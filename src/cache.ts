import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { USER_AGENT } from "./config.ts";
import type { AppDatabase } from "./db.ts";
import { findFfprobeExecutable, probeAudioWithFfprobe } from "./media-tools.ts";
import { mimeToExtension, type FetchLike } from "./resolver.ts";
import type { AudioHeaderInfo, ByteRange, CacheEntry, CacheStats } from "./types.ts";

function buildUpstreamHeaders(
  baseHeaders?: Record<string, string>,
  rangeHeader?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    ...(baseHeaders ?? {}),
  };
  if (rangeHeader) {
    headers.Range = rangeHeader;
  }
  return headers;
}

interface SegmentFile {
  start: number;
  end: number; // inclusive
  filePath: string;
}

interface ParsedRange {
  hasRangeHeader: boolean;
  invalid?: boolean;
  start: number;
  end: number | null; // inclusive when known
  explicitEnd: number | null;
}

export function computeCacheKey(sourceUrl: string): string {
  return crypto.createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24);
}

export function parseAudioHeader(buf: Buffer, mimeType?: string | null): AudioHeaderInfo | null {
  if (buf.length < 4) return null;

  // FLAC: "fLaC" + metadata block 0 (STREAMINFO, 34 bytes)
  if (buf.subarray(0, 4).toString("ascii") === "fLaC") {
    if (buf.length >= 42 && (buf[4]! & 0x7f) === 0) {
      const sampleRateHz = (buf[18]! << 12) | (buf[19]! << 4) | (buf[20]! >> 4);
      const channels = ((buf[20]! >> 1) & 0x07) + 1;
      const bitsPerSample = (((buf[20]! & 0x01) << 4) | (buf[21]! >> 4)) + 1;
      const totalSamples = (buf[21]! & 0x0f) * 2 ** 32 + buf.readUInt32BE(22);
      const durationSec =
        sampleRateHz > 0 && totalSamples > 0
          ? Math.round((totalSamples / sampleRateHz) * 10) / 10
          : undefined;
      return {
        codec: "FLAC",
        sampleRateHz,
        bitsPerSample,
        channels,
        durationSec,
        lossless: true,
      };
    }
    return { codec: "FLAC", lossless: true };
  }

  // WAV: "RIFF" <size> "WAVE"
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    let offset = 12;
    while (offset + 8 <= buf.length) {
      const chunkId = buf.subarray(offset, offset + 4).toString("ascii");
      const chunkSize = buf.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      if (chunkId === "fmt " && dataStart + 16 <= buf.length) {
        const channels = buf.readUInt16LE(dataStart + 2);
        const sampleRateHz = buf.readUInt32LE(dataStart + 4);
        const bitsPerSample = buf.readUInt16LE(dataStart + 14);
        return {
          codec: "WAV",
          sampleRateHz,
          bitsPerSample,
          channels,
          lossless: true,
        };
      }
      offset = dataStart + chunkSize + (chunkSize % 2);
    }
    return { codec: "WAV", lossless: true };
  }

  // OGG (check Ogg FLAC vs Vorbis/Opus)
  if (buf.subarray(0, 4).toString("ascii") === "OggS") {
    const isOggFlac = buf.includes(Buffer.from("FLAC"));
    return { codec: "OGG", lossless: isOggFlac };
  }

  // MP4 / M4A / ALAC
  if (buf.length >= 8 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const isAlac = buf.includes(Buffer.from("alac")) || (mimeType ?? "").toLowerCase().includes("alac");
    return { codec: "AAC/M4A", lossless: isAlac };
  }

  // MP3 (ID3 tag or MPEG frame sync)
  if (
    buf.subarray(0, 3).toString("ascii") === "ID3" ||
    (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)
  ) {
    return { codec: "MP3", lossless: false };
  }

  return null;
}

export function parseRangeHeader(rangeHeader: string | undefined, totalBytes: number | null): ParsedRange {
  if (!rangeHeader) {
    return {
      hasRangeHeader: false,
      start: 0,
      end: totalBytes != null ? totalBytes - 1 : null,
      explicitEnd: null,
    };
  }

  const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) {
    return { hasRangeHeader: true, invalid: true, start: 0, end: null, explicitEnd: null };
  }

  const startStr = match[1] ?? "";
  const endStr = match[2] ?? "";

  if (!startStr && !endStr) {
    return { hasRangeHeader: true, invalid: true, start: 0, end: null, explicitEnd: null };
  }

  if (!startStr && endStr) {
    if (totalBytes == null) {
      return { hasRangeHeader: true, invalid: true, start: 0, end: null, explicitEnd: null };
    }
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return { hasRangeHeader: true, invalid: true, start: 0, end: null, explicitEnd: null };
    }
    const start = Math.max(0, totalBytes - suffix);
    return {
      hasRangeHeader: true,
      start,
      end: totalBytes - 1,
      explicitEnd: totalBytes - 1,
    };
  }

  const start = Number(startStr);
  const explicitEnd = endStr ? Number(endStr) : null;
  if (
    !Number.isFinite(start) ||
    start < 0 ||
    (explicitEnd !== null && (!Number.isFinite(explicitEnd) || explicitEnd < start))
  ) {
    return { hasRangeHeader: true, invalid: true, start: 0, end: null, explicitEnd: null };
  }

  if (totalBytes != null && start >= totalBytes) {
    return { hasRangeHeader: true, invalid: true, start, end: null, explicitEnd };
  }

  let end: number | null = explicitEnd;
  if (totalBytes != null) {
    end = explicitEnd !== null ? Math.min(explicitEnd, totalBytes - 1) : totalBytes - 1;
  }

  return {
    hasRangeHeader: true,
    start,
    end,
    explicitEnd,
  };
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;\r\n]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i) ?? header.match(/filename=([^;\r\n]+)/i);
  return quoted?.[1]?.trim() ?? null;
}

function parseContentRangeHeader(header: string | null): { start: number; end: number; total: number | null } | null {
  if (!header) return null;
  const match = header.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === "*" ? null : Number(match[3]),
  };
}

async function writeChunkWithBackpressure(ws: fs.WriteStream, chunk: Buffer): Promise<void> {
  if (ws.write(chunk)) return;
  await new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      ws.off("error", onError);
      resolve();
    };
    const onError = (err: Error) => {
      ws.off("drain", onDrain);
      reject(err);
    };
    ws.once("drain", onDrain);
    ws.once("error", onError);
  });
}

function isNonAudioMime(mime: string | null): boolean {
  if (!mime) return false;
  const lower = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    lower.startsWith("text/") ||
    lower === "application/json" ||
    lower === "application/xml" ||
    lower.startsWith("image/")
  );
}

export class DiskCacheManager {
  public readonly cacheDir: string;
  private readonly db: AppDatabase;
  private readonly fetchImpl: FetchLike;
  private readonly keyLocks = new Map<string, Promise<void>>();
  private readonly activeStreams = new Map<string, number>();
  private readonly activePrefetches = new Map<string, Promise<CacheEntry>>();

  constructor(cacheDir: string, db: AppDatabase, fetchImpl: FetchLike = fetch) {
    this.cacheDir = cacheDir;
    this.db = db;
    this.fetchImpl = fetchImpl;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    this.reconcileDiskOnStartup();
  }

  private entryDir(cacheKey: string): string {
    return path.join(this.cacheDir, cacheKey);
  }

  private async withKeyLock<T>(cacheKey: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.keyLocks.get(cacheKey) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.keyLocks.set(cacheKey, next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.keyLocks.get(cacheKey) === next) {
        this.keyLocks.delete(cacheKey);
      }
    }
  }

  private incrementActive(cacheKey: string): void {
    this.activeStreams.set(cacheKey, (this.activeStreams.get(cacheKey) ?? 0) + 1);
  }

  private decrementActive(cacheKey: string): void {
    const cur = this.activeStreams.get(cacheKey) ?? 0;
    if (cur <= 1) this.activeStreams.delete(cacheKey);
    else this.activeStreams.set(cacheKey, cur - 1);
  }

  private reconcileDiskOnStartup(): void {
    try {
      const dirs = fs.readdirSync(this.cacheDir, { withFileTypes: true });
      for (const d of dirs) {
        if (!d.isDirectory()) continue;
        const dirPath = path.join(this.cacheDir, d.name);
        const files = fs.readdirSync(dirPath);
        for (const f of files) {
          if (f.startsWith(".tmp-")) {
            fs.rmSync(path.join(dirPath, f), { force: true });
          }
        }
        const entry = this.db.getCacheEntry(d.name);
        if (!entry) {
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }
      // Remove stale SQLite entries whose directory vanished
      for (const entry of this.db.listCacheEntriesLruAsc()) {
        if (!fs.existsSync(this.entryDir(entry.cacheKey))) {
          this.db.deleteCacheEntry(entry.cacheKey);
        }
      }
    } catch {
      // ignore startup reconciliation error
    }
  }

  private async listSegments(cacheKey: string): Promise<SegmentFile[]> {
    const dir = this.entryDir(cacheKey);
    try {
      const files = await fsp.readdir(dir);
      const segs: SegmentFile[] = [];
      for (const name of files) {
        const match = name.match(/^(\d+)-(\d+)\.seg$/);
        if (!match) continue;
        const start = Number(match[1]);
        const declaredEnd = Number(match[2]);
        const filePath = path.join(dir, name);
        const st = await fsp.stat(filePath);
        if (st.size <= 0) {
          await fsp.rm(filePath, { force: true });
          continue;
        }
        const actualEnd = Math.min(declaredEnd, start + st.size - 1);
        segs.push({ start, end: actualEnd, filePath });
      }
      segs.sort((a, b) => a.start - b.start || b.end - a.end);
      return segs;
    } catch {
      return [];
    }
  }

  private async mergeAndMeasureSegments(cacheKey: string): Promise<{
    segments: SegmentFile[];
    ranges: ByteRange[];
    cachedBytes: number;
  }> {
    const rawSegs = await this.listSegments(cacheKey);
    if (rawSegs.length === 0) {
      return { segments: [], ranges: [], cachedBytes: 0 };
    }

    const dir = this.entryDir(cacheKey);
    const merged: SegmentFile[] = [rawSegs[0]!];

    for (let i = 1; i < rawSegs.length; i++) {
      const cur = rawSegs[i]!;
      const prev = merged[merged.length - 1]!;

      if (cur.end <= prev.end) {
        // Fully shadowed by previous segment
        await fsp.rm(cur.filePath, { force: true });
        continue;
      }

      if (cur.start <= prev.end + 1) {
        // Overlapping or contiguous — append non-overlapping tail of `cur` onto `prev`
        const skipBytes = prev.end + 1 - cur.start;
        const tailHandle = await fsp.open(cur.filePath, "r");
        const prevHandle = await fsp.open(prev.filePath, "a");
        try {
          const buf = Buffer.allocUnsafe(64 * 1024);
          let pos = skipBytes;
          while (true) {
            const { bytesRead } = await tailHandle.read(buf, 0, buf.length, pos);
            if (bytesRead <= 0) break;
            await prevHandle.write(buf, 0, bytesRead);
            pos += bytesRead;
          }
        } finally {
          await tailHandle.close();
          await prevHandle.close();
        }
        await fsp.rm(cur.filePath, { force: true });
        const newName = path.join(dir, `${prev.start}-${cur.end}.seg`);
        if (prev.filePath !== newName) {
          await fsp.rename(prev.filePath, newName);
          prev.filePath = newName;
        }
        prev.end = cur.end;
      } else {
        merged.push(cur);
      }
    }

    const ranges: ByteRange[] = merged.map((s) => [s.start, s.end]);
    const cachedBytes = merged.reduce((sum, s) => sum + (s.end - s.start + 1), 0);
    return { segments: merged, ranges, cachedBytes };
  }

  private async commitSegment(
    cacheKey: string,
    meta: {
      trackId: string | null;
      sourceUrl: string;
      resolvedUrl: string | null;
      mimeType: string | null;
      filename: string | null;
      totalBytes: number | null;
      audioMeta: AudioHeaderInfo | null;
    },
    tempFilePath: string | null,
    segStart: number,
    bytesWritten: number
  ): Promise<CacheEntry> {
    return this.withKeyLock(cacheKey, async () => {
      const dir = this.entryDir(cacheKey);
      await fsp.mkdir(dir, { recursive: true });

      if (tempFilePath && bytesWritten > 0) {
        const segEnd = segStart + bytesWritten - 1;
        const target = path.join(dir, `${segStart}-${segEnd}.seg`);
        if (fs.existsSync(target)) {
          // Rare same-range collision: keep larger segment
          const existingStat = await fsp.stat(target);
          if (bytesWritten > existingStat.size) {
            await fsp.rename(tempFilePath, target);
          } else {
            await fsp.rm(tempFilePath, { force: true });
          }
        } else {
          await fsp.rename(tempFilePath, target);
        }
      } else if (tempFilePath) {
        await fsp.rm(tempFilePath, { force: true });
      }

      const { segments, ranges, cachedBytes } = await this.mergeAndMeasureSegments(cacheKey);

      // Try parsing audio header from segment starting at byte 0 if not yet parsed
      let audioMeta = meta.audioMeta;
      if (!audioMeta && segments[0]?.start === 0) {
        try {
          const fh = await fsp.open(segments[0].filePath, "r");
          try {
            const headBuf = Buffer.allocUnsafe(Math.min(4096, segments[0].end + 1));
            const { bytesRead } = await fh.read(headBuf, 0, headBuf.length, 0);
            audioMeta = parseAudioHeader(headBuf.subarray(0, bytesRead), meta.mimeType);
          } finally {
            await fh.close();
          }
        } catch {
          // ignore header parse failure
        }
      }

      // Enhance header detection via ffprobe for WebM/Opus/ALAC/M4A/OGG when >= 4KB cached
      if (
        segments[0]?.start === 0 &&
        segments[0].end + 1 >= 4096 &&
        (!audioMeta || (!audioMeta.sampleRateHz && !audioMeta.durationSec)) &&
        findFfprobeExecutable()
      ) {
        try {
          const probed = await probeAudioWithFfprobe(segments[0].filePath);
          if (probed) {
            audioMeta = audioMeta ? { ...audioMeta, ...probed } : probed;
          }
        } catch {
          // ignore ffprobe fallback failure
        }
      }

      const existing = this.db.getCacheEntry(cacheKey);
      const totalBytes = meta.totalBytes ?? existing?.totalBytes ?? null;
      const isComplete =
        totalBytes != null &&
        totalBytes > 0 &&
        ranges.length === 1 &&
        ranges[0]![0] === 0 &&
        ranges[0]![1] >= totalBytes - 1;

      const now = Date.now();
      const record: Omit<CacheEntry, "trackTitle" | "artist" | "era"> = {
        cacheKey,
        trackId: meta.trackId ?? existing?.trackId ?? null,
        sourceUrl: meta.sourceUrl,
        resolvedUrl: meta.resolvedUrl ?? existing?.resolvedUrl ?? null,
        filePath: dir,
        mimeType: meta.mimeType ?? existing?.mimeType ?? null,
        filename: meta.filename ?? existing?.filename ?? null,
        totalBytes,
        cachedBytes,
        ranges,
        isComplete,
        audioMeta: audioMeta ?? existing?.audioMeta ?? null,
        lastAccessedAt: now,
        createdAt: existing?.createdAt ?? now,
      };

      this.db.upsertCacheEntry(record);

      if (meta.trackId && (audioMeta || meta.mimeType || totalBytes || meta.filename)) {
        this.db.updateTrackResolution(meta.trackId, {
          resolvedMime: record.mimeType,
          resolvedSize: record.totalBytes,
          resolvedFilename: record.filename,
          audioMeta: record.audioMeta,
        });
      }

      await this.evictIfNeeded();
      return this.db.getCacheEntry(cacheKey)!;
    });
  }

  public async evictIfNeeded(): Promise<number> {
    const maxBytes = this.db.getMaxCacheBytes();
    const entries = this.db.listCacheEntriesLruAsc();
    let totalBytes = entries.reduce((sum, e) => sum + e.cachedBytes, 0);
    let evicted = 0;

    for (const entry of entries) {
      if (totalBytes <= maxBytes) break;
      if ((this.activeStreams.get(entry.cacheKey) ?? 0) > 0) continue;

      await fsp.rm(this.entryDir(entry.cacheKey), { recursive: true, force: true });
      this.db.deleteCacheEntry(entry.cacheKey);
      totalBytes -= entry.cachedBytes;
      evicted++;
    }

    return evicted;
  }

  public async deleteCachedEntry(cacheKey: string): Promise<boolean> {
    if ((this.activeStreams.get(cacheKey) ?? 0) > 0) {
      throw new Error("Cannot delete cache entry while it is actively streaming.");
    }
    const existing = this.db.getCacheEntry(cacheKey);
    await fsp.rm(this.entryDir(cacheKey), { recursive: true, force: true });
    this.db.deleteCacheEntry(cacheKey);
    return existing !== null;
  }

  public async clearAllCache(): Promise<number> {
    const entries = this.db.listCacheEntriesLruAsc();
    let cleared = 0;
    for (const entry of entries) {
      if ((this.activeStreams.get(entry.cacheKey) ?? 0) > 0) continue;
      await fsp.rm(this.entryDir(entry.cacheKey), { recursive: true, force: true });
      this.db.deleteCacheEntry(entry.cacheKey);
      cleared++;
    }
    return cleared;
  }

  public getStats(): CacheStats {
    const entries = this.db.listCacheEntriesRecentDesc();
    const maxCacheBytes = this.db.getMaxCacheBytes();
    const totalCachedBytes = entries.reduce((sum, e) => sum + e.cachedBytes, 0);
    const completeCount = entries.filter((e) => e.isComplete).length;
    const partialCount = entries.length - completeCount;
    const utilizationPercent =
      maxCacheBytes > 0 ? Math.min(100, Math.round((totalCachedBytes / maxCacheBytes) * 1000) / 10) : 0;

    return {
      totalCachedBytes,
      maxCacheBytes,
      entryCount: entries.length,
      completeCount,
      partialCount,
      utilizationPercent,
      entries,
    };
  }

  private findContiguousPrefix(
    segments: SegmentFile[],
    reqStart: number,
    reqEnd: number
  ): { slices: Array<{ filePath: string; fileStart: number; fileEnd: number }>; hitEnd: number } | null {
    const slices: Array<{ filePath: string; fileStart: number; fileEnd: number }> = [];
    let cursor = reqStart;

    for (const seg of segments) {
      if (seg.end < cursor) continue;
      if (seg.start > cursor) break;

      const takeEnd = Math.min(seg.end, reqEnd);
      slices.push({
        filePath: seg.filePath,
        fileStart: cursor - seg.start,
        fileEnd: takeEnd - seg.start,
      });
      cursor = takeEnd + 1;
      if (cursor > reqEnd) break;
    }

    if (slices.length === 0) return null;
    return { slices, hitEnd: cursor - 1 };
  }

  private async streamDiskSlices(
    slices: Array<{ filePath: string; fileStart: number; fileEnd: number }>,
    res: ServerResponse,
    abortSignal: AbortSignal
  ): Promise<void> {
    for (const slice of slices) {
      if (abortSignal.aborted || res.destroyed) return;
      await new Promise<void>((resolve, reject) => {
        const rs = fs.createReadStream(slice.filePath, {
          start: slice.fileStart,
          end: slice.fileEnd,
        });
        const onAbort = () => {
          rs.destroy();
          resolve();
        };
        abortSignal.addEventListener("abort", onAbort, { once: true });

        rs.on("data", (chunk) => {
          if (abortSignal.aborted || res.destroyed) {
            rs.destroy();
            return;
          }
          if (!res.write(chunk)) {
            rs.pause();
            res.once("drain", () => rs.resume());
          }
        });
        rs.on("end", () => {
          abortSignal.removeEventListener("abort", onAbort);
          resolve();
        });
        rs.on("error", (err) => {
          abortSignal.removeEventListener("abort", onAbort);
          reject(err);
        });
      });
    }
  }

  private inferMime(mimeHeader: string | null, filename: string | null, fallbackUrl: string): string {
    if (mimeHeader && mimeHeader !== "application/octet-stream") {
      return mimeHeader.split(";")[0]!.trim();
    }
    const ext =
      mimeToExtension(mimeHeader) ??
      (filename?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || null) ??
      (fallbackUrl.split("?")[0]?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || null);
    switch (ext) {
      case "flac":
        return "audio/flac";
      case "wav":
        return "audio/wav";
      case "m4a":
      case "alac":
        return "audio/mp4";
      case "mp3":
        return "audio/mpeg";
      case "ogg":
        return "audio/ogg";
      case "aac":
        return "audio/aac";
      case "opus":
        return "audio/opus";
      case "webm":
        return "audio/webm";
      default:
        return mimeHeader || "audio/mpeg";
    }
  }

  public async streamLocalFile(
    filePath: string,
    req: IncomingMessage,
    res: ServerResponse,
    mimeHint?: string | null
  ): Promise<void> {
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Local file not found: ${filePath}` }));
      return;
    }
    if (!stat.isFile()) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Path is not a file: ${filePath}` }));
      return;
    }

    const total = stat.size;
    const mime = this.inferMime(mimeHint ?? null, path.basename(filePath), filePath);

    if (req.method === "HEAD") {
      res.writeHead(200, {
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
        "Content-Length": total,
        "X-Cache-Status": "LOCAL",
      });
      res.end();
      return;
    }

    const parsed = parseRangeHeader(req.headers.range, total);
    if (parsed.invalid) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }

    const start = parsed.start;
    const end = parsed.end ?? Math.max(0, total - 1);
    const len = total === 0 ? 0 : end - start + 1;

    const headers: Record<string, string | number> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": len,
      "X-Cache-Status": "LOCAL",
    };

    if (parsed.hasRangeHeader) {
      headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    if (len === 0) {
      res.end();
      return;
    }

    const abortSignal = new AbortController();
    const onClose = () => abortSignal.abort();
    req.on("close", onClose);
    res.on("close", onClose);

    try {
      await new Promise<void>((resolve, reject) => {
        const rs = fs.createReadStream(filePath, { start, end });
        const onAbort = () => {
          rs.destroy();
          resolve();
        };
        abortSignal.signal.addEventListener("abort", onAbort, { once: true });
        rs.on("data", (chunk) => {
          if (abortSignal.signal.aborted || res.destroyed) {
            rs.destroy();
            return;
          }
          if (!res.write(chunk)) {
            rs.pause();
            res.once("drain", () => rs.resume());
          }
        });
        rs.on("end", () => {
          abortSignal.signal.removeEventListener("abort", onAbort);
          resolve();
        });
        rs.on("error", (err) => {
          abortSignal.signal.removeEventListener("abort", onAbort);
          reject(err);
        });
      });
      if (!res.writableEnded) res.end();
    } finally {
      req.off("close", onClose);
      res.off("close", onClose);
    }
  }

  public async streamWithCache(
    req: IncomingMessage,
    res: ServerResponse,
    target: {
      trackId: string | null;
      sourceUrl: string;
      resolvedUrl: string;
      upstreamHeaders?: Record<string, string>;
      onExpiredUpstream?: () => Promise<{
        resolvedUrl: string;
        upstreamHeaders?: Record<string, string>;
      } | null>;
    }
  ): Promise<void> {
    const cacheKey = computeCacheKey(target.sourceUrl);
    this.incrementActive(cacheKey);

    const clientAbort = new AbortController();
    const onClientClose = () => clientAbort.abort();
    req.on("close", onClientClose);
    res.on("close", onClientClose);

    try {
      let resolvedUrl = target.resolvedUrl;
      let upstreamHeaders = target.upstreamHeaders;
      const entry = this.db.getCacheEntry(cacheKey);
      const segments = await this.listSegments(cacheKey);
      const knownTotal = entry?.totalBytes ?? null;

      if (req.method === "HEAD") {
        if (entry && knownTotal != null) {
          res.writeHead(200, {
            "Content-Type": this.inferMime(entry.mimeType, entry.filename, resolvedUrl),
            "Accept-Ranges": "bytes",
            "Content-Length": knownTotal,
            "X-Cache-Status": entry.isComplete ? "HIT" : "PARTIAL",
          });
          res.end();
          return;
        }
        const headRes = await this.fetchImpl(resolvedUrl, {
          method: "HEAD",
          headers: buildUpstreamHeaders(upstreamHeaders),
          signal: clientAbort.signal,
        });
        res.writeHead(headRes.ok ? 200 : headRes.status, {
          "Content-Type": this.inferMime(
            headRes.headers.get("content-type"),
            parseContentDispositionFilename(headRes.headers.get("content-disposition")),
            resolvedUrl
          ),
          "Accept-Ranges": headRes.headers.get("accept-ranges") ?? "bytes",
          ...(headRes.headers.get("content-length")
            ? { "Content-Length": headRes.headers.get("content-length")! }
            : {}),
        });
        res.end();
        return;
      }

      const parsed = parseRangeHeader(req.headers.range, knownTotal);

      if (parsed.invalid && knownTotal != null) {
        res.writeHead(416, {
          "Content-Range": `bytes */${knownTotal}`,
        });
        res.end();
        return;
      }

      // Check local disk cache hit if total size is known
      if (knownTotal != null && segments.length > 0 && parsed.end != null) {
        const hit = this.findContiguousPrefix(segments, parsed.start, parsed.end);
        if (hit && hit.hitEnd >= parsed.end) {
          this.db.touchCacheEntry(cacheKey);
          const mime = this.inferMime(entry?.mimeType ?? null, entry?.filename ?? null, resolvedUrl);
          const len = parsed.end - parsed.start + 1;
          const headers: Record<string, string | number> = {
            "Content-Type": mime,
            "Accept-Ranges": "bytes",
            "Content-Length": len,
            "X-Cache-Status": "HIT",
            "X-Cache-Key": cacheKey,
          };
          if (parsed.hasRangeHeader) {
            headers["Content-Range"] = `bytes ${parsed.start}-${parsed.end}/${knownTotal}`;
            res.writeHead(206, headers);
          } else {
            res.writeHead(200, headers);
          }

          await this.streamDiskSlices(hit.slices, res, clientAbort.signal);
          if (!res.writableEnded) res.end();
          return;
        }

        // Partial prefix hit: serve cached prefix + fetch upstream tail
        if (hit && hit.hitEnd >= parsed.start) {
          const tailStart = hit.hitEnd + 1;
          const tailRange =
            parsed.explicitEnd !== null
              ? `bytes=${tailStart}-${parsed.end}`
              : `bytes=${tailStart}-`;
          let upstreamRes = await this.fetchImpl(resolvedUrl, {
            headers: buildUpstreamHeaders(upstreamHeaders, tailRange),
            signal: clientAbort.signal,
          });

          if (upstreamRes.status === 403 && target.onExpiredUpstream) {
            await upstreamRes.body?.cancel().catch(() => {});
            const refreshed = await target.onExpiredUpstream();
            if (refreshed?.resolvedUrl) {
              resolvedUrl = refreshed.resolvedUrl;
              upstreamHeaders = refreshed.upstreamHeaders ?? upstreamHeaders;
              upstreamRes = await this.fetchImpl(resolvedUrl, {
                headers: buildUpstreamHeaders(upstreamHeaders, tailRange),
                signal: clientAbort.signal,
              });
            }
          }

          const upstreamCr = parseContentRangeHeader(upstreamRes.headers.get("content-range"));
          if (upstreamRes.status === 206 && upstreamRes.body && upstreamCr?.start === tailStart) {
            const mime = this.inferMime(
              entry?.mimeType ?? upstreamRes.headers.get("content-type"),
              entry?.filename ?? parseContentDispositionFilename(upstreamRes.headers.get("content-disposition")),
              resolvedUrl
            );
            const len = parsed.end - parsed.start + 1;
            const headers: Record<string, string | number> = {
              "Content-Type": mime,
              "Accept-Ranges": "bytes",
              "Content-Length": len,
              "X-Cache-Status": "PARTIAL-HIT",
              "X-Cache-Key": cacheKey,
            };
            if (parsed.hasRangeHeader) {
              headers["Content-Range"] = `bytes ${parsed.start}-${parsed.end}/${knownTotal}`;
              res.writeHead(206, headers);
            } else {
              res.writeHead(200, headers);
            }

            await this.streamDiskSlices(hit.slices, res, clientAbort.signal);
            await this.pipeUpstreamAndCache(
              upstreamRes,
              res,
              clientAbort.signal,
              {
                cacheKey,
                trackId: target.trackId,
                sourceUrl: target.sourceUrl,
                resolvedUrl,
                mimeType: mime,
                filename: entry?.filename ?? null,
                totalBytes: knownTotal,
                writeStart: tailStart,
                forwardOffset: tailStart,
              }
            );
            return;
          }
        }
      }

      // Cache miss at reqStart: request from upstream
      const missRange = parsed.hasRangeHeader
        ? parsed.explicitEnd !== null
          ? `bytes=${parsed.start}-${parsed.explicitEnd}`
          : `bytes=${parsed.start}-`
        : undefined;

      let upstreamRes = await this.fetchImpl(resolvedUrl, {
        headers: buildUpstreamHeaders(upstreamHeaders, missRange),
        signal: clientAbort.signal,
      });

      if (upstreamRes.status === 403 && target.onExpiredUpstream) {
        await upstreamRes.body?.cancel().catch(() => {});
        const refreshed = await target.onExpiredUpstream();
        if (refreshed?.resolvedUrl) {
          resolvedUrl = refreshed.resolvedUrl;
          upstreamHeaders = refreshed.upstreamHeaders ?? upstreamHeaders;
          upstreamRes = await this.fetchImpl(resolvedUrl, {
            headers: buildUpstreamHeaders(upstreamHeaders, missRange),
            signal: clientAbort.signal,
          });
        }
      }

      const rawMime = upstreamRes.headers.get("content-type");
      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        let errorMessage = `Upstream host returned HTTP ${upstreamRes.status}`;
        let errorCode = `http_${upstreamRes.status}`;
        try {
          if (rawMime?.includes("application/json")) {
            const errJson = (await upstreamRes.json()) as { value?: string; message?: string };
            if (errJson.message) errorMessage = errJson.message;
            if (errJson.value) errorCode = errJson.value;
          }
        } catch {
          // ignore
        }
        if (!res.headersSent) {
          res.writeHead(upstreamRes.status === 403 || upstreamRes.status === 404 ? upstreamRes.status : 502, {
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ error: errorMessage, errorCode }));
        }
        return;
      }

      if (isNonAudioMime(rawMime)) {
        if (!res.headersSent) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: `Upstream URL returned "${rawMime}" instead of a streamable audio file.`,
              errorCode: "non_audio_response",
            })
          );
        }
        return;
      }

      if (!upstreamRes.body) {
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Upstream response had no body.", errorCode: "empty_body" }));
        }
        return;
      }

      const filename = parseContentDispositionFilename(upstreamRes.headers.get("content-disposition"));
      const mime = this.inferMime(rawMime, filename, resolvedUrl);
      const contentRange = parseContentRangeHeader(upstreamRes.headers.get("content-range"));
      const contentLengthHeader = upstreamRes.headers.get("content-length");
      const upstreamContentLen = contentLengthHeader ? Number(contentLengthHeader) : null;

      let totalBytes: number | null = knownTotal;
      let upstreamStart = 0;

      if (upstreamRes.status === 206 && contentRange) {
        upstreamStart = contentRange.start;
        totalBytes = contentRange.total ?? totalBytes;
      } else if (upstreamRes.status === 200 && upstreamContentLen != null && Number.isFinite(upstreamContentLen)) {
        totalBytes = upstreamContentLen;
        upstreamStart = 0;
      }

      // Check if client asked for range starting past EOF
      if (parsed.hasRangeHeader && totalBytes != null && parsed.start >= totalBytes) {
        res.writeHead(416, { "Content-Range": `bytes */${totalBytes}` });
        res.end();
        return;
      }

      const outHeaders: Record<string, string | number> = {
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
        "X-Cache-Status": "MISS",
        "X-Cache-Key": cacheKey,
      };

      if (parsed.hasRangeHeader && upstreamRes.status === 206 && contentRange) {
        outHeaders["Content-Range"] = `bytes ${contentRange.start}-${contentRange.end}/${contentRange.total ?? "*"}`;
        if (upstreamContentLen != null) outHeaders["Content-Length"] = upstreamContentLen;
        res.writeHead(206, outHeaders);
      } else if (parsed.hasRangeHeader && totalBytes != null) {
        // Upstream ignored Range and sent 200 from 0: send 206 slice to client while caching from 0
        const endByte = parsed.explicitEnd !== null ? Math.min(parsed.explicitEnd, totalBytes - 1) : totalBytes - 1;
        outHeaders["Content-Range"] = `bytes ${parsed.start}-${endByte}/${totalBytes}`;
        outHeaders["Content-Length"] = endByte - parsed.start + 1;
        res.writeHead(206, outHeaders);
      } else {
        if (upstreamContentLen != null) outHeaders["Content-Length"] = upstreamContentLen;
        res.writeHead(200, outHeaders);
      }

      await this.pipeUpstreamAndCache(upstreamRes, res, clientAbort.signal, {
        cacheKey,
        trackId: target.trackId,
        sourceUrl: target.sourceUrl,
        resolvedUrl,
        mimeType: mime,
        filename,
        totalBytes,
        writeStart: upstreamStart,
        forwardOffset: parsed.hasRangeHeader ? parsed.start : upstreamStart,
      });
    } catch (err) {
      if (!clientAbort.signal.aborted && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "Audio stream failed.",
            errorCode: "stream_error",
          })
        );
      } else if (!res.writableEnded) {
        res.end();
      }
    } finally {
      req.off("close", onClientClose);
      res.off("close", onClientClose);
      this.decrementActive(cacheKey);
    }
  }

  private async pipeUpstreamAndCache(
    upstreamRes: Response,
    res: ServerResponse,
    abortSignal: AbortSignal,
    opts: {
      cacheKey: string;
      trackId: string | null;
      sourceUrl: string;
      resolvedUrl: string;
      mimeType: string;
      filename: string | null;
      totalBytes: number | null;
      writeStart: number;
      forwardOffset: number;
    }
  ): Promise<void> {
    const dir = this.entryDir(opts.cacheKey);
    await fsp.mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}.seg`);
    const ws = fs.createWriteStream(tempPath);

    let bytesWritten = 0;
    let currentOffset = opts.writeStart;
    let audioMeta: AudioHeaderInfo | null = null;
    const headChunks: Buffer[] = [];
    let headSize = 0;
    let pendingClientChunk: Buffer | null = null;

    const writeToClient = async (buf: Buffer): Promise<void> => {
      if (abortSignal.aborted || res.destroyed || buf.length === 0) return;
      if (!res.write(buf)) {
        await new Promise<void>((resolve) => {
          const onDone = () => {
            res.off("drain", onDone);
            res.off("close", onDone);
            resolve();
          };
          res.once("drain", onDone);
          res.once("close", onDone);
        });
      }
    };

    const nodeStream = Readable.fromWeb(upstreamRes.body as never);

    try {
      for await (const rawChunk of nodeStream) {
        const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
        if (chunk.length === 0) continue;

        if (opts.writeStart === 0 && headSize < 4096) {
          headChunks.push(chunk);
          headSize += chunk.length;
        }

        // Write to disk cache (with backpressure)
        await writeChunkWithBackpressure(ws, chunk);
        bytesWritten += chunk.length;

        // Forward relevant byte slice with 1-chunk lookahead so commitSegment finishes before final byte reaches client
        const chunkStart = currentOffset;
        const chunkEnd = currentOffset + chunk.length - 1;
        currentOffset += chunk.length;

        if (!abortSignal.aborted && !res.destroyed && chunkEnd >= opts.forwardOffset) {
          const sliceStart = Math.max(0, opts.forwardOffset - chunkStart);
          const toClient = sliceStart === 0 ? chunk : chunk.subarray(sliceStart);
          if (toClient.length > 0) {
            if (pendingClientChunk) {
              await writeToClient(pendingClientChunk);
            }
            pendingClientChunk = toClient;
          }
        }
      }
    } catch (err) {
      if (!abortSignal.aborted) throw err;
    } finally {
      await new Promise<void>((resolve) => {
        ws.end(() => resolve());
      });

      if (opts.writeStart === 0 && headChunks.length > 0) {
        audioMeta = parseAudioHeader(Buffer.concat(headChunks), opts.mimeType);
      }

      await this.commitSegment(
        opts.cacheKey,
        {
          trackId: opts.trackId,
          sourceUrl: opts.sourceUrl,
          resolvedUrl: opts.resolvedUrl,
          mimeType: opts.mimeType,
          filename: opts.filename,
          totalBytes: opts.totalBytes,
          audioMeta,
        },
        tempPath,
        opts.writeStart,
        bytesWritten
      );

      if (pendingClientChunk && !abortSignal.aborted && !res.destroyed && !res.writableEnded) {
        await writeToClient(pendingClientChunk);
      }

      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  public async getCompleteCachedFile(sourceUrl: string): Promise<string | null> {
    const cacheKey = computeCacheKey(sourceUrl);
    const entry = this.db.getCacheEntry(cacheKey);
    if (!entry?.isComplete) return null;
    const segments = await this.listSegments(cacheKey);
    if (segments.length === 1 && segments[0]?.start === 0) {
      return segments[0].filePath;
    }
    return null;
  }

  public async prefetchFullTrack(target: {
    trackId: string | null;
    sourceUrl: string;
    resolvedUrl: string;
    upstreamHeaders?: Record<string, string>;
  }): Promise<CacheEntry> {
    const cacheKey = computeCacheKey(target.sourceUrl);
    const existingPromise = this.activePrefetches.get(cacheKey);
    if (existingPromise) return existingPromise;

    const job = (async () => {
      this.incrementActive(cacheKey);
      try {
        const existing = this.db.getCacheEntry(cacheKey);
        if (existing?.isComplete) {
          this.db.touchCacheEntry(cacheKey);
          return existing;
        }

        const segments = await this.listSegments(cacheKey);
        const startOffset = segments[0]?.start === 0 ? segments[0].end + 1 : 0;

        const headers = buildUpstreamHeaders(
          target.upstreamHeaders,
          startOffset > 0 ? `bytes=${startOffset}-` : undefined
        );

        const upstreamRes = await this.fetchImpl(target.resolvedUrl, { headers });
        const rawMime = upstreamRes.headers.get("content-type");
        if (!upstreamRes.ok && upstreamRes.status !== 206) {
          throw new Error(`Upstream host returned HTTP ${upstreamRes.status}`);
        }
        if (isNonAudioMime(rawMime)) {
          throw new Error(`Upstream returned "${rawMime}" instead of audio.`);
        }
        if (!upstreamRes.body) {
          throw new Error("Upstream response had no body.");
        }

        const filename = parseContentDispositionFilename(upstreamRes.headers.get("content-disposition"));
        const mimeType = this.inferMime(rawMime, filename, target.resolvedUrl);
        const cr = parseContentRangeHeader(upstreamRes.headers.get("content-range"));
        const clHeader = upstreamRes.headers.get("content-length");
        const contentLen = clHeader ? Number(clHeader) : null;

        let writeStart = 0;
        let totalBytes = existing?.totalBytes ?? null;
        if (upstreamRes.status === 206 && cr) {
          writeStart = cr.start;
          totalBytes = cr.total ?? totalBytes;
        } else if (upstreamRes.status === 200 && contentLen != null && Number.isFinite(contentLen)) {
          writeStart = 0;
          totalBytes = contentLen;
        }

        const dir = this.entryDir(cacheKey);
        await fsp.mkdir(dir, { recursive: true });
        const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}.seg`);
        const ws = fs.createWriteStream(tempPath);

        let bytesWritten = 0;
        const headChunks: Buffer[] = [];
        let headSize = 0;

        try {
          for await (const rawChunk of Readable.fromWeb(upstreamRes.body as never)) {
            const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
            if (writeStart === 0 && headSize < 4096) {
              headChunks.push(chunk);
              headSize += chunk.length;
            }
            await writeChunkWithBackpressure(ws, chunk);
            bytesWritten += chunk.length;
          }
        } finally {
          await new Promise<void>((resolve) => {
            ws.end(() => resolve());
          });
        }

        const audioMeta =
          writeStart === 0 && headChunks.length > 0
            ? parseAudioHeader(Buffer.concat(headChunks), mimeType)
            : null;

        if (totalBytes == null && writeStart === 0) {
          totalBytes = bytesWritten;
        }

        return await this.commitSegment(
          cacheKey,
          {
            trackId: target.trackId,
            sourceUrl: target.sourceUrl,
            resolvedUrl: target.resolvedUrl,
            mimeType,
            filename,
            totalBytes,
            audioMeta,
          },
          tempPath,
          writeStart,
          bytesWritten
        );
      } finally {
        this.decrementActive(cacheKey);
        this.activePrefetches.delete(cacheKey);
      }
    })();

    this.activePrefetches.set(cacheKey, job);
    return job;
  }
}
