import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { USER_AGENT } from "./config.ts";
import type { FetchLike } from "./resolver.ts";

const IBB_OEMBED = "https://ibb.artistgrid.cx";

export function isAllowedPublicImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    if (net.isIPv4(host)) {
      const parts = host.split(".").map(Number);
      if (
        parts[0] === 10 ||
        parts[0] === 127 ||
        parts[0] === 0 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
        (parts[0] === 192 && parts[1] === 168)
      ) {
        return false;
      }
    } else if (net.isIPv6(host)) {
      if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function resolveCoverImageUrl(rawUrl: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  const url = rawUrl.trim();
  if (!isAllowedPublicImageUrl(url)) return null;

  // Rewrite legacy Apple Music a1..a5.mzstatic.com/r40/... URLs (which return 403) to public is1-ssl thumbnail endpoint
  const mzMatch = url.match(/^https?:\/\/a\d+\.mzstatic\.com\/r\d+\/(.+)$/i);
  if (mzMatch?.[1]) {
    const base = `https://is1-ssl.mzstatic.com/image/thumb/${mzMatch[1]}`;
    return /\/\d+x\d+[^/]*$/i.test(base) ? base : `${base}/600x600bb.jpg`;
  }

  // Handle imgur.com/<id> page URLs -> direct i.imgur.com/<id>.jpg
  if (/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)(?:\?.*)?$/i.test(url)) {
    const id = url.match(/imgur\.com\/([a-zA-Z0-9]+)/i)?.[1];
    return id ? `https://i.imgur.com/${id}.jpg` : null;
  }

  // Handle ibb.co/<id> page URLs via ArtistGrid oembed (direct i.ibb.co stays direct)
  if (/^https?:\/\/(?:www\.)?ibb\.co\/([a-zA-Z0-9]+)\/?$/i.test(url)) {
    const id = url.match(/ibb\.co\/([a-zA-Z0-9]+)/i)?.[1];
    if (!id) return null;
    try {
      const res = await fetchImpl(`${IBB_OEMBED}/${id}/oembed.json`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        const full =
          (typeof json.url === "string" && json.url) ||
          (typeof json.fullurl === "string" && json.fullurl) ||
          (typeof json.full_url === "string" && json.full_url) ||
          (typeof json.thumbnail_url === "string" && json.thumbnail_url) ||
          (typeof json.image === "string" && json.image);
        if (full && isAllowedPublicImageUrl(full)) return full;
      }
    } catch {
      // fall through to direct i.ibb.co guess
    }
    return `https://i.ibb.co/${id}/image.jpg`;
  }

  return url;
}

function normalizeWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .match(/[\p{L}\p{N}]{2,}/gu) ?? []
  );
}

export async function lookupItunesAlbumCover(
  artist: string,
  era: string,
  fetchImpl: FetchLike = fetch
): Promise<string | null> {
  const cleanArtist = artist.trim();
  const cleanEra = era.replace(/\[[^\]]*\]/g, "").trim();
  if (!cleanArtist || !cleanEra) return null;
  if (/^(unknown|misc|unreleased|released|recent|grails|best|worst|special|hub|tracker)/i.test(cleanEra)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(`${cleanArtist} ${cleanEra}`)}&entity=album&limit=4`;
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: Array<{ artistName?: string; collectionName?: string; artworkUrl100?: string }>;
    };
    const artistTokens = normalizeWords(cleanArtist);
    const eraTokens = normalizeWords(cleanEra);
    if (eraTokens.length === 0) return null;

    for (const item of json.results ?? []) {
      const resArtist = (item.artistName || "").toLowerCase();
      const resAlbumWords = new Set(normalizeWords(item.collectionName || ""));
      const artistOk = artistTokens.some((t) => resArtist.includes(t));
      const matchedEraWords = eraTokens.filter((t) => resAlbumWords.has(t)).length;
      if (artistOk && matchedEraWords >= Math.max(1, Math.ceil(eraTokens.length * 0.6)) && item.artworkUrl100) {
        return item.artworkUrl100.replace("100x100bb", "600x600bb");
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface CachedImageMeta {
  contentType: string;
}

export class ImageProxyCache {
  private readonly imageDir: string;
  private readonly fetchImpl: FetchLike;
  private readonly inflight = new Map<string, Promise<{ buffer: Buffer; contentType: string } | null>>();
  private readonly negativeCache = new Map<string, number>();
  private activeFetches = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(imageDir: string, fetchImpl: FetchLike = fetch) {
    this.imageDir = imageDir;
    this.fetchImpl = fetchImpl;
    fs.mkdirSync(this.imageDir, { recursive: true });
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeFetches < 5) {
      this.activeFetches++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.activeFetches++;
  }

  private releaseSlot(): void {
    this.activeFetches = Math.max(0, this.activeFetches - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  private cacheKey(rawUrl: string, artist?: string, era?: string): string {
    const id = rawUrl ? rawUrl : `fallback:${artist ?? ""}\0${era ?? ""}`;
    return crypto.createHash("sha256").update(id).digest("hex").slice(0, 24);
  }

  public async serveImage(
    rawUrl: string,
    res: ServerResponse,
    meta: { artist?: string; era?: string } = {}
  ): Promise<void> {
    const cleanUrl = rawUrl.trim();
    if (cleanUrl && !isAllowedPublicImageUrl(cleanUrl)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or disallowed image URL." }));
      return;
    }
    if (!cleanUrl && (!meta.artist || !meta.era)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing image url or artist/era fallback." }));
      return;
    }

    const key = this.cacheKey(cleanUrl, meta.artist, meta.era);
    const dataPath = path.join(this.imageDir, `${key}.bin`);
    const metaPath = path.join(this.imageDir, `${key}.json`);

    // 1. Check disk cache
    try {
      const [buf, metaRaw] = await Promise.all([fsp.readFile(dataPath), fsp.readFile(metaPath, "utf8")]);
      const cachedMeta = JSON.parse(metaRaw) as CachedImageMeta;
      res.writeHead(200, {
        "Content-Type": cachedMeta.contentType,
        "Content-Length": buf.length,
        "Cache-Control": "public, max-age=604800",
        "X-Image-Cache": "HIT",
      });
      res.end(buf);
      return;
    } catch {
      // Cache miss
    }

    // Short negative cache so dead links aren't repeatedly retried on every scroll
    const failedAt = this.negativeCache.get(key);
    if (failedAt && Date.now() - failedAt < 1000 * 60 * 10) {
      res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
      res.end(JSON.stringify({ error: "Cover art unavailable." }));
      return;
    }

    // 2. Deduplicate concurrent requests for the same cover art
    let job = this.inflight.get(key);
    if (!job) {
      job = this.fetchAndPersist(cleanUrl, meta, dataPath, metaPath).finally(() => {
        this.inflight.delete(key);
      });
      this.inflight.set(key, job);
    }

    const result = await job;
    if (!result) {
      this.negativeCache.set(key, Date.now());
      if (!res.headersSent) {
        res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
        res.end(JSON.stringify({ error: "Cover art unavailable." }));
      }
      return;
    }

    res.writeHead(200, {
      "Content-Type": result.contentType,
      "Content-Length": result.buffer.length,
      "Cache-Control": "public, max-age=604800",
      "X-Image-Cache": "MISS",
    });
    res.end(result.buffer);
  }

  private async fetchDirectImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    await this.acquireSlot();
    try {
      let attempt = 0;
      while (attempt < 2) {
        attempt++;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const upstream = await this.fetchImpl(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": USER_AGENT,
              Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
            },
          });
          if (upstream.status === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          if (!upstream.ok) return null;

          const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim() || "";
          if (!contentType.startsWith("image/")) return null;

          const buffer = Buffer.from(await upstream.arrayBuffer());
          if (buffer.length === 0 || buffer.length > 15 * 1024 * 1024) return null;
          return { buffer, contentType };
        } catch {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }
          return null;
        } finally {
          clearTimeout(timer);
        }
      }
      return null;
    } finally {
      this.releaseSlot();
    }
  }

  private async fetchAndPersist(
    rawUrl: string,
    meta: { artist?: string; era?: string },
    dataPath: string,
    metaPath: string
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (rawUrl) {
      const resolved = await resolveCoverImageUrl(rawUrl, this.fetchImpl);
      if (resolved) {
        const direct = await this.fetchDirectImage(resolved);
        if (direct) {
          await Promise.all([
            fsp.writeFile(dataPath, direct.buffer),
            fsp.writeFile(metaPath, JSON.stringify({ contentType: direct.contentType })),
          ]);
          return direct;
        }
      }
    }

    // Fallback: look up verified official album cover if primary URL expired (e.g. Google Sheets 403)
    if (meta.artist && meta.era) {
      const fallbackUrl = await lookupItunesAlbumCover(meta.artist, meta.era, this.fetchImpl);
      if (fallbackUrl) {
        const fetched = await this.fetchDirectImage(fallbackUrl);
        if (fetched) {
          await Promise.all([
            fsp.writeFile(dataPath, fetched.buffer),
            fsp.writeFile(metaPath, JSON.stringify({ contentType: fetched.contentType })),
          ]);
          return fetched;
        }
      }
    }

    return null;
  }
}
