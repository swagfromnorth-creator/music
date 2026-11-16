import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_MAX_CACHE_BYTES } from "./config.ts";
import type { DemoSeedPayload } from "./demo.ts";
import { detectHost, isPlayableHost } from "./resolver.ts";
import {
  curateAndDeduplicateTracks,
  extractSongIdentity,
  isNonSongTab,
  isNonSongTrack,
  isUnavailableSong,
} from "./song-identity.ts";
import { lookupArtCover } from "./tracker.ts";
import type {
  ActivityRecord,
  AudioHeaderInfo,
  ByteRange,
  CacheEntry,
  EraFacet,
  HostKind,
  PlayHistoryItem,
  PlaylistDetail,
  PlaylistRecord,
  RecentSearchRecord,
  SearchParams,
  SearchResult,
  TrackerRecord,
  TrackerTabMeta,
  TrackLink,
  TrackRecord,
  UserProfile,
} from "./types.ts";

type Row = Record<string, unknown>;

const DEFAULT_PROFILE: UserProfile = {
  name: "Listener",
  handle: "@vaultstream",
  bio: "Lossless archive collector & studio session curator.",
  avatarPreset: "violet",
  avatarUrl: null,
  accentColor: "#7c4dff",
};

export function buildFtsMatchQuery(input: string): { ftsQuery: string | null; fallbackLike: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { ftsQuery: null, fallbackLike: null };

  const tokens = trimmed.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) {
    return { ftsQuery: null, fallbackLike: `%${trimmed}%` };
  }

  const ftsQuery = tokens.map((tok) => `"${tok}"*`).join(" ");
  return { ftsQuery, fallbackLike: null };
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class AppDatabase {
  public readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trackers (
        tracker_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artist_name TEXT NOT NULL,
        current_tab TEXT NOT NULL,
        tabs_json TEXT NOT NULL DEFAULT '[]',
        synced_tabs_json TEXT NOT NULL DEFAULT '[]',
        track_count INTEGER NOT NULL DEFAULT 0,
        playable_count INTEGER NOT NULL DEFAULT 0,
        credits TEXT,
        last_synced_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        tracker_id TEXT NOT NULL,
        tab_name TEXT NOT NULL,
        title TEXT NOT NULL,
        raw_name TEXT NOT NULL,
        credits TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL,
        era TEXT NOT NULL,
        sub_era TEXT NOT NULL DEFAULT 'Default',
        era_order INTEGER NOT NULL DEFAULT 0,
        track_order INTEGER NOT NULL DEFAULT 0,
        era_color TEXT,
        era_text_color TEXT,
        era_image TEXT,
        notes TEXT NOT NULL DEFAULT '',
        quality TEXT NOT NULL DEFAULT '',
        format_hint TEXT,
        track_length TEXT,
        available_length TEXT,
        leak_date TEXT,
        file_date TEXT,
        track_type TEXT,
        primary_url TEXT,
        primary_host TEXT NOT NULL DEFAULT 'unknown',
        links_json TEXT NOT NULL DEFAULT '[]',
        resolved_url TEXT,
        resolved_mime TEXT,
        resolved_size INTEGER,
        resolved_filename TEXT,
        resolved_at INTEGER,
        is_playable INTEGER NOT NULL DEFAULT 0,
        audio_meta_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_tracker_tab_order
        ON tracks(tracker_id, tab_name, era_order, track_order);
      CREATE INDEX IF NOT EXISTS idx_tracks_era ON tracks(tracker_id, era);
      CREATE INDEX IF NOT EXISTS idx_tracks_primary_url ON tracks(primary_url);

      CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
        title,
        credits,
        artist,
        era,
        sub_era,
        notes,
        quality,
        primary_host,
        content='tracks',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
        INSERT INTO tracks_fts(rowid, title, credits, artist, era, sub_era, notes, quality, primary_host)
        VALUES (new.rowid, new.title, new.credits, new.artist, new.era, new.sub_era, new.notes, new.quality, new.primary_host);
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
        INSERT INTO tracks_fts(tracks_fts, rowid, title, credits, artist, era, sub_era, notes, quality, primary_host)
        VALUES ('delete', old.rowid, old.title, old.credits, old.artist, old.era, old.sub_era, old.notes, old.quality, old.primary_host);
      END;

      CREATE TRIGGER IF NOT EXISTS tracks_au
      AFTER UPDATE OF title, credits, artist, era, sub_era, notes, quality, primary_host ON tracks BEGIN
        INSERT INTO tracks_fts(tracks_fts, rowid, title, credits, artist, era, sub_era, notes, quality, primary_host)
        VALUES ('delete', old.rowid, old.title, old.credits, old.artist, old.era, old.sub_era, old.notes, old.quality, old.primary_host);
        INSERT INTO tracks_fts(rowid, title, credits, artist, era, sub_era, notes, quality, primary_host)
        VALUES (new.rowid, new.title, new.credits, new.artist, new.era, new.sub_era, new.notes, new.quality, new.primary_host);
      END;

      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        track_id TEXT,
        source_url TEXT NOT NULL,
        resolved_url TEXT,
        file_path TEXT NOT NULL,
        mime_type TEXT,
        filename TEXT,
        total_bytes INTEGER,
        cached_bytes INTEGER NOT NULL DEFAULT 0,
        ranges_json TEXT NOT NULL DEFAULT '[]',
        is_complete INTEGER NOT NULL DEFAULT 0,
        audio_meta_json TEXT,
        last_accessed_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cache_lru ON cache_entries(last_accessed_at ASC);
      CREATE INDEX IF NOT EXISTS idx_cache_source_url ON cache_entries(source_url);
      CREATE INDEX IF NOT EXISTS idx_cache_track_id ON cache_entries(track_id);

      CREATE TABLE IF NOT EXISTS liked_tracks (
        track_id TEXT PRIMARY KEY,
        liked_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_liked_tracks_at ON liked_tracks(liked_at DESC);

      CREATE TABLE IF NOT EXISTS followed_trackers (
        tracker_id TEXT PRIMARY KEY,
        followed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cover_gradient TEXT NOT NULL DEFAULT '',
        cover_image TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id TEXT NOT NULL,
        track_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, track_id)
      );

      CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order
        ON playlist_tracks(playlist_id, position ASC, added_at ASC);

      CREATE TABLE IF NOT EXISTS play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        played_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at DESC);
      CREATE INDEX IF NOT EXISTS idx_play_history_track_id ON play_history(track_id);

      CREATE TABLE IF NOT EXISTS recent_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'query',
        item_id TEXT,
        subtitle TEXT,
        image_url TEXT,
        searched_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recent_searches_at ON recent_searches(searched_at DESC);

      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_activity_log_at ON activity_log(created_at DESC);
    `);

    const existingCap = this.getSetting("max_cache_bytes");
    if (!existingCap) {
      this.setSetting("max_cache_bytes", String(DEFAULT_MAX_CACHE_BYTES));
    }

    if (this.getSetting("curation_version") !== "v2") {
      this.cleanupLibraryCuration();
      this.setSetting("curation_version", "v2");
    }
  }

  public close(): void {
    this.db.close();
  }

  public getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row | undefined;
    return typeof row?.value === "string" ? row.value : null;
  }

  public setSetting(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(key, value);
  }

  public getMaxCacheBytes(): number {
    const raw = this.getSetting("max_cache_bytes");
    const parsed = raw ? Number(raw) : DEFAULT_MAX_CACHE_BYTES;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CACHE_BYTES;
  }

  public setMaxCacheBytes(bytes: number): number {
    const clamped = Math.max(1024 * 1024, Math.floor(bytes));
    this.setSetting("max_cache_bytes", String(clamped));
    return clamped;
  }

  // ---- User Profile ----

  public getUserProfile(): UserProfile {
    const raw = this.getSetting("user_profile");
    const parsed = safeJsonParse<Partial<UserProfile>>(raw, {});
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
    };
  }

  public updateUserProfile(patch: Partial<UserProfile>): UserProfile {
    const current = this.getUserProfile();
    const updated: UserProfile = {
      name: typeof patch.name === "string" && patch.name.trim() ? patch.name.trim().slice(0, 60) : current.name,
      handle:
        typeof patch.handle === "string" && patch.handle.trim()
          ? patch.handle.trim().slice(0, 40)
          : current.handle,
      bio: typeof patch.bio === "string" ? patch.bio.trim().slice(0, 200) : current.bio,
      avatarPreset:
        typeof patch.avatarPreset === "string" && patch.avatarPreset.trim()
          ? patch.avatarPreset.trim()
          : current.avatarPreset,
      avatarUrl: patch.avatarUrl !== undefined ? (patch.avatarUrl?.trim() || null) : current.avatarUrl,
      accentColor:
        typeof patch.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(patch.accentColor.trim())
          ? patch.accentColor.trim()
          : current.accentColor,
    };
    this.setSetting("user_profile", JSON.stringify(updated));
    return updated;
  }

  // ---- Trackers ----

  public upsertSyncedTracker(
    trackerMeta: Omit<TrackerRecord, "syncedTabs" | "lastSyncedAt">,
    tracks: TrackRecord[]
  ): TrackerRecord {
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existingRow = this.db
        .prepare("SELECT synced_tabs_json FROM trackers WHERE tracker_id = ?")
        .get(trackerMeta.trackerId) as Row | undefined;
      const syncedTabs = safeJsonParse<string[]>(existingRow?.synced_tabs_json, []).filter(
        (t) => !isNonSongTab(t)
      );
      if (!isNonSongTab(trackerMeta.currentTab) && !syncedTabs.includes(trackerMeta.currentTab)) {
        syncedTabs.push(trackerMeta.currentTab);
      }

      // Preserve previously resolved URLs & detected audio metadata across re-syncs
      const preservedRows = this.db
        .prepare(
          `SELECT id, resolved_url, resolved_mime, resolved_size, resolved_filename, resolved_at, audio_meta_json
           FROM tracks WHERE tracker_id = ?`
        )
        .all(trackerMeta.trackerId) as Row[];

      const preservedById = new Map<string, Row>();
      for (const r of preservedRows) {
        if (typeof r.id === "string") preservedById.set(r.id, r);
      }

      // Check existing tracks in other tabs of the same tracker to prevent cross-tab duplicates
      const otherTabRows = this.db
        .prepare(
          `SELECT id, tab_name, title, artist, credits, track_type, primary_url, links_json
           FROM tracks WHERE tracker_id = ? AND tab_name != ?`
        )
        .all(trackerMeta.trackerId, trackerMeta.currentTab) as Row[];

      const existingByIdentity = new Map<string, { id: string; links: TrackLink[] }>();
      const existingByUrl = new Map<string, { id: string; links: TrackLink[] }>();
      for (const r of otherTabRows) {
        const entry = {
          id: String(r.id),
          links: safeJsonParse<TrackLink[]>(r.links_json, []),
        };
        const ident = extractSongIdentity({
          title: String(r.title ?? ""),
          artist: String(r.artist ?? ""),
          credits: typeof r.credits === "string" ? r.credits : "",
          trackType: typeof r.track_type === "string" ? r.track_type : null,
        });
        existingByIdentity.set(ident.canonicalKey, entry);
        if (typeof r.primary_url === "string" && r.primary_url) {
          existingByUrl.set(r.primary_url, entry);
        }
      }

      this.db
        .prepare("DELETE FROM tracks WHERE tracker_id = ? AND tab_name = ?")
        .run(trackerMeta.trackerId, trackerMeta.currentTab);

      const curatedIncoming = curateAndDeduplicateTracks(tracks);
      const insertTrack = this.db.prepare(`
        INSERT INTO tracks (
          id, tracker_id, tab_name, title, raw_name, credits, artist,
          era, sub_era, era_order, track_order, era_color, era_text_color, era_image,
          notes, quality, format_hint, track_length, available_length, leak_date, file_date, track_type,
          primary_url, primary_host, links_json,
          resolved_url, resolved_mime, resolved_size, resolved_filename, resolved_at,
          is_playable, audio_meta_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
        ON CONFLICT(id) DO UPDATE SET
          tab_name = excluded.tab_name,
          title = excluded.title,
          raw_name = excluded.raw_name,
          credits = excluded.credits,
          artist = excluded.artist,
          era = excluded.era,
          era_image = COALESCE(excluded.era_image, tracks.era_image),
          notes = excluded.notes,
          quality = excluded.quality,
          format_hint = excluded.format_hint,
          primary_url = excluded.primary_url,
          primary_host = excluded.primary_host,
          links_json = excluded.links_json,
          is_playable = excluded.is_playable
      `);

      const updateExistingLinks = this.db.prepare("UPDATE tracks SET links_json = ? WHERE id = ?");

      for (const tr of curatedIncoming) {
        const ident = extractSongIdentity(tr);
        const crossTabMatch =
          existingByIdentity.get(ident.canonicalKey) ??
          (tr.primaryUrl ? existingByUrl.get(tr.primaryUrl) : undefined);

        if (crossTabMatch) {
          // Merge any extra mirror URLs into the already-synced song without duplicating it
          const seenUrls = new Set(crossTabMatch.links.map((l) => l.url));
          let changed = false;
          for (const l of tr.links) {
            if (!seenUrls.has(l.url)) {
              seenUrls.add(l.url);
              crossTabMatch.links.push(l);
              changed = true;
            }
          }
          if (changed) {
            updateExistingLinks.run(JSON.stringify(crossTabMatch.links), crossTabMatch.id);
          }
          continue;
        }

        const prev = preservedById.get(tr.id);
        insertTrack.run(
          tr.id,
          tr.trackerId,
          tr.tabName,
          tr.title,
          tr.rawName,
          tr.credits,
          tr.artist,
          tr.era,
          tr.subEra,
          tr.eraOrder,
          tr.trackOrder,
          tr.eraColor,
          tr.eraTextColor,
          tr.eraImage,
          tr.notes,
          tr.quality,
          tr.formatHint,
          tr.trackLength,
          tr.availableLength,
          tr.leakDate,
          tr.fileDate,
          tr.trackType,
          tr.primaryUrl,
          tr.primaryHost,
          JSON.stringify(tr.links),
          (prev?.resolved_url as string | null) ?? tr.resolvedUrl,
          (prev?.resolved_mime as string | null) ?? tr.resolvedMime,
          (prev?.resolved_size as number | null) ?? tr.resolvedSize,
          (prev?.resolved_filename as string | null) ?? tr.resolvedFilename,
          (prev?.resolved_at as number | null) ?? tr.resolvedAt,
          tr.isPlayable ? 1 : 0,
          (prev?.audio_meta_json as string | null) ?? (tr.audioMeta ? JSON.stringify(tr.audioMeta) : null)
        );
      }

      const hasUnavailable = this.db
        .prepare("SELECT 1 FROM tracks WHERE tracker_id = ? AND tab_name = 'Unavailable' LIMIT 1")
        .get(trackerMeta.trackerId);

      const cleanTabs = trackerMeta.tabs.filter((t) => !isNonSongTab(t.name));
      if (hasUnavailable) {
        if (!cleanTabs.some((t) => t.name === "Unavailable")) {
          cleanTabs.push({ name: "Unavailable", slug: "unavailable", gid: "" });
        }
        if (!syncedTabs.includes("Unavailable")) {
          syncedTabs.push("Unavailable");
        }
      }

      const totals = this.db
        .prepare(
          `SELECT COUNT(*) AS total_count, COALESCE(SUM(is_playable), 0) AS playable_count
           FROM tracks WHERE tracker_id = ? AND tab_name != 'Unavailable' AND is_playable = 1`
        )
        .get(trackerMeta.trackerId) as Row;

      const totalCount = Number(totals.total_count ?? 0);
      const playableCount = Number(totals.playable_count ?? 0);
      const currentTab = isNonSongTab(trackerMeta.currentTab)
        ? (cleanTabs[0]?.name ?? "Unreleased")
        : trackerMeta.currentTab;

      this.db
        .prepare(
          `INSERT INTO trackers (
            tracker_id, name, artist_name, current_tab, tabs_json, synced_tabs_json,
            track_count, playable_count, credits, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tracker_id) DO UPDATE SET
            name = excluded.name,
            artist_name = excluded.artist_name,
            current_tab = excluded.current_tab,
            tabs_json = excluded.tabs_json,
            synced_tabs_json = excluded.synced_tabs_json,
            track_count = excluded.track_count,
            playable_count = excluded.playable_count,
            credits = COALESCE(excluded.credits, trackers.credits),
            last_synced_at = excluded.last_synced_at`
        )
        .run(
          trackerMeta.trackerId,
          trackerMeta.name,
          trackerMeta.artistName,
          currentTab,
          JSON.stringify(cleanTabs),
          JSON.stringify(syncedTabs),
          totalCount,
          playableCount,
          trackerMeta.credits,
          now
        );

      this.db.exec("COMMIT");

      return {
        ...trackerMeta,
        currentTab,
        tabs: cleanTabs,
        syncedTabs,
        trackCount: totalCount,
        playableCount,
        lastSyncedAt: now,
      };
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public updateTrackerEraImages(trackerId: string, covers: Map<string, string>): number {
    if (covers.size === 0) return 0;
    const rows = this.db
      .prepare("SELECT DISTINCT era FROM tracks WHERE tracker_id = ?")
      .all(trackerId) as Row[];

    let updated = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const stmt = this.db.prepare(
        "UPDATE tracks SET era_image = ? WHERE tracker_id = ? AND era = ?"
      );
      for (const r of rows) {
        const eraName = typeof r.era === "string" ? r.era : "";
        const cover = lookupArtCover(covers, eraName);
        if (cover) {
          const info = stmt.run(cover, trackerId, eraName);
          updated += Number(info.changes ?? 0);
        }
      }
      this.db.exec("COMMIT");
      return updated;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public listTrackers(): TrackerRecord[] {
    const rows = this.db
      .prepare(
        `SELECT tr.*,
                CASE WHEN ft.tracker_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed,
                (SELECT era_image FROM tracks WHERE tracker_id = tr.tracker_id AND era_image IS NOT NULL AND era_image != '' ORDER BY era_order ASC, track_order ASC LIMIT 1) AS cover_image
         FROM trackers tr
         LEFT JOIN followed_trackers ft ON ft.tracker_id = tr.tracker_id
         ORDER BY tr.last_synced_at DESC`
      )
      .all() as Row[];
    return rows.map((r) => this.mapTrackerRow(r));
  }

  public getTracker(trackerId: string): TrackerRecord | null {
    const row = this.db
      .prepare(
        `SELECT tr.*,
                CASE WHEN ft.tracker_id IS NOT NULL THEN 1 ELSE 0 END AS is_followed,
                (SELECT era_image FROM tracks WHERE tracker_id = tr.tracker_id AND era_image IS NOT NULL AND era_image != '' ORDER BY era_order ASC, track_order ASC LIMIT 1) AS cover_image
         FROM trackers tr
         LEFT JOIN followed_trackers ft ON ft.tracker_id = tr.tracker_id
         WHERE tr.tracker_id = ?`
      )
      .get(trackerId) as Row | undefined;
    return row ? this.mapTrackerRow(row) : null;
  }

  public deleteTracker(trackerId: string): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM playlist_tracks WHERE track_id IN (SELECT id FROM tracks WHERE tracker_id = ?)")
        .run(trackerId);
      this.db
        .prepare("DELETE FROM liked_tracks WHERE track_id IN (SELECT id FROM tracks WHERE tracker_id = ?)")
        .run(trackerId);
      this.db
        .prepare("DELETE FROM play_history WHERE track_id IN (SELECT id FROM tracks WHERE tracker_id = ?)")
        .run(trackerId);
      this.db.prepare("DELETE FROM followed_trackers WHERE tracker_id = ?").run(trackerId);
      this.db.prepare("DELETE FROM tracks WHERE tracker_id = ?").run(trackerId);
      this.db.prepare("DELETE FROM trackers WHERE tracker_id = ?").run(trackerId);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public toggleFollowTracker(trackerId: string, desired?: boolean): boolean {
    const existing = this.db
      .prepare("SELECT tracker_id FROM followed_trackers WHERE tracker_id = ?")
      .get(trackerId) as Row | undefined;
    const next = desired !== undefined ? desired : !existing;
    if (next) {
      this.db
        .prepare(
          "INSERT INTO followed_trackers(tracker_id, followed_at) VALUES (?, ?) ON CONFLICT(tracker_id) DO NOTHING"
        )
        .run(trackerId, Date.now());
    } else {
      this.db.prepare("DELETE FROM followed_trackers WHERE tracker_id = ?").run(trackerId);
    }
    return next;
  }

  public getFollowedTrackerIds(): string[] {
    const rows = this.db
      .prepare("SELECT tracker_id FROM followed_trackers ORDER BY followed_at DESC")
      .all() as Row[];
    return rows.map((r) => String(r.tracker_id));
  }

  // ---- Tracks ----

  private trackSelectColumns(): string {
    return `t.*,
      ce.cache_key AS ce_cache_key,
      ce.cached_bytes AS ce_cached_bytes,
      ce.total_bytes AS ce_total_bytes,
      ce.is_complete AS ce_is_complete,
      ce.last_accessed_at AS ce_last_accessed_at,
      CASE WHEN lt.track_id IS NOT NULL THEN 1 ELSE 0 END AS is_liked,
      COALESCE((SELECT COUNT(*) FROM play_history ph WHERE ph.track_id = t.id), 0) AS play_count`;
  }

  public getTrackById(id: string): TrackRecord | null {
    const row = this.db
      .prepare(
        `SELECT ${this.trackSelectColumns()}
         FROM tracks t
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         LEFT JOIN liked_tracks lt ON lt.track_id = t.id
         WHERE t.id = ?`
      )
      .get(id) as Row | undefined;
    return row ? this.mapTrackRow(row) : null;
  }

  public updateTrackResolution(
    id: string,
    patch: {
      resolvedUrl?: string | null;
      resolvedMime?: string | null;
      resolvedSize?: number | null;
      resolvedFilename?: string | null;
      audioMeta?: AudioHeaderInfo | null;
    }
  ): void {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (patch.resolvedUrl !== undefined) {
      sets.push("resolved_url = ?", "resolved_at = ?");
      params.push(patch.resolvedUrl, Date.now());
    }
    if (patch.resolvedMime !== undefined) {
      sets.push("resolved_mime = ?");
      params.push(patch.resolvedMime);
    }
    if (patch.resolvedSize !== undefined) {
      sets.push("resolved_size = ?");
      params.push(patch.resolvedSize);
    }
    if (patch.resolvedFilename !== undefined) {
      sets.push("resolved_filename = ?");
      params.push(patch.resolvedFilename);
    }
    if (patch.audioMeta !== undefined) {
      sets.push("audio_meta_json = ?");
      params.push(patch.audioMeta ? JSON.stringify(patch.audioMeta) : null);
    }

    if (sets.length === 0) return;
    params.push(id);
    this.db.prepare(`UPDATE tracks SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  public upsertImportedTrack(
    trackerMeta: {
      trackerId: string;
      name: string;
      artistName: string;
      tabName?: string;
      credits?: string | null;
    },
    track: TrackRecord
  ): TrackRecord {
    const now = Date.now();
    const tabName = trackerMeta.tabName?.trim() || track.tabName || "Imported";
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const incomingIdent = extractSongIdentity(track);
      const existingCandidates = this.db
        .prepare(
          `SELECT id, tab_name, title, artist, credits, track_type, primary_url, links_json
           FROM tracks WHERE primary_url = ? OR LOWER(artist) = LOWER(?)`
        )
        .all(track.primaryUrl ?? "", track.artist) as Row[];

      const duplicateMatch = existingCandidates.find((r) => {
        if (String(r.id) === track.id) return false;
        if (track.primaryUrl && String(r.primary_url ?? "") === track.primaryUrl) return true;
        const rIdent = extractSongIdentity({
          title: String(r.title ?? ""),
          artist: String(r.artist ?? ""),
          credits: typeof r.credits === "string" ? r.credits : "",
          trackType: typeof r.track_type === "string" ? r.track_type : null,
        });
        return rIdent.canonicalKey === incomingIdent.canonicalKey;
      });

      if (duplicateMatch) {
        const existingId = String(duplicateMatch.id);
        const existingLinks = safeJsonParse<TrackLink[]>(duplicateMatch.links_json, []);
        const seenUrls = new Set(existingLinks.map((l) => l.url));
        let changed = false;
        for (const l of track.links) {
          if (!seenUrls.has(l.url)) {
            seenUrls.add(l.url);
            existingLinks.push(l);
            changed = true;
          }
        }
        if (changed) {
          this.db
            .prepare("UPDATE tracks SET links_json = ? WHERE id = ?")
            .run(JSON.stringify(existingLinks), existingId);
        }
        this.db.exec("COMMIT");
        return this.getTrackById(existingId) ?? track;
      }

      const existingTracker = this.db
        .prepare("SELECT tabs_json, synced_tabs_json, current_tab FROM trackers WHERE tracker_id = ?")
        .get(trackerMeta.trackerId) as Row | undefined;

      const existingTabs = existingTracker
        ? safeJsonParse<TrackerTabMeta[]>(existingTracker.tabs_json, [])
        : [];
      const tabSlug = tabName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const tabs: TrackerTabMeta[] = existingTabs.some((t) => t.name === tabName)
        ? existingTabs
        : [...existingTabs, { name: tabName, slug: tabSlug || "imported", gid: "" }];
      const syncedTabs = existingTracker
        ? Array.from(new Set([...safeJsonParse<string[]>(existingTracker.synced_tabs_json, []), tabName]))
        : [tabName];

      this.db
        .prepare(
          `INSERT INTO trackers (
            tracker_id, name, artist_name, current_tab, tabs_json, synced_tabs_json,
            track_count, playable_count, credits, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
          ON CONFLICT(tracker_id) DO UPDATE SET
            tabs_json = excluded.tabs_json,
            synced_tabs_json = excluded.synced_tabs_json,
            last_synced_at = excluded.last_synced_at`
        )
        .run(
          trackerMeta.trackerId,
          trackerMeta.name,
          trackerMeta.artistName,
          String(existingTracker?.current_tab ?? tabName),
          JSON.stringify(tabs),
          JSON.stringify(syncedTabs),
          trackerMeta.credits ?? null,
          now
        );

      this.db
        .prepare(
          `INSERT INTO tracks (
            id, tracker_id, tab_name, title, raw_name, credits, artist,
            era, sub_era, era_order, track_order, era_color, era_text_color, era_image,
            notes, quality, format_hint, track_length, available_length, leak_date, file_date, track_type,
            primary_url, primary_host, links_json,
            resolved_url, resolved_mime, resolved_size, resolved_filename, resolved_at,
            is_playable, audio_meta_json
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
          )
          ON CONFLICT(id) DO UPDATE SET
            tab_name = excluded.tab_name,
            title = excluded.title,
            raw_name = excluded.raw_name,
            credits = COALESCE(excluded.credits, tracks.credits),
            artist = excluded.artist,
            era = excluded.era,
            era_image = COALESCE(excluded.era_image, tracks.era_image),
            notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE tracks.notes END,
            quality = CASE WHEN excluded.quality != '' THEN excluded.quality ELSE tracks.quality END,
            format_hint = COALESCE(excluded.format_hint, tracks.format_hint),
            track_length = COALESCE(excluded.track_length, tracks.track_length),
            leak_date = COALESCE(excluded.leak_date, tracks.leak_date),
            primary_url = excluded.primary_url,
            primary_host = excluded.primary_host,
            links_json = excluded.links_json,
            resolved_url = COALESCE(excluded.resolved_url, tracks.resolved_url),
            resolved_mime = COALESCE(excluded.resolved_mime, tracks.resolved_mime),
            resolved_size = COALESCE(excluded.resolved_size, tracks.resolved_size),
            resolved_filename = COALESCE(excluded.resolved_filename, tracks.resolved_filename),
            resolved_at = COALESCE(excluded.resolved_at, tracks.resolved_at),
            is_playable = excluded.is_playable,
            audio_meta_json = COALESCE(excluded.audio_meta_json, tracks.audio_meta_json)`
        )
        .run(
          track.id,
          trackerMeta.trackerId,
          tabName,
          track.title,
          track.rawName,
          track.credits,
          track.artist,
          track.era,
          track.subEra,
          track.eraOrder,
          track.trackOrder,
          track.eraColor,
          track.eraTextColor,
          track.eraImage,
          track.notes,
          track.quality,
          track.formatHint,
          track.trackLength,
          track.availableLength,
          track.leakDate,
          track.fileDate,
          track.trackType,
          track.primaryUrl,
          track.primaryHost,
          JSON.stringify(track.links),
          track.resolvedUrl,
          track.resolvedMime,
          track.resolvedSize,
          track.resolvedFilename,
          track.resolvedAt,
          track.isPlayable ? 1 : 0,
          track.audioMeta ? JSON.stringify(track.audioMeta) : null
        );

      const totals = this.db
        .prepare(
          `SELECT COUNT(*) AS total_count, COALESCE(SUM(is_playable), 0) AS playable_count
           FROM tracks WHERE tracker_id = ? AND tab_name != 'Unavailable' AND is_playable = 1`
        )
        .get(trackerMeta.trackerId) as Row;

      this.db
        .prepare("UPDATE trackers SET track_count = ?, playable_count = ?, last_synced_at = ? WHERE tracker_id = ?")
        .run(
          Number(totals.total_count ?? 1),
          Number(totals.playable_count ?? (track.isPlayable ? 1 : 0)),
          now,
          trackerMeta.trackerId
        );

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    return this.getTrackById(track.id) ?? track;
  }

  public updateTrackMetadata(
    id: string,
    patch: {
      title?: string;
      artist?: string;
      era?: string;
      eraImage?: string | null;
      notes?: string;
      leakDate?: string | null;
      trackLength?: string | null;
      quality?: string;
      formatHint?: string | null;
    }
  ): TrackRecord | null {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (patch.title !== undefined && patch.title.trim()) {
      sets.push("title = ?");
      params.push(patch.title.trim());
    }
    if (patch.artist !== undefined && patch.artist.trim()) {
      sets.push("artist = ?");
      params.push(patch.artist.trim());
    }
    if (patch.era !== undefined) {
      sets.push("era = ?");
      params.push(patch.era.trim() || "Unknown");
    }
    if (patch.eraImage !== undefined) {
      sets.push("era_image = ?");
      params.push(patch.eraImage);
    }
    if (patch.notes !== undefined) {
      sets.push("notes = ?");
      params.push(patch.notes);
    }
    if (patch.leakDate !== undefined) {
      sets.push("leak_date = ?");
      params.push(patch.leakDate);
    }
    if (patch.trackLength !== undefined) {
      sets.push("track_length = ?");
      params.push(patch.trackLength);
    }
    if (patch.quality !== undefined) {
      sets.push("quality = ?");
      params.push(patch.quality);
    }
    if (patch.formatHint !== undefined) {
      sets.push("format_hint = ?");
      params.push(patch.formatHint);
    }

    if (sets.length > 0) {
      params.push(id);
      this.db.prepare(`UPDATE tracks SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.getTrackById(id);
  }

  public searchTracks(params: SearchParams): SearchResult {
    const started = performance.now();
    const limit = Math.min(Math.max(1, params.limit ?? 150), 500);
    const offset = Math.max(0, params.offset ?? 0);

    const baseWhere: string[] = [];
    const baseParams: Array<string | number> = [];

    if (params.trackerId) {
      baseWhere.push("t.tracker_id = ?");
      baseParams.push(params.trackerId);
    }
    if (params.tabName) {
      baseWhere.push("t.tab_name = ?");
      baseParams.push(params.tabName);
    } else {
      baseWhere.push("t.tab_name != 'Unavailable'");
    }

    const filterWhere = [...baseWhere];
    const filterParams = [...baseParams];

    if (params.era) {
      filterWhere.push("t.era = ?");
      filterParams.push(params.era);
    }
    if (params.host) {
      filterWhere.push("t.primary_host = ?");
      filterParams.push(params.host);
    }
    if (params.quality) {
      filterWhere.push("t.quality = ?");
      filterParams.push(params.quality);
    }
    if (params.losslessOnly) {
      filterWhere.push(
        `(LOWER(t.quality) LIKE '%lossless%' OR LOWER(t.quality) LIKE '%cdq%' OR LOWER(t.quality) LIKE '%cd quality%' OR LOWER(COALESCE(t.format_hint, '')) IN ('flac','wav','alac','aiff','lossless') OR LOWER(COALESCE(t.audio_meta_json, '')) LIKE '%"lossless":true%')`
      );
    }
    if (params.playableOnly) {
      filterWhere.push("t.is_playable = 1");
    }
    if (params.cachedOnly) {
      filterWhere.push("ce.cached_bytes > 0");
    }

    const { ftsQuery, fallbackLike } = buildFtsMatchQuery(params.q ?? "");
    let ftsJoin = "";
    let orderBy = "t.era_order ASC, t.track_order ASC";

    if (ftsQuery) {
      ftsJoin = "INNER JOIN tracks_fts ON tracks_fts.rowid = t.rowid";
      filterWhere.push("tracks_fts MATCH ?");
      filterParams.push(ftsQuery);
      orderBy = "bm25(tracks_fts, 10.0, 4.0, 3.0, 5.0, 2.0, 1.5, 2.0, 1.0) ASC, t.era_order ASC, t.track_order ASC";
    } else if (fallbackLike) {
      filterWhere.push("(t.title LIKE ? OR t.notes LIKE ? OR t.era LIKE ?)");
      filterParams.push(fallbackLike, fallbackLike, fallbackLike);
    }

    const whereClause = filterWhere.length > 0 ? `WHERE ${filterWhere.join(" AND ")}` : "";
    const countRow = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM tracks t
         ${ftsJoin}
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         ${whereClause}`
      )
      .get(...filterParams) as Row;

    const rows = this.db
      .prepare(
        `SELECT ${this.trackSelectColumns()}
         FROM tracks t
         ${ftsJoin}
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         LEFT JOIN liked_tracks lt ON lt.track_id = t.id
         ${whereClause}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(...filterParams, limit, offset) as Row[];

    const facetWhere = baseWhere.length > 0 ? `WHERE ${baseWhere.join(" AND ")}` : "";

    const eraRows = this.db
      .prepare(
        `SELECT t.era,
                COUNT(*) AS cnt,
                MAX(t.era_color) AS era_color,
                MAX(NULLIF(t.era_image, '')) AS era_image,
                MIN(t.era_order) AS ord
         FROM tracks t
         ${facetWhere}
         GROUP BY t.era
         ORDER BY ord ASC`
      )
      .all(...baseParams) as Row[];

    const hostRows = this.db
      .prepare(
        `SELECT t.primary_host AS host, COUNT(*) AS cnt
         FROM tracks t
         ${facetWhere}
         GROUP BY t.primary_host
         ORDER BY cnt DESC`
      )
      .all(...baseParams) as Row[];

    const qualityRows = this.db
      .prepare(
        `SELECT t.quality, COUNT(*) AS cnt
         FROM tracks t
         ${facetWhere ? `${facetWhere} AND` : "WHERE"} t.quality != ''
         GROUP BY t.quality
         ORDER BY cnt DESC`
      )
      .all(...baseParams) as Row[];

    const eras: EraFacet[] = eraRows.map((r) => ({
      era: String(r.era ?? ""),
      count: Number(r.cnt ?? 0),
      eraColor: typeof r.era_color === "string" ? r.era_color : null,
      eraImage: typeof r.era_image === "string" ? r.era_image : null,
    }));

    const hosts = hostRows.map((r) => ({
      host: String(r.host ?? "unknown"),
      count: Number(r.cnt ?? 0),
    }));

    const qualities = qualityRows.map((r) => ({
      quality: String(r.quality ?? ""),
      count: Number(r.cnt ?? 0),
    }));

    const queryMs = Math.round((performance.now() - started) * 100) / 100;

    return {
      tracks: rows.map((r) => this.mapTrackRow(r)),
      total: Number(countRow.cnt ?? 0),
      queryMs,
      eras,
      hosts,
      qualities,
    };
  }

  // ---- Liked Tracks ----

  public toggleLikeTrack(trackId: string, desired?: boolean): boolean {
    const existing = this.db
      .prepare("SELECT track_id FROM liked_tracks WHERE track_id = ?")
      .get(trackId) as Row | undefined;
    const next = desired !== undefined ? desired : !existing;
    if (next) {
      this.db
        .prepare("INSERT INTO liked_tracks(track_id, liked_at) VALUES (?, ?) ON CONFLICT(track_id) DO NOTHING")
        .run(trackId, Date.now());
    } else {
      this.db.prepare("DELETE FROM liked_tracks WHERE track_id = ?").run(trackId);
    }
    return next;
  }

  public getLikedTrackIds(): string[] {
    const rows = this.db.prepare("SELECT track_id FROM liked_tracks ORDER BY liked_at DESC").all() as Row[];
    return rows.map((r) => String(r.track_id));
  }

  public listLikedTracks(): TrackRecord[] {
    const rows = this.db
      .prepare(
        `SELECT ${this.trackSelectColumns()}
         FROM liked_tracks lt
         INNER JOIN tracks t ON t.id = lt.track_id
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         ORDER BY lt.liked_at DESC`
      )
      .all() as Row[];
    return rows.map((r) => this.mapTrackRow(r));
  }

  // ---- Playlists ----

  public listPlaylists(): PlaylistRecord[] {
    const rows = this.db
      .prepare(
        `SELECT p.*,
                (SELECT COUNT(*) FROM playlist_tracks pt INNER JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id) AS track_count
         FROM playlists p
         ORDER BY p.updated_at DESC, p.created_at DESC`
      )
      .all() as Row[];

    return rows.map((r) => {
      const id = String(r.id);
      const previewRows = this.db
        .prepare(
          `SELECT DISTINCT t.era_image
           FROM playlist_tracks pt
           INNER JOIN tracks t ON t.id = pt.track_id
           WHERE pt.playlist_id = ? AND t.era_image IS NOT NULL AND t.era_image != ''
           ORDER BY pt.position ASC, pt.added_at ASC
           LIMIT 4`
        )
        .all(id) as Row[];

      return {
        id,
        name: String(r.name),
        description: String(r.description ?? ""),
        coverGradient: String(r.cover_gradient ?? ""),
        coverImage: typeof r.cover_image === "string" ? r.cover_image : null,
        trackCount: Number(r.track_count ?? 0),
        previewImages: previewRows.map((pr) => String(pr.era_image)),
        createdAt: Number(r.created_at ?? 0),
        updatedAt: Number(r.updated_at ?? 0),
      };
    });
  }

  public getPlaylistDetail(playlistId: string): PlaylistDetail | null {
    const playlist = this.listPlaylists().find((p) => p.id === playlistId);
    if (!playlist) return null;

    const rows = this.db
      .prepare(
        `SELECT ${this.trackSelectColumns()}
         FROM playlist_tracks pt
         INNER JOIN tracks t ON t.id = pt.track_id
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         LEFT JOIN liked_tracks lt ON lt.track_id = t.id
         WHERE pt.playlist_id = ?
         ORDER BY pt.position ASC, pt.added_at ASC`
      )
      .all(playlistId) as Row[];

    return {
      ...playlist,
      tracks: rows.map((r) => this.mapTrackRow(r)),
    };
  }

  public createPlaylist(input: {
    name: string;
    description?: string;
    coverGradient?: string;
    coverImage?: string | null;
  }): PlaylistRecord {
    const id = `pl_${crypto.randomBytes(8).toString("hex")}`;
    const now = Date.now();
    const gradients = [
      "linear-gradient(135deg, #7c4dff, #ec4899)",
      "linear-gradient(135deg, #2563eb, #06b6d4)",
      "linear-gradient(135deg, #be123c, #581c87)",
      "linear-gradient(135deg, #059669, #0284c7)",
      "linear-gradient(135deg, #d97706, #dc2626)",
    ];
    const gradient =
      input.coverGradient?.trim() || gradients[Math.floor(Math.random() * gradients.length)]!;

    this.db
      .prepare(
        `INSERT INTO playlists(id, name, description, cover_gradient, cover_image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim().slice(0, 100),
        (input.description ?? "").trim().slice(0, 300),
        gradient,
        input.coverImage ?? null,
        now,
        now
      );

    return {
      id,
      name: input.name.trim().slice(0, 100),
      description: (input.description ?? "").trim().slice(0, 300),
      coverGradient: gradient,
      coverImage: input.coverImage ?? null,
      trackCount: 0,
      previewImages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  public updatePlaylist(
    playlistId: string,
    patch: { name?: string; description?: string; coverGradient?: string; coverImage?: string | null }
  ): PlaylistRecord | null {
    const existing = this.listPlaylists().find((p) => p.id === playlistId);
    if (!existing) return null;

    const name = patch.name !== undefined && patch.name.trim() ? patch.name.trim().slice(0, 100) : existing.name;
    const description =
      patch.description !== undefined ? patch.description.trim().slice(0, 300) : existing.description;
    const coverGradient =
      patch.coverGradient !== undefined ? patch.coverGradient.trim() : existing.coverGradient;
    const coverImage = patch.coverImage !== undefined ? patch.coverImage : existing.coverImage;
    const now = Date.now();

    this.db
      .prepare(
        `UPDATE playlists SET name = ?, description = ?, cover_gradient = ?, cover_image = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(name, description, coverGradient, coverImage, now, playlistId);

    return this.listPlaylists().find((p) => p.id === playlistId) ?? null;
  }

  public deletePlaylist(playlistId: string): boolean {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(playlistId);
      const info = this.db.prepare("DELETE FROM playlists WHERE id = ?").run(playlistId);
      this.db.exec("COMMIT");
      return Number(info.changes ?? 0) > 0;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public addTrackToPlaylist(playlistId: string, trackId: string): boolean {
    const candidate = this.getTrackById(trackId);
    if (!candidate) return false;

    const candidateIdent = extractSongIdentity(candidate);
    const existingRows = this.db
      .prepare(
        `SELECT t.id, t.title, t.artist, t.credits, t.track_type, t.primary_url
         FROM playlist_tracks pt
         INNER JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ?`
      )
      .all(playlistId) as Row[];

    for (const row of existingRows) {
      if (String(row.id) === trackId) return false;
      if (candidate.primaryUrl && String(row.primary_url ?? "") === candidate.primaryUrl) {
        return false;
      }
      const existingIdent = extractSongIdentity({
        title: String(row.title ?? ""),
        artist: String(row.artist ?? ""),
        credits: typeof row.credits === "string" ? row.credits : "",
        trackType: typeof row.track_type === "string" ? row.track_type : null,
      });
      if (existingIdent.canonicalKey === candidateIdent.canonicalKey) {
        return false;
      }
    }

    const maxRow = this.db
      .prepare("SELECT COALESCE(MAX(position), -1) AS max_pos FROM playlist_tracks WHERE playlist_id = ?")
      .get(playlistId) as Row;
    const nextPos = Number(maxRow.max_pos ?? -1) + 1;
    const now = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO playlist_tracks(playlist_id, track_id, position, added_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(playlist_id, track_id) DO NOTHING`
      )
      .run(playlistId, trackId, nextPos, now);
    this.db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(now, playlistId);
    return Number(info.changes ?? 0) > 0;
  }

  public cleanupLibraryCuration(): {
    removedTracks: number;
    movedToUnavailable: number;
    mergedDuplicates: number;
  } {
    const allRows = this.db.prepare("SELECT * FROM tracks ORDER BY era_order ASC, track_order ASC").all() as Row[];
    if (allRows.length === 0) {
      return { removedTracks: 0, movedToUnavailable: 0, mergedDuplicates: 0 };
    }

    let removedTracks = 0;
    let movedToUnavailable = 0;
    let mergedDuplicates = 0;

    this.db.exec("BEGIN IMMEDIATE");
    try {
      const survivorsByKey = new Map<string, { id: string; links: TrackLink[]; unavailable: boolean; quality: string }>();
      const urlToSurvivor = new Map<string, string>();
      const deleteIds: string[] = [];
      const moveUnavailableIds: string[] = [];
      const linkUpdates = new Map<string, TrackLink[]>();
      const playableUpdates: Array<{ id: string; host: string; links: TrackLink[] }> = [];

      const migrateRefs = (fromId: string, toId: string) => {
        this.db.prepare("UPDATE OR IGNORE liked_tracks SET track_id = ? WHERE track_id = ?").run(toId, fromId);
        this.db.prepare("DELETE FROM liked_tracks WHERE track_id = ?").run(fromId);
        this.db.prepare("UPDATE OR IGNORE playlist_tracks SET track_id = ? WHERE track_id = ?").run(toId, fromId);
        this.db.prepare("DELETE FROM playlist_tracks WHERE track_id = ?").run(fromId);
        this.db.prepare("UPDATE play_history SET track_id = ? WHERE track_id = ?").run(toId, fromId);
      };

      for (const r of allRows) {
        const id = String(r.id);
        const trackerId = String(r.tracker_id);
        const tabName = String(r.tab_name);
        const title = String(r.title ?? "");
        const artist = String(r.artist ?? "");
        const credits = String(r.credits ?? "");
        const trackType = typeof r.track_type === "string" ? r.track_type : null;
        const quality = String(r.quality ?? "");
        const primaryUrl = typeof r.primary_url === "string" ? r.primary_url : null;
        let links = safeJsonParse<TrackLink[]>(r.links_json, []);

        // Re-evaluate playability against current hosts (except skip non-songs cleanly)
        let isPlayable = Number(r.is_playable ?? 0) === 1;
        if (!isPlayable && links.length > 0) {
          links = links.map((l) => {
            const h = detectHost(l.url);
            return { ...l, host: h, playable: isPlayableHost(h) };
          });
          isPlayable = links.some((l) => l.playable);
          if (isPlayable) {
            const best = links.find((l) => l.playable) ?? links[0];
            playableUpdates.push({ id, host: best?.host ?? "unknown", links });
          }
        }

        if (!isPlayable || isNonSongTrack({ tabName, title, trackType, quality, primaryUrl, isPlayable })) {
          deleteIds.push(id);
          removedTracks++;
          continue;
        }

        const unavailable = isUnavailableSong({ quality, trackType, isPlayable });
        if (unavailable && tabName !== "Unavailable") {
          moveUnavailableIds.push(id);
          movedToUnavailable++;
        }

        const ident = extractSongIdentity({ title, artist, credits, trackType });
        const scopeGroup =
          trackerId === "imported_web" || trackerId === "spotify_imports" ? "imported" : trackerId;
        const key = `${scopeGroup}::${ident.canonicalKey}`;
        const existingKey =
          survivorsByKey.has(key)
            ? key
            : primaryUrl && urlToSurvivor.has(primaryUrl)
              ? urlToSurvivor.get(primaryUrl)!
              : null;

        if (existingKey) {
          const winner = survivorsByKey.get(existingKey)!;
          const seen = new Set(winner.links.map((l) => l.url));
          for (const l of links) {
            if (!seen.has(l.url)) {
              seen.add(l.url);
              winner.links.push(l);
              linkUpdates.set(winner.id, winner.links);
            }
          }
          migrateRefs(id, winner.id);
          deleteIds.push(id);
          mergedDuplicates++;
          continue;
        }

        const survivor = { id, links: [...links], unavailable, quality };
        survivorsByKey.set(key, survivor);
        if (primaryUrl) urlToSurvivor.set(primaryUrl, key);
      }

      for (const up of playableUpdates) {
        if (!deleteIds.includes(up.id)) {
          this.db
            .prepare("UPDATE tracks SET is_playable = 1, primary_host = ?, links_json = ? WHERE id = ?")
            .run(up.host, JSON.stringify(up.links), up.id);
        }
      }

      const updLinksStmt = this.db.prepare("UPDATE tracks SET links_json = ? WHERE id = ?");
      for (const [id, mergedLinks] of linkUpdates.entries()) {
        updLinksStmt.run(JSON.stringify(mergedLinks), id);
      }

      const moveUnavailStmt = this.db.prepare("UPDATE tracks SET tab_name = 'Unavailable' WHERE id = ?");
      for (const id of moveUnavailableIds) {
        if (!deleteIds.includes(id)) moveUnavailStmt.run(id);
      }

      const delTrackStmt = this.db.prepare("DELETE FROM tracks WHERE id = ?");
      const delLikeStmt = this.db.prepare("DELETE FROM liked_tracks WHERE track_id = ?");
      const delPlStmt = this.db.prepare("DELETE FROM playlist_tracks WHERE track_id = ?");
      const delHistStmt = this.db.prepare("DELETE FROM play_history WHERE track_id = ?");
      const clearCacheTrackStmt = this.db.prepare("UPDATE cache_entries SET track_id = NULL WHERE track_id = ?");
      for (const id of deleteIds) {
        delLikeStmt.run(id);
        delPlStmt.run(id);
        delHistStmt.run(id);
        clearCacheTrackStmt.run(id);
        delTrackStmt.run(id);
      }

      // Deduplicate any duplicate songs already sitting inside playlists
      const pls = this.db.prepare("SELECT id FROM playlists").all() as Row[];
      for (const pl of pls) {
        const pid = String(pl.id);
        const rows = this.db
          .prepare(
            `SELECT pt.track_id, t.title, t.artist, t.credits, t.track_type, t.primary_url
             FROM playlist_tracks pt
             INNER JOIN tracks t ON t.id = pt.track_id
             WHERE pt.playlist_id = ?
             ORDER BY pt.position ASC, pt.added_at ASC`
          )
          .all(pid) as Row[];
        const seenPlKeys = new Set<string>();
        const seenPlUrls = new Set<string>();
        for (const row of rows) {
          const tid = String(row.track_id);
          const url = typeof row.primary_url === "string" ? row.primary_url : "";
          const ident = extractSongIdentity({
            title: String(row.title ?? ""),
            artist: String(row.artist ?? ""),
            credits: typeof row.credits === "string" ? row.credits : "",
            trackType: typeof row.track_type === "string" ? row.track_type : null,
          });
          if (seenPlKeys.has(ident.canonicalKey) || (url && seenPlUrls.has(url))) {
            this.db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?").run(pid, tid);
          } else {
            seenPlKeys.add(ident.canonicalKey);
            if (url) seenPlUrls.add(url);
          }
        }
      }

      // Refresh every tracker's clean tabs, synced_tabs, and playable counts
      const trackerRows = this.db.prepare("SELECT * FROM trackers").all() as Row[];
      for (const tr of trackerRows) {
        const tid = String(tr.tracker_id);
        const tabs = safeJsonParse<TrackerTabMeta[]>(tr.tabs_json, []).filter((t) => !isNonSongTab(t.name));
        let syncedTabs = safeJsonParse<string[]>(tr.synced_tabs_json, []).filter((t) => !isNonSongTab(t));
        const hasUnavail = this.db
          .prepare("SELECT 1 FROM tracks WHERE tracker_id = ? AND tab_name = 'Unavailable' LIMIT 1")
          .get(tid);

        if (hasUnavail) {
          if (!tabs.some((t) => t.name === "Unavailable")) {
            tabs.push({ name: "Unavailable", slug: "unavailable", gid: "" });
          }
          if (!syncedTabs.includes("Unavailable")) {
            syncedTabs.push("Unavailable");
          }
        } else {
          syncedTabs = syncedTabs.filter((t) => t !== "Unavailable");
        }

        const totals = this.db
          .prepare(
            `SELECT COUNT(*) AS cnt, COALESCE(SUM(is_playable), 0) AS pcnt
             FROM tracks WHERE tracker_id = ? AND tab_name != 'Unavailable' AND is_playable = 1`
          )
          .get(tid) as Row;
        const curTab = isNonSongTab(String(tr.current_tab ?? ""))
          ? (syncedTabs[0] ?? tabs[0]?.name ?? "Unreleased")
          : String(tr.current_tab);

        this.db
          .prepare(
            `UPDATE trackers SET current_tab = ?, tabs_json = ?, synced_tabs_json = ?, track_count = ?, playable_count = ?
             WHERE tracker_id = ?`
          )
          .run(
            curTab,
            JSON.stringify(tabs),
            JSON.stringify(syncedTabs),
            Number(totals.cnt ?? 0),
            Number(totals.pcnt ?? 0),
            tid
          );
      }

      // Clear stale cached YouTube/SoundCloud resolutions so next play uses yt-dlp + faststart remux
      this.db
        .prepare(
          `UPDATE tracks SET resolved_url = NULL, resolved_mime = NULL, resolved_at = NULL
           WHERE primary_host IN ('youtube', 'soundcloud')`
        )
        .run();

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    return { removedTracks, movedToUnavailable, mergedDuplicates };
  }

  public removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    const info = this.db
      .prepare("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?")
      .run(playlistId, trackId);
    this.db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(Date.now(), playlistId);
    return Number(info.changes ?? 0) > 0;
  }

  public reorderPlaylistTracks(playlistId: string, orderedTrackIds: string[]): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const stmt = this.db.prepare(
        "UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?"
      );
      orderedTrackIds.forEach((trackId, index) => {
        stmt.run(index, playlistId, trackId);
      });
      this.db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(Date.now(), playlistId);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  // ---- Play History ----

  public recordPlay(trackId: string): void {
    this.db
      .prepare("INSERT INTO play_history(track_id, played_at) VALUES (?, ?)")
      .run(trackId, Date.now());
  }

  public listPlayHistory(limit = 40): PlayHistoryItem[] {
    const rows = this.db
      .prepare(
        `SELECT ph.id AS ph_id, ph.played_at AS ph_played_at, ${this.trackSelectColumns()}
         FROM play_history ph
         INNER JOIN tracks t ON t.id = ph.track_id
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
         LEFT JOIN liked_tracks lt ON lt.track_id = t.id
         ORDER BY ph.played_at DESC
         LIMIT ?`
      )
      .all(Math.min(Math.max(1, limit), 150)) as Row[];

    return rows.map((r) => ({
      id: Number(r.ph_id),
      trackId: String(r.id),
      playedAt: Number(r.ph_played_at),
      track: this.mapTrackRow(r),
    }));
  }

  public getTotalPlaysCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM play_history").get() as Row;
    return Number(row.cnt ?? 0);
  }

  // ---- Recent Searches ----

  public listRecentSearches(limit = 10): RecentSearchRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM recent_searches ORDER BY searched_at DESC LIMIT ?")
      .all(Math.min(Math.max(1, limit), 30)) as Row[];

    return rows.map((r) => ({
      id: Number(r.id),
      query: String(r.query),
      itemType: (String(r.item_type || "query") as RecentSearchRecord["itemType"]),
      itemId: typeof r.item_id === "string" ? r.item_id : null,
      subtitle: typeof r.subtitle === "string" ? r.subtitle : null,
      imageUrl: typeof r.image_url === "string" ? r.image_url : null,
      searchedAt: Number(r.searched_at ?? 0),
    }));
  }

  public addRecentSearch(entry: {
    query: string;
    itemType?: RecentSearchRecord["itemType"];
    itemId?: string | null;
    subtitle?: string | null;
    imageUrl?: string | null;
  }): RecentSearchRecord {
    const cleanQuery = entry.query.trim().slice(0, 120);
    const itemType = entry.itemType ?? "query";
    const now = Date.now();

    // Deduplicate identical query + type
    this.db
      .prepare("DELETE FROM recent_searches WHERE LOWER(query) = LOWER(?) AND item_type = ?")
      .run(cleanQuery, itemType);

    const info = this.db
      .prepare(
        `INSERT INTO recent_searches(query, item_type, item_id, subtitle, image_url, searched_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        cleanQuery,
        itemType,
        entry.itemId ?? null,
        entry.subtitle ?? null,
        entry.imageUrl ?? null,
        now
      );

    // Keep latest 20 entries
    this.db
      .prepare(
        `DELETE FROM recent_searches WHERE id NOT IN (
           SELECT id FROM recent_searches ORDER BY searched_at DESC LIMIT 20
         )`
      )
      .run();

    return {
      id: Number(info.lastInsertRowid),
      query: cleanQuery,
      itemType,
      itemId: entry.itemId ?? null,
      subtitle: entry.subtitle ?? null,
      imageUrl: entry.imageUrl ?? null,
      searchedAt: now,
    };
  }

  public deleteRecentSearch(id: number): void {
    this.db.prepare("DELETE FROM recent_searches WHERE id = ?").run(id);
  }

  public clearRecentSearches(): void {
    this.db.prepare("DELETE FROM recent_searches").run();
  }

  // ---- Activity / Notifications ----

  public addActivity(kind: ActivityRecord["kind"], title: string, detail = ""): ActivityRecord {
    const now = Date.now();
    const info = this.db
      .prepare(
        `INSERT INTO activity_log(kind, title, detail, created_at, is_read)
         VALUES (?, ?, ?, ?, 0)`
      )
      .run(kind, title.slice(0, 120), detail.slice(0, 260), now);

    // Keep latest 40 notifications
    this.db
      .prepare(
        `DELETE FROM activity_log WHERE id NOT IN (
           SELECT id FROM activity_log ORDER BY created_at DESC LIMIT 40
         )`
      )
      .run();

    return {
      id: Number(info.lastInsertRowid),
      kind,
      title,
      detail,
      createdAt: now,
      isRead: false,
    };
  }

  public listActivity(limit = 20): ActivityRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?")
      .all(Math.min(Math.max(1, limit), 40)) as Row[];

    return rows.map((r) => ({
      id: Number(r.id),
      kind: String(r.kind) as ActivityRecord["kind"],
      title: String(r.title),
      detail: String(r.detail ?? ""),
      createdAt: Number(r.created_at ?? 0),
      isRead: Number(r.is_read ?? 0) === 1,
    }));
  }

  public markAllActivityRead(): void {
    this.db.prepare("UPDATE activity_log SET is_read = 1 WHERE is_read = 0").run();
  }

  // ---- Demo Showcase Seeder ----

  public seedDemoLibrary(payload: DemoSeedPayload): { trackersCount: number; tracksCount: number; playlistsCount: number } {
    let tracksCount = 0;
    for (const item of payload.trackers) {
      this.upsertSyncedTracker(item.tracker, item.tracks);
      tracksCount += item.tracks.length;
    }

    for (const id of payload.likedTrackIds) {
      this.toggleLikeTrack(id, true);
    }

    for (const id of payload.followedTrackerIds) {
      this.toggleFollowTracker(id, true);
    }

    const existingPlaylists = new Set(this.listPlaylists().map((p) => p.name.toLowerCase()));
    let playlistsCreated = 0;
    for (const pl of payload.playlists) {
      if (existingPlaylists.has(pl.name.toLowerCase())) continue;
      const created = this.createPlaylist({
        name: pl.name,
        description: pl.description,
        coverGradient: pl.coverGradient,
      });
      for (const tid of pl.trackIds) {
        this.addTrackToPlaylist(created.id, tid);
      }
      playlistsCreated++;
    }

    if (this.listRecentSearches(1).length === 0) {
      for (const rs of [...payload.recentSearches].reverse()) {
        this.addRecentSearch(rs);
      }
    }

    // Seed a couple of initial plays so Top Hits / Recently Played feel alive right away
    if (this.getTotalPlaysCount() === 0) {
      this.recordPlay("demo_trk_07");
      this.recordPlay("demo_trk_03");
      this.recordPlay("demo_trk_01");
      this.recordPlay("demo_trk_01");
    }

    this.addActivity(
      "sync",
      "Studio Demo Vault loaded",
      `${payload.trackers.length} artists, ${tracksCount} lossless WAV masters, and ${playlistsCreated} curated playlists ready.`
    );

    return {
      trackersCount: payload.trackers.length,
      tracksCount,
      playlistsCount: playlistsCreated,
    };
  }

  // ---- Cache Entries ----

  public getCacheEntry(cacheKey: string): CacheEntry | null {
    const row = this.db
      .prepare(
        `SELECT ce.*, t.title AS track_title, t.artist AS track_artist, t.era AS track_era
         FROM cache_entries ce
         LEFT JOIN tracks t ON t.id = ce.track_id
         WHERE ce.cache_key = ?`
      )
      .get(cacheKey) as Row | undefined;
    return row ? this.mapCacheRow(row) : null;
  }

  public listCacheEntriesLruAsc(): CacheEntry[] {
    const rows = this.db
      .prepare(
        `SELECT ce.*, t.title AS track_title, t.artist AS track_artist, t.era AS track_era
         FROM cache_entries ce
         LEFT JOIN tracks t ON t.id = ce.track_id
         ORDER BY ce.last_accessed_at ASC`
      )
      .all() as Row[];
    return rows.map((r) => this.mapCacheRow(r));
  }

  public listCacheEntriesRecentDesc(): CacheEntry[] {
    const rows = this.db
      .prepare(
        `SELECT ce.*, t.title AS track_title, t.artist AS track_artist, t.era AS track_era
         FROM cache_entries ce
         LEFT JOIN tracks t ON t.id = ce.track_id
         ORDER BY ce.last_accessed_at DESC`
      )
      .all() as Row[];
    return rows.map((r) => this.mapCacheRow(r));
  }

  public upsertCacheEntry(entry: Omit<CacheEntry, "trackTitle" | "artist" | "era">): void {
    this.db
      .prepare(
        `INSERT INTO cache_entries (
          cache_key, track_id, source_url, resolved_url, file_path, mime_type, filename,
          total_bytes, cached_bytes, ranges_json, is_complete, audio_meta_json,
          last_accessed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          track_id = COALESCE(excluded.track_id, cache_entries.track_id),
          resolved_url = COALESCE(excluded.resolved_url, cache_entries.resolved_url),
          mime_type = COALESCE(excluded.mime_type, cache_entries.mime_type),
          filename = COALESCE(excluded.filename, cache_entries.filename),
          total_bytes = COALESCE(excluded.total_bytes, cache_entries.total_bytes),
          cached_bytes = excluded.cached_bytes,
          ranges_json = excluded.ranges_json,
          is_complete = excluded.is_complete,
          audio_meta_json = COALESCE(excluded.audio_meta_json, cache_entries.audio_meta_json),
          last_accessed_at = excluded.last_accessed_at`
      )
      .run(
        entry.cacheKey,
        entry.trackId,
        entry.sourceUrl,
        entry.resolvedUrl,
        entry.filePath,
        entry.mimeType,
        entry.filename,
        entry.totalBytes,
        entry.cachedBytes,
        JSON.stringify(entry.ranges),
        entry.isComplete ? 1 : 0,
        entry.audioMeta ? JSON.stringify(entry.audioMeta) : null,
        entry.lastAccessedAt,
        entry.createdAt
      );
  }

  public touchCacheEntry(cacheKey: string, accessedAt = Date.now()): void {
    this.db
      .prepare("UPDATE cache_entries SET last_accessed_at = ? WHERE cache_key = ?")
      .run(accessedAt, cacheKey);
  }

  public deleteCacheEntry(cacheKey: string): void {
    this.db.prepare("DELETE FROM cache_entries WHERE cache_key = ?").run(cacheKey);
  }

  // ---- Row Mappers ----

  private mapTrackerRow(r: Row): TrackerRecord {
    return {
      trackerId: String(r.tracker_id),
      name: String(r.name),
      artistName: String(r.artist_name),
      currentTab: String(r.current_tab),
      tabs: safeJsonParse<TrackerTabMeta[]>(r.tabs_json, []),
      syncedTabs: safeJsonParse<string[]>(r.synced_tabs_json, []),
      trackCount: Number(r.track_count ?? 0),
      playableCount: Number(r.playable_count ?? 0),
      credits: typeof r.credits === "string" ? r.credits : null,
      lastSyncedAt: Number(r.last_synced_at ?? 0),
      isFollowed: Number(r.is_followed ?? 0) === 1,
      coverImage: typeof r.cover_image === "string" ? r.cover_image : null,
    };
  }

  private mapTrackRow(r: Row): TrackRecord {
    return {
      id: String(r.id),
      trackerId: String(r.tracker_id),
      tabName: String(r.tab_name),
      title: String(r.title),
      rawName: String(r.raw_name),
      credits: String(r.credits ?? ""),
      artist: String(r.artist ?? ""),
      era: String(r.era),
      subEra: String(r.sub_era ?? "Default"),
      eraOrder: Number(r.era_order ?? 0),
      trackOrder: Number(r.track_order ?? 0),
      eraColor: typeof r.era_color === "string" ? r.era_color : null,
      eraTextColor: typeof r.era_text_color === "string" ? r.era_text_color : null,
      eraImage: typeof r.era_image === "string" ? r.era_image : null,
      notes: String(r.notes ?? ""),
      quality: String(r.quality ?? ""),
      formatHint: typeof r.format_hint === "string" ? r.format_hint : null,
      trackLength: typeof r.track_length === "string" ? r.track_length : null,
      availableLength: typeof r.available_length === "string" ? r.available_length : null,
      leakDate: typeof r.leak_date === "string" ? r.leak_date : null,
      fileDate: typeof r.file_date === "string" ? r.file_date : null,
      trackType: typeof r.track_type === "string" ? r.track_type : null,
      primaryUrl: typeof r.primary_url === "string" ? r.primary_url : null,
      primaryHost: (typeof r.primary_host === "string" ? r.primary_host : "unknown") as HostKind,
      links: safeJsonParse<TrackLink[]>(r.links_json, []),
      resolvedUrl: typeof r.resolved_url === "string" ? r.resolved_url : null,
      resolvedMime: typeof r.resolved_mime === "string" ? r.resolved_mime : null,
      resolvedSize: typeof r.resolved_size === "number" ? r.resolved_size : null,
      resolvedFilename: typeof r.resolved_filename === "string" ? r.resolved_filename : null,
      resolvedAt: typeof r.resolved_at === "number" ? r.resolved_at : null,
      isPlayable: Number(r.is_playable ?? 0) === 1,
      audioMeta: safeJsonParse<AudioHeaderInfo | null>(r.audio_meta_json, null),
      cacheStatus:
        typeof r.ce_cache_key === "string"
          ? {
              cacheKey: r.ce_cache_key,
              cachedBytes: Number(r.ce_cached_bytes ?? 0),
              totalBytes: typeof r.ce_total_bytes === "number" ? r.ce_total_bytes : null,
              isComplete: Number(r.ce_is_complete ?? 0) === 1,
              lastAccessedAt: Number(r.ce_last_accessed_at ?? 0),
            }
          : null,
      isLiked: Number(r.is_liked ?? 0) === 1,
      playCount: Number(r.play_count ?? 0),
    };
  }

  private mapCacheRow(r: Row): CacheEntry {
    return {
      cacheKey: String(r.cache_key),
      trackId: typeof r.track_id === "string" ? r.track_id : null,
      trackTitle: typeof r.track_title === "string" ? r.track_title : null,
      artist: typeof r.track_artist === "string" ? r.track_artist : null,
      era: typeof r.track_era === "string" ? r.track_era : null,
      sourceUrl: String(r.source_url),
      resolvedUrl: typeof r.resolved_url === "string" ? r.resolved_url : null,
      filePath: String(r.file_path),
      mimeType: typeof r.mime_type === "string" ? r.mime_type : null,
      filename: typeof r.filename === "string" ? r.filename : null,
      totalBytes: typeof r.total_bytes === "number" ? r.total_bytes : null,
      cachedBytes: Number(r.cached_bytes ?? 0),
      ranges: safeJsonParse<ByteRange[]>(r.ranges_json, []),
      isComplete: Number(r.is_complete ?? 0) === 1,
      audioMeta: safeJsonParse<AudioHeaderInfo | null>(r.audio_meta_json, null),
      lastAccessedAt: Number(r.last_accessed_at ?? 0),
      createdAt: Number(r.created_at ?? 0),
    };
  }
}
