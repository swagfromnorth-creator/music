import { spawn } from "node:child_process";
import crypto from "node:crypto";
import dns from "node:dns";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

dns.setDefaultResultOrder("ipv4first");

import { DiskCacheManager } from "./cache.ts";
import { CACHE_DIR, DATA_DIR, DB_PATH, HOST, PORT } from "./config.ts";
import { AppDatabase } from "./db.ts";
import { buildDemoSeedPayload, createDemoAudioResponse, renderDemoArtSvg } from "./demo.ts";
import { ImageProxyCache } from "./images.ts";
import { LOCAL_LIBRARY_TRACKER_ID, scanLocalMusicFolder } from "./local-library.ts";
import {
  formatDurationSeconds,
  searchOnlineMedia,
  streamTranscodedAudio,
} from "./media-tools.ts";
import {
  cleanMessyTrackTitle,
  lookupMusicBrainzMetadata,
  parseSpotifyPlaylistInput,
} from "./musicbrainz.ts";
import { detectHost, resolveHostUrl, type FetchLike } from "./resolver.ts";
import { fetchArtTabCovers, fetchDirectoryArtists, fetchTrackerFromArtistGrid } from "./tracker.ts";
import { applyGitUpdate, checkForUpdates, getCurrentCommit } from "./updater.ts";
import type { DirectoryArtist, HostKind, HostResolution, SyncResult, TrackRecord, UserProfile } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const STATIC_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > 1024 * 1024) {
      throw new Error("Request body exceeds 1 MB limit.");
    }
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function fileUrlToLocalPath(urlOrPath: string): string {
  if (!/^file:\/\//i.test(urlOrPath)) return urlOrPath;
  const stripped = urlOrPath.replace(/^file:\/\//i, "");
  if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(stripped)) {
    return stripped.slice(1);
  }
  return stripped;
}

function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isStrongLocalTrackMatch(candidate: TrackRecord, targetTitle: string, targetArtist: string): boolean {
  const cTitle = normalizeMatchText(candidate.title);
  const tTitle = normalizeMatchText(targetTitle);
  if (!cTitle || !tTitle) return false;
  const titleMatch = cTitle === tTitle || cTitle.includes(tTitle) || tTitle.includes(cTitle);
  if (!titleMatch) return false;
  const tArtist = normalizeMatchText(targetArtist);
  if (!tArtist || tArtist === "unknown artist") return true;
  const cArtist = normalizeMatchText(`${candidate.artist} ${candidate.credits}`);
  return tArtist
    .split(" ")
    .some((tok) => tok.length >= 2 && cArtist.includes(tok));
}

function buildImportedTrackRecord(input: {
  idPrefix: string;
  trackerId: string;
  tabName: string;
  sourceUrl: string;
  title: string;
  artist: string;
  album: string | null;
  thumbnail: string | null;
  durationSec: number | null;
  year: string | null;
  host: HostKind;
  notes?: string;
  resolved?: HostResolution;
  trackOrder?: number;
}): TrackRecord {
  const cleanUrl = input.sourceUrl.trim();
  const id =
    input.idPrefix +
    crypto.createHash("sha256").update(cleanUrl).digest("hex").slice(0, 16);
  const resolvedOk = input.resolved && input.resolved.ok ? input.resolved : null;
  const inferredExt =
    resolvedOk?.formatHint ??
    cleanUrl.split("?")[0]?.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ??
    null;

  return {
    id,
    trackerId: input.trackerId,
    tabName: input.tabName,
    title: input.title,
    rawName: input.title,
    credits: "",
    artist: input.artist || "Unknown Artist",
    era: input.album || "Imported",
    subEra: input.year || input.host,
    eraOrder: 0,
    trackOrder: input.trackOrder ?? 0,
    eraColor: "#2563eb",
    eraTextColor: "#ffffff",
    eraImage: input.thumbnail,
    notes: input.notes ?? `Imported from ${input.host}: ${cleanUrl}`,
    quality:
      inferredExt === "flac" || inferredExt === "wav" || inferredExt === "alac"
        ? "Lossless"
        : "High Quality",
    formatHint: inferredExt,
    trackLength: formatDurationSeconds(input.durationSec),
    availableLength: null,
    leakDate: input.year,
    fileDate: null,
    trackType: "Imported",
    primaryUrl: cleanUrl,
    primaryHost: input.host,
    links: [
      {
        url: cleanUrl,
        text: input.host,
        host: input.host,
        playable: true,
        formatHint: inferredExt,
      },
    ],
    resolvedUrl: resolvedOk?.resolvedUrl ?? null,
    resolvedMime: resolvedOk?.mimeType ?? null,
    resolvedSize: resolvedOk?.sizeBytes ?? null,
    resolvedFilename: resolvedOk?.filename ?? null,
    resolvedAt: resolvedOk ? Date.now() : null,
    isPlayable: true,
    audioMeta: null,
  };
}

export interface AppContext {
  db: AppDatabase;
  cache: DiskCacheManager;
  server: http.Server;
  getCommit: () => string | null;
  setCommit: (c: string | null) => void;
  close: () => Promise<void>;
}

export function createAppServer(options: {
  dbPath?: string;
  cacheDir?: string;
  imagesDir?: string;
  fetchImpl?: FetchLike;
  publicDir?: string;
  initialCommit?: string | null;
} = {}): AppContext {
  const dbPath = options.dbPath ?? DB_PATH;
  const db = new AppDatabase(dbPath);
  const rawFetchImpl = options.fetchImpl ?? fetch;

  // Transparently serve built-in demo:// lossless WAV streams through the real DiskCacheManager pipeline
  const fetchImpl: FetchLike = async (input, init) => {
    if (typeof input === "string" && input.startsWith("demo://")) {
      const slug = input.slice("demo://".length).replace(/\.wav$/i, "");
      const headers = new Headers(init?.headers);
      return createDemoAudioResponse(slug, headers.get("range"));
    }
    return rawFetchImpl(input, init);
  };

  const cache = new DiskCacheManager(options.cacheDir ?? CACHE_DIR, db, fetchImpl);
  const imagesDir =
    options.imagesDir ??
    (dbPath === ":memory:" ? path.join(os.tmpdir(), "vaultstream-images") : path.join(path.dirname(dbPath), "images"));
  const imageCache = new ImageProxyCache(imagesDir, rawFetchImpl);
  const publicDir = options.publicDir ?? PUBLIC_DIR;

  let currentCommit: string | null = options.initialCommit ?? null;
  let lastAutoUpdateCheck = 0;
  let lastAutoUpdateError: string | null = null;
  let directoryCache: { fetchedAt: number; artists: DirectoryArtist[] } | null = null;
  const resolvedHeadersCache = new Map<string, Record<string, string>>();

  async function resolveTrackLink(
    track: TrackRecord,
    opts: { linkIndex?: number; forceRefresh?: boolean } = {}
  ): Promise<{ sourceUrl: string; resolution: HostResolution }> {
    const candidateLinks =
      opts.linkIndex !== undefined && track.links[opts.linkIndex]
        ? [track.links[opts.linkIndex]!]
        : track.links.filter((l) => l.playable);

    if (candidateLinks.length === 0) {
      const fallbackUrl = track.primaryUrl ?? track.links[0]?.url ?? "";
      return {
        sourceUrl: fallbackUrl,
        resolution: {
          ok: false,
          sourceUrl: fallbackUrl,
          host: track.primaryHost,
          errorCode: "no_playable_links",
          errorMessage: "This track has no playable audio host links.",
        },
      };
    }

    const firstCandidate = candidateLinks[0]!;
    if (firstCandidate.url.startsWith("demo://")) {
      return {
        sourceUrl: firstCandidate.url,
        resolution: {
          ok: true,
          sourceUrl: firstCandidate.url,
          resolvedUrl: firstCandidate.url,
          host: "direct",
          mimeType: "audio/wav",
          filename: firstCandidate.url.slice("demo://".length),
          sizeBytes: null,
          formatHint: "wav",
        },
      };
    }

    if (firstCandidate.host === "local" || firstCandidate.url.startsWith("file://")) {
      const localPath = track.resolvedUrl || fileUrlToLocalPath(firstCandidate.url);
      return {
        sourceUrl: firstCandidate.url,
        resolution: {
          ok: true,
          sourceUrl: firstCandidate.url,
          resolvedUrl: localPath,
          host: "local",
          mimeType: track.resolvedMime,
          filename: track.resolvedFilename ?? path.basename(localPath),
          sizeBytes: track.resolvedSize,
          formatHint: track.formatHint,
        },
      };
    }

    // Reuse fresh cached resolution if resolving primary link (and headers exist when needed)
    const needsFreshYtHeaders =
      track.primaryHost === "youtube" &&
      Boolean(track.primaryUrl && !resolvedHeadersCache.has(track.primaryUrl));
    if (
      !opts.forceRefresh &&
      !needsFreshYtHeaders &&
      opts.linkIndex === undefined &&
      track.resolvedUrl &&
      track.primaryUrl &&
      track.resolvedAt &&
      Date.now() - track.resolvedAt < 1000 * 60 * 30
    ) {
      return {
        sourceUrl: track.primaryUrl,
        resolution: {
          ok: true,
          sourceUrl: track.primaryUrl,
          resolvedUrl: track.resolvedUrl,
          host: track.primaryHost,
          mimeType: track.resolvedMime,
          filename: track.resolvedFilename,
          sizeBytes: track.resolvedSize,
          formatHint: track.formatHint,
          httpHeaders: resolvedHeadersCache.get(track.primaryUrl),
        },
      };
    }

    let lastFailure: HostResolution | null = null;
    for (const link of candidateLinks) {
      let resolved = await resolveHostUrl(link.url, rawFetchImpl);
      if (!resolved.ok && link.host === "soundcloud") {
        resolved = await resolveHostUrl(link.url, rawFetchImpl, {
          preferYtDlpForSoundcloud: true,
        });
      }
      if (resolved.ok) {
        if (resolved.httpHeaders && Object.keys(resolved.httpHeaders).length > 0) {
          resolvedHeadersCache.set(link.url, resolved.httpHeaders);
        }
        if (link.url === track.primaryUrl || opts.linkIndex === undefined) {
          db.updateTrackResolution(track.id, {
            resolvedUrl: resolved.resolvedUrl,
            resolvedMime: resolved.mimeType,
            resolvedSize: resolved.sizeBytes,
            resolvedFilename: resolved.filename,
          });
          if (!track.trackLength && resolved.durationSec) {
            const lenStr = formatDurationSeconds(resolved.durationSec);
            if (lenStr) db.updateTrackMetadata(track.id, { trackLength: lenStr });
          }
        }
        return { sourceUrl: link.url, resolution: resolved };
      }
      lastFailure = resolved;
    }

    return {
      sourceUrl: candidateLinks[0]!.url,
      resolution: lastFailure!,
    };
  }

  async function serveStatic(reqPath: string, res: ServerResponse): Promise<void> {
    const cleanRel = reqPath === "/" ? "index.html" : reqPath.replace(/^\/+/, "");
    const resolved = path.resolve(publicDir, cleanRel);
    if (!resolved.startsWith(publicDir + path.sep) && resolved !== path.join(publicDir, "index.html")) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const stat = await fsp.stat(resolved);
      if (!stat.isFile()) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        "Content-Type": STATIC_MIME[ext] ?? "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(resolved).pipe(res);
    } catch {
      sendJson(res, 404, { error: "Not found" });
    }
  }

  const server = http.createServer(async (req, res) => {
    const method = req.method ?? "GET";
    const parsedUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    try {
      // Health check (also exposes current git commit so browser auto-reloads on GitHub updates)
      if (method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, {
          ok: true,
          cacheDir: cache.cacheDir,
          dataDir: DATA_DIR,
          commit: currentCommit,
          autoUpdateEnabled: process.env.AUTO_UPDATE !== "0",
          lastAutoUpdateCheck,
          lastAutoUpdateError,
        });
        return;
      }

      // Demo studio artwork SVG endpoint
      const demoArtMatch = pathname.match(/^\/api\/demo\/art\/([a-z0-9-]+)$/i);
      if (method === "GET" && demoArtMatch) {
        const svg = renderDemoArtSvg(demoArtMatch[1]!);
        res.writeHead(200, {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(svg),
          "Cache-Control": "public, max-age=86400",
        });
        res.end(svg);
        return;
      }

      // Optional interactive Demo Studio Showcase seeder
      if (method === "POST" && pathname === "/api/demo/seed") {
        const summary = db.seedDemoLibrary(buildDemoSeedPayload());
        sendJson(res, 200, { ok: true, ...summary });
        return;
      }

      // Cover art proxy + disk cache
      if (method === "GET" && pathname === "/api/image") {
        const targetUrl = parsedUrl.searchParams.get("url") ?? "";
        const artist = parsedUrl.searchParams.get("artist") ?? undefined;
        const era = parsedUrl.searchParams.get("era") ?? undefined;
        await imageCache.serveImage(targetUrl, res, { artist, era });
        return;
      }

      // User Profile
      if (method === "GET" && pathname === "/api/profile") {
        const profile = db.getUserProfile();
        const trackers = db.listTrackers();
        const playlists = db.listPlaylists();
        const likedCount = db.getLikedTrackIds().length;
        const followedCount = db.getFollowedTrackerIds().length;
        const playsCount = db.getTotalPlaysCount();
        const cacheStats = cache.getStats();
        sendJson(res, 200, {
          profile,
          stats: {
            likedCount,
            playlistCount: playlists.length,
            trackerCount: trackers.length,
            followedCount,
            playsCount,
            cachedCount: cacheStats.entryCount,
            cachedBytes: cacheStats.totalCachedBytes,
          },
        });
        return;
      }

      if (method === "PUT" && pathname === "/api/profile") {
        const body = await readJsonBody<Partial<UserProfile>>(req);
        const profile = db.updateUserProfile(body);
        sendJson(res, 200, { profile });
        return;
      }

      // Activity / Notifications
      if (method === "GET" && pathname === "/api/activity") {
        const items = db.listActivity(25);
        const unreadCount = items.filter((a) => !a.isRead).length;
        sendJson(res, 200, { items, unreadCount });
        return;
      }

      if (method === "POST" && pathname === "/api/activity/read") {
        db.markAllActivityRead();
        sendJson(res, 200, { ok: true });
        return;
      }

      // Liked tracks & followed artists
      if (method === "GET" && pathname === "/api/likes") {
        sendJson(res, 200, {
          likedIds: db.getLikedTrackIds(),
          tracks: db.listLikedTracks(),
          followedTrackerIds: db.getFollowedTrackerIds(),
        });
        return;
      }

      const likeMatch = pathname.match(/^\/api\/likes\/([^/]+)$/);
      if (likeMatch && (method === "POST" || method === "DELETE")) {
        const trackId = likeMatch[1]!;
        let desired: boolean | undefined = method === "DELETE" ? false : undefined;
        if (method === "POST") {
          const body = await readJsonBody<{ liked?: boolean }>(req);
          if (typeof body.liked === "boolean") desired = body.liked;
        }
        const liked = db.toggleLikeTrack(trackId, desired);
        sendJson(res, 200, { trackId, liked, likedCount: db.getLikedTrackIds().length });
        return;
      }

      // Follow artist/tracker
      const followTrackerMatch = pathname.match(/^\/api\/trackers\/([^/]+)\/follow$/);
      if (method === "POST" && followTrackerMatch) {
        const trackerId = followTrackerMatch[1]!;
        const body = await readJsonBody<{ followed?: boolean }>(req);
        const followed = db.toggleFollowTracker(
          trackerId,
          typeof body.followed === "boolean" ? body.followed : undefined
        );
        sendJson(res, 200, { trackerId, followed });
        return;
      }

      // Playlists CRUD
      if (method === "GET" && pathname === "/api/playlists") {
        sendJson(res, 200, { playlists: db.listPlaylists() });
        return;
      }

      if (method === "POST" && pathname === "/api/playlists") {
        const body = await readJsonBody<{
          name?: string;
          description?: string;
          coverGradient?: string;
          coverImage?: string | null;
        }>(req);
        const name = (body.name ?? "").trim();
        if (!name) {
          sendJson(res, 400, { error: "Playlist name is required." });
          return;
        }
        const playlist = db.createPlaylist({
          name,
          description: body.description,
          coverGradient: body.coverGradient,
          coverImage: body.coverImage,
        });
        db.addActivity("playlist", `Created playlist "${playlist.name}"`, playlist.description || "Ready for tracks.");
        sendJson(res, 201, { playlist });
        return;
      }

      const playlistTracksReorderMatch = pathname.match(/^\/api\/playlists\/([^/]+)\/tracks\/reorder$/);
      if (method === "PUT" && playlistTracksReorderMatch) {
        const playlistId = playlistTracksReorderMatch[1]!;
        const body = await readJsonBody<{ trackIds?: string[] }>(req);
        if (!Array.isArray(body.trackIds)) {
          sendJson(res, 400, { error: "Provide 'trackIds' array." });
          return;
        }
        db.reorderPlaylistTracks(playlistId, body.trackIds);
        sendJson(res, 200, { playlist: db.getPlaylistDetail(playlistId) });
        return;
      }

      const playlistTrackItemMatch = pathname.match(/^\/api\/playlists\/([^/]+)\/tracks\/([^/]+)$/);
      if (method === "DELETE" && playlistTrackItemMatch) {
        const [, playlistId, trackId] = playlistTrackItemMatch;
        db.removeTrackFromPlaylist(playlistId!, trackId!);
        sendJson(res, 200, { playlist: db.getPlaylistDetail(playlistId!) });
        return;
      }

      const playlistTracksMatch = pathname.match(/^\/api\/playlists\/([^/]+)\/tracks$/);
      if (method === "POST" && playlistTracksMatch) {
        const playlistId = playlistTracksMatch[1]!;
        const body = await readJsonBody<{ trackId?: string }>(req);
        if (!body.trackId) {
          sendJson(res, 400, { error: "Missing 'trackId'." });
          return;
        }
        const added = db.addTrackToPlaylist(playlistId, body.trackId);
        sendJson(res, 200, { added, playlist: db.getPlaylistDetail(playlistId) });
        return;
      }

      const playlistItemMatch = pathname.match(/^\/api\/playlists\/([^/]+)$/);
      if (playlistItemMatch) {
        const playlistId = playlistItemMatch[1]!;
        if (method === "GET") {
          const detail = db.getPlaylistDetail(playlistId);
          if (!detail) {
            sendJson(res, 404, { error: "Playlist not found" });
            return;
          }
          sendJson(res, 200, { playlist: detail });
          return;
        }
        if (method === "PATCH") {
          const body = await readJsonBody<{
            name?: string;
            description?: string;
            coverGradient?: string;
            coverImage?: string | null;
          }>(req);
          const updated = db.updatePlaylist(playlistId, body);
          if (!updated) {
            sendJson(res, 404, { error: "Playlist not found" });
            return;
          }
          sendJson(res, 200, { playlist: updated });
          return;
        }
        if (method === "DELETE") {
          db.deletePlaylist(playlistId);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      // Play History
      if (method === "GET" && pathname === "/api/history") {
        const limit = Number(parsedUrl.searchParams.get("limit") ?? 40);
        sendJson(res, 200, {
          items: db.listPlayHistory(limit),
          totalPlays: db.getTotalPlaysCount(),
        });
        return;
      }

      if (method === "POST" && pathname === "/api/history") {
        const body = await readJsonBody<{ trackId?: string }>(req);
        if (!body.trackId) {
          sendJson(res, 400, { error: "Missing 'trackId'." });
          return;
        }
        db.recordPlay(body.trackId);
        sendJson(res, 200, { ok: true });
        return;
      }

      // Recent Searches
      if (method === "GET" && pathname === "/api/recent-searches") {
        sendJson(res, 200, { items: db.listRecentSearches(12) });
        return;
      }

      if (method === "POST" && pathname === "/api/recent-searches") {
        const body = await readJsonBody<{
          query?: string;
          itemType?: "query" | "track" | "artist" | "era" | "playlist";
          itemId?: string | null;
          subtitle?: string | null;
          imageUrl?: string | null;
        }>(req);
        if (!body.query?.trim()) {
          sendJson(res, 400, { error: "Missing 'query'." });
          return;
        }
        const item = db.addRecentSearch({
          query: body.query,
          itemType: body.itemType,
          itemId: body.itemId,
          subtitle: body.subtitle,
          imageUrl: body.imageUrl,
        });
        sendJson(res, 201, { item, items: db.listRecentSearches(12) });
        return;
      }

      if (method === "DELETE" && pathname === "/api/recent-searches") {
        db.clearRecentSearches();
        sendJson(res, 200, { items: [] });
        return;
      }

      const delRecentMatch = pathname.match(/^\/api\/recent-searches\/(\d+)$/);
      if (method === "DELETE" && delRecentMatch) {
        db.deleteRecentSearch(Number(delRecentMatch[1]));
        sendJson(res, 200, { items: db.listRecentSearches(12) });
        return;
      }

      // ArtistGrid Directory
      if (method === "GET" && pathname === "/api/directory") {
        const now = Date.now();
        if (!directoryCache || now - directoryCache.fetchedAt > 1000 * 60 * 30) {
          const artists = await fetchDirectoryArtists(rawFetchImpl);
          directoryCache = { fetchedAt: now, artists };
        }
        const q = (parsedUrl.searchParams.get("q") ?? "").trim().toLowerCase();
        const filtered = q
          ? directoryCache.artists.filter((a) => a.name.toLowerCase().includes(q))
          : directoryCache.artists;
        sendJson(res, 200, {
          total: directoryCache.artists.length,
          artists: filtered.slice(0, 100),
        });
        return;
      }

      // List synced trackers
      if (method === "GET" && pathname === "/api/trackers") {
        sendJson(res, 200, { trackers: db.listTrackers() });
        return;
      }

      // Sync an ArtistGrid tracker
      if (method === "POST" && pathname === "/api/trackers/sync") {
        const body = await readJsonBody<{
          input?: string;
          trackerId?: string;
          tabGid?: string;
          tabSlug?: string;
          tabName?: string;
        }>(req);
        const input = (body.input ?? body.trackerId ?? "").trim();
        if (!input) {
          sendJson(res, 400, { error: "Missing tracker ID or URL in 'input'." });
          return;
        }
        const started = performance.now();
        const normalized = await fetchTrackerFromArtistGrid(input, {
          tabGid: body.tabGid,
          tabSlug: body.tabSlug,
          tabName: body.tabName,
          fetchImpl: rawFetchImpl,
        });
        const tracker = db.upsertSyncedTracker(normalized.tracker, normalized.tracks);
        const result: SyncResult = {
          tracker,
          tabSynced: normalized.tracker.currentTab,
          tracksSynced: normalized.tracks.length,
          playableTracks: normalized.tracker.playableCount,
          erasCount: normalized.erasCount,
          elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        };
        db.addActivity(
          "sync",
          `Synced ${tracker.artistName}`,
          `${result.tracksSynced} tracks indexed from "${result.tabSynced}" in ${result.elapsedMs} ms.`
        );
        sendJson(res, 200, result);
        return;
      }

      // Delete tracker
      const deleteTrackerMatch = pathname.match(/^\/api\/trackers\/([^/]+)$/);
      if (method === "DELETE" && deleteTrackerMatch) {
        db.deleteTracker(deleteTrackerMatch[1]!);
        sendJson(res, 200, { ok: true });
        return;
      }

      // Search tracks (SQLite FTS5 + Filters)
      if (method === "GET" && pathname === "/api/tracks") {
        const p = parsedUrl.searchParams;
        const result = db.searchTracks({
          trackerId: p.get("trackerId") || undefined,
          tabName: p.get("tabName") || undefined,
          q: p.get("q") || undefined,
          era: p.get("era") || undefined,
          host: p.get("host") || undefined,
          quality: p.get("quality") || undefined,
          losslessOnly: p.get("losslessOnly") === "1" || p.get("losslessOnly") === "true",
          cachedOnly: p.get("cachedOnly") === "1" || p.get("cachedOnly") === "true",
          playableOnly: p.get("playableOnly") === "1" || p.get("playableOnly") === "true",
          limit: p.get("limit") ? Number(p.get("limit")) : undefined,
          offset: p.get("offset") ? Number(p.get("offset")) : undefined,
        });
        sendJson(res, 200, result);
        return;
      }

      // Track detail
      const trackDetailMatch = pathname.match(/^\/api\/tracks\/([^/]+)$/);
      if (method === "GET" && trackDetailMatch) {
        const track = db.getTrackById(trackDetailMatch[1]!);
        if (!track) {
          sendJson(res, 404, { error: "Track not found" });
          return;
        }
        sendJson(res, 200, { track });
        return;
      }

      // Resolve track host URL
      const trackResolveMatch = pathname.match(/^\/api\/tracks\/([^/]+)\/resolve$/);
      if (method === "POST" && trackResolveMatch) {
        const track = db.getTrackById(trackResolveMatch[1]!);
        if (!track) {
          sendJson(res, 404, { error: "Track not found" });
          return;
        }
        const body = await readJsonBody<{ linkIndex?: number; force?: boolean }>(req);
        const { resolution } = await resolveTrackLink(track, {
          linkIndex: body.linkIndex,
          forceRefresh: body.force ?? true,
        });
        sendJson(res, resolution.ok ? 200 : 422, {
          track: db.getTrackById(track.id),
          resolution,
        });
        return;
      }

      // Stream track audio with HTTP byte-range support + progressive ./cache storage
      const trackStreamMatch = pathname.match(/^\/api\/tracks\/([^/]+)\/stream$/);
      if ((method === "GET" || method === "HEAD") && trackStreamMatch) {
        const track = db.getTrackById(trackStreamMatch[1]!);
        if (!track) {
          sendJson(res, 404, { error: "Track not found" });
          return;
        }
        const compat = parsedUrl.searchParams.get("compat") === "1";
        const linkIdxParam = parsedUrl.searchParams.get("linkIndex");
        const linkIndex = linkIdxParam !== null ? Number(linkIdxParam) : undefined;
        const { sourceUrl, resolution } = await resolveTrackLink(track, { linkIndex });
        if (!resolution.ok) {
          sendJson(res, 422, {
            error: resolution.errorMessage,
            errorCode: resolution.errorCode,
            host: resolution.host,
            sourceUrl,
          });
          return;
        }

        if (resolution.host === "local") {
          const localPath = fileUrlToLocalPath(resolution.resolvedUrl);
          if (compat) {
            await streamTranscodedAudio(localPath, res, {
              lossless: Boolean(track.audioMeta?.lossless),
            });
          } else {
            await cache.streamLocalFile(localPath, req, res, resolution.mimeType);
          }
          return;
        }

        if (compat) {
          const cachedPath = await cache.getCompleteCachedFile(sourceUrl);
          await streamTranscodedAudio(cachedPath ?? resolution.resolvedUrl, res, {
            lossless: Boolean(track.audioMeta?.lossless),
            httpHeaders: cachedPath ? undefined : resolution.httpHeaders,
          });
          return;
        }

        await cache.streamWithCache(req, res, {
          trackId: track.id,
          sourceUrl,
          resolvedUrl: resolution.resolvedUrl,
          upstreamHeaders: resolution.httpHeaders,
          onExpiredUpstream: async () => {
            const fresh = await resolveTrackLink(track, { linkIndex, forceRefresh: true });
            return fresh.resolution.ok
              ? {
                  resolvedUrl: fresh.resolution.resolvedUrl,
                  upstreamHeaders: fresh.resolution.httpHeaders,
                }
              : null;
          },
        });
        return;
      }

      // Explicitly download/cache full track to ./cache
      const trackCacheMatch = pathname.match(/^\/api\/tracks\/([^/]+)\/cache$/);
      if (method === "POST" && trackCacheMatch) {
        const track = db.getTrackById(trackCacheMatch[1]!);
        if (!track) {
          sendJson(res, 404, { error: "Track not found" });
          return;
        }
        if (track.primaryHost === "local") {
          sendJson(res, 200, {
            entry: null,
            track,
            cache: cache.getStats(),
            alreadyLocal: true,
          });
          return;
        }
        const body = await readJsonBody<{ linkIndex?: number }>(req);
        const { sourceUrl, resolution } = await resolveTrackLink(track, {
          linkIndex: body.linkIndex,
        });
        if (!resolution.ok) {
          sendJson(res, 422, {
            error: resolution.errorMessage,
            errorCode: resolution.errorCode,
          });
          return;
        }
        const entry = await cache.prefetchFullTrack({
          trackId: track.id,
          sourceUrl,
          resolvedUrl: resolution.resolvedUrl,
          upstreamHeaders: resolution.httpHeaders,
        });
        db.addActivity(
          "cache",
          `Saved "${track.title}" offline`,
          `${track.artist} · ${track.era} cached to disk.`
        );
        sendJson(res, 200, {
          entry,
          track: db.getTrackById(track.id),
          cache: cache.getStats(),
        });
        return;
      }

      // Serve locally extracted embedded album artwork (music-metadata)
      const localArtMatch = pathname.match(/^\/api\/local-art\/([a-z0-9-]+)$/i);
      if (method === "GET" && localArtMatch) {
        const key = localArtMatch[1]!;
        const binPath = path.join(imagesDir, `${key}.bin`);
        const metaPath = path.join(imagesDir, `${key}.json`);
        try {
          const [data, metaRaw] = await Promise.all([
            fsp.readFile(binPath),
            fsp.readFile(metaPath, "utf8").catch(() => "{}"),
          ]);
          const meta = JSON.parse(metaRaw) as { contentType?: string };
          res.writeHead(200, {
            "Content-Type": meta.contentType || "image/jpeg",
            "Content-Length": data.length,
            "Cache-Control": "public, max-age=31536000, immutable",
          });
          res.end(data);
        } catch {
          sendJson(res, 404, { error: "Local artwork not found" });
        }
        return;
      }

      // Online media discovery via YouTube Music (youtubei.js), YouTube, and SoundCloud (yt-dlp)
      if (method === "GET" && pathname === "/api/discover/search") {
        const q = (parsedUrl.searchParams.get("q") ?? "").trim();
        if (!q) {
          sendJson(res, 400, { error: "Missing 'q' query parameter" });
          return;
        }
        const rawSource = parsedUrl.searchParams.get("source") ?? "ytmusic";
        const source =
          rawSource === "youtube" || rawSource === "soundcloud" ? rawSource : "ytmusic";
        const limit = Math.min(Math.max(1, Number(parsedUrl.searchParams.get("limit") ?? 12)), 20);
        const results = await searchOnlineMedia(q, source, limit);
        sendJson(res, 200, { query: q, source, results });
        return;
      }

      // Import a YouTube / SoundCloud / Bandcamp / direct audio URL into the library
      if (method === "POST" && pathname === "/api/discover/import-url") {
        const body = await readJsonBody<{
          url?: string;
          title?: string;
          artist?: string;
          album?: string;
          thumbnail?: string;
          playlistId?: string;
          enrichMusicBrainz?: boolean;
        }>(req);
        const targetUrl = body.url?.trim();
        if (!targetUrl) {
          sendJson(res, 400, { error: "Missing 'url'" });
          return;
        }

        let resolved = await resolveHostUrl(targetUrl, rawFetchImpl, {
          preferYtDlpForSoundcloud: true,
        });
        if (!resolved.ok) {
          sendJson(res, 422, { error: resolved.errorMessage, errorCode: resolved.errorCode });
          return;
        }

        if (resolved.httpHeaders && Object.keys(resolved.httpHeaders).length > 0) {
          resolvedHeadersCache.set(targetUrl, resolved.httpHeaders);
        }

        const rawTitle = body.title?.trim() || resolved.title || resolved.filename || targetUrl;
        const rawArtist = body.artist?.trim() || resolved.artist || "";
        const cleaned = cleanMessyTrackTitle(rawTitle, rawArtist);

        let title = cleaned.title || rawTitle;
        let artist = cleaned.artist || rawArtist || "Unknown Artist";
        let album = body.album?.trim() || resolved.album || null;
        let thumbnail = body.thumbnail?.trim() || resolved.thumbnail || null;
        let year: string | null = null;

        if (body.enrichMusicBrainz !== false) {
          const mb = await lookupMusicBrainzMetadata(title, artist, rawFetchImpl).catch(() => null);
          if (mb) {
            title = mb.title || title;
            artist = mb.artist || artist;
            album = mb.album || album;
            year = mb.year || year;
            if (mb.coverArtUrl) thumbnail = mb.coverArtUrl;
          }
        }

        const trackRecord = buildImportedTrackRecord({
          idPrefix: "imp_",
          trackerId: "imported_web",
          tabName: "Saved URLs",
          sourceUrl: targetUrl,
          title,
          artist,
          album,
          thumbnail,
          durationSec: resolved.durationSec ?? null,
          year,
          host: resolved.host,
          resolved,
        });

        const saved = db.upsertImportedTrack(
          {
            trackerId: "imported_web",
            name: "Imported Web Tracks",
            artistName: "Web & Streaming",
            tabName: "Saved URLs",
          },
          trackRecord
        );

        if (body.playlistId) {
          db.addTrackToPlaylist(body.playlistId, saved.id);
        }

        db.addActivity("sync", `Imported "${saved.title}"`, `${saved.artist} · ${saved.primaryHost}`);
        sendJson(res, 200, { track: saved, resolution: resolved });
        return;
      }

      // MusicBrainz + Cover Art Archive metadata normalizer
      if (method === "POST" && pathname === "/api/metadata/musicbrainz") {
        const body = await readJsonBody<{
          trackId?: string;
          title?: string;
          artist?: string;
        }>(req);

        const existingTrack = body.trackId ? db.getTrackById(body.trackId) : null;
        if (body.trackId && !existingTrack) {
          sendJson(res, 404, { error: "Track not found" });
          return;
        }

        const lookupTitle = body.title?.trim() || existingTrack?.title || "";
        const lookupArtist = body.artist?.trim() || existingTrack?.artist || "";
        if (!lookupTitle) {
          sendJson(res, 400, { error: "Provide 'trackId' or 'title'" });
          return;
        }

        const match = await lookupMusicBrainzMetadata(lookupTitle, lookupArtist, rawFetchImpl);
        if (!match) {
          sendJson(res, 200, { matched: false, match: null, track: existingTrack });
          return;
        }

        let updatedTrack = existingTrack;
        if (existingTrack) {
          updatedTrack = db.updateTrackMetadata(existingTrack.id, {
            title: match.title,
            artist: match.artist,
            era: match.album ?? existingTrack.era,
            eraImage: match.coverArtUrl ?? existingTrack.eraImage,
            leakDate: match.year ?? existingTrack.leakDate,
          });
          db.addActivity(
            "sync",
            `Enriched "${match.title}" via MusicBrainz`,
            `${match.artist}${match.album ? ` · ${match.album}` : ""}`
          );
        }

        sendJson(res, 200, { matched: true, match, track: updatedTrack });
        return;
      }

      // Scan a local music folder (MP3/FLAC/WAV/ALAC/M4A/OGG/OPUS) via music-metadata
      if (method === "POST" && pathname === "/api/library/scan-local") {
        const body = await readJsonBody<{ folderPath?: string }>(req);
        const folderPath = body.folderPath?.trim();
        if (!folderPath) {
          sendJson(res, 400, { error: "Provide 'folderPath'" });
          return;
        }
        const stats = await scanLocalMusicFolder(folderPath, db, imagesDir);
        const tracker = db.getTracker(LOCAL_LIBRARY_TRACKER_ID);
        db.addActivity(
          "sync",
          `Scanned local folder (${stats.indexedTracks} tracks)`,
          `${folderPath} · ${stats.albumsCount} album(s)`
        );
        sendJson(res, 200, { ...stats, tracker });
        return;
      }

      // Spotify CSV/JSON playlist migration into VaultStream library + playlist
      if (method === "POST" && pathname === "/api/import/spotify") {
        const body = await readJsonBody<{
          content?: string;
          playlistName?: string;
          sourcePreference?: "ytmusic" | "youtube" | "soundcloud";
          resolveOnline?: boolean;
          createPlaylist?: boolean;
        }>(req);

        const rawContent = body.content?.trim();
        if (!rawContent) {
          sendJson(res, 400, { error: "Provide Spotify CSV, SpotDL JSON, or 'Artist - Track' text in 'content'." });
          return;
        }

        const parsedItems = parseSpotifyPlaylistInput(rawContent);
        if (parsedItems.length === 0) {
          sendJson(res, 400, { error: "No tracks could be parsed from the provided playlist input." });
          return;
        }

        const playlistName = (body.playlistName?.trim() || "Spotify Import").slice(0, 100);
        const sourcePref =
          body.sourcePreference === "youtube" || body.sourcePreference === "soundcloud"
            ? body.sourcePreference
            : "ytmusic";
        const resolveOnline = body.resolveOnline !== false;
        const maxTracks = parsedItems.slice(0, 100);

        const matchedTrackIds: string[] = [];
        const unmatched: Array<{ title: string; artist: string }> = [];
        let matchedLocal = 0;
        let matchedOnline = 0;

        for (let idx = 0; idx < maxTracks.length; idx++) {
          const item = maxTracks[idx]!;
          const searchQ = `${item.title} ${item.artist !== "Unknown Artist" ? item.artist : ""}`.trim();
          const localCandidates = db.searchTracks({ q: searchQ, playableOnly: true, limit: 8 }).tracks;
          const localHit = localCandidates.find((c) => isStrongLocalTrackMatch(c, item.title, item.artist));

          if (localHit) {
            matchedTrackIds.push(localHit.id);
            matchedLocal++;
            continue;
          }

          if (!resolveOnline) {
            unmatched.push({ title: item.title, artist: item.artist });
            continue;
          }

          let chosenUrl =
            item.externalUrl && detectHost(item.externalUrl) !== "unknown" ? item.externalUrl : null;
          let host: HostKind = chosenUrl ? detectHost(chosenUrl) : "youtube";
          let thumb = item.coverUrl;
          let durSec = item.durationSec;

          if (!chosenUrl) {
            try {
              const onlineHits = await searchOnlineMedia(
                `${item.artist !== "Unknown Artist" ? `${item.artist} - ` : ""}${item.title}`,
                sourcePref,
                1
              );
              if (onlineHits[0]) {
                chosenUrl = onlineHits[0].url;
                host = sourcePref === "soundcloud" ? "soundcloud" : "youtube";
                thumb = thumb || onlineHits[0].thumbnail;
                durSec = durSec ?? onlineHits[0].durationSec;
              }
            } catch {
              // treat as unmatched if search fails
            }
          }

          if (!chosenUrl) {
            unmatched.push({ title: item.title, artist: item.artist });
            continue;
          }

          const imported = buildImportedTrackRecord({
            idPrefix: "spf_",
            trackerId: "spotify_imports",
            tabName: playlistName,
            sourceUrl: chosenUrl,
            title: item.title,
            artist: item.artist,
            album: item.album,
            thumbnail: thumb,
            durationSec: durSec,
            year: null,
            host,
            notes: `Migrated from Spotify playlist "${playlistName}"`,
            trackOrder: idx,
          });

          const saved = db.upsertImportedTrack(
            {
              trackerId: "spotify_imports",
              name: "Spotify Migrations",
              artistName: "Spotify Imports",
              tabName: playlistName,
            },
            imported
          );
          matchedTrackIds.push(saved.id);
          matchedOnline++;
        }

        let playlist = null;
        if (body.createPlaylist !== false) {
          playlist = db.createPlaylist({
            name: playlistName,
            description: `Imported ${matchedTrackIds.length}/${parsedItems.length} tracks (${matchedLocal} local, ${matchedOnline} online)`,
          });
          for (const tid of matchedTrackIds) {
            db.addTrackToPlaylist(playlist.id, tid);
          }
          playlist = db.getPlaylistDetail(playlist.id);
        }

        db.addActivity(
          "playlist",
          `Imported "${playlistName}"`,
          `${matchedTrackIds.length}/${parsedItems.length} tracks matched (${matchedLocal} local, ${matchedOnline} online)`
        );

        sendJson(res, 200, {
          playlist,
          totalParsed: parsedItems.length,
          processedCount: maxTracks.length,
          tracksAdded: matchedTrackIds.length,
          matchedLocal,
          matchedOnline,
          unmatchedCount: unmatched.length,
          unmatched,
        });
        return;
      }

      // Direct host link resolver utility
      if (method === "POST" && pathname === "/api/resolve") {
        const body = await readJsonBody<{ url?: string }>(req);
        if (!body.url) {
          sendJson(res, 400, { error: "Missing 'url'" });
          return;
        }
        const resolution = await resolveHostUrl(body.url, rawFetchImpl, {
          preferYtDlpForSoundcloud: true,
        });
        sendJson(res, resolution.ok ? 200 : 422, resolution);
        return;
      }

      // Cache telemetry & management
      if (method === "GET" && pathname === "/api/cache") {
        sendJson(res, 200, cache.getStats());
        return;
      }

      if (method === "POST" && pathname === "/api/cache/config") {
        const body = await readJsonBody<{ maxCacheBytes?: number; maxCacheMb?: number }>(req);
        const requestedBytes =
          typeof body.maxCacheBytes === "number"
            ? body.maxCacheBytes
            : typeof body.maxCacheMb === "number"
              ? body.maxCacheMb * 1024 * 1024
              : null;
        if (requestedBytes == null || !Number.isFinite(requestedBytes) || requestedBytes <= 0) {
          sendJson(res, 400, { error: "Provide positive 'maxCacheBytes' or 'maxCacheMb'." });
          return;
        }
        db.setMaxCacheBytes(requestedBytes);
        const evictedCount = await cache.evictIfNeeded();
        sendJson(res, 200, { evictedCount, cache: cache.getStats() });
        return;
      }

      if (method === "DELETE" && pathname === "/api/cache") {
        const cleared = await cache.clearAllCache();
        sendJson(res, 200, { cleared, cache: cache.getStats() });
        return;
      }

      const deleteCacheMatch = pathname.match(/^\/api\/cache\/([^/]+)$/);
      if (method === "DELETE" && deleteCacheMatch) {
        await cache.deleteCachedEntry(deleteCacheMatch[1]!);
        sendJson(res, 200, { cache: cache.getStats() });
        return;
      }

      // GitHub auto-update endpoints (loopback only)
      const isLoopback =
        req.socket.remoteAddress === "127.0.0.1" ||
        req.socket.remoteAddress === "::1" ||
        req.socket.remoteAddress === "::ffff:127.0.0.1";

      if (method === "GET" && pathname === "/api/update/status") {
        const status = await checkForUpdates();
        if (status.localCommit) currentCommit = status.localCommit;
        lastAutoUpdateCheck = Date.now();
        lastAutoUpdateError = status.supported ? null : status.reason ?? null;
        sendJson(res, 200, {
          ...status,
          autoUpdateEnabled: process.env.AUTO_UPDATE !== "0",
          lastCheckedAt: lastAutoUpdateCheck,
          lastError: lastAutoUpdateError,
        });
        return;
      }

      if (method === "POST" && pathname === "/api/update/apply") {
        if (!isLoopback) {
          sendJson(res, 403, { error: "Updates can only be triggered from localhost." });
          return;
        }
        const result = await applyGitUpdate();
        currentCommit = result.currentCommit;
        sendJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/update/restart") {
        if (!isLoopback) {
          sendJson(res, 403, { error: "Restart can only be triggered from localhost." });
          return;
        }
        sendJson(res, 200, { restarting: true });
        setTimeout(() => void restartSelf(), 150);
        return;
      }

      // Static frontend fallback
      if (method === "GET" && !pathname.startsWith("/api/")) {
        await serveStatic(pathname, res);
        return;
      }

      sendJson(res, 404, { error: "Route not found" });
    } catch (err) {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : "Internal server error",
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  });

  async function restartSelf(): Promise<void> {
    try {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      db.close();
    } catch {
      // continue restart
    }

    if (process.env.VAULTSTREAM_SUPERVISED === "1") {
      process.exit(42);
    }

    const entry = fileURLToPath(import.meta.url);
    const child = spawn(process.execPath, [entry], {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    process.exit(0);
  }

  return {
    db,
    cache,
    server,
    getCommit: () => currentCommit,
    setCommit: (c) => {
      currentCommit = c;
    },
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      db.close();
    },
  };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

async function listenWithRetry(server: http.Server, port: number, host: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onErr = (err: NodeJS.ErrnoException) => {
          server.off("listening", onOk);
          reject(err);
        };
        const onOk = () => {
          server.off("error", onErr);
          resolve();
        };
        server.once("error", onErr);
        server.once("listening", onOk);
        server.listen(port, host);
      });
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EADDRINUSE" && attempt < 7) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      throw err;
    }
  }
}

if (isEntrypoint) {
  const initialCommit = await getCurrentCommit();
  const ctx = createAppServer({ initialCommit });
  await listenWithRetry(ctx.server, PORT, HOST);

  console.log(`Lossless Tracker Player listening at http://${HOST}:${PORT}`);
  console.log(`SQLite FTS5 DB: ${DB_PATH}`);
  console.log(`LRU Disk Cache: ${CACHE_DIR}`);
  if (initialCommit) console.log(`Git commit: ${initialCommit}`);

  // Backfill permanent Art-tab cover URLs for any already-synced trackers
  void (async () => {
    for (const t of ctx.db.listTrackers()) {
      if (t.trackerId.startsWith("demo_")) continue;
      try {
        const covers = await fetchArtTabCovers(t.trackerId, t.tabs);
        if (covers.size > 0) {
          ctx.db.updateTrackerEraImages(t.trackerId, covers);
        }
      } catch {
        // ignore non-critical background art refresh
      }
    }
  })();

  // Automatic background GitHub auto-updater (pulls new commits from origin/main automatically)
  if (process.env.AUTO_UPDATE !== "0" && fs.existsSync(path.join(process.cwd(), ".git"))) {
    const intervalMs = Math.max(5000, Number(process.env.AUTO_UPDATE_INTERVAL_MS ?? 20000));
    let autoUpdateBusy = false;

    const runAutoUpdateTick = async () => {
      if (autoUpdateBusy) return;
      autoUpdateBusy = true;
      try {
        const status = await checkForUpdates();
        if (!status.supported || status.behindCount === 0) return;

        console.log(
          `[auto-update] Found ${status.behindCount} new commit(s) on origin/main (${status.localCommit} -> ${status.remoteCommit}). Pulling...`
        );
        const applied = await applyGitUpdate();
        if (!applied.updated) return;

        ctx.setCommit(applied.currentCommit);
        console.log(
          `[auto-update] Updated ${applied.previousCommit} -> ${applied.currentCommit} (${applied.changedFiles.length} file(s))`
        );

        if (applied.needsServerRestart) {
          console.log("[auto-update] Backend changed — restarting server...");
          await ctx.close();
          if (process.env.VAULTSTREAM_SUPERVISED === "1") {
            process.exit(42);
          }
          const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
            cwd: process.cwd(),
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });
          child.unref();
          process.exit(0);
        }
      } catch (err) {
        console.error(
          "[auto-update] Failed:",
          err instanceof Error ? err.message : String(err)
        );
      } finally {
        autoUpdateBusy = false;
      }
    };

    setTimeout(() => void runAutoUpdateTick(), 4000);
    setInterval(() => void runAutoUpdateTick(), intervalMs).unref();
  }
}
