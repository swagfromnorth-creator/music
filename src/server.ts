import dns from "node:dns";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";

dns.setDefaultResultOrder("ipv4first");
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DiskCacheManager } from "./cache.ts";
import { CACHE_DIR, DATA_DIR, DB_PATH, HOST, PORT } from "./config.ts";
import { AppDatabase } from "./db.ts";
import { ImageProxyCache } from "./images.ts";
import { resolveHostUrl, type FetchLike } from "./resolver.ts";
import { fetchArtTabCovers, fetchDirectoryArtists, fetchTrackerFromArtistGrid } from "./tracker.ts";
import { applyGitUpdate, checkForUpdates } from "./updater.ts";
import type { DirectoryArtist, HostResolution, SyncResult, TrackRecord } from "./types.ts";

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

export interface AppContext {
  db: AppDatabase;
  cache: DiskCacheManager;
  server: http.Server;
  close: () => Promise<void>;
}

export function createAppServer(options: {
  dbPath?: string;
  cacheDir?: string;
  imagesDir?: string;
  fetchImpl?: FetchLike;
  publicDir?: string;
} = {}): AppContext {
  const dbPath = options.dbPath ?? DB_PATH;
  const db = new AppDatabase(dbPath);
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new DiskCacheManager(options.cacheDir ?? CACHE_DIR, db, fetchImpl);
  const imagesDir =
    options.imagesDir ??
    (dbPath === ":memory:" ? path.join(os.tmpdir(), "vaultstream-images") : path.join(path.dirname(dbPath), "images"));
  const imageCache = new ImageProxyCache(imagesDir, fetchImpl);
  const publicDir = options.publicDir ?? PUBLIC_DIR;

  let directoryCache: { fetchedAt: number; artists: DirectoryArtist[] } | null = null;

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

    // Reuse fresh cached resolution if resolving primary link
    if (
      !opts.forceRefresh &&
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
        },
      };
    }

    let lastFailure: HostResolution | null = null;
    for (const link of candidateLinks) {
      const resolved = await resolveHostUrl(link.url, fetchImpl);
      if (resolved.ok) {
        if (link.url === track.primaryUrl || opts.linkIndex === undefined) {
          db.updateTrackResolution(track.id, {
            resolvedUrl: resolved.resolvedUrl,
            resolvedMime: resolved.mimeType,
            resolvedSize: resolved.sizeBytes,
            resolvedFilename: resolved.filename,
          });
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
      // Health check
      if (method === "GET" && pathname === "/api/health") {
        sendJson(res, 200, { ok: true, cacheDir: cache.cacheDir, dataDir: DATA_DIR });
        return;
      }

      // Cover art proxy + disk cache (strips Referer to avoid Google Sheets 429, falls back cleanly)
      if (method === "GET" && pathname === "/api/image") {
        const targetUrl = parsedUrl.searchParams.get("url") ?? "";
        const artist = parsedUrl.searchParams.get("artist") ?? undefined;
        const era = parsedUrl.searchParams.get("era") ?? undefined;
        await imageCache.serveImage(targetUrl, res, { artist, era });
        return;
      }

      // ArtistGrid Directory
      if (method === "GET" && pathname === "/api/directory") {
        const now = Date.now();
        if (!directoryCache || now - directoryCache.fetchedAt > 1000 * 60 * 30) {
          const artists = await fetchDirectoryArtists(fetchImpl);
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
          fetchImpl,
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

        await cache.streamWithCache(req, res, {
          trackId: track.id,
          sourceUrl,
          resolvedUrl: resolution.resolvedUrl,
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
        });
        sendJson(res, 200, {
          entry,
          track: db.getTrackById(track.id),
          cache: cache.getStats(),
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
        const resolution = await resolveHostUrl(body.url, fetchImpl);
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
        sendJson(res, 200, status);
        return;
      }

      if (method === "POST" && pathname === "/api/update/apply") {
        if (!isLoopback) {
          sendJson(res, 403, { error: "Updates can only be triggered from localhost." });
          return;
        }
        const result = await applyGitUpdate();
        sendJson(res, 200, result);
        return;
      }

      if (method === "POST" && pathname === "/api/update/restart") {
        if (!isLoopback) {
          sendJson(res, 403, { error: "Restart can only be triggered from localhost." });
          return;
        }
        sendJson(res, 200, { restarting: true });
        setTimeout(() => process.exit(42), 150);
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

  return {
    db,
    cache,
    server,
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

if (isEntrypoint) {
  const ctx = createAppServer();
  ctx.server.listen(PORT, HOST, () => {
    console.log(`Lossless Tracker Player listening at http://${HOST}:${PORT}`);
    console.log(`SQLite FTS5 DB: ${DB_PATH}`);
    console.log(`LRU Disk Cache: ${CACHE_DIR}`);
    // Backfill permanent Art-tab cover URLs for any already-synced trackers
    void (async () => {
      for (const t of ctx.db.listTrackers()) {
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
  });
}
