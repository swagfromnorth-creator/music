import type { FetchLike } from "./resolver.ts";

const MB_USER_AGENT = "VaultStream/1.0 (https://github.com/swagfromnorth-creator/music)";

export interface CleanedMediaQuery {
  artist: string;
  title: string;
}

export interface MusicBrainzMatch {
  mbid: string;
  title: string;
  artist: string;
  album: string | null;
  year: string | null;
  releaseGroupId: string | null;
  releaseId: string | null;
  coverArtUrl: string | null;
}

export interface ImportedTrackItem {
  title: string;
  artist: string;
  album: string | null;
  durationSec: number | null;
  externalUrl: string | null;
  coverUrl: string | null;
}

export function cleanMessyTrackTitle(rawTitle: string, uploaderOrChannel = ""): CleanedMediaQuery {
  let text = rawTitle
    .replace(/\((?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|explicit|clean|remastered[^)]*)\)/gi, " ")
    .replace(/\[(?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|explicit|clean|prod\.?[^\]]*|cdq|lossless|snippet|leak)\]/gi, " ")
    .replace(/\s+\|\s+.*$/, " ")
    .replace(/\s+/g, " ")
    .trim();

  let artist = uploaderOrChannel
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .trim();

  const dashSplit = text.split(/\s+[—–-]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0] && dashSplit[1]) {
    artist = dashSplit[0].trim();
    text = dashSplit.slice(1).join(" - ").trim();
  }

  // Strip trailing feat./ft. from title when querying MusicBrainz recording
  const title = text
    .replace(/\s*[\[(](?:feat|ft|with)\.?\s+[^)\]]+[\])]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    artist,
    title: title || rawTitle.trim(),
  };
}

let lastMbRequestAt = 0;
let mbQueue: Promise<unknown> = Promise.resolve();

async function scheduleMbFetch<T>(fn: () => Promise<T>): Promise<T> {
  const run = mbQueue.then(async () => {
    const elapsed = Date.now() - lastMbRequestAt;
    if (elapsed < 1050) {
      await new Promise((r) => setTimeout(r, 1050 - elapsed));
    }
    lastMbRequestAt = Date.now();
    return fn();
  });
  mbQueue = run.catch(() => {});
  return run;
}

export async function lookupMusicBrainzMetadata(
  rawTitle: string,
  rawArtist = "",
  fetchImpl: FetchLike = fetch
): Promise<MusicBrainzMatch | null> {
  const cleaned = cleanMessyTrackTitle(rawTitle, rawArtist);
  if (!cleaned.title) return null;

  const esc = (s: string) => s.replace(/["\\]/g, " ").trim();
  const queryParts = [`recording:"${esc(cleaned.title)}"`];
  if (cleaned.artist) {
    queryParts.push(`artist:"${esc(cleaned.artist)}"`);
  }
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(queryParts.join(" AND "))}&fmt=json&limit=5`;

  return scheduleMbFetch(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": MB_USER_AGENT,
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;

      const json = (await res.json()) as {
        recordings?: Array<{
          id?: string;
          title?: string;
          score?: number;
          "artist-credit"?: Array<{ name?: string; artist?: { name?: string } }>;
          releases?: Array<{
            id?: string;
            title?: string;
            status?: string;
            date?: string;
            "release-group"?: { id?: string; "primary-type"?: string };
          }>;
        }>;
      };

      const rec = json.recordings?.[0];
      if (!rec || !rec.id || !rec.title) return null;
      if (typeof rec.score === "number" && rec.score < 55) return null;

      const artist =
        rec["artist-credit"]
          ?.map((c) => c.name || c.artist?.name)
          .filter(Boolean)
          .join(", ") || cleaned.artist || "Unknown Artist";

      const officialRelease =
        rec.releases?.find((r) => r.status === "Official" && r["release-group"]?.["primary-type"] === "Album") ??
        rec.releases?.find((r) => r.status === "Official") ??
        rec.releases?.[0];

      const releaseId = officialRelease?.id ?? null;
      const releaseGroupId = officialRelease?.["release-group"]?.id ?? null;
      const album = officialRelease?.title ?? null;
      const year = officialRelease?.date ? officialRelease.date.slice(0, 4) : null;

      let coverArtUrl: string | null = null;
      if (releaseGroupId || releaseId) {
        const candidates = [
          releaseGroupId ? `https://coverartarchive.org/release-group/${releaseGroupId}/front-500` : null,
          releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : null,
        ].filter((u): u is string => Boolean(u));

        for (const caaUrl of candidates) {
          try {
            const headRes = await fetchImpl(caaUrl, {
              method: "HEAD",
              headers: { "User-Agent": MB_USER_AGENT },
            });
            if (headRes.ok) {
              coverArtUrl = headRes.url || caaUrl;
              break;
            }
          } catch {
            // try next cover URL
          }
        }
      }

      return {
        mbid: rec.id,
        title: rec.title,
        artist,
        album,
        year,
        releaseGroupId,
        releaseId,
        coverArtUrl,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      rows.push([...row, field]);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

export function parseSpotifyPlaylistInput(rawText: string): ImportedTrackItem[] {
  const trimmed = rawText.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];

  // 1. JSON (SpotDL export or array of track objects)
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as
        | Array<Record<string, unknown>>
        | { tracks?: Array<Record<string, unknown>>; songs?: Array<Record<string, unknown>> };
      const list = Array.isArray(parsed) ? parsed : parsed.tracks ?? parsed.songs ?? [];
      const items: ImportedTrackItem[] = [];
      for (const entry of list) {
        const title = String(entry.name ?? entry.title ?? entry.trackName ?? "").trim();
        if (!title) continue;
        const artistsRaw = entry.artists ?? entry.artist ?? entry.artistName;
        const artist = Array.isArray(artistsRaw)
          ? artistsRaw.map((a) => (typeof a === "string" ? a : String((a as { name?: string })?.name ?? ""))).filter(Boolean).join(", ")
          : String(artistsRaw ?? "").trim();
        const album = entry.album_name || entry.album ? String(entry.album_name ?? entry.album).trim() : null;
        const durMs = typeof entry.duration_ms === "number" ? entry.duration_ms : null;
        const durSec =
          typeof entry.duration === "number"
            ? entry.duration
            : durMs
              ? Math.round(durMs / 1000)
              : null;
        const externalUrl =
          typeof entry.url === "string"
            ? entry.url
            : typeof entry.download_url === "string"
              ? entry.download_url
              : null;
        const coverUrl = typeof entry.cover_url === "string" ? entry.cover_url : null;
        items.push({ title, artist: artist || "Unknown Artist", album, durationSec: durSec, externalUrl, coverUrl });
      }
      if (items.length > 0) return items;
    } catch {
      // fall through to CSV / text parser
    }
  }

  // 2. CSV (Exportify / Spotify playlist CSV)
  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  if (firstLine.includes(",") && /track|title|name|artist/i.test(firstLine)) {
    const rows = parseCsvRows(trimmed);
    const headers = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
    const findCol = (names: string[]) => headers.findIndex((h) => names.some((n) => h === n || h.includes(n)));

    const titleIdx = findCol(["track name", "title", "song", "name"]);
    const artistIdx = findCol(["artist name", "artists", "artist"]);
    const albumIdx = findCol(["album name", "album"]);
    const durIdx = findCol(["duration (ms)", "duration_ms", "duration"]);
    const urlIdx = findCol(["track uri", "spotify url", "url"]);

    if (titleIdx !== -1) {
      const items: ImportedTrackItem[] = [];
      for (const cols of rows) {
        const title = (cols[titleIdx] ?? "").trim();
        if (!title) continue;
        const artist = artistIdx !== -1 ? (cols[artistIdx] ?? "").replace(/;/g, ", ").trim() : "";
        const album = albumIdx !== -1 ? (cols[albumIdx] ?? "").trim() || null : null;
        const rawDur = durIdx !== -1 ? Number(cols[durIdx]) : NaN;
        const durationSec = Number.isFinite(rawDur) && rawDur > 0 ? (rawDur > 10000 ? Math.round(rawDur / 1000) : Math.round(rawDur)) : null;
        const externalUrl = urlIdx !== -1 ? (cols[urlIdx] ?? "").trim() || null : null;
        items.push({
          title,
          artist: artist || "Unknown Artist",
          album,
          durationSec,
          externalUrl: externalUrl && /^https?:\/\//i.test(externalUrl) ? externalUrl : null,
          coverUrl: null,
        });
      }
      if (items.length > 0) return items;
    }
  }

  // 3. Plain text ("Artist - Song Title" lines)
  const items: ImportedTrackItem[] = [];
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.replace(/^\d+[.)]\s*/, "").trim();
    if (!line) continue;
    const cleaned = cleanMessyTrackTitle(line);
    items.push({
      title: cleaned.title,
      artist: cleaned.artist || "Unknown Artist",
      album: null,
      durationSec: null,
      externalUrl: null,
      coverUrl: null,
    });
  }
  return items;
}
