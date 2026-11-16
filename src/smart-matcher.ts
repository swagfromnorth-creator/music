import type { OnlineSearchResult } from "./media-tools.ts";
import type { ImportedTrackItem } from "./musicbrainz.ts";
import { detectHost } from "./resolver.ts";
import type { DirectoryArtist, HostKind, TrackRecord, TrackerRecord } from "./types.ts";

export type MatchSourceKind = "artistgrid" | "library" | "ytmusic" | "soundcloud" | "youtube" | "direct";

export interface CandidateMatchScore {
  score: number;
  signals: string[];
}

export interface PartialCandidateHint {
  title: string;
  artist: string;
  album: string | null;
  source: MatchSourceKind;
  url: string;
  score: number;
}

export interface MatchedImportDetail {
  inputTitle: string;
  inputArtist: string;
  inputAlbum: string | null;
  trackId: string;
  matchedTitle: string;
  matchedArtist: string;
  matchedAlbum: string | null;
  matchedSource: MatchSourceKind;
  score: number;
  matchReason: string;
  isDuplicateInPlaylist?: boolean;
}

export interface UnmatchedImportDetail {
  title: string;
  artist: string;
  album: string | null;
  reason: string;
  sourcesChecked: string[];
  bestPartialCandidate: PartialCandidateHint | null;
}

const VERSION_TAG_RE =
  /\b(remix|acoustic|live|slowed|sped\s*up|reverb|demo|instrumental|acapella|chopped|deluxe|extended|radio\s*edit|clean|explicit|v\d+|alt)\b/gi;

const NOISE_PENALTY_RE =
  /\b(type\s*beat|free\s*beat|reaction|tutorial|karaoke|nightcore|8d\s*audio|bass\s*boosted|piano\s*cover|guitar\s*cover|drum\s*cover|vocal\s*cover|1\s*hour|looped)\b/i;

const INTERNAL_TRACKER_IDS = new Set(["imported_web", "spotify_imports", "local_files"]);

export function stripFeatureAndNoise(raw: string): string {
  return raw
    .replace(/\s*[\[(](?:feat|ft|with)\.?\s+[^)\]]+[\])]/gi, " ")
    .replace(/\((?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|remaster(?:ed)?(?:\s+\d{4})?|bonus\s*track)\)/gi, " ")
    .replace(/\[(?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|cdq|lossless|hq\s*rip)\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMatchTokens(raw: string): string {
  return stripFeatureAndNoise(raw)
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractVersionTags(rawTitle: string): Set<string> {
  const tags = new Set<string>();
  const matches = rawTitle.match(VERSION_TAG_RE) ?? [];
  for (const m of matches) {
    tags.add(m.toLowerCase().replace(/\s+/g, " ").trim());
  }
  return tags;
}

export function parseDurationTextToSec(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  if (match[3]) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function tokenJaccard(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter((t) => t.length > 0));
  const setB = new Set(b.split(" ").filter((t) => t.length > 0));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function scoreTrackCandidate(
  target: {
    title: string;
    artist: string;
    album: string | null;
    durationSec: number | null;
  },
  candidate: {
    title: string;
    artist: string;
    albumOrEra: string | null;
    extraText?: string | null;
    durationSec: number | null;
    source: MatchSourceKind;
  }
): CandidateMatchScore {
  const signals: string[] = [];
  let score = 0;

  // YouTube/SoundCloud titles often have "Artist - Song", try splitting to avoid artist words diluting title score
  let candTitleRaw = candidate.title;
  let candArtistCombined = `${candidate.artist} ${candidate.extraText ?? ""}`.trim();
  const dashSplit = candidate.title.split(/\s+[—–-]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0] && dashSplit[1]) {
    const leftNorm = normalizeMatchTokens(dashSplit[0]);
    const targetArtistNorm = normalizeMatchTokens(target.artist);
    if (targetArtistNorm && leftNorm && (leftNorm.includes(targetArtistNorm) || targetArtistNorm.includes(leftNorm))) {
      candArtistCombined = `${candArtistCombined} ${dashSplit[0]}`;
      candTitleRaw = dashSplit.slice(1).join(" - ");
    }
  }

  const tTitle = normalizeMatchTokens(target.title);
  const cTitle = normalizeMatchTokens(candTitleRaw);
  const cTitleFull = normalizeMatchTokens(candidate.title);
  if (!tTitle || (!cTitle && !cTitleFull)) {
    return { score: 0, signals: [] };
  }

  const bestTitleOverlap = Math.max(tokenJaccard(tTitle, cTitle), tokenJaccard(tTitle, cTitleFull));
  if (tTitle === cTitle) {
    score += 46;
    signals.push("exact title");
  } else if (
    (cTitle.startsWith(tTitle) || tTitle.startsWith(cTitle) || cTitleFull.includes(tTitle)) &&
    Math.min(tTitle.length, cTitle.length) >= 4
  ) {
    score += 36;
    signals.push("title match");
  } else if (bestTitleOverlap >= 0.45) {
    score += Math.round(bestTitleOverlap * 38);
    signals.push("similar title");
  } else {
    // Reject unrelated song titles outright
    return { score: 0, signals: [] };
  }

  // Version tag consistency
  const tVersions = extractVersionTags(target.title);
  const cVersions = extractVersionTags(`${candidate.title} ${candidate.extraText ?? ""}`);
  if (tVersions.size > 0) {
    const sharedVersion = [...tVersions].some((v) => cVersions.has(v));
    if (sharedVersion) {
      score += 8;
      signals.push("version match");
    } else {
      score -= 22;
    }
  } else {
    if (NOISE_PENALTY_RE.test(candidate.title) && !NOISE_PENALTY_RE.test(target.title)) {
      score -= 34;
    } else if (cVersions.has("slowed") || cVersions.has("sped up")) {
      score -= 24;
    }
  }

  // Artist match (against artist, channel, title prefix, credits)
  const tArtistNorm = normalizeMatchTokens(target.artist);
  const cArtistNorm = normalizeMatchTokens(`${candArtistCombined} ${candidate.title}`);
  if (!tArtistNorm || tArtistNorm === "unknown artist") {
    score += 8;
  } else {
    const primaryTargetArtist = normalizeMatchTokens(
      target.artist.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0] ?? target.artist
    );
    const artistWords = primaryTargetArtist.split(" ").filter((w) => w.length >= 2);
    const allTokensPresent = artistWords.length > 0 && artistWords.every((w) => cArtistNorm.includes(w));
    const anyTokenPresent = artistWords.some((w) => cArtistNorm.includes(w));
    if (primaryTargetArtist && cArtistNorm.includes(primaryTargetArtist)) {
      score += 28;
      signals.push("artist");
    } else if (allTokensPresent) {
      score += 24;
      signals.push("artist");
    } else if (anyTokenPresent) {
      score += 14;
      signals.push("artist token");
    } else {
      score -= 20;
    }
  }

  // Album / Era metadata match
  const tAlbumNorm = normalizeMatchTokens(target.album ?? "");
  const cAlbumNorm = normalizeMatchTokens(`${candidate.albumOrEra ?? ""} ${candidate.extraText ?? ""} ${candidate.title}`);
  if (tAlbumNorm && tAlbumNorm.length >= 2 && cAlbumNorm) {
    const albumJaccard = tokenJaccard(tAlbumNorm, cAlbumNorm);
    if (cAlbumNorm.includes(tAlbumNorm) || albumJaccard >= 0.5) {
      score += 16;
      signals.push("album/era");
    } else if (albumJaccard >= 0.25) {
      score += 8;
      signals.push("partial album");
    }
  }

  // Duration proximity
  if (target.durationSec && target.durationSec > 0 && candidate.durationSec && candidate.durationSec > 0) {
    const diff = Math.abs(target.durationSec - candidate.durationSec);
    if (diff <= 3) {
      score += 14;
      signals.push("duration");
    } else if (diff <= 8) {
      score += 9;
      signals.push("duration");
    } else if (diff <= 15) {
      score += 4;
    } else if (diff > 60) {
      score -= 22;
    }
  }

  // Source fidelity nudge
  if (candidate.source === "artistgrid") {
    score += 6;
  } else if (candidate.source === "library") {
    score += 5;
  } else if (candidate.source === "ytmusic") {
    score += 4;
  }

  return { score: Math.max(0, Math.min(115, score)), signals };
}

export function findDirectoryTrackersForArtist(
  artistName: string,
  directory: DirectoryArtist[]
): DirectoryArtist[] {
  const cleanArtist = normalizeMatchTokens(
    artistName.split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0] ?? artistName
  );
  if (!cleanArtist || cleanArtist === "unknown artist" || cleanArtist.length < 2) {
    return [];
  }

  const scored: Array<{ entry: DirectoryArtist; rank: number }> = [];
  for (const entry of directory) {
    const baseName = entry.name.replace(/\s*\[Alt(?:\s*#\d+)?\]$/i, "").trim();
    const normEntry = normalizeMatchTokens(baseName);
    if (!normEntry) continue;

    let rank = 0;
    if (normEntry === cleanArtist) {
      rank = 100;
    } else if (normEntry.includes(cleanArtist) || cleanArtist.includes(normEntry)) {
      if (Math.min(normEntry.length, cleanArtist.length) >= 4) rank = 70;
    }
    if (rank === 0) continue;

    if (!entry.isLinkWorking) rank -= 30;
    if (/\[Alt/i.test(entry.name)) rank -= 10;
    if (entry.isStarred) rank += 8;
    if (entry.isUpdated) rank += 4;
    scored.push({ entry, rank });
  }

  return scored
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 2)
    .map((s) => s.entry);
}

export interface SmartBatchDependencies {
  searchLocalTracks: (params: { q?: string; trackerId?: string; limit?: number }) => TrackRecord[];
  listTrackers: () => TrackerRecord[];
  getDirectory: () => Promise<DirectoryArtist[]>;
  syncArtistGridTracker: (trackerId: string) => Promise<{ tracker: TrackerRecord; tracksSynced: number }>;
  searchOnline: (query: string, source: "ytmusic" | "youtube" | "soundcloud", limit: number) => Promise<OnlineSearchResult[]>;
  saveOnlineTrack: (input: {
    item: ImportedTrackItem;
    chosenUrl: string;
    host: HostKind;
    thumbnail: string | null;
    durationSec: number | null;
    order: number;
    matchedVia: MatchSourceKind;
    matchReason: string;
  }) => TrackRecord;
}

export interface SmartBatchResult {
  matchedTracks: Array<{ track: TrackRecord; detail: MatchedImportDetail }>;
  unmatched: UnmatchedImportDetail[];
  sourceBreakdown: {
    artistgrid: number;
    library: number;
    ytmusic: number;
    soundcloud: number;
    youtube: number;
    direct: number;
  };
  autoSyncedTrackers: string[];
}

export async function runSmartMultiSourceImport(
  items: ImportedTrackItem[],
  options: {
    sourcePreference?: "auto" | "ytmusic" | "youtube" | "soundcloud";
    resolveOnline?: boolean;
  },
  deps: SmartBatchDependencies
): Promise<SmartBatchResult> {
  const sourcePreference = options.sourcePreference ?? "auto";
  const resolveOnline = options.resolveOnline !== false;

  const matchedTracks: Array<{ track: TrackRecord; detail: MatchedImportDetail }> = [];
  const unmatched: UnmatchedImportDetail[] = [];
  const sourceBreakdown = {
    artistgrid: 0,
    library: 0,
    ytmusic: 0,
    soundcloud: 0,
    youtube: 0,
    direct: 0,
  };
  const autoSyncedTrackerIds = new Set<string>();
  const autoSyncedTrackers: string[] = [];

  let cachedDirectory: DirectoryArtist[] | null = null;
  const existingTrackers = deps.listTrackers();
  const syncedTrackerSet = new Set(existingTrackers.map((t) => t.trackerId));

  const classifyLocalSource = (tr: TrackRecord): MatchSourceKind =>
    INTERNAL_TRACKER_IDS.has(tr.trackerId) || tr.trackerId.startsWith("demo_") ? "library" : "artistgrid";

  const evaluateLocalPool = (
    item: ImportedTrackItem,
    pool: TrackRecord[]
  ): { track: TrackRecord; source: MatchSourceKind; score: number; reason: string } | null => {
    let best: { track: TrackRecord; source: MatchSourceKind; score: number; reason: string } | null = null;
    for (const cand of pool) {
      if (cand.isUnavailable || cand.tabName === "Unavailable") continue;
      const src = classifyLocalSource(cand);
      const candDur = cand.audioMeta?.durationSec ?? parseDurationTextToSec(cand.trackLength);
      const { score, signals } = scoreTrackCandidate(
        { title: item.title, artist: item.artist, album: item.album, durationSec: item.durationSec },
        {
          title: cand.title,
          artist: cand.artist,
          albumOrEra: cand.era,
          extraText: `${cand.credits} ${cand.notes}`,
          durationSec: candDur,
          source: src,
        }
      );
      if (score >= 58 && (!best || score > best.score)) {
        const viaLabel = src === "artistgrid" ? `ArtistGrid (${cand.artist} · ${cand.era})` : "Local Library";
        best = {
          track: cand,
          source: src,
          score,
          reason: `${viaLabel} via ${signals.join(" + ")}`,
        };
      }
    }
    return best;
  };

  const onlineOrder: Array<"ytmusic" | "soundcloud" | "youtube"> =
    sourcePreference === "soundcloud"
      ? ["soundcloud", "ytmusic", "youtube"]
      : sourcePreference === "youtube"
        ? ["youtube", "ytmusic", "soundcloud"]
        : ["ytmusic", "soundcloud", "youtube"];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const sourcesChecked: string[] = ["library", "artistgrid"];
    let bestPartial: PartialCandidateHint | null = null;

    // 0) Direct explicit playable external URL (Bandcamp/SoundCloud/YouTube/direct audio link)
    if (item.externalUrl && detectHost(item.externalUrl) !== "unknown") {
      const host = detectHost(item.externalUrl);
      const saved = deps.saveOnlineTrack({
        item,
        chosenUrl: item.externalUrl,
        host,
        thumbnail: item.coverUrl,
        durationSec: item.durationSec,
        order: idx,
        matchedVia: "direct",
        matchReason: `Direct ${host} URL from import data`,
      });
      sourceBreakdown.direct++;
      matchedTracks.push({
        track: saved,
        detail: {
          inputTitle: item.title,
          inputArtist: item.artist,
          inputAlbum: item.album,
          trackId: saved.id,
          matchedTitle: saved.title,
          matchedArtist: saved.artist,
          matchedAlbum: saved.era || null,
          matchedSource: "direct",
          score: 100,
          matchReason: `Direct ${host} link`,
        },
      });
      continue;
    }

    // 1) Already-synced Local Library & ArtistGrid Trackers
    const cleanCore = stripFeatureAndNoise(item.title);
    const fullQ = `${cleanCore} ${item.artist !== "Unknown Artist" ? item.artist : ""}`.trim();
    const poolA = deps.searchLocalTracks({ q: fullQ, limit: 12 });
    const poolB = cleanCore !== fullQ ? deps.searchLocalTracks({ q: cleanCore, limit: 12 }) : [];
    const seenIds = new Set<string>();
    const combinedLocal = [...poolA, ...poolB].filter((t) => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    const localMatch = evaluateLocalPool(item, combinedLocal);
    if (localMatch && localMatch.score >= 64) {
      if (localMatch.source === "artistgrid") sourceBreakdown.artistgrid++;
      else sourceBreakdown.library++;
      matchedTracks.push({
        track: localMatch.track,
        detail: {
          inputTitle: item.title,
          inputArtist: item.artist,
          inputAlbum: item.album,
          trackId: localMatch.track.id,
          matchedTitle: localMatch.track.title,
          matchedArtist: localMatch.track.artist,
          matchedAlbum: localMatch.track.era || null,
          matchedSource: localMatch.source,
          score: localMatch.score,
          matchReason: localMatch.reason,
        },
      });
      continue;
    }

    // 2) Auto-discover & sync matching ArtistGrid tracker if not already synced
    let discoveredMatch: typeof localMatch = null;
    if (item.artist && item.artist.toLowerCase() !== "unknown artist") {
      if (cachedDirectory === null) {
        try {
          cachedDirectory = await deps.getDirectory();
        } catch {
          cachedDirectory = [];
        }
      }
      const dirHits = findDirectoryTrackersForArtist(item.artist, cachedDirectory);
      for (const dirEntry of dirHits) {
        if (!syncedTrackerSet.has(dirEntry.trackerId) && !autoSyncedTrackerIds.has(dirEntry.trackerId)) {
          autoSyncedTrackerIds.add(dirEntry.trackerId);
          try {
            const synced = await deps.syncArtistGridTracker(dirEntry.trackerId);
            syncedTrackerSet.add(dirEntry.trackerId);
            autoSyncedTrackers.push(`${synced.tracker.artistName} (${synced.tracksSynced} tracks)`);
          } catch {
            // ArtistGrid tracker unreachable; continue gracefully
          }
        }
        if (syncedTrackerSet.has(dirEntry.trackerId)) {
          const trackerPool = deps.searchLocalTracks({
            trackerId: dirEntry.trackerId,
            q: cleanCore,
            limit: 12,
          });
          const hit = evaluateLocalPool(item, trackerPool);
          if (hit && (!discoveredMatch || hit.score > discoveredMatch.score)) {
            discoveredMatch = hit;
          }
        }
      }
    }

    const bestLocalOrTracker =
      discoveredMatch && (!localMatch || discoveredMatch.score > localMatch.score)
        ? discoveredMatch
        : localMatch;
    if (bestLocalOrTracker) {
      if (bestLocalOrTracker.source === "artistgrid") sourceBreakdown.artistgrid++;
      else sourceBreakdown.library++;
      matchedTracks.push({
        track: bestLocalOrTracker.track,
        detail: {
          inputTitle: item.title,
          inputArtist: item.artist,
          inputAlbum: item.album,
          trackId: bestLocalOrTracker.track.id,
          matchedTitle: bestLocalOrTracker.track.title,
          matchedArtist: bestLocalOrTracker.track.artist,
          matchedAlbum: bestLocalOrTracker.track.era || null,
          matchedSource: bestLocalOrTracker.source,
          score: bestLocalOrTracker.score,
          matchReason: bestLocalOrTracker.reason,
        },
      });
      continue;
    }

    if (!resolveOnline) {
      unmatched.push({
        title: item.title,
        artist: item.artist,
        album: item.album,
        reason: "Not found in synced local library or ArtistGrid trackers.",
        sourcesChecked,
        bestPartialCandidate: bestPartial,
      });
      continue;
    }

    // 3) Smart Online Discovery across YouTube Music, SoundCloud & YouTube
    let bestOnline: {
      hit: OnlineSearchResult;
      source: "ytmusic" | "soundcloud" | "youtube";
      score: number;
      signals: string[];
    } | null = null;

    const baseQuery =
      item.artist !== "Unknown Artist" ? `${item.artist} - ${cleanCore}` : cleanCore;
    const albumQuery =
      item.album && item.artist !== "Unknown Artist"
        ? `${item.artist} ${cleanCore} ${item.album}`.trim()
        : null;

    for (const src of onlineOrder) {
      sourcesChecked.push(src);
      const queriesToTry = [baseQuery];
      if (albumQuery && albumQuery !== baseQuery) {
        queriesToTry.push(albumQuery);
      }

      for (const q of queriesToTry) {
        try {
          const hits = await deps.searchOnline(q, src, 5);
          for (const hit of hits) {
            const durSec = hit.durationSec ?? parseDurationTextToSec(hit.durationText);
            const { score, signals } = scoreTrackCandidate(
              { title: item.title, artist: item.artist, album: item.album, durationSec: item.durationSec },
              {
                title: hit.title,
                artist: hit.artist,
                albumOrEra: hit.album,
                durationSec: durSec,
                source: src,
              }
            );
            if (score >= 52) {
              if (!bestOnline || score > bestOnline.score) {
                bestOnline = { hit, source: src, score, signals };
              }
            } else if (score > 0 && (!bestPartial || score > bestPartial.score)) {
              bestPartial = {
                title: hit.title,
                artist: hit.artist,
                album: hit.album,
                source: src,
                url: hit.url,
                score,
              };
            }
          }
          // Stop trying album query if primary already found a strong hit on this source
          if (bestOnline && bestOnline.source === src && bestOnline.score >= 66) {
            break;
          }
        } catch {
          // Continue to remaining sources cleanly
        }
      }

      // If preferred first source already yielded a very confident match (>= 72), stop searching remaining sources
      if (bestOnline && bestOnline.score >= 72) {
        break;
      }
    }

    if (bestOnline) {
      const host: HostKind = bestOnline.source === "soundcloud" ? "soundcloud" : "youtube";
      const saved = deps.saveOnlineTrack({
        item,
        chosenUrl: bestOnline.hit.url,
        host,
        thumbnail: item.coverUrl || bestOnline.hit.thumbnail,
        durationSec: item.durationSec ?? bestOnline.hit.durationSec ?? parseDurationTextToSec(bestOnline.hit.durationText),
        order: idx,
        matchedVia: bestOnline.source,
        matchReason: `${bestOnline.source === "ytmusic" ? "YouTube Music" : bestOnline.source === "soundcloud" ? "SoundCloud" : "YouTube"} (${bestOnline.signals.join(" + ")})`,
      });
      sourceBreakdown[bestOnline.source]++;
      matchedTracks.push({
        track: saved,
        detail: {
          inputTitle: item.title,
          inputArtist: item.artist,
          inputAlbum: item.album,
          trackId: saved.id,
          matchedTitle: bestOnline.hit.title,
          matchedArtist: bestOnline.hit.artist,
          matchedAlbum: bestOnline.hit.album,
          matchedSource: bestOnline.source,
          score: bestOnline.score,
          matchReason: `${bestOnline.source} via ${bestOnline.signals.join(" + ")}`,
        },
      });
      continue;
    }

    // Record detailed failure so user clearly sees what failed & closest candidate if any
    const reasonText = bestPartial
      ? `No confident match across ${sourcesChecked.join(", ")} (closest: "${bestPartial.title}" by ${bestPartial.artist} on ${bestPartial.source}, ${bestPartial.score}/100).`
      : `No playable match found on ${sourcesChecked.join(", ")}.`;

    unmatched.push({
      title: item.title,
      artist: item.artist,
      album: item.album,
      reason: reasonText,
      sourcesChecked,
      bestPartialCandidate: bestPartial,
    });
  }

  return {
    matchedTracks,
    unmatched,
    sourceBreakdown,
    autoSyncedTrackers,
  };
}
