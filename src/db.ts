import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_MAX_CACHE_BYTES } from "./config.ts";
import { lookupArtCover } from "./tracker.ts";
import type {
  AudioHeaderInfo,
  ByteRange,
  CacheEntry,
  EraFacet,
  HostKind,
  SearchParams,
  SearchResult,
  TrackerRecord,
  TrackerTabMeta,
  TrackLink,
  TrackRecord,
} from "./types.ts";

type Row = Record<string, unknown>;

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
    `);

    const existingCap = this.getSetting("max_cache_bytes");
    if (!existingCap) {
      this.setSetting("max_cache_bytes", String(DEFAULT_MAX_CACHE_BYTES));
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
      const syncedTabs = safeJsonParse<string[]>(existingRow?.synced_tabs_json, []);
      if (!syncedTabs.includes(trackerMeta.currentTab)) {
        syncedTabs.push(trackerMeta.currentTab);
      }

      // Preserve previously resolved URLs & detected audio metadata across re-syncs
      const preservedRows = this.db
        .prepare(
          `SELECT id, resolved_url, resolved_mime, resolved_size, resolved_filename, resolved_at, audio_meta_json
           FROM tracks WHERE tracker_id = ? AND tab_name = ?`
        )
        .all(trackerMeta.trackerId, trackerMeta.currentTab) as Row[];

      const preservedById = new Map<string, Row>();
      for (const r of preservedRows) {
        if (typeof r.id === "string") preservedById.set(r.id, r);
      }

      this.db
        .prepare("DELETE FROM tracks WHERE tracker_id = ? AND tab_name = ?")
        .run(trackerMeta.trackerId, trackerMeta.currentTab);

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
      `);

      for (const tr of tracks) {
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

      const totals = this.db
        .prepare(
          `SELECT COUNT(*) AS total_count, COALESCE(SUM(is_playable), 0) AS playable_count
           FROM tracks WHERE tracker_id = ?`
        )
        .get(trackerMeta.trackerId) as Row;

      const totalCount = Number(totals.total_count ?? tracks.length);
      const playableCount = Number(totals.playable_count ?? 0);

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
          trackerMeta.currentTab,
          JSON.stringify(trackerMeta.tabs),
          JSON.stringify(syncedTabs),
          totalCount,
          playableCount,
          trackerMeta.credits,
          now
        );

      this.db.exec("COMMIT");

      return {
        ...trackerMeta,
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
      .prepare("SELECT * FROM trackers ORDER BY last_synced_at DESC")
      .all() as Row[];
    return rows.map((r) => this.mapTrackerRow(r));
  }

  public getTracker(trackerId: string): TrackerRecord | null {
    const row = this.db
      .prepare("SELECT * FROM trackers WHERE tracker_id = ?")
      .get(trackerId) as Row | undefined;
    return row ? this.mapTrackerRow(row) : null;
  }

  public deleteTracker(trackerId: string): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM tracks WHERE tracker_id = ?").run(trackerId);
      this.db.prepare("DELETE FROM trackers WHERE tracker_id = ?").run(trackerId);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  public getTrackById(id: string): TrackRecord | null {
    const row = this.db
      .prepare(
        `SELECT t.*,
                ce.cache_key AS ce_cache_key,
                ce.cached_bytes AS ce_cached_bytes,
                ce.total_bytes AS ce_total_bytes,
                ce.is_complete AS ce_is_complete,
                ce.last_accessed_at AS ce_last_accessed_at
         FROM tracks t
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
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
        `SELECT t.*,
                ce.cache_key AS ce_cache_key,
                ce.cached_bytes AS ce_cached_bytes,
                ce.total_bytes AS ce_total_bytes,
                ce.is_complete AS ce_is_complete,
                ce.last_accessed_at AS ce_last_accessed_at
         FROM tracks t
         ${ftsJoin}
         LEFT JOIN cache_entries ce ON ce.source_url = t.primary_url
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
