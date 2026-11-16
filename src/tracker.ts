import crypto from "node:crypto";
import {
  ARTISTGRID_DIRECTORY_CSV,
  ARTISTGRID_V2_API,
  ARTISTGRID_V3_API,
  USER_AGENT,
} from "./config.ts";
import {
  detectFormatHint,
  detectHost,
  isPlayableHost,
  normalizeHostUrl,
  rankLinks,
  type FetchLike,
} from "./resolver.ts";
import type {
  DirectoryArtist,
  TrackerRecord,
  TrackerTabMeta,
  TrackLink,
  TrackRecord,
} from "./types.ts";

interface V3TrackName {
  raw?: string;
  title?: string;
  credits?: string[];
}

interface V3Track {
  name?: V3TrackName | string;
  notes?: string;
  track_length?: string | null;
  file_date?: string | null;
  leak_date?: string | null;
  available_length?: string;
  quality?: string;
  links?: Array<{ url?: string; text?: string }>;
  image?: string;
  type?: string;
  sub_era?: string;
  era?: string;
  era_color?: string;
  era_text_color?: string;
  art_used?: boolean;
}

interface V3Era {
  name?: string;
  description?: string;
  cover_art?: string;
  color?: string;
  text_color?: string;
  tracks?: V3Track[];
}

interface V3Tab {
  name: string;
  slug: string;
  gid: string;
}

interface V3Response {
  name?: string;
  tab?: V3Tab;
  tabs?: V3Tab[];
  eras?: V3Era[];
  tracks?: V3Track[];
  credits?: string | null;
}

interface V2Track {
  name?: string;
  extra?: string;
  notes?: string;
  quality?: string;
  url?: string;
  urls?: string[];
  available_length?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  type?: string;
}

interface V2Era {
  name?: string;
  image?: string;
  backgroundColor?: string;
  textColor?: string;
  data?: Record<string, V2Track[]>;
}

interface V2Response {
  name?: string;
  tabs?: string[];
  current_tab?: string;
  eras?: Record<string, V2Era>;
  credits?: string;
}

export function extractTrackerId(rawInput: string): string {
  const input = rawInput.trim();
  if (!input) {
    throw new Error("Tracker ID or URL cannot be empty.");
  }

  // Exact 44-char Google Sheet ID
  if (/^[a-zA-Z0-9_-]{44}$/.test(input)) {
    return input;
  }

  // Published Google Sheet ID (2PACX-...)
  const pubMatch = input.match(/(2PACX-[a-zA-Z0-9_-]{20,})/);
  if (pubMatch?.[1]) {
    return pubMatch[1];
  }

  // Google Sheets URL: /spreadsheets/d/<id>
  const sheetUrlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (sheetUrlMatch?.[1]) {
    return sheetUrlMatch[1];
  }

  // ArtistGrid URLs: ?tracker=<id> or /sh/<id> or /view?id=<id>
  try {
    if (/^https?:\/\//i.test(input)) {
      const parsed = new URL(input);
      const paramId = parsed.searchParams.get("tracker") ?? parsed.searchParams.get("id");
      if (paramId) return extractTrackerId(paramId);

      const pathMatch = parsed.pathname.match(/\/(?:sh|get|view)\/([a-zA-Z0-9._-]{10,})/);
      if (pathMatch?.[1]) return pathMatch[1];
    }
  } catch {
    // fall through to regex match
  }

  // Any 44-char ID embedded in text
  const idMatch = input.match(/([a-zA-Z0-9_-]{44})/);
  if (idMatch?.[1]) {
    return idMatch[1];
  }

  // Custom domain tracker identifiers from artists.csv (e.g., franktracker.net)
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)) {
    return input;
  }

  throw new Error(
    `Invalid ArtistGrid tracker ID or URL: "${input}". Expected a 44-character spreadsheet ID or Google Sheets/ArtistGrid URL.`
  );
}

export function cleanArtistName(trackerName: string | null | undefined, fallbackId: string): string {
  if (!trackerName) return fallbackId;
  return (
    trackerName
      .replace(/\s+(?:music\s+)?tracker(?:\s+v\d+)?$/i, "")
      .replace(/\s+unreleased$/i, "")
      .trim() || trackerName.trim()
  );
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/\S+$/i.test(value.trim());
}

function buildTrackLinks(rawUrls: Array<{ url: string; text?: string }>, quality?: string | null): TrackLink[] {
  const seen = new Set<string>();
  const links: TrackLink[] = [];
  for (const item of rawUrls) {
    const normalized = normalizeHostUrl(item.url);
    if (!isHttpUrl(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    const host = detectHost(normalized);
    links.push({
      url: normalized,
      text: item.text,
      host,
      playable: isPlayableHost(host),
      formatHint: detectFormatHint(normalized, quality),
    });
  }
  return rankLinks(links);
}

function makeTrackId(
  trackerId: string,
  tabName: string,
  eraName: string,
  title: string,
  primaryUrl: string | null,
  occurrence: number
): string {
  return crypto
    .createHash("sha256")
    .update(`${trackerId}\0${tabName}\0${eraName}\0${title}\0${primaryUrl ?? ""}\0${occurrence}`)
    .digest("hex")
    .slice(0, 20);
}

function scoreCoverCandidate(
  url: string,
  eraName: string,
  trackTitle: string,
  trackType: string,
  artUsed?: boolean
): number {
  const lower = url.toLowerCase();
  // Skip non-image hosts, album pages, and expiring Google Sheets blobs
  if (
    lower.includes("docs.google.com/sheets-images-rt") ||
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("pillows.su") ||
    lower.includes("krakenfiles.com") ||
    lower.includes("drive.google.com") ||
    lower.includes("leaked.cx") ||
    lower.includes("instagram.com") ||
    lower.includes("x.com/") ||
    lower.includes("twitter.com/") ||
    /imgur\.com\/(?:a|gallery)\//i.test(lower)
  ) {
    return -1;
  }

  let score = 0;
  const isImageExt = /\.(?:jpg|jpeg|png|webp|gif)(?:\?|$)/i.test(lower);
  const isImageHost =
    lower.includes("i.ibb.co/") ||
    lower.includes("i.imgur.com/") ||
    lower.includes("mzstatic.com/") ||
    lower.includes("i.scdn.co/") ||
    lower.includes("images.genius.com/") ||
    lower.includes("t2.genius.com/") ||
    lower.includes("media.tumblr.com/") ||
    lower.includes("i1.sndcdn.com/") ||
    lower.includes("pbs.twimg.com/") ||
    lower.includes("i.postimg.cc/") ||
    lower.includes("i.discogs.com/") ||
    lower.includes("cdn-images.dzcdn.net/") ||
    lower.includes("f4.bcbits.com/") ||
    lower.includes("i.imgur.gg/") ||
    /^https?:\/\/(?:www\.)?(?:ibb\.co|imgur\.com)\/[a-z0-9]+\/?$/i.test(url);

  if (!isImageExt && !isImageHost) return -1;

  if (isImageHost) score += 30;
  if (isImageExt) score += 20;
  if (lower.includes("i.ibb.co/") || lower.includes("mzstatic.com/") || lower.includes("i.scdn.co/")) {
    score += 20;
  }

  const typeLower = trackType.toLowerCase();
  if (typeLower.includes("front cover") || typeLower.includes("album cover") || typeLower === "cover") {
    score += 120;
  } else if (typeLower.includes("single")) {
    score += 60;
  } else if (typeLower.includes("back cover")) {
    score += 10;
  }

  if (artUsed) score += 45;
  if (trackTitle.toLowerCase().trim() === eraName.toLowerCase().trim()) score += 40;
  return score;
}

export function extractArtTabCovers(artPayload: unknown): Map<string, string> {
  const covers = new Map<string, string>();
  if (!artPayload || typeof artPayload !== "object") return covers;

  const v3 = artPayload as V3Response;
  for (const era of v3.eras ?? []) {
    const eraName = (era.name || "").trim();
    if (!eraName) continue;
    let bestUrl: string | null = null;
    let bestScore = -1;

    for (const tr of era.tracks ?? []) {
      const title =
        typeof tr.name === "string"
          ? tr.name.trim()
          : (tr.name?.title || tr.name?.raw || "").trim();
      const trackType = (tr.type || "").trim();

      for (const link of tr.links ?? []) {
        if (!isHttpUrl(link.url)) continue;
        const s = scoreCoverCandidate(link.url.trim(), eraName, title, trackType, tr.art_used);
        if (s > bestScore) {
          bestScore = s;
          bestUrl = link.url.trim();
        }
      }
    }

    if (bestUrl) {
      covers.set(eraName.toLowerCase(), bestUrl);
    }
  }
  return covers;
}

export async function fetchArtTabCovers(
  trackerId: string,
  tabs: TrackerTabMeta[],
  fetchImpl: FetchLike = fetch
): Promise<Map<string, string>> {
  const artTab = tabs.find(
    (t) => t.slug.toLowerCase() === "art" || /\bart\b/i.test(t.name)
  );
  if (!artTab) return new Map();

  const endpoint = artTab.gid
    ? `${ARTISTGRID_V3_API}/sh/${encodeURIComponent(trackerId)}/gid/${encodeURIComponent(artTab.gid)}`
    : `${ARTISTGRID_V3_API}/sh/${encodeURIComponent(trackerId)}/tab/${encodeURIComponent(artTab.slug)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetchImpl(endpoint, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return new Map();
    return extractArtTabCovers(await res.json());
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}

export function stripEraVersionTag(eraName: string): string {
  return eraName
    .replace(/\s*[\[(]v\d+[\])]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function lookupArtCover(covers: Map<string, string> | undefined, eraName: string): string | null {
  if (!covers || covers.size === 0) return null;
  const exact = covers.get(eraName.toLowerCase().trim());
  if (exact) return exact;
  const stripped = stripEraVersionTag(eraName);
  if (stripped) {
    const baseMatch = covers.get(stripped);
    if (baseMatch) return baseMatch;
    for (const [key, url] of covers.entries()) {
      if (stripEraVersionTag(key) === stripped) return url;
    }
  }
  return null;
}

export function normalizeTrackerPayload(
  trackerId: string,
  payload: unknown,
  requestedTab?: string,
  artCovers?: Map<string, string>
): {
  tracker: Omit<TrackerRecord, "syncedTabs" | "lastSyncedAt">;
  tracks: TrackRecord[];
  erasCount: number;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("Tracker API returned an empty or invalid JSON response.");
  }

  const raw = payload as V3Response & V2Response;
  const isV3 = Boolean(raw.tab || Array.isArray(raw.eras) || Array.isArray(raw.tracks));

  const trackerName = (typeof raw.name === "string" && raw.name.trim()) || trackerId;
  const artistName = cleanArtistName(trackerName, trackerId);
  const occurrenceMap = new Map<string, number>();
  const tracks: TrackRecord[] = [];
  const erasSet = new Set<string>();

  const nextOccurrence = (key: string): number => {
    const count = occurrenceMap.get(key) ?? 0;
    occurrenceMap.set(key, count + 1);
    return count;
  };

  if (isV3) {
    const v3 = payload as V3Response;
    const currentTab = v3.tab?.name || requestedTab || "Unreleased";
    const tabs: TrackerTabMeta[] = Array.isArray(v3.tabs)
      ? v3.tabs.map((t) => ({ name: t.name, slug: t.slug, gid: t.gid }))
      : v3.tab
        ? [{ name: v3.tab.name, slug: v3.tab.slug, gid: v3.tab.gid }]
        : [];

    if (Array.isArray(v3.eras) && v3.eras.length > 0) {
      v3.eras.forEach((era, eraOrder) => {
        const eraName = (era.name || "Unknown Era").trim();
        erasSet.add(eraName);
        const eraTracks = Array.isArray(era.tracks) ? era.tracks : [];
        eraTracks.forEach((tr, trackOrder) => {
          const title =
            typeof tr.name === "string"
              ? tr.name.trim()
              : (tr.name?.title || tr.name?.raw || "Untitled").trim();
          const rawName =
            typeof tr.name === "string" ? tr.name.trim() : (tr.name?.raw || title).trim();
          const credits =
            typeof tr.name === "object" && Array.isArray(tr.name?.credits)
              ? tr.name.credits.join(", ").trim()
              : "";

          const rawLinks: Array<{ url: string; text?: string }> = [];
          for (const link of tr.links ?? []) {
            if (isHttpUrl(link.url)) rawLinks.push({ url: link.url, text: link.text });
          }
          if (isHttpUrl(tr.quality)) rawLinks.push({ url: tr.quality });
          if (isHttpUrl(tr.available_length)) rawLinks.push({ url: tr.available_length });

          const links = buildTrackLinks(rawLinks, tr.quality);
          const primary = links[0] ?? null;
          const occKey = `${eraName}\0${title}\0${primary?.url ?? ""}`;
          const id = makeTrackId(trackerId, currentTab, eraName, title, primary?.url ?? null, nextOccurrence(occKey));

          tracks.push({
            id,
            trackerId,
            tabName: currentTab,
            title,
            rawName,
            credits,
            artist: artistName,
            era: eraName,
            subEra: (tr.sub_era || "Default").trim(),
            eraOrder,
            trackOrder,
            eraColor: era.color ?? null,
            eraTextColor: era.text_color ?? null,
            eraImage: lookupArtCover(artCovers, eraName) || tr.image || era.cover_art || null,
            notes: (tr.notes || "").trim(),
            quality: isHttpUrl(tr.quality) ? "" : (tr.quality || "").trim(),
            formatHint: primary?.formatHint ?? detectFormatHint("", tr.quality),
            trackLength: tr.track_length ?? null,
            availableLength: isHttpUrl(tr.available_length) ? null : (tr.available_length ?? null),
            leakDate: tr.leak_date ?? null,
            fileDate: tr.file_date ?? null,
            trackType: tr.type ?? null,
            primaryUrl: primary?.url ?? null,
            primaryHost: primary?.host ?? "unknown",
            links,
            resolvedUrl: null,
            resolvedMime: null,
            resolvedSize: null,
            resolvedFilename: null,
            resolvedAt: null,
            isPlayable: links.some((l) => l.playable),
            audioMeta: null,
          });
        });
      });
    } else if (Array.isArray(v3.tracks)) {
      const eraIndices = new Map<string, number>();
      v3.tracks.forEach((tr, trackOrder) => {
        const eraName = (tr.era || "Tracks").trim();
        if (!eraIndices.has(eraName)) eraIndices.set(eraName, eraIndices.size);
        const eraOrder = eraIndices.get(eraName)!;
        erasSet.add(eraName);

        const title =
          typeof tr.name === "string"
            ? tr.name.trim()
            : (tr.name?.title || tr.name?.raw || "Untitled").trim();
        const rawName =
          typeof tr.name === "string" ? tr.name.trim() : (tr.name?.raw || title).trim();
        const credits =
          typeof tr.name === "object" && Array.isArray(tr.name?.credits)
            ? tr.name.credits.join(", ").trim()
            : "";

        const rawLinks: Array<{ url: string; text?: string }> = [];
        for (const link of tr.links ?? []) {
          if (isHttpUrl(link.url)) rawLinks.push({ url: link.url, text: link.text });
        }
        const links = buildTrackLinks(rawLinks, tr.quality);
        const primary = links[0] ?? null;
        const occKey = `${eraName}\0${title}\0${primary?.url ?? ""}`;
        const id = makeTrackId(trackerId, currentTab, eraName, title, primary?.url ?? null, nextOccurrence(occKey));

        tracks.push({
          id,
          trackerId,
          tabName: currentTab,
          title,
          rawName,
          credits,
          artist: artistName,
          era: eraName,
          subEra: (tr.sub_era || "Default").trim(),
          eraOrder,
          trackOrder,
          eraColor: tr.era_color ?? null,
          eraTextColor: tr.era_text_color ?? null,
          eraImage: lookupArtCover(artCovers, eraName) || tr.image || null,
          notes: (tr.notes || "").trim(),
          quality: (tr.quality || "").trim(),
          formatHint: primary?.formatHint ?? detectFormatHint("", tr.quality),
          trackLength: tr.track_length ?? null,
          availableLength: tr.available_length ?? null,
          leakDate: tr.leak_date ?? null,
          fileDate: tr.file_date ?? null,
          trackType: tr.type ?? null,
          primaryUrl: primary?.url ?? null,
          primaryHost: primary?.host ?? "unknown",
          links,
          resolvedUrl: null,
          resolvedMime: null,
          resolvedSize: null,
          resolvedFilename: null,
          resolvedAt: null,
          isPlayable: links.some((l) => l.playable),
          audioMeta: null,
        });
      });
    }

    return {
      tracker: {
        trackerId,
        name: trackerName,
        artistName,
        currentTab,
        tabs,
        trackCount: tracks.length,
        playableCount: tracks.filter((t) => t.isPlayable).length,
        credits: v3.credits ?? null,
      },
      tracks,
      erasCount: erasSet.size,
    };
  }

  // Legacy V2 response fallback
  const v2 = payload as V2Response;
  const currentTab = v2.current_tab || requestedTab || "Main";
  const tabs: TrackerTabMeta[] = (v2.tabs ?? []).map((name) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    gid: "",
  }));

  const erasEntries = Object.values(v2.eras ?? {});
  erasEntries.forEach((era, eraOrder) => {
    const eraName = (era.name || "Unknown Era").trim();
    erasSet.add(eraName);
    let trackOrder = 0;
    for (const [subEra, list] of Object.entries(era.data ?? {})) {
      for (const tr of list ?? []) {
        const title = (tr.name || "Untitled").trim();
        const rawLinks: Array<{ url: string }> = [];
        for (const u of tr.urls ?? []) {
          if (isHttpUrl(u)) rawLinks.push({ url: u });
        }
        if (isHttpUrl(tr.url)) rawLinks.push({ url: tr.url });
        if (isHttpUrl(tr.quality)) rawLinks.push({ url: tr.quality });
        if (isHttpUrl(tr.available_length)) rawLinks.push({ url: tr.available_length });

        const links = buildTrackLinks(rawLinks, tr.quality);
        const primary = links[0] ?? null;
        const occKey = `${eraName}\0${title}\0${primary?.url ?? ""}`;
        const id = makeTrackId(trackerId, currentTab, eraName, title, primary?.url ?? null, nextOccurrence(occKey));

        tracks.push({
          id,
          trackerId,
          tabName: currentTab,
          title,
          rawName: title,
          credits: (tr.extra || "").trim(),
          artist: artistName,
          era: eraName,
          subEra,
          eraOrder,
          trackOrder: trackOrder++,
          eraColor: era.backgroundColor ?? null,
          eraTextColor: era.textColor ?? null,
          eraImage: era.image ?? null,
          notes: (tr.notes || "").trim(),
          quality: isHttpUrl(tr.quality) ? "" : (tr.quality || "").trim(),
          formatHint: primary?.formatHint ?? detectFormatHint("", tr.quality),
          trackLength: tr.track_length ?? null,
          availableLength: isHttpUrl(tr.available_length) ? null : (tr.available_length ?? null),
          leakDate: tr.leak_date ?? null,
          fileDate: tr.file_date ?? null,
          trackType: tr.type ?? null,
          primaryUrl: primary?.url ?? null,
          primaryHost: primary?.host ?? "unknown",
          links,
          resolvedUrl: null,
          resolvedMime: null,
          resolvedSize: null,
          resolvedFilename: null,
          resolvedAt: null,
          isPlayable: links.some((l) => l.playable),
          audioMeta: null,
        });
      }
    }
  });

  return {
    tracker: {
      trackerId,
      name: trackerName,
      artistName,
      currentTab,
      tabs,
      trackCount: tracks.length,
      playableCount: tracks.filter((t) => t.isPlayable).length,
      credits: v2.credits ?? null,
    },
    tracks,
    erasCount: erasSet.size,
  };
}

export async function fetchTrackerFromArtistGrid(
  rawInput: string,
  options: { tabGid?: string; tabSlug?: string; tabName?: string; fetchImpl?: FetchLike } = {}
) {
  const trackerId = extractTrackerId(rawInput);
  const fetchImpl = options.fetchImpl ?? fetch;

  let v3Path = `/sh/${encodeURIComponent(trackerId)}/`;
  if (options.tabGid) {
    v3Path = `/sh/${encodeURIComponent(trackerId)}/gid/${encodeURIComponent(options.tabGid)}`;
  } else if (options.tabSlug) {
    v3Path = `/sh/${encodeURIComponent(trackerId)}/tab/${encodeURIComponent(options.tabSlug)}`;
  }

  const v3Url = `${ARTISTGRID_V3_API}${v3Path}`;
  const v3Res = await fetchImpl(v3Url, { headers: { "User-Agent": USER_AGENT } });
  if (v3Res.ok) {
    const json = (await v3Res.json()) as V3Response;
    const tabs: TrackerTabMeta[] = Array.isArray(json.tabs)
      ? json.tabs.map((t) => ({ name: t.name, slug: t.slug, gid: t.gid }))
      : [];
    const isArtTab = options.tabSlug === "art" || /\bart\b/i.test(json.tab?.name || "");
    const artCovers = !isArtTab && tabs.length > 0 ? await fetchArtTabCovers(trackerId, tabs, fetchImpl) : undefined;
    return normalizeTrackerPayload(trackerId, json, options.tabName, artCovers);
  }

  // Fallback to legacy trackerapi-2 (trackerdl endpoint)
  const v2Url = options.tabName
    ? `${ARTISTGRID_V2_API}/get/${encodeURIComponent(trackerId)}?tab=${encodeURIComponent(options.tabName)}`
    : `${ARTISTGRID_V2_API}/get/${encodeURIComponent(trackerId)}`;
  const v2Res = await fetchImpl(v2Url, { headers: { "User-Agent": USER_AGENT } });
  if (v2Res.ok) {
    const json = await v2Res.json();
    return normalizeTrackerPayload(trackerId, json, options.tabName);
  }

  throw new Error(
    `ArtistGrid API returned HTTP ${v3Res.status} (v3) / HTTP ${v2Res.status} (v2) for tracker "${trackerId}".`
  );
}

export function parseArtistsCsv(csvText: string): DirectoryArtist[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i]!;
    if (ch === '"') {
      if (quoted && csvText[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && csvText[i + 1] === "\n") i++;
      rows.push([...row, field]);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) rows.push([...row, field]);

  const headers = (rows.shift() ?? []).map((h) => h.replace(/^\uFEFF/, "").trim());
  const nameIdx = headers.indexOf("name");
  const urlIdx = headers.indexOf("url");
  const linksWorkIdx = headers.indexOf("links_work");
  const updatedIdx = headers.indexOf("updated");
  const bestIdx = headers.indexOf("best");
  if (nameIdx === -1 || urlIdx === -1) return [];

  const counts = new Map<string, number>();
  const out: DirectoryArtist[] = [];

  for (const cols of rows) {
    const name = cols[nameIdx]?.trim();
    const url = cols[urlIdx]?.trim();
    if (!name || !url) continue;
    let trackerId: string;
    try {
      trackerId = extractTrackerId(url);
    } catch {
      continue;
    }
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    const displayName = count === 0 ? name : `${name} [Alt${count > 1 ? ` #${count}` : ""}]`;

    out.push({
      name: displayName,
      trackerId,
      url,
      isLinkWorking: Number(cols[linksWorkIdx]) === 1,
      isUpdated: Number(cols[updatedIdx]) === 1,
      isStarred: cols[bestIdx]?.trim() === "true",
    });
  }

  return out;
}

export async function fetchDirectoryArtists(fetchImpl: FetchLike = fetch): Promise<DirectoryArtist[]> {
  const res = await fetchImpl(ARTISTGRID_DIRECTORY_CSV, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`ArtistGrid directory returned HTTP ${res.status}`);
  }
  return parseArtistsCsv(await res.text());
}
