import { USER_AGENT } from "./config.ts";
import { resolveWithYtDlp, type YtDlpExtraction } from "./media-tools.ts";
import type { HostKind, HostResolution, TrackLink } from "./types.ts";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type YtDlpResolver = (url: string) => Promise<YtDlpExtraction>;

const TIDAL_APIS = [
  "https://triton.squid.wtf",
  "https://tidal.kinoplus.online",
  "https://tidal-api.binimum.org",
];

const QOBUZ_API = "https://qobuz.squid.wtf/api/download-music";

const AUDIO_EXTENSIONS = new Set(["flac", "wav", "alac", "aiff", "aif", "m4a", "mp3", "ogg", "aac", "opus"]);

const PLAYABLE_HOSTS = new Set<HostKind>([
  "pixeldrain",
  "pillows",
  "krakenfiles",
  "froste",
  "soundcloud",
  "imgur",
  "tidal",
  "qobuz",
  "juicewrld",
  "googledrive",
  "youtube",
  "bandcamp",
  "local",
  "direct",
]);

const HOST_PRIORITY: Record<HostKind, number> = {
  local: 110,
  pillows: 100,
  pixeldrain: 95,
  froste: 90,
  direct: 88,
  tidal: 85,
  qobuz: 85,
  juicewrld: 80,
  bandcamp: 75,
  krakenfiles: 70,
  imgur: 65,
  googledrive: 55,
  soundcloud: 50,
  exoshare: 20,
  youtube: 15,
  unknown: 1,
};

export function normalizeHostUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/pillowcase\.su/gi, "pillows.su");
}

export function detectHost(rawUrl: string): HostKind {
  const url = normalizeHostUrl(rawUrl).toLowerCase();
  if (url.startsWith("file://")) return "local";
  if (/https?:\/\/(?:www\.)?pixeldrain\.com\/[du]\//.test(url)) return "pixeldrain";
  if (/https?:\/\/(?:www\.|api\.)?pillows\.su\/(?:f|api\/download)\//.test(url)) return "pillows";
  if (/https?:\/\/(?:www\.)?krakenfiles\.com\/view\//.test(url)) return "krakenfiles";
  if (/https?:\/\/music\.froste\.lol\/song\//.test(url)) return "froste";
  if (/https?:\/\/(?:www\.|m\.)?soundcloud\.com\/[^/]+\/[^/?#]+/.test(url)) return "soundcloud";
  if (/https?:\/\/[^/]*bandcamp\.com\/track\//.test(url)) return "bandcamp";
  if (/https?:\/\/(?:www\.)?imgur\.gg\//.test(url)) return "imgur";
  if (/https?:\/\/(?:listen\.|www\.)?tidal\.com\/(?:browse\/)?track\//.test(url)) return "tidal";
  if (/https?:\/\/(?:play\.|open\.|www\.)?qobuz\.com\/(?:[^/]+\/)?track\//.test(url)) return "qobuz";
  if (/https?:\/\/(?:www\.)?juicewrldapi\.com\//.test(url)) return "juicewrld";
  if (/https?:\/\/drive\.google\.com\/file\/d\//.test(url)) return "googledrive";
  if (/https?:\/\/(?:www\.)?exoshare\.org\/share\//.test(url)) return "exoshare";
  if (/https?:\/\/(?:www\.|music\.)?(?:youtube\.com|youtu\.be)\//.test(url)) return "youtube";

  const ext = extractExtension(url);
  if (ext && AUDIO_EXTENSIONS.has(ext)) return "direct";
  if (/cdn\.discordapp\.com\/attachments\/.*\.(?:flac|wav|m4a|mp3|ogg|aac|opus)/i.test(url)) return "direct";
  return "unknown";
}

export function isPlayableHost(host: HostKind): boolean {
  return PLAYABLE_HOSTS.has(host);
}

export function extractExtension(urlOrName: string | null | undefined): string | null {
  if (!urlOrName) return null;
  const clean = urlOrName.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";
  const match = clean.match(/\.([a-z0-9]{2,5})$/);
  return match ? match[1]! : null;
}

export function detectFormatHint(url: string, quality?: string | null): string | null {
  const ext = extractExtension(url);
  if (ext && AUDIO_EXTENSIONS.has(ext)) return ext;
  const q = (quality ?? "").toLowerCase();
  if (q.includes("flac")) return "flac";
  if (q.includes("wav")) return "wav";
  if (q.includes("alac")) return "alac";
  if (q.includes("lossless") || q.includes("cdq") || q.includes("cd quality")) return "lossless";
  if (q.includes("m4a") || q.includes("aac")) return "m4a";
  if (q.includes("mp3") || q.includes("320")) return "mp3";
  return null;
}

export function mimeToExtension(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const m = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "audio/flac" || m === "audio/x-flac") return "flac";
  if (m === "audio/wav" || m === "audio/x-wav" || m === "audio/wave") return "wav";
  if (m === "audio/mp4" || m === "audio/x-m4a" || m === "audio/aac") return "m4a";
  if (m === "audio/mpeg" || m === "audio/mp3") return "mp3";
  if (m === "audio/ogg" || m === "application/ogg") return "ogg";
  if (m === "audio/opus") return "opus";
  if (m === "audio/aiff" || m === "audio/x-aiff") return "aiff";
  return null;
}

export function rankLinks(links: TrackLink[]): TrackLink[] {
  return [...links].sort((a, b) => {
    const scoreA =
      (a.playable ? 1000 : 0) +
      (a.formatHint === "flac" || a.formatHint === "wav" || a.formatHint === "lossless" ? 200 : 0) +
      HOST_PRIORITY[a.host];
    const scoreB =
      (b.playable ? 1000 : 0) +
      (b.formatHint === "flac" || b.formatHint === "wav" || b.formatHint === "lossless" ? 200 : 0) +
      HOST_PRIORITY[b.host];
    return scoreB - scoreA;
  });
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveHostUrl(
  rawUrl: string,
  fetchImpl: FetchLike = fetch,
  opts: { ytDlpResolver?: YtDlpResolver; preferYtDlpForSoundcloud?: boolean } = {}
): Promise<HostResolution> {
  const sourceUrl = normalizeHostUrl(rawUrl);
  const host = detectHost(sourceUrl);
  const ytDlpResolve = opts.ytDlpResolver ?? resolveWithYtDlp;

  try {
    switch (host) {
      case "pixeldrain": {
        const match = sourceUrl.match(/pixeldrain\.com\/[du]\/([a-zA-Z0-9]+)/i);
        const id = match?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Pixeldrain file ID.",
          };
        }

        let filename: string | null = null;
        let mimeType: string | null = null;
        let sizeBytes: number | null = null;

        try {
          const infoRes = await fetchWithTimeout(fetchImpl, `https://pixeldrain.com/api/file/${id}/info`, {}, 6000);
          if (infoRes.status === 404) {
            return {
              ok: false,
              sourceUrl,
              host,
              errorCode: "not_found",
              errorMessage: "Pixeldrain file no longer exists (404).",
            };
          }
          if (infoRes.ok) {
            const info = (await infoRes.json()) as {
              name?: string;
              mime_type?: string;
              size?: number;
              availability?: string;
              availability_message?: string;
              can_download?: boolean;
            };
            filename = info.name ?? null;
            mimeType = info.mime_type ?? null;
            sizeBytes = typeof info.size === "number" ? info.size : null;

            if (info.availability && info.availability.includes("captcha")) {
              return {
                ok: false,
                sourceUrl,
                host,
                errorCode: "rate_limited_captcha",
                errorMessage:
                  info.availability_message ||
                  "Pixeldrain requires verification/captcha for this file. Open the source link directly.",
              };
            }
          }
        } catch {
          // Proceed with direct API URL if /info probe times out
        }

        return {
          ok: true,
          sourceUrl,
          resolvedUrl: `https://pixeldrain.com/api/file/${id}`,
          host,
          mimeType,
          filename,
          sizeBytes,
          formatHint: extractExtension(filename) ?? mimeToExtension(mimeType),
        };
      }

      case "pillows": {
        const match = sourceUrl.match(/pillows\.su\/(?:f|api\/download)\/([a-f0-9]+)/i);
        const id = match?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Pillows file ID.",
          };
        }
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: `https://api.pillows.su/api/download/${id}`,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: null,
        };
      }

      case "froste": {
        const match = sourceUrl.match(/music\.froste\.lol\/song\/([a-zA-Z0-9]+)/i);
        const id = match?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Froste song ID.",
          };
        }
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: `https://music.froste.lol/song/${id}/download`,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: null,
        };
      }

      case "krakenfiles": {
        const match = sourceUrl.match(/krakenfiles\.com\/view\/([a-zA-Z0-9]+)/i);
        const id = match?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract KrakenFiles ID.",
          };
        }
        const pageRes = await fetchWithTimeout(fetchImpl, `https://krakenfiles.com/view/${id}/file.html`, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!pageRes.ok) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: `http_${pageRes.status}`,
            errorMessage: `KrakenFiles returned HTTP ${pageRes.status}.`,
          };
        }
        const html = await pageRes.text();
        const m4aMatch =
          html.match(/m4a:\s*['"]([^'"]+)['"]/) ??
          html.match(/<source[^>]+src=['"]([^'"]+)['"]/i) ??
          html.match(/<audio[^>]+src=['"]([^'"]+)['"]/i);
        if (!m4aMatch?.[1]) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "stream_not_found",
            errorMessage: "Could not locate playable media URL on KrakenFiles page.",
          };
        }
        const resolvedUrl = m4aMatch[1].startsWith("//") ? `https:${m4aMatch[1]}` : m4aMatch[1];
        return {
          ok: true,
          sourceUrl,
          resolvedUrl,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: extractExtension(resolvedUrl) ?? "m4a",
        };
      }

      case "imgur": {
        const id =
          sourceUrl.match(/imgur\.gg\/f\/([a-zA-Z0-9]+)/i)?.[1] ??
          sourceUrl.match(/imgur\.gg\/([a-zA-Z0-9]+)(?:\?|$)/i)?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Imgur.gg file ID.",
          };
        }

        const apiRes = await fetchWithTimeout(fetchImpl, `https://imgur.gg/api/file/${id}`, {}, 6000);
        if (apiRes.ok) {
          const data = (await apiRes.json()) as {
            cdnUrl?: string;
            mediaType?: string;
            mimeType?: string;
            type?: string;
            fileName?: string;
            size?: number;
          };
          const mime = data.mediaType || data.mimeType || data.type || null;
          if (mime && mime.startsWith("image/")) {
            return {
              ok: false,
              sourceUrl,
              host,
              errorCode: "not_audio",
              errorMessage: "Imgur.gg link points to an image, not audio.",
            };
          }
          if (data.cdnUrl) {
            return {
              ok: true,
              sourceUrl,
              resolvedUrl: data.cdnUrl,
              host,
              mimeType: mime,
              filename: data.fileName ?? null,
              sizeBytes: typeof data.size === "number" ? data.size : null,
              formatHint: extractExtension(data.cdnUrl) ?? mimeToExtension(mime),
            };
          }
        }

        const htmlRes = await fetchWithTimeout(fetchImpl, `https://imgur.gg/f/${id}`, {
          headers: { Accept: "text/html,application/xhtml+xml" },
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const audioMatch =
            html.match(/<audio[^>]+src=['"]([^'"]+)['"]/i) ??
            html.match(/<source[^>]+src=['"]([^'"]+)['"]/i) ??
            html.match(/https:\/\/[^"'\s\\]+\.(?:flac|wav|m4a|mp3|ogg|aac)/i);
          if (audioMatch) {
            const resolvedUrl = audioMatch[1] ?? audioMatch[0];
            return {
              ok: true,
              sourceUrl,
              resolvedUrl,
              host,
              mimeType: null,
              filename: null,
              sizeBytes: null,
              formatHint: extractExtension(resolvedUrl),
            };
          }
        }

        return {
          ok: false,
          sourceUrl,
          host,
          errorCode: "resolve_failed",
          errorMessage: "Unable to resolve Imgur.gg audio URL.",
        };
      }

      case "soundcloud": {
        if (opts.preferYtDlpForSoundcloud) {
          try {
            const ext = await ytDlpResolve(sourceUrl);
            return {
              ok: true,
              sourceUrl,
              resolvedUrl: ext.streamUrl,
              host,
              mimeType: ext.ext === "m4a" ? "audio/mp4" : ext.ext === "opus" ? "audio/opus" : "audio/mpeg",
              filename: ext.title ? `${ext.title}.${ext.ext ?? "mp3"}` : null,
              sizeBytes: ext.filesize,
              formatHint: ext.ext,
              httpHeaders: ext.httpHeaders,
              durationSec: ext.durationSec,
              thumbnail: ext.thumbnail,
              title: ext.title,
              artist: ext.artist,
              album: ext.album,
            };
          } catch {
            // fall back to sc.maid.zone
          }
        }
        const match = sourceUrl.match(/soundcloud\.com\/([^/]+\/[^/?#]+)/i);
        const trackPath = match?.[1];
        if (!trackPath) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract SoundCloud path.",
          };
        }
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: `https://sc.maid.zone/_/restream/${trackPath}`,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: null,
        };
      }

      case "tidal": {
        const id = sourceUrl.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/i)?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Tidal track ID.",
          };
        }
        for (const base of TIDAL_APIS) {
          try {
            const res = await fetchWithTimeout(
              fetchImpl,
              `${base}/track/?id=${id}&quality=HI_RES_LOSSLESS`,
              {},
              6000
            );
            if (!res.ok) continue;
            const json = (await res.json()) as { data?: { manifest?: string } };
            const manifestB64 = json.data?.manifest;
            if (!manifestB64) continue;
            const decoded = JSON.parse(Buffer.from(manifestB64, "base64").toString("utf8")) as {
              urls?: string[];
              mimeType?: string;
            };
            const firstUrl = decoded.urls?.[0];
            if (firstUrl) {
              return {
                ok: true,
                sourceUrl,
                resolvedUrl: firstUrl,
                host,
                mimeType: decoded.mimeType ?? "audio/flac",
                filename: null,
                sizeBytes: null,
                formatHint: mimeToExtension(decoded.mimeType) ?? "flac",
              };
            }
          } catch {
            // try next Tidal mirror
          }
        }
        return {
          ok: false,
          sourceUrl,
          host,
          errorCode: "tidal_unavailable",
          errorMessage: "Tidal mirror endpoints did not return a playable manifest.",
        };
      }

      case "qobuz": {
        const id = sourceUrl.match(/qobuz\.com\/(?:[^/]+\/)?track\/(\d+)/i)?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Qobuz track ID.",
          };
        }
        const res = await fetchWithTimeout(fetchImpl, `${QOBUZ_API}?track_id=${id}&quality=27`, {}, 7000);
        if (!res.ok) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: `http_${res.status}`,
            errorMessage: `Qobuz resolver returned HTTP ${res.status}.`,
          };
        }
        const json = (await res.json()) as { data?: { url?: string } };
        if (!json.data?.url) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "resolve_failed",
            errorMessage: "Qobuz resolver did not return a stream URL.",
          };
        }
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: json.data.url,
          host,
          mimeType: "audio/flac",
          filename: null,
          sizeBytes: null,
          formatHint: extractExtension(json.data.url) ?? "flac",
        };
      }

      case "googledrive": {
        const id = sourceUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i)?.[1];
        if (!id) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "invalid_url",
            errorMessage: "Could not extract Google Drive file ID.",
          };
        }
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: `https://drive.google.com/uc?export=download&id=${id}`,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: null,
        };
      }

      case "juicewrld":
      case "direct":
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: sourceUrl,
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: extractExtension(sourceUrl),
        };

      case "local":
        return {
          ok: true,
          sourceUrl,
          resolvedUrl: sourceUrl.replace(/^file:\/\//i, ""),
          host,
          mimeType: null,
          filename: null,
          sizeBytes: null,
          formatHint: extractExtension(sourceUrl),
        };

      case "youtube":
      case "bandcamp": {
        try {
          const ext = await ytDlpResolve(sourceUrl);
          const mimeType =
            ext.ext === "m4a"
              ? "audio/mp4"
              : ext.ext === "webm"
                ? "audio/webm"
                : ext.ext === "opus"
                  ? "audio/opus"
                  : ext.ext === "flac"
                    ? "audio/flac"
                    : "audio/mpeg";
          return {
            ok: true,
            sourceUrl,
            resolvedUrl: ext.streamUrl,
            host,
            mimeType,
            filename: ext.title ? `${ext.title}.${ext.ext ?? "m4a"}` : null,
            sizeBytes: ext.filesize,
            formatHint: ext.ext,
            httpHeaders: ext.httpHeaders,
            durationSec: ext.durationSec,
            thumbnail: ext.thumbnail,
            title: ext.title,
            artist: ext.artist,
            album: ext.album,
          };
        } catch (err) {
          return {
            ok: false,
            sourceUrl,
            host,
            errorCode: "ytdlp_failed",
            errorMessage: err instanceof Error ? err.message : "yt-dlp extraction failed.",
          };
        }
      }

      default:
        return {
          ok: false,
          sourceUrl,
          host,
          errorCode: "unsupported_host",
          errorMessage: `Host "${host}" does not provide a known direct audio resolver.`,
        };
    }
  } catch (err) {
    return {
      ok: false,
      sourceUrl,
      host,
      errorCode: "network_error",
      errorMessage: err instanceof Error ? err.message : "Host resolution failed.",
    };
  }
}
