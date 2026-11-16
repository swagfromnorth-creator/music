import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import type { AppDatabase } from "./db.ts";
import { formatDurationSeconds } from "./media-tools.ts";
import type { AudioHeaderInfo, TrackRecord } from "./types.ts";

export const LOCAL_LIBRARY_TRACKER_ID = "local_files";

const SUPPORTED_EXTS = new Set([
  ".flac",
  ".wav",
  ".alac",
  ".aiff",
  ".aif",
  ".m4a",
  ".mp3",
  ".ogg",
  ".opus",
  ".aac",
]);

function mapLocalCodec(codecName: string | undefined, ext: string): AudioHeaderInfo["codec"] {
  const c = (codecName ?? "").toLowerCase();
  if (c.includes("flac") || ext === ".flac") return "FLAC";
  if (c.includes("alac") || ext === ".alac") return "ALAC";
  if (c.includes("opus") || ext === ".opus") return "OPUS";
  if (c.includes("pcm") || ext === ".wav" || ext === ".aiff" || ext === ".aif") return "WAV";
  if (c.includes("mp3") || c.includes("mpeg") || ext === ".mp3") return "MP3";
  if (c.includes("vorbis") || ext === ".ogg") return "OGG";
  if (c.includes("aac") || ext === ".m4a" || ext === ".aac") return "AAC/M4A";
  return "UNKNOWN";
}

async function collectAudioFiles(dirPath: string, maxFiles = 5000): Promise<string[]> {
  const results: string[] = [];
  const stack = [dirPath];

  while (stack.length > 0 && results.length < maxFiles) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (results.length >= maxFiles) break;
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (!ent.name.startsWith(".")) stack.push(full);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) results.push(full);
      }
    }
  }
  return results.sort();
}

export async function scanLocalMusicFolder(
  folderPath: string,
  db: AppDatabase,
  imagesDir: string
): Promise<{
  scannedFiles: number;
  indexedTracks: number;
  albumsCount: number;
  elapsedMs: number;
}> {
  const started = performance.now();
  const resolvedFolder = path.resolve(folderPath.trim());
  const stat = await fsp.stat(resolvedFolder).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Local folder does not exist or is not a directory: "${resolvedFolder}"`);
  }

  await fsp.mkdir(imagesDir, { recursive: true });
  const files = await collectAudioFiles(resolvedFolder);

  const tracks: TrackRecord[] = [];
  const albums = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]!;
    const ext = path.extname(filePath).toLowerCase();
    const fileStat = await fsp.stat(filePath);

    let title = path.basename(filePath, ext);
    let artist = "Local Artist";
    let album = path.basename(path.dirname(filePath)) || "Local Library";
    let credits = "";
    let durationSec: number | undefined;
    let audioMeta: AudioHeaderInfo = {
      codec: mapLocalCodec(undefined, ext),
      lossless: ext === ".flac" || ext === ".wav" || ext === ".alac" || ext === ".aiff" || ext === ".aif",
    };
    let eraImage: string | null = null;
    let yearStr: string | null = null;

    try {
      const parsed = await parseFile(filePath, { duration: true });
      if (parsed.common.title) title = parsed.common.title.trim();
      if (parsed.common.artist) artist = parsed.common.artist.trim();
      if (parsed.common.album) album = parsed.common.album.trim();
      if (parsed.common.artists && parsed.common.artists.length > 1) {
        credits = parsed.common.artists.slice(1).join(", ");
      }
      if (parsed.common.year) yearStr = String(parsed.common.year);

      const fmt = parsed.format;
      const mappedCodec = mapLocalCodec(fmt.codec, ext);
      const isLossless =
        Boolean(fmt.lossless) ||
        mappedCodec === "FLAC" ||
        mappedCodec === "WAV" ||
        mappedCodec === "ALAC";

      durationSec = typeof fmt.duration === "number" ? Math.round(fmt.duration * 10) / 10 : undefined;
      audioMeta = {
        codec: mappedCodec,
        sampleRateHz: typeof fmt.sampleRate === "number" ? fmt.sampleRate : undefined,
        bitsPerSample: typeof fmt.bitsPerSample === "number" ? fmt.bitsPerSample : undefined,
        channels: typeof fmt.numberOfChannels === "number" ? fmt.numberOfChannels : undefined,
        durationSec,
        lossless: isLossless,
      };

      const picture = parsed.common.picture?.[0];
      if (picture?.data && picture.data.length > 0) {
        const picHash = crypto
          .createHash("sha256")
          .update(picture.data)
          .digest("hex")
          .slice(0, 20);
        const key = `local-${picHash}`;
        const binPath = path.join(imagesDir, `${key}.bin`);
        const metaPath = path.join(imagesDir, `${key}.json`);
        if (!fs.existsSync(binPath)) {
          await Promise.all([
            fsp.writeFile(binPath, picture.data),
            fsp.writeFile(metaPath, JSON.stringify({ contentType: picture.format || "image/jpeg" })),
          ]);
        }
        eraImage = `/api/local-art/${key}`;
      }
    } catch {
      // keep filename fallback metadata if tag parse fails
    }

    albums.add(album);
    const id = "loc_" + crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 16);
    const quality = audioMeta.lossless ? "Lossless" : "High Quality";

    tracks.push({
      id,
      trackerId: LOCAL_LIBRARY_TRACKER_ID,
      tabName: "Local Files",
      title,
      rawName: title,
      credits,
      artist,
      era: album,
      subEra: yearStr || "Local",
      eraOrder: 0,
      trackOrder: i,
      eraColor: "#1d3557",
      eraTextColor: "#ffffff",
      eraImage,
      notes: `Local file: ${filePath}`,
      quality,
      formatHint: ext.replace(".", ""),
      trackLength: formatDurationSeconds(durationSec),
      availableLength: null,
      leakDate: yearStr,
      fileDate: null,
      trackType: "Local File",
      primaryUrl: `file://${filePath}`,
      primaryHost: "local",
      links: [
        {
          url: `file://${filePath}`,
          text: path.basename(filePath),
          host: "local",
          playable: true,
          formatHint: ext.replace(".", ""),
        },
      ],
      resolvedUrl: filePath,
      resolvedMime: ext === ".flac" ? "audio/flac" : ext === ".wav" ? "audio/wav" : ext === ".m4a" ? "audio/mp4" : "audio/mpeg",
      resolvedSize: fileStat.size,
      resolvedFilename: path.basename(filePath),
      resolvedAt: Date.now(),
      isPlayable: true,
      audioMeta,
    });
  }

  db.upsertSyncedTracker(
    {
      trackerId: LOCAL_LIBRARY_TRACKER_ID,
      name: "Local Music Library",
      artistName: "Local Files",
      currentTab: "Local Files",
      tabs: [{ name: "Local Files", slug: "local", gid: "" }],
      trackCount: tracks.length,
      playableCount: tracks.length,
      credits: resolvedFolder,
    },
    tracks
  );

  return {
    scannedFiles: files.length,
    indexedTracks: tracks.length,
    albumsCount: albums.size,
    elapsedMs: Math.round((performance.now() - started) * 10) / 10,
  };
}
