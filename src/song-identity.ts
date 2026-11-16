import type { TrackLink, TrackRecord } from "./types.ts";

const DECORATIVE_EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0E}\u{FE0F}]/gu;

const NOISE_TAG_RE =
  /[\[(]\s*(?:official\s+(?:music\s+)?(?:video|audio|lyric\s*video|visualizer)|lyrics?|hd|hq|4k|cdq|lossless|master\s+file|explicit|clean|remastered[^)\]]*|(?:feat|ft|with)\.?\s+[^)\]]+)\s*[\])]/gi;

const VERSION_TOKEN_RE =
  /[\[(]\s*(?:(v\d+(?:\s*-\s*v?\d+)?|demo(?:\s*\d+)?|remix|og(?:\s+file)?|alt(?:ernate)?(?:\s+mix)?|self[-\s]?bounce|acoustic|slowed(?:\s*\+?\s*reverb)?|sped\s*up|nightcore|live|instrumental|acapella|extended|deluxe|edit|master|ref(?:erence)?(?:\s+track)?|session(?:s)?|mix\s*\d+))\s*[\])]/gi;

const PRODUCER_TAG_RE = /[\[(]\s*prod\.?\s+([^)\]]+)[\])]/gi;

const NON_SONG_TAB_RE =
  /\b(?:art|tracklists?|interviews?|music\s+videos?|videos?|merch|socials?|social\s+media|tours?|groupbuys?|buys|bpm\s*&?\s*keys?|key|stems?|stem\s+edits|fan\s+edits|tour\s+remixes|edits|performances?|live\s+performances?|album\s+copies|compilations?|ai\s+tracks?|fakes?|misc)\b/i;

const NON_SONG_TYPE_RE =
  /^(?:album\/zip|zip|sessions|discord|live|interview|music\s+video|video|art|cover|front\s+cover|back\s+cover|tracklist|merch|tour|stems?)$/i;

const NON_SONG_QUALITY_RE = /^(?:performance|hd\s*\(\d+p\))$/i;

const NON_SONG_TITLE_RE =
  /[\[(]\s*(?:stems?|music\s+video|interview|cover\s+art|album\s+cover|tracklist|script|merch|trailer|concert|unheard\s+.+\s+sessions)\s*[\])]|^\[?\d+x\s+unheard\b/i;

const UNAVAILABLE_QUALITY_RE =
  /\b(?:not\s+available|unavailable|inaudible|snippet|conflicting\s+sources|removed|lost|n\/a)\b/i;

const UNAVAILABLE_TYPE_RE = /^(?:removed|lost|n\/a)$/i;

function normAlphaNum(text: string): string {
  return text
    .normalize("NFKC")
    .replace(DECORATIVE_EMOJI_RE, " ")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SongIdentity {
  baseTitle: string;
  artistKey: string;
  versionKey: string;
  producerKey: string;
  canonicalKey: string;
}

export function extractSongIdentity(input: {
  title: string;
  artist: string;
  credits?: string | null;
  trackType?: string | null;
}): SongIdentity {
  const versionTokens = new Set<string>();
  const producerTokens = new Set<string>();

  const combinedMeta = `${input.title} ${input.credits ?? ""}`;
  for (const m of combinedMeta.matchAll(PRODUCER_TAG_RE)) {
    const prod = normAlphaNum(m[1] ?? "");
    if (prod) producerTokens.add(prod);
  }

  let workingTitle = input.title
    .replace(DECORATIVE_EMOJI_RE, " ")
    .replace(NOISE_TAG_RE, " ")
    .replace(/\s+(?:feat|ft)\.?\s+[^(\[\-|]+$/i, " ");

  for (const m of workingTitle.matchAll(VERSION_TOKEN_RE)) {
    const tok = normAlphaNum(m[1] ?? "");
    if (tok) versionTokens.add(tok);
  }

  workingTitle = workingTitle
    .replace(VERSION_TOKEN_RE, " ")
    .replace(PRODUCER_TAG_RE, " ");

  const trailingVer = workingTitle.match(/\s+-\s+(remix|demo|acoustic|instrumental|acapella|live|extended|slowed(?:\s+reverb)?|sped\s*up)$/i);
  if (trailingVer?.[1]) {
    versionTokens.add(normAlphaNum(trailingVer[1]));
    workingTitle = workingTitle.slice(0, trailingVer.index).trim();
  }

  if (
    versionTokens.size === 0 &&
    input.trackType &&
    /^(?:remix|alt\s*mix|demo|self-bounce|ref\s*track)$/i.test(input.trackType.trim())
  ) {
    // Only tag trackType as a version when distinguishing alternate studio mixes, not generic Release/Unreleased rows
    const normType = normAlphaNum(input.trackType);
    if (normType) versionTokens.add(normType);
  }

  const primaryArtist = input.artist
    .split(/,|&|\b(?:feat|ft|with)\.?\b/i)[0] ?? input.artist;
  const artistKey = normAlphaNum(primaryArtist) || "unknown";
  const baseTitle = normAlphaNum(workingTitle) || normAlphaNum(input.title) || "untitled";
  const versionKey = Array.from(versionTokens).sort().join("|");
  const producerKey = Array.from(producerTokens).sort().join("|");

  return {
    baseTitle,
    artistKey,
    versionKey,
    producerKey,
    canonicalKey: `${artistKey}::${baseTitle}::${versionKey}::${producerKey}`,
  };
}

export function isNonSongTab(tabName: string | null | undefined): boolean {
  if (!tabName) return false;
  const clean = tabName.replace(DECORATIVE_EMOJI_RE, " ").trim();
  return NON_SONG_TAB_RE.test(clean);
}

export function isNonSongTrack(input: {
  tabName?: string | null;
  title: string;
  trackType?: string | null;
  quality?: string | null;
  primaryUrl?: string | null;
  isPlayable: boolean;
}): boolean {
  if (isNonSongTab(input.tabName)) return true;

  const tType = (input.trackType ?? "").trim();
  if (tType && NON_SONG_TYPE_RE.test(tType)) return true;

  const qual = (input.quality ?? "").trim();
  if (qual && NON_SONG_QUALITY_RE.test(qual)) return true;

  if (NON_SONG_TITLE_RE.test(input.title)) return true;

  const url = (input.primaryUrl ?? "").toLowerCase();
  if (
    !input.isPlayable &&
    /(?:dubcnn\.com|hiphopdx\.com|rollingstone|complex\.com|thefader\.com|x\.com\/|twitter\.com\/|instagram\.com\/)/i.test(
      url
    )
  ) {
    return true;
  }

  return false;
}

export function isUnavailableSong(input: {
  quality?: string | null;
  trackType?: string | null;
  isPlayable: boolean;
}): boolean {
  if (!input.isPlayable) return true;
  const qual = (input.quality ?? "").trim();
  if (qual && UNAVAILABLE_QUALITY_RE.test(qual)) return true;
  const tType = (input.trackType ?? "").trim();
  if (tType && UNAVAILABLE_TYPE_RE.test(tType)) return true;
  return false;
}

function mergeTrackLinks(existing: TrackLink[], incoming: TrackLink[]): TrackLink[] {
  const seen = new Set(existing.map((l) => l.url));
  const merged = [...existing];
  for (const link of incoming) {
    if (!seen.has(link.url)) {
      seen.add(link.url);
      merged.push(link);
    }
  }
  return merged;
}

function trackPriorityScore(tr: TrackRecord): number {
  let score = 0;
  if (tr.tabName !== "Unavailable") score += 1000;
  if (tr.isPlayable) score += 500;
  if (tr.formatHint === "flac" || tr.formatHint === "wav" || /lossless/i.test(tr.quality)) score += 200;
  if (tr.primaryHost === "local" || tr.primaryHost === "pillows" || tr.primaryHost === "pixeldrain") {
    score += 100;
  }
  if (/released/i.test(tr.tabName)) score += 50;
  if (/unreleased/i.test(tr.tabName)) score += 40;
  return score;
}

export function curateAndDeduplicateTracks(tracks: TrackRecord[]): TrackRecord[] {
  const dedupedByIdentity = new Map<string, TrackRecord>();
  const urlOwner = new Map<string, string>();

  for (const rawTrack of tracks) {
    // 1. Remove non-songs and anything lacking a playable link
    if (!rawTrack.isPlayable || isNonSongTrack(rawTrack)) {
      continue;
    }

    const unavailable = isUnavailableSong(rawTrack);
    const curated: TrackRecord = {
      ...rawTrack,
      tabName: unavailable ? "Unavailable" : rawTrack.tabName,
    };

    const ident = extractSongIdentity(curated);
    const identityKey = `${curated.trackerId}::${ident.canonicalKey}`;
    const existingKey =
      dedupedByIdentity.has(identityKey)
        ? identityKey
        : curated.primaryUrl && urlOwner.has(curated.primaryUrl)
          ? urlOwner.get(curated.primaryUrl)!
          : null;

    if (!existingKey) {
      dedupedByIdentity.set(identityKey, curated);
      if (curated.primaryUrl) urlOwner.set(curated.primaryUrl, identityKey);
      continue;
    }

    const prev = dedupedByIdentity.get(existingKey)!;
    if (trackPriorityScore(curated) > trackPriorityScore(prev)) {
      const winner: TrackRecord = {
        ...curated,
        links: mergeTrackLinks(curated.links, prev.links),
      };
      dedupedByIdentity.set(existingKey, winner);
      if (winner.primaryUrl) urlOwner.set(winner.primaryUrl, existingKey);
    } else {
      prev.links = mergeTrackLinks(prev.links, curated.links);
    }
  }

  return Array.from(dedupedByIdentity.values());
}
