export type HostKind =
  | "pixeldrain"
  | "pillows"
  | "krakenfiles"
  | "froste"
  | "soundcloud"
  | "imgur"
  | "tidal"
  | "qobuz"
  | "juicewrld"
  | "googledrive"
  | "exoshare"
  | "youtube"
  | "direct"
  | "unknown";

export interface TrackLink {
  url: string;
  text?: string;
  host: HostKind;
  playable: boolean;
  formatHint: string | null;
}

export interface AudioHeaderInfo {
  codec: "FLAC" | "WAV" | "MP3" | "AAC/M4A" | "OGG" | "UNKNOWN";
  sampleRateHz?: number;
  bitsPerSample?: number;
  channels?: number;
  durationSec?: number;
  lossless: boolean;
}

export interface TrackRecord {
  id: string;
  trackerId: string;
  tabName: string;
  title: string;
  rawName: string;
  credits: string;
  artist: string;
  era: string;
  subEra: string;
  eraOrder: number;
  trackOrder: number;
  eraColor: string | null;
  eraTextColor: string | null;
  eraImage: string | null;
  notes: string;
  quality: string;
  formatHint: string | null;
  trackLength: string | null;
  availableLength: string | null;
  leakDate: string | null;
  fileDate: string | null;
  trackType: string | null;
  primaryUrl: string | null;
  primaryHost: HostKind;
  links: TrackLink[];
  resolvedUrl: string | null;
  resolvedMime: string | null;
  resolvedSize: number | null;
  resolvedFilename: string | null;
  resolvedAt: number | null;
  isPlayable: boolean;
  audioMeta: AudioHeaderInfo | null;
  cacheStatus?: {
    cacheKey: string;
    cachedBytes: number;
    totalBytes: number | null;
    isComplete: boolean;
    lastAccessedAt: number;
  } | null;
  isLiked?: boolean;
  playCount?: number;
}

export interface TrackerTabMeta {
  name: string;
  slug: string;
  gid: string;
}

export interface TrackerRecord {
  trackerId: string;
  name: string;
  artistName: string;
  currentTab: string;
  tabs: TrackerTabMeta[];
  syncedTabs: string[];
  trackCount: number;
  playableCount: number;
  credits: string | null;
  lastSyncedAt: number;
  isFollowed?: boolean;
  coverImage?: string | null;
}

export interface SyncResult {
  tracker: TrackerRecord;
  tabSynced: string;
  tracksSynced: number;
  playableTracks: number;
  erasCount: number;
  elapsedMs: number;
}

export interface DirectoryArtist {
  name: string;
  trackerId: string;
  url: string;
  isLinkWorking: boolean;
  isUpdated: boolean;
  isStarred: boolean;
}

export interface SearchParams {
  trackerId?: string;
  tabName?: string;
  q?: string;
  era?: string;
  host?: string;
  quality?: string;
  losslessOnly?: boolean;
  cachedOnly?: boolean;
  playableOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface EraFacet {
  era: string;
  count: number;
  eraColor: string | null;
  eraImage: string | null;
}

export interface SearchResult {
  tracks: TrackRecord[];
  total: number;
  queryMs: number;
  eras: EraFacet[];
  hosts: Array<{ host: string; count: number }>;
  qualities: Array<{ quality: string; count: number }>;
}

export type HostResolution =
  | {
      ok: true;
      sourceUrl: string;
      resolvedUrl: string;
      host: HostKind;
      mimeType: string | null;
      filename: string | null;
      sizeBytes: number | null;
      formatHint: string | null;
    }
  | {
      ok: false;
      sourceUrl: string;
      host: HostKind;
      errorCode: string;
      errorMessage: string;
    };

export type ByteRange = [number, number]; // inclusive [start, end]

export interface CacheEntry {
  cacheKey: string;
  trackId: string | null;
  trackTitle?: string | null;
  artist?: string | null;
  era?: string | null;
  sourceUrl: string;
  resolvedUrl: string | null;
  filePath: string;
  mimeType: string | null;
  filename: string | null;
  totalBytes: number | null;
  cachedBytes: number;
  ranges: ByteRange[];
  isComplete: boolean;
  audioMeta: AudioHeaderInfo | null;
  lastAccessedAt: number;
  createdAt: number;
}

export interface CacheStats {
  totalCachedBytes: number;
  maxCacheBytes: number;
  entryCount: number;
  completeCount: number;
  partialCount: number;
  utilizationPercent: number;
  entries: CacheEntry[];
}

export interface UserProfile {
  name: string;
  handle: string;
  bio: string;
  avatarPreset: string;
  avatarUrl: string | null;
  accentColor: string;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  description: string;
  coverGradient: string;
  coverImage: string | null;
  trackCount: number;
  previewImages: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistDetail extends PlaylistRecord {
  tracks: TrackRecord[];
}

export interface RecentSearchRecord {
  id: number;
  query: string;
  itemType: "query" | "track" | "artist" | "era" | "playlist";
  itemId: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  searchedAt: number;
}

export interface PlayHistoryItem {
  id: number;
  trackId: string;
  playedAt: number;
  track: TrackRecord;
}

export interface ActivityRecord {
  id: number;
  kind: "sync" | "cache" | "playlist" | "like" | "info";
  title: string;
  detail: string;
  createdAt: number;
  isRead: boolean;
}
