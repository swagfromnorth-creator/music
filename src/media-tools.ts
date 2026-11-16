import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { Innertube } from "youtubei.js";
import type { AudioHeaderInfo } from "./types.ts";

const execFileAsync = promisify(execFile);

export interface YtDlpExtraction {
  streamUrl: string;
  ext: string | null;
  acodec: string | null;
  protocol?: string | null;
  sampleRateHz: number | null;
  abr: number | null;
  filesize: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
  thumbnail: string | null;
  httpHeaders: Record<string, string>;
}

export interface OnlineSearchResult {
  id: string;
  source: "ytmusic" | "youtube" | "soundcloud";
  url: string;
  title: string;
  artist: string;
  album: string | null;
  durationSec: number | null;
  durationText: string | null;
  thumbnail: string | null;
}

export interface OnlineCollectionResult {
  id: string;
  kind: "album" | "playlist";
  source: "ytmusic" | "youtube" | "soundcloud";
  browseId: string;
  url: string;
  title: string;
  artist: string;
  subtitle: string | null;
  thumbnail: string | null;
}

let runtimeCookiesBrowser: string | null = null;

export function setRuntimeCookiesBrowser(browser: string | null): void {
  const clean = (browser ?? "").trim().toLowerCase();
  runtimeCookiesBrowser = clean || null;
}

export function getEffectiveCookiesBrowser(): string | null {
  return runtimeCookiesBrowser ?? ((process.env.YTDLP_COOKIES_BROWSER ?? "").trim().toLowerCase() || null);
}

function findExecutableInWinGet(packagePrefix: string, relativeExeCandidates: string[]): string | null {
  if (process.platform !== "win32") return null;
  const localApp = process.env.LOCALAPPDATA ?? "";
  if (!localApp) return null;
  const pkgRoot = path.join(localApp, "Microsoft", "WinGet", "Packages");
  try {
    if (!fs.existsSync(pkgRoot)) return null;
    for (const dir of fs.readdirSync(pkgRoot)) {
      if (!dir.startsWith(packagePrefix)) continue;
      const fullPkgDir = path.join(pkgRoot, dir);
      for (const rel of relativeExeCandidates) {
        const candidate = path.join(fullPkgDir, rel);
        if (fs.existsSync(candidate)) return candidate;
      }
      // Also inspect one nested subfolder (e.g., ffmpeg-9.0.2-full_build\bin\ffmpeg.exe)
      for (const sub of fs.readdirSync(fullPkgDir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        for (const rel of relativeExeCandidates) {
          const nested = path.join(fullPkgDir, sub.name, rel);
          if (fs.existsSync(nested)) return nested;
        }
      }
    }
  } catch {
    // ignore scan errors
  }
  return null;
}

function findInPath(exeName: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  for (const rawDir of pathEnv.split(path.delimiter)) {
    const dir = rawDir.trim();
    if (!dir) continue;
    try {
      const full = path.join(dir, exeName);
      if (fs.existsSync(full)) return full;
    } catch {
      // ignore
    }
  }
  return null;
}

export function findYtDlpExecutable(): string | null {
  const exe = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  return (
    findInPath(exe) ??
    findExecutableInWinGet("yt-dlp.yt-dlp", ["yt-dlp.exe"]) ??
    (process.platform === "win32" && process.env.LOCALAPPDATA
      ? [path.join(process.env.LOCALAPPDATA, "Programs", "yt-dlp", "yt-dlp.exe")].find((p) => fs.existsSync(p)) ?? null
      : null)
  );
}

export function findFfmpegExecutable(): string | null {
  const exe = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return (
    findInPath(exe) ??
    findExecutableInWinGet("Gyan.FFmpeg", ["bin\\ffmpeg.exe", "ffmpeg.exe"]) ??
    findExecutableInWinGet("yt-dlp.FFmpeg", ["bin\\ffmpeg.exe", "ffmpeg.exe"])
  );
}

export function findFfprobeExecutable(): string | null {
  const exe = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  return (
    findInPath(exe) ??
    findExecutableInWinGet("Gyan.FFmpeg", ["bin\\ffprobe.exe", "ffprobe.exe"]) ??
    findExecutableInWinGet("yt-dlp.FFmpeg", ["bin\\ffprobe.exe", "ffprobe.exe"])
  );
}

function buildToolEnv(): NodeJS.ProcessEnv {
  const extraDirs: string[] = [];
  const ffmpeg = findFfmpegExecutable();
  if (ffmpeg) extraDirs.push(path.dirname(ffmpeg));
  const deno = findExecutableInWinGet("DenoLand.Deno", ["deno.exe"]);
  if (deno) extraDirs.push(path.dirname(deno));

  const currentPath = process.env.PATH ?? "";
  return {
    ...process.env,
    PATH: extraDirs.length > 0 ? `${extraDirs.join(path.delimiter)}${path.delimiter}${currentPath}` : currentPath,
  };
}

export async function resolveWithYtDlp(targetUrl: string, timeoutMs = 15000): Promise<YtDlpExtraction> {
  const ytdlp = findYtDlpExecutable();
  if (!ytdlp) {
    throw new Error("yt-dlp executable was not found on this machine.");
  }

  const args = [
    "--force-ipv4",
    "--dump-json",
    "--no-warnings",
    "--no-playlist",
    "-f",
    "bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio[protocol*=m3u8]/bestaudio/18",
  ];
  const cookieBrowser = getEffectiveCookiesBrowser();
  if (cookieBrowser) {
    args.push("--cookies-from-browser", cookieBrowser);
  }
  args.push("--", targetUrl);

  const { stdout } = await execFileAsync(ytdlp, args, {
    env: buildToolEnv(),
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });

  const info = JSON.parse(stdout.trim()) as {
    url?: string;
    ext?: string;
    acodec?: string;
    protocol?: string;
    asr?: number;
    abr?: number;
    filesize?: number;
    filesize_approx?: number;
    title?: string;
    artist?: string;
    creator?: string;
    uploader?: string;
    channel?: string;
    album?: string;
    duration?: number;
    thumbnail?: string;
    http_headers?: Record<string, string>;
  };

  if (!info.url) {
    throw new Error("yt-dlp did not return a playable direct audio URL.");
  }

  return {
    streamUrl: info.url,
    ext: info.ext ?? null,
    acodec: info.acodec ?? null,
    protocol: info.protocol ?? null,
    sampleRateHz: typeof info.asr === "number" ? info.asr : null,
    abr: typeof info.abr === "number" ? info.abr : null,
    filesize:
      typeof info.filesize === "number"
        ? info.filesize
        : typeof info.filesize_approx === "number"
          ? info.filesize_approx
          : null,
    title: info.title ?? null,
    artist: info.artist || info.creator || info.uploader || info.channel || null,
    album: info.album ?? null,
    durationSec: typeof info.duration === "number" ? info.duration : null,
    thumbnail: info.thumbnail ?? null,
    httpHeaders: info.http_headers ?? {},
  };
}

let ytMusicClientPromise: Promise<Innertube> | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!ytMusicClientPromise) {
    ytMusicClientPromise = Innertube.create({ retrieve_player: false }).catch((err) => {
      ytMusicClientPromise = null;
      throw err;
    });
  }
  return ytMusicClientPromise;
}

export function formatDurationSeconds(sec: number | null | undefined): string | null {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return null;
  const total = Math.round(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export function isCollectionUrl(rawUrl: string): boolean {
  const u = rawUrl.toLowerCase();
  return (
    /(?:youtube\.com|music\.youtube\.com)\/(?:playlist\?list=|browse\/MPREb_)/i.test(u) ||
    /soundcloud\.com\/[^/]+\/sets\/[^/?#]+/i.test(u)
  );
}

function upgradeThumbUrl(rawThumb: string | null | undefined): string | null {
  if (!rawThumb) return null;
  return rawThumb.replace(/=w\d+-h\d+[^&]*/i, "=w544-h544-l90-rj");
}

export async function searchYouTubeMusicCollections(
  query: string,
  limit = 8
): Promise<OnlineCollectionResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  const yt = await getInnertube();
  const [albumsRes, playlistsRes] = await Promise.all([
    yt.music.search(clean, { type: "album" }).catch(() => null),
    yt.music.search(clean, { type: "playlist" }).catch(() => null),
  ]);

  const rawAlbums = ((albumsRes as { albums?: { contents?: unknown[] } })?.albums?.contents ?? []) as Array<{
    id?: string;
    title?: string;
    author?: { name?: string };
    year?: string;
    thumbnails?: Array<{ url?: string }>;
  }>;

  const rawPlaylists = (
    (playlistsRes as { playlists?: { contents?: unknown[] } })?.playlists?.contents ?? []
  ) as Array<{
    id?: string;
    title?: string;
    author?: { name?: string };
    thumbnails?: Array<{ url?: string }>;
  }>;

  const out: OnlineCollectionResult[] = [];
  const half = Math.max(2, Math.ceil(limit / 2));

  for (const a of rawAlbums.slice(0, half)) {
    if (!a.id || !a.title) continue;
    const artist = a.author?.name || "Artist";
    out.push({
      id: a.id,
      kind: "album",
      source: "ytmusic",
      browseId: a.id,
      url: `https://music.youtube.com/browse/${a.id}`,
      title: a.title,
      artist,
      subtitle: a.year ? `Album · ${a.year}` : "Album",
      thumbnail: upgradeThumbUrl(a.thumbnails?.[0]?.url),
    });
  }

  for (const p of rawPlaylists.slice(0, limit - out.length)) {
    if (!p.id || !p.title) continue;
    const listId = p.id.startsWith("VL") ? p.id.slice(2) : p.id;
    out.push({
      id: p.id,
      kind: "playlist",
      source: "ytmusic",
      browseId: p.id,
      url: `https://music.youtube.com/playlist?list=${listId}`,
      title: p.title,
      artist: p.author?.name || "YouTube Music",
      subtitle: "YouTube Music Playlist",
      thumbnail: upgradeThumbUrl(p.thumbnails?.[0]?.url),
    });
  }

  return out;
}

export async function fetchOnlineCollectionTracks(params: {
  kind?: "album" | "playlist";
  source?: "ytmusic" | "youtube" | "soundcloud";
  idOrUrl: string;
}): Promise<{
  title: string;
  artist: string;
  thumbnail: string | null;
  tracks: OnlineSearchResult[];
}> {
  const input = params.idOrUrl.trim();
  const albumBrowseMatch = input.match(/(MPREb_[a-zA-Z0-9_-]+)/);
  const ytListMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/) ?? input.match(/^(VL[a-zA-Z0-9_-]+|OLAK[a-zA-Z0-9_-]+|PL[a-zA-Z0-9_-]+|RDCLAK[a-zA-Z0-9_-]+)$/);

  // 1) Try YouTube Music Album via Innertube
  if (params.kind === "album" || albumBrowseMatch) {
    const browseId = albumBrowseMatch?.[1] ?? input;
    const yt = await getInnertube();
    const alb = await yt.music.getAlbum(browseId);
    const header = (alb as { header?: { title?: { text?: string }; subtitle?: { text?: string }; thumbnail?: { contents?: Array<{ url?: string }> } } }).header;
    const title = header?.title?.text || "Album";
    const cover = upgradeThumbUrl(header?.thumbnail?.contents?.[0]?.url);
    const rawItems = ((alb as { contents?: unknown[] }).contents ?? []) as Array<{
      id?: string;
      title?: string;
      artists?: Array<{ name?: string }>;
      duration?: { text?: string; seconds?: number };
      flex_columns?: Array<{ title?: { text?: string } }>;
    }>;

    const artistHint =
      rawItems[0]?.artists?.map((a) => a.name).filter(Boolean).join(", ") ||
      header?.subtitle?.text?.replace(/Album\s*•\s*/i, "").trim() ||
      "Artist";

    const tracks: OnlineSearchResult[] = [];
    for (const item of rawItems.slice(0, 50)) {
      if (!item.id) continue;
      const trackTitle = item.title || item.flex_columns?.[0]?.title?.text || "Untitled";
      const trackArtist = item.artists?.map((a) => a.name).filter(Boolean).join(", ") || artistHint;
      tracks.push({
        id: item.id,
        source: "ytmusic",
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: trackTitle,
        artist: trackArtist,
        album: title,
        durationSec: item.duration?.seconds ?? null,
        durationText: item.duration?.text ?? formatDurationSeconds(item.duration?.seconds),
        thumbnail: cover,
      });
    }
    return { title, artist: artistHint, thumbnail: cover, tracks };
  }

  // 2) Try YouTube Music Playlist via Innertube
  if ((params.source === "ytmusic" || ytListMatch) && !/soundcloud\.com/i.test(input)) {
    const rawListId = ytListMatch?.[1] ?? input;
    const browseOrListId = rawListId.startsWith("VL") ? rawListId : rawListId;
    try {
      const yt = await getInnertube();
      const pl = await yt.music.getPlaylist(browseOrListId);
      const header = (pl as { header?: { title?: { text?: string }; author?: { name?: string }; thumbnail?: { contents?: Array<{ url?: string }> } } }).header;
      const title = header?.title?.text || "Playlist";
      const cover = upgradeThumbUrl(header?.thumbnail?.contents?.[0]?.url);
      const rawItems = (
        (pl as { items?: unknown[]; contents?: unknown[] }).items ??
        (pl as { contents?: unknown[] }).contents ??
        []
      ) as Array<{
        id?: string;
        title?: string;
        artists?: Array<{ name?: string }>;
        duration?: { text?: string; seconds?: number };
        thumbnails?: Array<{ url?: string }>;
      }>;

      const tracks: OnlineSearchResult[] = [];
      for (const item of rawItems.slice(0, 50)) {
        if (!item.id || !item.title) continue;
        tracks.push({
          id: item.id,
          source: "ytmusic",
          url: `https://www.youtube.com/watch?v=${item.id}`,
          title: item.title,
          artist: item.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Various Artists",
          album: title,
          durationSec: item.duration?.seconds ?? null,
          durationText: item.duration?.text ?? formatDurationSeconds(item.duration?.seconds),
          thumbnail: upgradeThumbUrl(item.thumbnails?.[0]?.url) || cover,
        });
      }
      if (tracks.length > 0) {
        return { title, artist: header?.author?.name || "YouTube Music", thumbnail: cover, tracks };
      }
    } catch {
      // Fall through cleanly to yt-dlp --flat-playlist
    }
  }

  // 3) Generic YouTube or SoundCloud playlist URL via yt-dlp --flat-playlist
  const ytdlp = findYtDlpExecutable();
  if (!ytdlp) {
    throw new Error("yt-dlp executable was not found to load playlist.");
  }
  const targetUrl =
    /^https?:\/\//i.test(input)
      ? input
      : `https://www.youtube.com/playlist?list=${input.replace(/^VL/, "")}`;

  const args = ["--force-ipv4", "--flat-playlist", "--dump-json", "--no-warnings", "--playlist-end", "50"];
  const cookieBrowser = getEffectiveCookiesBrowser();
  if (cookieBrowser) args.push("--cookies-from-browser", cookieBrowser);
  args.push("--", targetUrl);

  const { stdout } = await execFileAsync(ytdlp, args, {
    env: buildToolEnv(),
    timeout: 20000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const tracks: OnlineSearchResult[] = [];
  let playlistTitle = "Imported Playlist";
  let playlistCover: string | null = null;

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const item = JSON.parse(line) as {
        id?: string;
        url?: string;
        webpage_url?: string;
        title?: string;
        uploader?: string;
        artist?: string;
        playlist_title?: string;
        duration?: number;
        thumbnail?: string;
        thumbnails?: Array<{ url?: string }>;
      };
      if (item.playlist_title) playlistTitle = item.playlist_title;
      const thumb = upgradeThumbUrl(item.thumbnail || item.thumbnails?.[item.thumbnails.length - 1]?.url);
      if (!playlistCover && thumb) playlistCover = thumb;
      const url = item.webpage_url || item.url;
      if (!url || !item.title) continue;
      const src: "soundcloud" | "youtube" = /soundcloud\.com/i.test(url) ? "soundcloud" : "youtube";
      tracks.push({
        id: item.id || url,
        source: src,
        url,
        title: item.title,
        artist: item.artist || item.uploader || (src === "soundcloud" ? "SoundCloud" : "YouTube"),
        album: playlistTitle,
        durationSec: typeof item.duration === "number" ? item.duration : null,
        durationText: formatDurationSeconds(item.duration),
        thumbnail: thumb,
      });
    } catch {
      // skip malformed item
    }
  }

  return { title: playlistTitle, artist: "Imported Collection", thumbnail: playlistCover, tracks };
}

export async function searchYouTubeMusic(query: string, limit = 12): Promise<OnlineSearchResult[]> {
  const yt = await getInnertube();
  const res = await yt.music.search(query, { type: "song" });
  const rawItems = (res as { songs?: { contents?: unknown[] } })?.songs?.contents ?? [];

  const out: OnlineSearchResult[] = [];
  for (const raw of rawItems) {
    if (out.length >= limit) break;
    const item = raw as {
      id?: string;
      title?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string };
      duration?: { text?: string; seconds?: number };
      thumbnails?: Array<{ url?: string }>;
    };
    if (!item.id || !item.title) continue;
    const rawThumb = item.thumbnails?.[0]?.url ?? null;
    const thumb = rawThumb ? rawThumb.replace(/=w\d+-h\d+/i, "=w544-h544") : null;
    const artist = (item.artists ?? []).map((a) => a.name).filter(Boolean).join(", ") || "Unknown Artist";
    out.push({
      id: item.id,
      source: "ytmusic",
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title: item.title,
      artist,
      album: item.album?.name ?? null,
      durationSec: item.duration?.seconds ?? null,
      durationText: item.duration?.text ?? formatDurationSeconds(item.duration?.seconds),
      thumbnail: thumb,
    });
  }
  return out;
}

export async function searchWithYtDlp(
  query: string,
  source: "youtube" | "soundcloud",
  limit = 10
): Promise<OnlineSearchResult[]> {
  const ytdlp = findYtDlpExecutable();
  if (!ytdlp) {
    throw new Error("yt-dlp executable was not found on this machine.");
  }

  const prefix = source === "soundcloud" ? "scsearch" : "ytsearch";
  const clampedLimit = Math.max(1, Math.min(20, limit));
  const target = `${prefix}${clampedLimit}:${query}`;

  const { stdout } = await execFileAsync(
    ytdlp,
    ["--force-ipv4", "--flat-playlist", "--dump-json", "--no-warnings", "--", target],
    {
      env: buildToolEnv(),
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
    }
  );

  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().startsWith("{"));
  const out: OnlineSearchResult[] = [];

  for (const line of lines) {
    try {
      const item = JSON.parse(line) as {
        id?: string;
        url?: string;
        webpage_url?: string;
        title?: string;
        uploader?: string;
        channel?: string;
        artist?: string;
        duration?: number;
        duration_string?: string;
        thumbnails?: Array<{ url?: string }>;
        thumbnail?: string;
      };
      const url = item.webpage_url || item.url;
      if (!url || !item.title) continue;
      const thumb = item.thumbnail || item.thumbnails?.[item.thumbnails.length - 1]?.url || null;
      out.push({
        id: item.id || url,
        source,
        url,
        title: item.title,
        artist: item.artist || item.uploader || item.channel || (source === "soundcloud" ? "SoundCloud" : "YouTube"),
        album: null,
        durationSec: typeof item.duration === "number" ? item.duration : null,
        durationText: item.duration_string || formatDurationSeconds(item.duration),
        thumbnail: thumb,
      });
    } catch {
      // skip malformed line
    }
  }
  return out;
}

export async function searchOnlineMedia(
  query: string,
  source: "ytmusic" | "youtube" | "soundcloud" = "ytmusic",
  limit = 12
): Promise<OnlineSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  if (source === "ytmusic") {
    try {
      const items = await searchYouTubeMusic(clean, limit);
      if (items.length > 0) return items;
    } catch {
      // fall back cleanly to yt-dlp ytsearch
    }
    return searchWithYtDlp(clean, "youtube", limit);
  }

  return searchWithYtDlp(clean, source, limit);
}

function mapFfprobeCodec(codecName: string): AudioHeaderInfo["codec"] {
  const c = codecName.toLowerCase();
  if (c === "flac") return "FLAC";
  if (c === "alac") return "ALAC";
  if (c === "opus") return "OPUS";
  if (c === "aac") return "AAC/M4A";
  if (c === "mp3" || c === "mp3float") return "MP3";
  if (c === "vorbis") return "OGG";
  if (c.startsWith("pcm_")) return "WAV";
  return "UNKNOWN";
}

export async function probeAudioWithFfprobe(filePathOrUrl: string): Promise<AudioHeaderInfo | null> {
  const ffprobe = findFfprobeExecutable();
  if (!ffprobe) return null;

  try {
    const { stdout } = await execFileAsync(
      ffprobe,
      ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", "--", filePathOrUrl],
      {
        env: buildToolEnv(),
        timeout: 6000,
      }
    );
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        sample_rate?: string;
        channels?: number;
        bits_per_sample?: number;
        bits_per_raw_sample?: string;
        duration?: string;
      }>;
      format?: { duration?: string };
    };

    const audioStream = parsed.streams?.find((s) => s.codec_type === "audio");
    if (!audioStream?.codec_name) return null;

    const rawCodec = audioStream.codec_name.toLowerCase();
    const mapped = mapFfprobeCodec(rawCodec);
    const sampleRateHz = audioStream.sample_rate ? Number(audioStream.sample_rate) : undefined;
    const rawBps = audioStream.bits_per_raw_sample
      ? Number(audioStream.bits_per_raw_sample)
      : audioStream.bits_per_sample;
    const bitsPerSample = rawBps && Number.isFinite(rawBps) && rawBps > 0 ? rawBps : undefined;
    const durRaw = audioStream.duration || parsed.format?.duration;
    const durationSec = durRaw && Number.isFinite(Number(durRaw)) ? Math.round(Number(durRaw) * 10) / 10 : undefined;
    const lossless =
      rawCodec === "flac" ||
      rawCodec === "alac" ||
      rawCodec.startsWith("pcm_") ||
      rawCodec === "wavpack" ||
      rawCodec === "ape";

    return {
      codec: mapped,
      sampleRateHz: sampleRateHz && Number.isFinite(sampleRateHz) ? sampleRateHz : undefined,
      bitsPerSample,
      channels: typeof audioStream.channels === "number" ? audioStream.channels : undefined,
      durationSec,
      lossless,
    };
  } catch {
    return null;
  }
}

export async function remuxStreamToFile(
  inputPathOrUrl: string,
  outputPath: string,
  httpHeaders?: Record<string, string>,
  timeoutMs = 45000
): Promise<{ mimeType: string; ext: string; sizeBytes: number }> {
  const ffmpeg = findFfmpegExecutable();
  if (!ffmpeg) {
    throw new Error("ffmpeg executable not found for stream remuxing.");
  }

  const baseInputArgs = ["-hide_banner", "-loglevel", "error", "-y"];
  if (/^https?:\/\//i.test(inputPathOrUrl) && httpHeaders) {
    const headerLines = Object.entries(httpHeaders)
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join("");
    if (headerLines) {
      baseInputArgs.push("-headers", headerLines);
    }
  }
  baseInputArgs.push("-i", inputPathOrUrl, "-vn");

  // 1) Try lossless container remux first (ftypdash / HLS m3u8 AAC -> faststart ftypisom M4A)
  try {
    await execFileAsync(
      ffmpeg,
      [...baseInputArgs, "-c:a", "copy", "-movflags", "+faststart", "-f", "mp4", outputPath],
      { env: buildToolEnv(), timeout: timeoutMs }
    );
    const stat = fs.statSync(outputPath);
    if (stat.size > 1024) {
      return { mimeType: "audio/mp4", ext: "m4a", sizeBytes: stat.size };
    }
  } catch {
    // Fall through to compatibility MP3 transcode
  }

  // 2) Fallback transcode to standard 256kbps MP3 (handles WebM Opus/Vorbis -> universal MP3)
  await execFileAsync(
    ffmpeg,
    [...baseInputArgs, "-c:a", "libmp3lame", "-b:a", "256k", "-f", "mp3", outputPath],
    { env: buildToolEnv(), timeout: timeoutMs }
  );
  const stat = fs.statSync(outputPath);
  if (stat.size <= 0) {
    throw new Error("ffmpeg produced an empty audio file.");
  }
  return { mimeType: "audio/mpeg", ext: "mp3", sizeBytes: stat.size };
}

export async function streamTranscodedAudio(
  inputPathOrUrl: string,
  res: ServerResponse,
  options: { lossless?: boolean; forceMp3?: boolean; httpHeaders?: Record<string, string> } = {}
): Promise<void> {
  const ffmpeg = findFfmpegExecutable();
  if (!ffmpeg) {
    res.writeHead(501, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "ffmpeg executable not found for audio transcoding." }));
    return;
  }

  const args = ["-hide_banner", "-loglevel", "error"];
  if (/^https?:\/\//i.test(inputPathOrUrl) && options.httpHeaders) {
    const headerLines = Object.entries(options.httpHeaders)
      .filter(([, v]) => Boolean(v))
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join("");
    if (headerLines) {
      args.push("-headers", headerLines);
    }
  }

  args.push("-i", inputPathOrUrl, "-vn");
  const useFlac = Boolean(options.lossless && !options.forceMp3);
  if (useFlac) {
    args.push("-c:a", "flac", "-f", "flac", "pipe:1");
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", "320k", "-f", "mp3", "pipe:1");
  }

  res.writeHead(200, {
    "Content-Type": useFlac ? "audio/flac" : "audio/mpeg",
    "Cache-Control": "no-store",
    "X-Transcoded-By": "ffmpeg",
  });

  const child = spawn(ffmpeg, args, {
    env: buildToolEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const onClose = () => {
    if (!child.killed) child.kill();
  };
  res.on("close", onClose);

  child.stdout.pipe(res);
  await new Promise<void>((resolve) => {
    child.on("close", () => {
      res.off("close", onClose);
      if (!res.writableEnded) res.end();
      resolve();
    });
    child.on("error", () => {
      res.off("close", onClose);
      if (!res.writableEnded) res.end();
      resolve();
    });
  });
}
