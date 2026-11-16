/* ==================== SVG ICONS ==================== */
const ICONS = {
  play: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`,
  playLg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>`,
  pauseLg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20.4c-.3 0-.6-.1-.8-.3C6.2 15.8 3 12.8 3 8.9 3 6.1 5.2 4 7.9 4c1.6 0 3.1.8 4.1 2.1C13 4.8 14.5 4 16.1 4 18.8 4 21 6.1 21 8.9c0 3.9-3.2 6.9-8.2 11.2-.2.2-.5.3-.8.3z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  volHigh: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`,
  volLow: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`,
  volMute: `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`,
  eqBars: `<span class="eq-bars" aria-hidden="true"><span></span><span></span><span></span></span>`,
  musicNote: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  x: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
};

const PLAYLIST_GRADIENTS = [
  "linear-gradient(135deg, #7c4dff, #ec4899)",
  "linear-gradient(135deg, #2563eb, #06b6d4)",
  "linear-gradient(135deg, #be123c, #581c87)",
  "linear-gradient(135deg, #059669, #0284c7)",
  "linear-gradient(135deg, #d97706, #dc2626)",
  "linear-gradient(135deg, #4338ca, #1e1b4b)",
  "linear-gradient(135deg, #0f766e, #111827)",
  "linear-gradient(135deg, #9333ea, #2563eb)",
];

const AVATAR_PRESETS = {
  violet: "linear-gradient(135deg, #7c4dff, #ec4899)",
  ocean: "linear-gradient(135deg, #06b6d4, #2563eb)",
  crimson: "linear-gradient(135deg, #f43f5e, #7c2d12)",
  emerald: "linear-gradient(135deg, #10b981, #0f766e)",
  amber: "linear-gradient(135deg, #f59e0b, #be123c)",
  midnight: "linear-gradient(135deg, #312e81, #0f172a)",
};

const ACCENT_OPTIONS = [
  { hex: "#7c4dff", name: "Electric Violet" },
  { hex: "#ec4899", name: "Neon Rose" },
  { hex: "#3b82f6", name: "Cobalt Blue" },
  { hex: "#10b981", name: "Studio Mint" },
  { hex: "#f59e0b", name: "Warm Amber" },
  { hex: "#ef4444", name: "Crimson" },
];

const MIX_GRADIENTS = [
  "linear-gradient(135deg, #3b1c6d, #120924)",
  "linear-gradient(135deg, #1d3557, #0b1628)",
  "linear-gradient(135deg, #6b1d3b, #1e0a15)",
  "linear-gradient(135deg, #134e4a, #071b1a)",
  "linear-gradient(135deg, #713f12, #1f1106)",
  "linear-gradient(135deg, #312e81, #0f1028)",
];

const EQ_BANDS = [
  { freq: 60, label: "60Hz" },
  { freq: 230, label: "230Hz" },
  { freq: 910, label: "910Hz" },
  { freq: 3600, label: "3.6k" },
  { freq: 14000, label: "14k" },
];

const EQ_PRESETS = {
  flat: { label: "Flat", gains: [0, 0, 0, 0, 0] },
  bass: { label: "Bass Boost", gains: [6, 3.5, 0, 0.5, 1.5] },
  vocal: { label: "Vocal", gains: [-2, 1, 4.5, 3, 0.5] },
  electronic: { label: "Club", gains: [5, 2, -1, 3, 4.5] },
  latenight: { label: "Late Night", gains: [3, 1.5, -0.5, -1.5, -2.5] },
};

/* ==================== APPLICATION STATE ==================== */
const state = {
  // Navigation history
  navStack: [],
  navIndex: -1,
  route: { view: "home" },

  // Data
  profile: {
    name: "Listener",
    handle: "@vaultstream",
    bio: "",
    avatarPreset: "violet",
    avatarUrl: null,
    accentColor: "#7c4dff",
  },
  profileStats: {
    likedCount: 0,
    playlistCount: 0,
    trackerCount: 0,
    followedCount: 0,
    playsCount: 0,
    cachedCount: 0,
    cachedBytes: 0,
  },
  trackers: [],
  playlists: [],
  likedIds: new Set(),
  likedTracks: [],
  historyItems: [],
  recentSearches: [],
  activity: [],
  unreadActivity: 0,
  cacheStats: null,
  directoryArtists: [],

  // Active view caches
  activeTrackerId: null,
  activeTabName: null,
  homeTracks: [],
  homeEras: [],
  searchQuery: "",
  searchSource: "library", // "library" | "ytmusic" | "youtube" | "soundcloud"
  onlineResults: [],
  onlineCollections: [],
  onlineSearchReqSeq: 0,
  preparingTrackId: null,
  searchTrackerId: "",
  searchTabName: "",
  searchEra: "",
  searchHost: "",
  losslessOnly: false,
  playableOnly: true,
  searchOffset: 0,
  searchLimit: 80,
  searchTotal: 0,
  searchTracks: [],
  searchEras: [],
  searchHosts: [],
  libraryTracks: [],
  profileCachedTracks: [],
  artistData: null,
  artistShowAllHits: false,
  profileTab: "playlists",
  libraryTab: "artists",
  collectionData: null,
  collectionFilter: "",

  // Track map for instant lookup
  trackMap: new Map(),

  // Playback & Queue
  playingTrack: null,
  playingSourceName: "VaultStream",
  queueContext: [],
  queueIndex: -1,
  userQueue: [],
  shuffle: false,
  repeat: "off", // "off" | "all" | "one"
  isSeeking: false,
  volume: 0.9,
  playbackRate: 1,
  sleepTimerId: null,
  sleepMinutes: 0,

  // UI Overlays
  selectedTrack: null,
  openDrawer: null, // "inspector" | "queue" | null
  fsOpen: false,
  fsTab: "notes",
  editingPlaylistId: null,
  selectedPlaylistGradient: PLAYLIST_GRADIENTS[0],
  addToPlaylistTrackId: null,
  profileDraftPreset: "violet",
  profileDraftAccent: "#7c4dff",

  // Web Audio EQ & Visualizer
  audioCtx: null,
  mediaSource: null,
  eqFilters: [],
  analyser: null,
  eqPreset: "flat",
  eqGains: [0, 0, 0, 0, 0],
  visRafId: null,
};

/* ==================== DOM REFERENCES ==================== */
const $ = (id) => document.getElementById(id);

const el = {
  sidebar: $("sidebar"),
  brandHomeBtn: $("brandHomeBtn"),
  navItems: document.querySelectorAll(".nav-item[data-view]"),
  navNewPlaylistBtn: $("navNewPlaylistBtn"),
  navSyncBtn: $("navSyncBtn"),
  navSettingsBtn: $("navSettingsBtn"),
  sidebarLikedCount: $("sidebarLikedCount"),
  sidebarPlaylistsWrap: $("sidebarPlaylistsWrap"),
  sidebarPlaylistsList: $("sidebarPlaylistsList"),
  sidebarCacheSummary: $("sidebarCacheSummary"),
  sidebarCacheLabel: $("sidebarCacheLabel"),
  mobileMenuBtn: $("mobileMenuBtn"),
  mobileSidebarBackdrop: $("mobileSidebarBackdrop"),

  stageHeader: $("stageHeader"),
  stageScroll: $("stageScroll"),
  navBackBtn: $("navBackBtn"),
  navForwardBtn: $("navForwardBtn"),
  searchInput: $("searchInput"),
  clearSearchInputBtn: $("clearSearchInputBtn"),
  queryTimingBadge: $("queryTimingBadge"),
  notifBellBtn: $("notifBellBtn"),
  notifUnreadDot: $("notifUnreadDot"),
  profileAvatarBtn: $("profileAvatarBtn"),
  headerAvatarInner: $("headerAvatarInner"),
  statusToast: $("statusToast"),

  // Views
  homeView: $("homeView"),
  homeEmptyHero: $("homeEmptyHero"),
  heroAddTrackerBtn: $("heroAddTrackerBtn"),
  heroSeedDemoBtn: $("heroSeedDemoBtn"),
  homeContent: $("homeContent"),
  homeGreetingTitle: $("homeGreetingTitle"),
  homeSyncBtn: $("homeSyncBtn"),
  quickAccessGrid: $("quickAccessGrid"),
  homeArtistsBlock: $("homeArtistsBlock"),
  homeArtistsRow: $("homeArtistsRow"),
  homeSeeLibraryBtn: $("homeSeeLibraryBtn"),
  homeRecentBlock: $("homeRecentBlock"),
  homeRecentShelf: $("homeRecentShelf"),
  homeSeeHistoryBtn: $("homeSeeHistoryBtn"),

  searchView: $("searchView"),
  searchSourceTabs: $("searchSourceTabs"),
  localFilterPills: $("localFilterPills"),
  searchDiscoverWrap: $("searchDiscoverWrap"),
  recentSearchesBlock: $("recentSearchesBlock"),
  clearRecentSearchesBtn: $("clearRecentSearchesBtn"),
  recentSearchesList: $("recentSearchesList"),
  searchMixGrid: $("searchMixGrid"),
  searchResultsWrap: $("searchResultsWrap"),
  searchResultsHeading: $("searchResultsHeading"),
  searchResultsSub: $("searchResultsSub"),
  trackerSelect: $("trackerSelect"),
  tabSelect: $("tabSelect"),
  eraSelect: $("eraSelect"),
  hostSelect: $("hostSelect"),
  losslessFilterBtn: $("losslessFilterBtn"),
  playableFilterBtn: $("playableFilterBtn"),
  clearFiltersBtn: $("clearFiltersBtn"),
  searchTopResultWrap: $("searchTopResultWrap"),
  searchCollectionsWrap: $("searchCollectionsWrap"),
  searchCollectionsGrid: $("searchCollectionsGrid"),
  searchTrackList: $("searchTrackList"),
  listEmptyState: $("listEmptyState"),
  paginationBar: $("paginationBar"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  pageIndicator: $("pageIndicator"),

  artistView: $("artistView"),
  artistHeroBg: $("artistHeroBg"),
  artistHeroName: $("artistHeroName"),
  artistHeroMeta: $("artistHeroMeta"),
  artistFollowBtn: $("artistFollowBtn"),
  artistMoreBtn: $("artistMoreBtn"),
  artistShuffleBtn: $("artistShuffleBtn"),
  artistPlayBtn: $("artistPlayBtn"),
  artistTabsRow: $("artistTabsRow"),
  artistTopHitsList: $("artistTopHitsList"),
  artistToggleMoreHitsBtn: $("artistToggleMoreHitsBtn"),
  artistFeaturingBlock: $("artistFeaturingBlock"),
  artistFeaturingList: $("artistFeaturingList"),
  artistErasCount: $("artistErasCount"),
  artistErasGrid: $("artistErasGrid"),

  profileView: $("profileView"),
  profileBigAvatar: $("profileBigAvatar"),
  profileDisplayName: $("profileDisplayName"),
  editProfileBtn: $("editProfileBtn"),
  profileStatsLine: $("profileStatsLine"),
  profileBioLine: $("profileBioLine"),
  profileTabs: $("profileTabs"),
  profileTabContent: $("profileTabContent"),

  libraryView: $("libraryView"),
  libNewPlaylistBtn: $("libNewPlaylistBtn"),
  libMbBatchBtn: $("libMbBatchBtn"),
  libSyncBtn: $("libSyncBtn"),
  libraryTabs: $("libraryTabs"),
  libraryTabBody: $("libraryTabBody"),

  collectionView: $("collectionView"),
  collectionHeroBg: $("collectionHeroBg"),
  collectionArtwork: $("collectionArtwork"),
  collectionEyebrow: $("collectionEyebrow"),
  collectionTitle: $("collectionTitle"),
  collectionDesc: $("collectionDesc"),
  collectionStats: $("collectionStats"),
  collectionShuffleBtn: $("collectionShuffleBtn"),
  collectionPlayBtn: $("collectionPlayBtn"),
  collectionFilterInput: $("collectionFilterInput"),
  collectionExtraActions: $("collectionExtraActions"),
  collectionTrackList: $("collectionTrackList"),
  collectionEmpty: $("collectionEmpty"),

  // Player
  audioEl: $("audioEl"),
  playerArtTrigger: $("playerArtTrigger"),
  playerTitle: $("playerTitle"),
  playerSubtitle: $("playerSubtitle"),
  playerLikeBtn: $("playerLikeBtn"),
  shuffleBtn: $("shuffleBtn"),
  prevTrackBtn: $("prevTrackBtn"),
  playPauseBtn: $("playPauseBtn"),
  playPauseSvg: $("playPauseSvg"),
  nextTrackBtn: $("nextTrackBtn"),
  repeatBtn: $("repeatBtn"),
  repeatOneTag: $("repeatOneTag"),
  currentTimeLabel: $("currentTimeLabel"),
  durationLabel: $("durationLabel"),
  seekBar: $("seekBar"),
  seekBufferFill: $("seekBufferFill"),
  seekProgressFill: $("seekProgressFill"),
  seekThumb: $("seekThumb"),
  playerCodecBadge: $("playerCodecBadge"),
  eqToggleBtn: $("eqToggleBtn"),
  queueToggleBtn: $("queueToggleBtn"),
  playerInspectBtn: $("playerInspectBtn"),
  muteBtn: $("muteBtn"),
  volumeSvg: $("volumeSvg"),
  volumeBar: $("volumeBar"),
  volumeFill: $("volumeFill"),
  volumeThumb: $("volumeThumb"),
  fullscreenToggleBtn: $("fullscreenToggleBtn"),

  // Popovers & Drawers
  notifPopover: $("notifPopover"),
  markAllReadBtn: $("markAllReadBtn"),
  notifList: $("notifList"),
  eqPopover: $("eqPopover"),
  eqStatusBadge: $("eqStatusBadge"),
  eqPresetsRow: $("eqPresetsRow"),
  eqSlidersGrid: $("eqSlidersGrid"),
  speedPills: $("speedPills"),
  sleepPills: $("sleepPills"),
  trackContextMenu: $("trackContextMenu"),
  drawerBackdrop: $("drawerBackdrop"),
  queueDrawer: $("queueDrawer"),
  queueContent: $("queueContent"),
  clearQueueBtn: $("clearQueueBtn"),
  closeQueueBtn: $("closeQueueBtn"),
  inspectorDrawer: $("inspectorDrawer"),
  inspectorContent: $("inspectorContent"),
  closeInspectorBtn: $("closeInspectorBtn"),

  // Fullscreen
  fullscreenPlayer: $("fullscreenPlayer"),
  fsBackdrop: $("fsBackdrop"),
  closeFullscreenBtn: $("closeFullscreenBtn"),
  fsSourceText: $("fsSourceText"),
  fsCoverWrap: $("fsCoverWrap"),
  fsVisualizerCanvas: $("fsVisualizerCanvas"),
  fsTitle: $("fsTitle"),
  fsArtist: $("fsArtist"),
  fsLikeBtn: $("fsLikeBtn"),
  fsSeekBar: $("fsSeekBar"),
  fsSeekFill: $("fsSeekFill"),
  fsSeekThumb: $("fsSeekThumb"),
  fsCurrentTime: $("fsCurrentTime"),
  fsCodecPill: $("fsCodecPill"),
  fsDuration: $("fsDuration"),
  fsShuffleBtn: $("fsShuffleBtn"),
  fsPrevBtn: $("fsPrevBtn"),
  fsPlayPauseBtn: $("fsPlayPauseBtn"),
  fsPlayPauseSvg: $("fsPlayPauseSvg"),
  fsNextBtn: $("fsNextBtn"),
  fsRepeatBtn: $("fsRepeatBtn"),
  fsSidePanel: $("fsSidePanel"),

  // Modals
  playlistModal: $("playlistModal"),
  playlistModalTitle: $("playlistModalTitle"),
  closePlaylistModalBtn: $("closePlaylistModalBtn"),
  cancelPlaylistModalBtn: $("cancelPlaylistModalBtn"),
  playlistForm: $("playlistForm"),
  playlistNameInput: $("playlistNameInput"),
  playlistDescInput: $("playlistDescInput"),
  playlistGradientPicker: $("playlistGradientPicker"),
  savePlaylistBtn: $("savePlaylistBtn"),

  addToPlaylistModal: $("addToPlaylistModal"),
  closeAddToPlModalBtn: $("closeAddToPlModalBtn"),
  addToPlTrackPreview: $("addToPlTrackPreview"),
  addToPlList: $("addToPlList"),
  addToPlCreateNewBtn: $("addToPlCreateNewBtn"),

  profileModal: $("profileModal"),
  closeProfileModalBtn: $("closeProfileModalBtn"),
  cancelProfileModalBtn: $("cancelProfileModalBtn"),
  profileForm: $("profileForm"),
  profileNameInput: $("profileNameInput"),
  profileHandleInput: $("profileHandleInput"),
  profileBioInput: $("profileBioInput"),
  profileAvatarUrlInput: $("profileAvatarUrlInput"),
  avatarPresetPicker: $("avatarPresetPicker"),
  accentColorPicker: $("accentColorPicker"),

  syncModal: $("syncModal"),
  closeSyncModalBtn: $("closeSyncModalBtn"),
  syncModalTabs: $("syncModalTabs"),
  syncTabArtistGrid: $("syncTabArtistGrid"),
  syncTabUrl: $("syncTabUrl"),
  syncTabLocal: $("syncTabLocal"),
  syncTabSpotify: $("syncTabSpotify"),
  syncForm: $("syncForm"),
  trackerInput: $("trackerInput"),
  syncBtn: $("syncBtn"),
  modalSeedDemoBtn: $("modalSeedDemoBtn"),
  directorySearchInput: $("directorySearchInput"),
  directoryList: $("directoryList"),
  importUrlForm: $("importUrlForm"),
  importUrlInput: $("importUrlInput"),
  importUrlMbCheck: $("importUrlMbCheck"),
  importUrlBtn: $("importUrlBtn"),
  localScanForm: $("localScanForm"),
  localFolderInput: $("localFolderInput"),
  localScanStatus: $("localScanStatus"),
  localScanBtn: $("localScanBtn"),
  spotifyImportForm: $("spotifyImportForm"),
  spotifyPlaylistNameInput: $("spotifyPlaylistNameInput"),
  spotifySourceSelect: $("spotifySourceSelect"),
  spotifyFileInput: $("spotifyFileInput"),
  spotifyContentInput: $("spotifyContentInput"),
  spotifyImportStatus: $("spotifyImportStatus"),
  spotifyImportBtn: $("spotifyImportBtn"),

  cacheModal: $("cacheModal"),
  closeCacheBtn: $("closeCacheBtn"),
  cacheUsedValue: $("cacheUsedValue"),
  cacheCapValue: $("cacheCapValue"),
  cacheCountValue: $("cacheCountValue"),
  cacheProgressBar: $("cacheProgressBar"),
  customCapForm: $("customCapForm"),
  customCapMbInput: $("customCapMbInput"),
  clearAllCacheBtn: $("clearAllCacheBtn"),
  cacheEntriesList: $("cacheEntriesList"),
  cookiesBrowserSelect: $("cookiesBrowserSelect"),
  lanStatusText: $("lanStatusText"),
  lanAccessToggle: $("lanAccessToggle"),
  restartLanBtn: $("restartLanBtn"),
  lanUrlsList: $("lanUrlsList"),
  updateStatusText: $("updateStatusText"),
  checkUpdateBtn: $("checkUpdateBtn"),
  applyUpdateBtn: $("applyUpdateBtn"),
  restartAppBtn: $("restartAppBtn"),
  testResolveForm: $("testResolveForm"),
  testResolveInput: $("testResolveInput"),
  testResolveOutput: $("testResolveOutput"),
};

/* ==================== UTILITIES ==================== */
function escapeHtml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function monogram(text) {
  const clean = (text || "?").replace(/[^\p{L}\p{N}]/gu, "");
  return (clean.slice(0, 2) || "♪").toUpperCase();
}

function coverUrl(rawUrl, artist = "", era = "") {
  if (!rawUrl && (!artist || !era)) return "";
  if (rawUrl && rawUrl.startsWith("/")) return rawUrl;
  const params = new URLSearchParams();
  if (rawUrl) params.set("url", rawUrl);
  if (artist) params.set("artist", artist);
  if (era) params.set("era", era);
  return `/api/image?${params.toString()}`;
}

function formatCodecShort(track) {
  if (track?.audioMeta?.codec) {
    const sr = track.audioMeta.sampleRateHz
      ? ` ${(track.audioMeta.sampleRateHz / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : "";
    return `${track.audioMeta.codec}${sr}`;
  }
  return track?.formatHint ? track.formatHint.toUpperCase() : "";
}

function formatCodecFull(track) {
  if (track?.audioMeta?.codec) {
    const parts = [track.audioMeta.codec];
    if (track.audioMeta.sampleRateHz) {
      parts.push(`${(track.audioMeta.sampleRateHz / 1000).toFixed(1).replace(/\.0$/, "")} kHz`);
    }
    if (track.audioMeta.bitsPerSample) {
      parts.push(`${track.audioMeta.bitsPerSample}-bit`);
    }
    return parts.join(" · ");
  }
  return track?.quality || track?.formatHint?.toUpperCase() || "Unknown";
}

function isTrackLossless(tr) {
  return Boolean(
    tr?.audioMeta?.lossless ||
      /lossless|cdq|cd quality|flac|wav|alac/i.test(`${tr?.quality ?? ""} ${tr?.formatHint ?? ""}`)
  );
}

function rememberTracks(tracks) {
  for (const t of tracks || []) {
    if (t?.id) {
      if (state.likedIds.has(t.id)) t.isLiked = true;
      state.trackMap.set(t.id, t);
    }
  }
}

function applyAccentColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return;
  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, r + 24);
  const lg = Math.min(255, g + 24);
  const lb = Math.min(255, b + 24);
  root.setProperty("--accent-hover", `rgb(${lr}, ${lg}, ${lb})`);
  root.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, 0.18)`);
  root.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.42)`);
}

let toastTimer = null;
function showToast(msg, kind = "info") {
  clearTimeout(toastTimer);
  el.statusToast.textContent = msg;
  el.statusToast.className = `status-toast ${kind === "error" ? "error" : kind === "success" ? "success" : ""}`;
  if (kind !== "error") {
    toastTimer = setTimeout(() => el.statusToast.classList.add("hidden"), 4200);
  }
}

function hideToast() {
  el.statusToast.classList.add("hidden");
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/* ==================== NAVIGATION ENGINE ==================== */
function closeAllPopovers() {
  el.notifPopover.classList.add("hidden");
  el.eqPopover.classList.add("hidden");
  el.trackContextMenu.classList.add("hidden");
}

function closeMobileSidebar() {
  el.sidebar.classList.remove("mobile-open");
  el.mobileSidebarBackdrop.classList.add("hidden");
}

function updateNavHistoryButtons() {
  el.navBackBtn.disabled = state.navIndex <= 0;
  el.navForwardBtn.disabled = state.navIndex >= state.navStack.length - 1;
}

async function navigate(route, push = true) {
  closeAllPopovers();
  closeMobileSidebar();

  if (push) {
    state.navStack = state.navStack.slice(0, state.navIndex + 1);
    state.navStack.push(route);
    state.navIndex = state.navStack.length - 1;
  }
  state.route = route;
  updateNavHistoryButtons();

  // Sidebar active highlight
  el.navItems.forEach((btn) => {
    const v = btn.getAttribute("data-view");
    const isMatch =
      v === route.view ||
      (v === "library" && route.view === "artist") ||
      (v === "liked" && route.view === "liked");
    btn.classList.toggle("active", isMatch);
  });

  document.querySelectorAll(".sidebar-pl-item").forEach((item) => {
    item.classList.toggle(
      "active",
      route.view === "playlist" && item.getAttribute("data-sidebar-pl") === route.playlistId
    );
  });

  // Hide all views
  const isCollection = ["liked", "playlist", "era", "mix"].includes(route.view);
  el.homeView.classList.toggle("hidden", route.view !== "home");
  el.searchView.classList.toggle("hidden", route.view !== "search");
  el.artistView.classList.toggle("hidden", route.view !== "artist");
  el.profileView.classList.toggle("hidden", route.view !== "profile");
  el.libraryView.classList.toggle("hidden", route.view !== "library");
  el.collectionView.classList.toggle("hidden", !isCollection);

  // Header hero transparency
  const isHeroView = route.view === "artist" || isCollection;
  el.stageHeader.classList.toggle("over-hero", isHeroView);
  el.stageHeader.classList.remove("scrolled");
  el.stageScroll.scrollTop = 0;

  if (route.view === "home") {
    await renderHomeView();
  } else if (route.view === "search") {
    await renderSearchView();
  } else if (route.view === "artist") {
    await renderArtistView(route.trackerId, route.tabName);
  } else if (route.view === "profile") {
    if (route.tab) state.profileTab = route.tab;
    await renderProfileView();
  } else if (route.view === "library") {
    if (route.tab) state.libraryTab = route.tab;
    await renderLibraryView();
  } else if (isCollection) {
    await renderCollectionView(route);
  }
}

/* ==================== CORE DATA REFRESHERS ==================== */
async function refreshProfile() {
  const data = await apiJson("/api/profile");
  state.profile = data.profile;
  state.profileStats = data.stats;
  applyAccentColor(state.profile.accentColor);
  renderHeaderAvatar();
}

function renderAvatarInto(containerEl, profile) {
  const grad = AVATAR_PRESETS[profile.avatarPreset] || AVATAR_PRESETS.violet;
  containerEl.style.background = grad;
  if (profile.avatarUrl) {
    containerEl.innerHTML = `<img src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(profile.name)}" onerror="this.remove()" />`;
  } else {
    containerEl.textContent = monogram(profile.name).slice(0, 1);
  }
}

function renderHeaderAvatar() {
  renderAvatarInto(el.headerAvatarInner, state.profile);
}

async function refreshTrackers() {
  const data = await apiJson("/api/trackers");
  state.trackers = data.trackers || [];
  if (!state.activeTrackerId && state.trackers.length > 0) {
    state.activeTrackerId = state.trackers[0].trackerId;
    state.activeTabName = state.trackers[0].currentTab;
  }
}

async function refreshLikes() {
  const data = await apiJson("/api/likes");
  state.likedIds = new Set(data.likedIds || []);
  state.likedTracks = data.tracks || [];
  rememberTracks(state.likedTracks);
  el.sidebarLikedCount.textContent = String(state.likedIds.size);
  el.sidebarLikedCount.classList.toggle("hidden", state.likedIds.size === 0);
  updatePlayerLikeState();
}

async function refreshPlaylists() {
  const data = await apiJson("/api/playlists");
  state.playlists = data.playlists || [];
  renderSidebarPlaylists();
}

function renderSidebarPlaylists() {
  if (state.playlists.length === 0) {
    el.sidebarPlaylistsWrap.classList.add("hidden");
    return;
  }
  el.sidebarPlaylistsWrap.classList.remove("hidden");
  el.sidebarPlaylistsList.innerHTML = state.playlists
    .map((pl) => {
      const thumb = pl.previewImages?.[0]
        ? `<img src="${escapeHtml(coverUrl(pl.previewImages[0]))}" alt="" onerror="this.remove()" />`
        : escapeHtml(monogram(pl.name).slice(0, 1));
      const active = state.route.view === "playlist" && state.route.playlistId === pl.id ? "active" : "";
      return `
        <button type="button" class="sidebar-pl-item ${active}" data-sidebar-pl="${escapeHtml(pl.id)}">
          <span class="sidebar-pl-swatch" style="background:${escapeHtml(pl.coverGradient || PLAYLIST_GRADIENTS[0])}">${thumb}</span>
          <span class="sidebar-pl-name">${escapeHtml(pl.name)}</span>
        </button>
      `;
    })
    .join("");
}

async function refreshHistory() {
  const data = await apiJson("/api/history?limit=30");
  state.historyItems = data.items || [];
  rememberTracks(state.historyItems.map((h) => h.track));
}

async function refreshRecentSearches() {
  const data = await apiJson("/api/recent-searches");
  state.recentSearches = data.items || [];
}

async function refreshActivity() {
  const data = await apiJson("/api/activity");
  state.activity = data.items || [];
  state.unreadActivity = data.unreadCount || 0;
  el.notifUnreadDot.classList.toggle("hidden", state.unreadActivity === 0);
}

async function refreshCacheStats() {
  try {
    const stats = await apiJson("/api/cache");
    state.cacheStats = stats;
    el.sidebarCacheLabel.textContent = `${formatBytes(stats.totalCachedBytes)} cached`;
    if (!el.cacheModal.classList.contains("hidden")) {
      renderCacheModal(stats);
    }
  } catch {
    // ignore
  }
}

async function refreshAllCore() {
  await Promise.all([
    refreshProfile(),
    refreshTrackers(),
    refreshLikes(),
    refreshPlaylists(),
    refreshHistory(),
    refreshRecentSearches(),
    refreshActivity(),
    refreshCacheStats(),
  ]);
}

/* ==================== SHARED COMPONENT BUILDERS ==================== */
function isTrackUnavailable(tr) {
  return Boolean(
    tr?.isUnavailable ||
      tr?.tabName === "Unavailable" ||
      /\b(?:not\s+available|unavailable|inaudible|snippet)\b/i.test(tr?.quality || "")
  );
}

function canAttemptPlay(tr) {
  return Boolean(tr && (tr.isPlayable || (Array.isArray(tr.links) && tr.links.length > 0)));
}

function buildTrackRowHtml(tr, opts = {}) {
  const isPlayingTrack = state.playingTrack?.id === tr.id;
  const isActivelyPlaying = isPlayingTrack && !el.audioEl.paused;
  const isSelected = state.selectedTrack?.id === tr.id;
  const isLiked = state.likedIds.has(tr.id);
  const unavail = isTrackUnavailable(tr);
  const clickable = canAttemptPlay(tr);
  const lossless = isTrackLossless(tr);
  const codec = formatCodecShort(tr);

  let badgeHtml = "";
  if (unavail) {
    badgeHtml = `<span class="soft-tag unavailable-tag">Unavailable</span>`;
  } else if (tr.cacheStatus?.isComplete) {
    badgeHtml = `<span class="soft-tag lossless">Offline</span>`;
  } else if (tr.cacheStatus?.totalBytes) {
    const pct = Math.round((tr.cacheStatus.cachedBytes / tr.cacheStatus.totalBytes) * 100);
    badgeHtml = `<span class="soft-tag partial">${pct}%</span>`;
  } else if (codec) {
    badgeHtml = `<span class="soft-tag ${lossless ? "lossless" : ""}">${escapeHtml(codec)}</span>`;
  } else if (lossless) {
    badgeHtml = `<span class="soft-tag lossless">Lossless</span>`;
  }

  const subParts = [];
  if (opts.showPlays && tr.playCount > 0) {
    subParts.push(`${tr.playCount.toLocaleString()} ${tr.playCount === 1 ? "play" : "plays"}`);
  }
  if (!opts.hideArtist && tr.artist) subParts.push(tr.artist);
  if (tr.era) subParts.push(tr.era);
  if (tr.quality && !/not available/i.test(tr.quality) && subParts.length < 3) {
    subParts.push(tr.quality);
  }

  const imgSrc = coverUrl(tr.eraImage || "", tr.artist, tr.era);
  const dur = tr.trackLength || (tr.audioMeta?.durationSec ? formatTime(tr.audioMeta.durationSec) : "");

  return `
    <div
      class="track-item ${isPlayingTrack ? "playing" : ""} ${isSelected ? "active" : ""} ${unavail ? "is-unavailable" : ""}"
      data-track-id="${escapeHtml(tr.id)}"
      data-list-ctx="${escapeHtml(opts.ctx || "")}"
    >
      <button
        type="button"
        class="track-thumb"
        data-action="play"
        data-track-id="${escapeHtml(tr.id)}"
        ${clickable ? "" : "disabled"}
        title="${unavail ? "Unavailable (click to retry)" : clickable ? (isActivelyPlaying ? "Pause" : "Play") : "No playable link"}"
      >
        <span class="track-thumb-fallback">${escapeHtml(monogram(tr.title))}</span>
        ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
        <span class="track-thumb-overlay">${isActivelyPlaying ? ICONS.eqBars : ICONS.play}</span>
      </button>

      <div class="track-item-main">
        <div class="track-item-title">
          ${escapeHtml(tr.title)}${tr.credits ? ` <span class="track-item-credits">${escapeHtml(tr.credits)}</span>` : ""}
        </div>
        <div class="track-item-sub">${escapeHtml(subParts.join(" · "))}</div>
      </div>

      <div class="track-item-badges">${badgeHtml}</div>

      <button
        type="button"
        class="row-heart-btn ${isLiked ? "liked" : ""}"
        data-action="like"
        data-track-id="${escapeHtml(tr.id)}"
        title="${isLiked ? "Remove from Liked songs" : "Save to Liked songs"}"
      >
        ${ICONS.heart}
      </button>

      <div class="track-duration mono">${escapeHtml(dur)}</div>

      <button
        type="button"
        class="row-more-btn"
        data-action="menu"
        data-track-id="${escapeHtml(tr.id)}"
        title="More options"
      >
        ${ICONS.more}
      </button>
    </div>
  `;
}

function buildPlaylistMosaicHtml(pl, sizeClass = "") {
  if (pl.coverImage) {
    return `<img src="${escapeHtml(coverUrl(pl.coverImage))}" alt="" onerror="this.remove()" />`;
  }
  const imgs = (pl.previewImages || []).slice(0, 4);
  if (imgs.length >= 4 && sizeClass === "large") {
    return `<div class="collection-art-mosaic">${imgs
      .map((u) => `<img src="${escapeHtml(coverUrl(u))}" alt="" onerror="this.remove()" />`)
      .join("")}</div>`;
  }
  if (imgs.length >= 1) {
    return `<img src="${escapeHtml(coverUrl(imgs[0]))}" alt="" onerror="this.remove()" />`;
  }
  return `<span>${escapeHtml(monogram(pl.name))}</span>`;
}

function buildMixCardHtml({ title, subtitle, bg, imgUrl, dataAttrs }) {
  return `
    <button type="button" class="mix-card" style="background:${escapeHtml(bg)}" ${dataAttrs}>
      ${imgUrl ? `<img class="mix-card-bg" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
      <span class="mix-card-scrim"></span>
      <span class="mix-card-title">${escapeHtml(title)}</span>
      ${subtitle ? `<span class="mix-card-sub">${escapeHtml(subtitle)}</span>` : ""}
    </button>
  `;
}

/* ==================== 1. HOME VIEW ==================== */
async function renderHomeView() {
  if (state.trackers.length === 0) {
    el.homeEmptyHero.classList.remove("hidden");
    el.homeContent.classList.add("hidden");
    return;
  }

  el.homeEmptyHero.classList.add("hidden");
  el.homeContent.classList.remove("hidden");
  el.homeGreetingTitle.textContent = `${getGreeting()}, ${state.profile.name}`;

  // 1) Quick Access 6-tile shelf
  const tiles = [
    {
      title: "Liked songs",
      sub: `${state.likedIds.size} tracks`,
      grad: "linear-gradient(135deg, #6d28d9, #ec4899)",
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M12 20.4c-.3 0-.6-.1-.8-.3C6.2 15.8 3 12.8 3 8.9 3 6.1 5.2 4 7.9 4c1.6 0 3.1.8 4.1 2.1C13 4.8 14.5 4 16.1 4 18.8 4 21 6.1 21 8.9c0 3.9-3.2 6.9-8.2 11.2-.2.2-.5.3-.8.3z"/></svg>`,
      action: `data-quick-route="liked"`,
    },
    {
      title: "Lossless vault",
      sub: "FLAC & WAV masters",
      grad: "linear-gradient(135deg, #059669, #0f766e)",
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>`,
      action: `data-quick-route="mix:lossless"`,
    },
    {
      title: "Downloaded offline",
      sub: `${state.cacheStats?.entryCount ?? 0} cached`,
      grad: "linear-gradient(135deg, #2563eb, #1e3a8a)",
      icon: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`,
      action: `data-quick-route="mix:cached"`,
    },
  ];

  for (const pl of state.playlists.slice(0, 3)) {
    tiles.push({
      title: pl.name,
      sub: `${pl.trackCount} tracks`,
      grad: pl.coverGradient || PLAYLIST_GRADIENTS[0],
      img: pl.previewImages?.[0] ? coverUrl(pl.previewImages[0]) : "",
      action: `data-quick-route="playlist:${escapeHtml(pl.id)}"`,
    });
  }

  for (const trk of state.trackers) {
    if (tiles.length >= 6) break;
    tiles.push({
      title: trk.artistName,
      sub: `${trk.trackCount} tracks`,
      grad: "linear-gradient(135deg, #4338ca, #18181b)",
      img: trk.coverImage ? coverUrl(trk.coverImage) : "",
      action: `data-quick-route="artist:${escapeHtml(trk.trackerId)}"`,
    });
  }

  el.quickAccessGrid.innerHTML = tiles
    .slice(0, 6)
    .map(
      (tile) => `
      <button type="button" class="quick-tile" ${tile.action}>
        <div class="quick-tile-art" style="background:${escapeHtml(tile.grad)}">
          ${tile.img ? `<img src="${escapeHtml(tile.img)}" alt="" onerror="this.remove()" />` : tile.icon || escapeHtml(monogram(tile.title))}
        </div>
        <div class="quick-tile-text">
          <div class="quick-tile-title">${escapeHtml(tile.title)}</div>
          <div class="quick-tile-sub">${escapeHtml(tile.sub)}</div>
        </div>
        <span class="quick-tile-play" aria-hidden="true">${ICONS.play}</span>
      </button>
    `
    )
    .join("");

  // 2) Artists shelf
  el.homeArtistsBlock.classList.toggle("hidden", state.trackers.length === 0);
  el.homeArtistsRow.innerHTML = state.trackers
    .slice(0, 8)
    .map((t) => {
      const img = t.coverImage ? coverUrl(t.coverImage) : "";
      return `
        <button type="button" class="artist-card" data-open-artist="${escapeHtml(t.trackerId)}">
          <div class="artist-avatar-wrap">
            <span>${escapeHtml(monogram(t.artistName))}</span>
            ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
          </div>
          <div class="artist-card-name">${escapeHtml(t.artistName)}</div>
          <div class="artist-card-sub">${t.playableCount} playable · Artist</div>
        </button>
      `;
    })
    .join("");

  // 3) Recently played deduplicated shelf
  const seenRecent = new Set();
  const uniqueRecent = [];
  for (const h of state.historyItems) {
    if (!seenRecent.has(h.track.id)) {
      seenRecent.add(h.track.id);
      uniqueRecent.push(h.track);
    }
    if (uniqueRecent.length >= 6) break;
  }
  el.homeRecentBlock.classList.toggle("hidden", uniqueRecent.length === 0);
  el.homeRecentShelf.innerHTML = uniqueRecent
    .map((tr) => {
      const img = coverUrl(tr.eraImage || "", tr.artist, tr.era);
      return `
        <div class="media-card" data-card-track="${escapeHtml(tr.id)}">
          <div class="media-card-art">
            <span>${escapeHtml(monogram(tr.title))}</span>
            ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
            <button type="button" class="media-card-play" data-card-play="${escapeHtml(tr.id)}" aria-label="Play ${escapeHtml(tr.title)}">
              ${ICONS.play}
            </button>
          </div>
          <div class="media-card-title">${escapeHtml(tr.title)}</div>
          <div class="media-card-sub">${escapeHtml(tr.artist)} · ${escapeHtml(tr.era)}</div>
        </div>
      `;
    })
    .join("");

  // Keep active tracker state & prewarm era metadata for Search Discover without cluttering Home
  const primary = state.trackers.find((t) => t.trackerId === state.activeTrackerId) || state.trackers[0];
  state.activeTrackerId = primary.trackerId;
  state.activeTabName = state.activeTabName || primary.currentTab;

  const data = await apiJson(`/api/tracks?playableOnly=1&limit=1`).catch(() => null);
  if (data?.eras) state.homeEras = data.eras;
}

/* ==================== 2. SEARCH VIEW (Audio X Image 2) ==================== */
const ONLINE_SOURCE_LABELS = {
  ytmusic: "YouTube Music",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

async function renderSearchView() {
  el.searchSourceTabs?.querySelectorAll("[data-search-source]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-search-source") === state.searchSource);
  });

  if (state.searchSource !== "library") {
    el.searchDiscoverWrap.classList.add("hidden");
    el.searchResultsWrap.classList.remove("hidden");
    el.localFilterPills?.classList.add("hidden");
    el.searchTopResultWrap.classList.add("hidden");
    el.paginationBar.classList.add("hidden");
    await loadOnlineSearchResults();
    return;
  }

  el.localFilterPills?.classList.remove("hidden");

  const hasQueryOrFilters = Boolean(
    state.searchQuery.trim() ||
      state.searchTrackerId ||
      state.searchTabName ||
      state.searchEra ||
      state.searchHost ||
      state.losslessOnly
  );

  el.searchDiscoverWrap.classList.toggle("hidden", hasQueryOrFilters);
  el.searchResultsWrap.classList.toggle("hidden", !hasQueryOrFilters);

  if (!hasQueryOrFilters) {
    el.queryTimingBadge.classList.add("hidden");
    el.searchCollectionsWrap?.classList.add("hidden");
    if (state.homeEras.length === 0 && state.trackers.length > 0) {
      const meta = await apiJson("/api/tracks?limit=1").catch(() => null);
      if (meta?.eras) state.homeEras = meta.eras;
    }
    renderSearchDiscover();
    return;
  }

  await loadSearchResults();
}

async function loadOnlineSearchResults() {
  const q = state.searchQuery.trim();
  const label = ONLINE_SOURCE_LABELS[state.searchSource] || "Online";

  if (!q) {
    el.queryTimingBadge.classList.add("hidden");
    el.searchCollectionsWrap?.classList.add("hidden");
    el.searchResultsHeading.textContent = `Search ${label}`;
    el.searchResultsSub.textContent = "Type a song, album, or playlist name in the search bar above.";
    el.searchTrackList.innerHTML = "";
    el.listEmptyState.classList.add("hidden");
    return;
  }

  const seq = ++state.onlineSearchReqSeq;
  el.searchResultsHeading.textContent = `${label}: "${q}"`;
  el.searchResultsSub.textContent = `Searching ${label}...`;
  el.listEmptyState.classList.add("hidden");

  try {
    const data = await apiJson(
      `/api/discover/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(state.searchSource)}&limit=15`
    );
    if (seq !== state.onlineSearchReqSeq || state.searchSource === "library") return;

    const results = data.results || [];
    const collections = data.collections || [];
    state.onlineResults = results;
    state.onlineCollections = collections;

    el.queryTimingBadge.textContent = `${results.length + collections.length} · ${label}`;
    el.queryTimingBadge.classList.remove("hidden");
    el.searchResultsSub.textContent =
      collections.length > 0
        ? `${collections.length} album/playlist matches · ${results.length} songs on ${label}`
        : `${results.length} playable songs on ${label} (double-click or click Play to stream)`;

    if (collections.length > 0 && el.searchCollectionsWrap && el.searchCollectionsGrid) {
      el.searchCollectionsWrap.classList.remove("hidden");
      el.searchCollectionsGrid.innerHTML = collections
        .map((c, idx) => {
          const thumb = c.thumbnail ? coverUrl(c.thumbnail) : "";
          return `
            <div class="media-card online-col-card" data-online-col-play="${idx}">
              <div class="media-card-art" style="background:${MIX_GRADIENTS[idx % MIX_GRADIENTS.length]}">
                <span>${escapeHtml(monogram(c.title))}</span>
                ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
                <button type="button" class="media-card-play" data-online-col-play="${idx}" title="Play ${escapeHtml(c.title)}">${ICONS.play}</button>
              </div>
              <div class="media-card-title">${escapeHtml(c.title)}</div>
              <div class="media-card-sub" style="display:flex; align-items:center; justify-content:space-between; gap:6px">
                <span style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(c.subtitle || c.kind)} · ${escapeHtml(c.artist)}</span>
                <button type="button" class="pill-btn" style="padding:2px 8px; font-size:11px; flex-shrink:0" data-online-col-save="${idx}">+ Playlist</button>
              </div>
            </div>
          `;
        })
        .join("");
    } else {
      el.searchCollectionsWrap?.classList.add("hidden");
    }

    el.searchTrackList.innerHTML = results
      .map((item, idx) => {
        const thumb = item.thumbnail ? coverUrl(item.thumbnail) : "";
        const metaParts = [item.artist, item.album, item.durationText].filter(Boolean);
        return `
          <div class="simple-row online-result-row" data-online-idx="${idx}">
            <div class="simple-thumb" style="background:${MIX_GRADIENTS[idx % MIX_GRADIENTS.length]}">
              <span>${escapeHtml(monogram(item.title))}</span>
              ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" onerror="this.remove()" />` : ""}
            </div>
            <div class="track-item-main">
              <div class="track-item-title">${escapeHtml(item.title)}</div>
              <div class="track-item-sub">${escapeHtml(metaParts.join(" · "))}</div>
            </div>
            <div class="online-action-group">
              <button type="button" class="pill-btn" data-online-save="${idx}">+ Save</button>
              <button type="button" class="btn btn-accent btn-sm" data-online-play="${idx}">Play</button>
            </div>
          </div>
        `;
      })
      .join("");
    el.listEmptyState.classList.toggle("hidden", results.length > 0 || collections.length > 0);
  } catch (err) {
    if (seq !== state.onlineSearchReqSeq) return;
    el.searchCollectionsWrap?.classList.add("hidden");
    el.searchResultsSub.textContent = `Search failed: ${err.message}`;
    el.searchTrackList.innerHTML = "";
    el.listEmptyState.classList.remove("hidden");
  }
}

async function importOnlineCollection(idx, autoPlay) {
  const col = state.onlineCollections[idx];
  if (!col) return;
  showToast(`${autoPlay ? "Loading" : "Saving"} ${col.kind} "${col.title}"...`);
  try {
    const res = await apiJson("/api/discover/import-collection", {
      method: "POST",
      body: JSON.stringify({
        kind: col.kind,
        source: col.source,
        idOrUrl: col.browseId || col.url,
        title: col.title,
        artist: col.artist,
        thumbnail: col.thumbnail,
        savePlaylist: true,
      }),
    });
    rememberTracks(res.tracks || []);
    await Promise.all([refreshPlaylists(), refreshTrackers(), refreshActivity()]);
    if (!autoPlay && res.playlist?.id) {
      showToast(`Saved "${res.playlist.name}" (${res.tracks?.length ?? 0} tracks) to Playlists.`, "success");
      await navigate({ view: "playlist", playlistId: res.playlist.id });
    } else if (res.tracks?.length) {
      showToast(`Playing "${res.title}" (${res.tracks.length} tracks)`, "success");
      startQueueAndPlay(res.tracks, 0, res.title, false);
    } else {
      showToast("No playable tracks found in this collection.", "error");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function importOnlineResult(idx, autoPlay) {
  const item = state.onlineResults[idx];
  if (!item) return;
  showToast(`${autoPlay ? "Loading stream" : "Saving"} "${item.title}"...`);
  try {
    const res = await apiJson("/api/discover/import-url", {
      method: "POST",
      body: JSON.stringify({
        url: item.url,
        title: item.title,
        artist: item.artist,
        album: item.album,
        thumbnail: item.thumbnail,
        enrichMusicBrainz: true,
      }),
    });
    rememberTracks([res.track]);
    await Promise.all([refreshTrackers(), refreshActivity()]);
    if (autoPlay && res.track) {
      await playTrack(res.track);
    } else {
      showToast(`Saved "${res.track?.title || item.title}" to Imported Web Tracks.`, "success");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderSearchDiscover() {
  // Recent Searches (Image 2 top section)
  el.recentSearchesBlock.classList.toggle("hidden", state.recentSearches.length === 0);
  el.recentSearchesList.innerHTML = state.recentSearches
    .map((rs) => {
      const img = rs.imageUrl ? coverUrl(rs.imageUrl) : "";
      const isRound = rs.itemType === "artist";
      return `
        <div class="simple-row" data-recent-id="${rs.id}">
          <div class="simple-thumb ${isRound ? "round" : ""}" style="background:${MIX_GRADIENTS[rs.id % MIX_GRADIENTS.length]}">
            <span>${escapeHtml(monogram(rs.query))}</span>
            ${img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.remove()" />` : ""}
          </div>
          <div class="track-item-main">
            <div class="track-item-title">${escapeHtml(rs.query)}</div>
            <div class="track-item-sub">${escapeHtml(rs.subtitle || rs.itemType)}</div>
          </div>
          <div class="simple-row-right">
            <button type="button" class="row-remove-x" data-del-recent="${rs.id}" title="Remove">${ICONS.x}</button>
            ${ICONS.chevron}
          </div>
        </div>
      `;
    })
    .join("");

  // "Based on what you like" 4-column visual mix grid (Image 2 bottom section)
  const mixCards = [
    {
      title: "Lossless Mix",
      subtitle: "FLAC & WAV masters",
      bg: "linear-gradient(135deg, #065f46, #064e3b)",
      imgUrl: "/api/demo/art/midnight-telemetry",
      dataAttrs: `data-open-mix="lossless"`,
    },
    {
      title: "Offline Vault",
      subtitle: `${state.cacheStats?.entryCount ?? 0} cached on disk`,
      bg: "linear-gradient(135deg, #1d4ed8, #0f172a)",
      imgUrl: "/api/demo/art/chrome-solstice",
      dataAttrs: `data-open-mix="cached"`,
    },
    {
      title: "Collaborations",
      subtitle: "Featuring & rare demos",
      bg: "linear-gradient(135deg, #9f1239, #3b0764)",
      imgUrl: "/api/demo/art/velvet-tapes",
      dataAttrs: `data-open-mix="collabs"`,
    },
    {
      title: "Late Night Vault",
      subtitle: "Recently played & favorites",
      bg: "linear-gradient(135deg, #5b21b6, #111827)",
      imgUrl: "/api/demo/art/after-hours-sessions",
      dataAttrs: `data-open-mix="recent"`,
    },
  ];

  // Append top real eras from the library
  const seenEras = new Set();
  for (const era of state.homeEras) {
    if (mixCards.length >= 8) break;
    if (seenEras.has(era.era)) continue;
    seenEras.add(era.era);
    mixCards.push({
      title: era.era,
      subtitle: `${era.count} tracks`,
      bg: era.eraColor ? `linear-gradient(135deg, ${era.eraColor}, #111116)` : MIX_GRADIENTS[mixCards.length % MIX_GRADIENTS.length],
      imgUrl: coverUrl(era.eraImage || ""),
      dataAttrs: `data-open-era="${escapeHtml(era.era)}"`,
    });
  }

  // Ensure full balanced 8 cards even before trackers are synced
  const fallbackGenres = [
    { title: "Studio Masters", subtitle: "Uncompressed audio", bg: "linear-gradient(135deg, #92400e, #1c1008)", imgUrl: "/api/demo/art/amber-archive", dataAttrs: `data-open-mix="lossless"` },
    { title: "Quiet Hours", subtitle: "Minimal & ambient cuts", bg: "linear-gradient(135deg, #3730a3, #0f1024)", imgUrl: "/api/demo/art/quiet-hours", dataAttrs: `data-open-mix="recent"` },
    { title: "Liked Mix", subtitle: `${state.likedIds.size} saved songs`, bg: "linear-gradient(135deg, #7c3aed, #db2777)", imgUrl: "/api/demo/art/after-hours-sessions", dataAttrs: `data-quick-route="liked"` },
    { title: "All Tracks", subtitle: "Browse entire vault", bg: "linear-gradient(135deg, #334155, #09090b)", imgUrl: "/api/demo/art/chrome-solstice", dataAttrs: `data-show-all-tracks="1"` },
  ];
  for (const fg of fallbackGenres) {
    if (mixCards.length >= 8) break;
    mixCards.push(fg);
  }

  el.searchMixGrid.innerHTML = mixCards.map(buildMixCardHtml).join("");
}

async function loadSearchResults() {
  const params = new URLSearchParams();
  if (state.searchTrackerId) params.set("trackerId", state.searchTrackerId);
  if (state.searchTabName) params.set("tabName", state.searchTabName);
  if (state.searchQuery.trim()) params.set("q", state.searchQuery.trim());
  if (state.searchEra) params.set("era", state.searchEra);
  if (state.searchHost) params.set("host", state.searchHost);
  if (state.losslessOnly) params.set("losslessOnly", "1");
  if (state.playableOnly) params.set("playableOnly", "1");
  params.set("limit", String(state.searchLimit));
  params.set("offset", String(state.searchOffset));

  const data = await apiJson(`/api/tracks?${params.toString()}`);
  state.searchTracks = data.tracks || [];
  state.searchTotal = data.total || 0;
  state.searchEras = data.eras || [];
  state.searchHosts = data.hosts || [];
  rememberTracks(state.searchTracks);

  if (state.searchQuery.trim()) {
    el.queryTimingBadge.textContent = `${state.searchTotal} · ${data.queryMs}ms`;
    el.queryTimingBadge.classList.remove("hidden");
  } else {
    el.queryTimingBadge.classList.add("hidden");
  }

  el.searchResultsHeading.textContent = state.searchQuery.trim()
    ? `Results for "${state.searchQuery.trim()}"`
    : state.searchEra || "All tracks";
  el.searchResultsSub.textContent = `${state.searchTotal} tracks indexed · ${data.queryMs} ms FTS5`;

  // Populate filter selects
  if (state.trackers.length > 1) {
    el.trackerSelect.classList.remove("hidden");
    el.trackerSelect.innerHTML =
      `<option value="">All artists</option>` +
      state.trackers
        .map((t) => `<option value="${escapeHtml(t.trackerId)}">${escapeHtml(t.artistName)}</option>`)
        .join("");
    el.trackerSelect.value = state.searchTrackerId;
  } else {
    el.trackerSelect.classList.add("hidden");
  }

  const scopedTracker = state.trackers.find(
    (t) => t.trackerId === (state.searchTrackerId || (state.trackers.length === 1 ? state.trackers[0].trackerId : ""))
  );
  if (scopedTracker && scopedTracker.tabs.length > 1) {
    el.tabSelect.classList.remove("hidden");
    el.tabSelect.innerHTML =
      `<option value="">All synced tabs</option>` +
      scopedTracker.tabs
        .map((tab) => {
          const synced = scopedTracker.syncedTabs.includes(tab.name);
          return `<option value="${escapeHtml(tab.name)}">${escapeHtml(tab.name)}${synced ? "" : " (sync)"}</option>`;
        })
        .join("");
    el.tabSelect.value = state.searchTabName;
  } else {
    el.tabSelect.classList.add("hidden");
  }

  el.eraSelect.innerHTML =
    `<option value="">All eras</option>` +
    state.searchEras
      .map((e) => `<option value="${escapeHtml(e.era)}">${escapeHtml(e.era)} (${e.count})</option>`)
      .join("");
  el.eraSelect.value = state.searchEra;

  el.hostSelect.innerHTML =
    `<option value="">All hosts</option>` +
    state.searchHosts
      .map((h) => `<option value="${escapeHtml(h.host)}">${escapeHtml(h.host)} (${h.count})</option>`)
      .join("");
  el.hostSelect.value = state.searchHost;

  el.losslessFilterBtn.classList.toggle("active", state.losslessOnly);
  el.playableFilterBtn.classList.toggle("active", state.playableOnly);
  el.clearFiltersBtn.classList.remove("hidden");

  // Top artist match spotlight when searching
  const qLower = state.searchQuery.trim().toLowerCase();
  const matchedArtist = qLower
    ? state.trackers.find((t) => t.artistName.toLowerCase().includes(qLower))
    : null;

  if (matchedArtist) {
    const img = matchedArtist.coverImage ? coverUrl(matchedArtist.coverImage) : "";
    el.searchTopResultWrap.classList.remove("hidden");
    el.searchTopResultWrap.innerHTML = `
      <div class="top-result-card" data-open-artist="${escapeHtml(matchedArtist.trackerId)}">
        <div class="top-result-art" style="border-radius:50%">
          <span>${escapeHtml(monogram(matchedArtist.artistName))}</span>
          ${img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.remove()" />` : ""}
        </div>
        <div style="flex:1; min-width:0">
          <span class="soft-tag accent">Top Artist Match</span>
          <div style="font-size:20px; font-weight:800; margin-top:4px">${escapeHtml(matchedArtist.artistName)}</div>
          <div class="muted small">${matchedArtist.trackCount} tracks · ${matchedArtist.playableCount} playable</div>
        </div>
        <span style="color:var(--text-muted)">${ICONS.chevron}</span>
      </div>
    `;
  } else {
    el.searchTopResultWrap.classList.add("hidden");
  }

  // Library search: also surface matching Playlists & Eras/Albums
  const libColCards = [];
  if (qLower && el.searchCollectionsWrap && el.searchCollectionsGrid) {
    for (const pl of state.playlists) {
      if (pl.name.toLowerCase().includes(qLower) || (pl.description || "").toLowerCase().includes(qLower)) {
        libColCards.push(`
          <div class="media-card" data-open-playlist="${escapeHtml(pl.id)}">
            <div class="media-card-art" style="background:${escapeHtml(pl.coverGradient || PLAYLIST_GRADIENTS[0])}">
              ${buildPlaylistMosaicHtml(pl)}
              <button type="button" class="media-card-play" data-play-playlist="${escapeHtml(pl.id)}">${ICONS.play}</button>
            </div>
            <div class="media-card-title">${escapeHtml(pl.name)}</div>
            <div class="media-card-sub">Playlist · ${pl.trackCount} tracks</div>
          </div>
        `);
      }
    }
    for (const er of state.searchEras) {
      if (libColCards.length >= 10) break;
      if (er.era.toLowerCase().includes(qLower)) {
        const img = er.eraImage ? coverUrl(er.eraImage, "", er.era) : "";
        libColCards.push(`
          <div class="media-card" data-open-era="${escapeHtml(er.era)}">
            <div class="media-card-art" style="background:${er.eraColor ? escapeHtml(er.eraColor) : MIX_GRADIENTS[libColCards.length % MIX_GRADIENTS.length]}">
              <span>${escapeHtml(monogram(er.era))}</span>
              ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
            </div>
            <div class="media-card-title">${escapeHtml(er.era)}</div>
            <div class="media-card-sub">Era / Album · ${er.count} tracks</div>
          </div>
        `);
      }
    }
    el.searchCollectionsWrap.classList.toggle("hidden", libColCards.length === 0);
    el.searchCollectionsGrid.innerHTML = libColCards.join("");
  } else {
    el.searchCollectionsWrap?.classList.add("hidden");
  }

  el.searchTrackList.innerHTML = state.searchTracks
    .map((tr) => buildTrackRowHtml(tr, { ctx: "search" }))
    .join("");
  el.listEmptyState.classList.toggle("hidden", state.searchTracks.length > 0 || libColCards.length > 0);

  const showPages = state.searchTotal > state.searchLimit;
  el.paginationBar.classList.toggle("hidden", !showPages);
  if (showPages) {
    const page = Math.floor(state.searchOffset / state.searchLimit) + 1;
    const totalPages = Math.ceil(state.searchTotal / state.searchLimit);
    el.pageIndicator.textContent = `${page} / ${totalPages}`;
    el.prevPageBtn.disabled = state.searchOffset <= 0;
    el.nextPageBtn.disabled = state.searchOffset + state.searchLimit >= state.searchTotal;
  }
}

/* ==================== 3. ARTIST HERO VIEW (Audio X Image 3) ==================== */
async function renderArtistView(trackerId, tabName = null) {
  const tracker = state.trackers.find((t) => t.trackerId === trackerId) || state.trackers[0];
  if (!tracker) {
    await navigate({ view: "home" }, false);
    return;
  }

  const activeTab = tabName || tracker.currentTab;
  const isUnavailTab = activeTab === "Unavailable";
  const params = new URLSearchParams({
    trackerId: tracker.trackerId,
    tabName: activeTab,
    limit: "300",
  });
  if (!isUnavailTab) params.set("playableOnly", "1");
  const data = await apiJson(`/api/tracks?${params.toString()}`);
  const tracks = data.tracks || [];
  rememberTracks(tracks);

  // Sort playable tracks by playCount desc then lossless first for Top Hits
  const topHits = (isUnavailTab ? [...tracks] : tracks.filter((t) => t.isPlayable && t.tabName !== "Unavailable"))
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0) || Number(isTrackLossless(b)) - Number(isTrackLossless(a)));

  const featuring = isUnavailTab
    ? []
    : tracks.filter((t) => t.isPlayable && t.tabName !== "Unavailable" && /\b(?:feat|ft)\.?\b/i.test(`${t.credits} ${t.title}`));

  state.artistData = {
    tracker,
    tabName: activeTab,
    tracks,
    topHits,
    featuring,
    eras: data.eras || [],
  };
  state.artistShowAllHits = false;

  // Hero visual
  const heroCover = tracker.coverImage || data.eras?.find((e) => e.eraImage)?.eraImage;
  if (heroCover) {
    el.artistHeroBg.style.backgroundImage = `url("${coverUrl(heroCover, tracker.artistName, data.eras?.[0]?.era || "")}")`;
  } else {
    el.artistHeroBg.style.backgroundImage = "linear-gradient(135deg, #4c1d95 0%, #1e1b4b 55%, #000 100%)";
  }

  el.artistHeroName.textContent = tracker.artistName;
  const losslessCount = tracks.filter(isTrackLossless).length;
  el.artistHeroMeta.textContent = `${tracker.trackCount.toLocaleString()} tracks · ${losslessCount.toLocaleString()} lossless · ${(data.eras || []).length} eras`;
  el.artistFollowBtn.classList.toggle("liked", Boolean(tracker.isFollowed));
  el.artistFollowBtn.title = tracker.isFollowed ? "Unfollow artist" : "Follow artist";

  // Multi-tab switcher if >1 tab
  if (tracker.tabs.length > 1) {
    el.artistTabsRow.classList.remove("hidden");
    el.artistTabsRow.innerHTML = tracker.tabs
      .map((tab) => {
        const isSynced = tracker.syncedTabs.includes(tab.name);
        const active = tab.name === activeTab ? "active" : "";
        return `
          <button
            type="button"
            class="chip-btn ${active}"
            data-artist-tab-name="${escapeHtml(tab.name)}"
            data-artist-tab-gid="${escapeHtml(tab.gid)}"
            data-artist-tab-slug="${escapeHtml(tab.slug)}"
          >
            ${escapeHtml(tab.name)}${isSynced ? "" : " +"}
          </button>
        `;
      })
      .join("");
  } else {
    el.artistTabsRow.classList.add("hidden");
  }

  renderArtistLists();

  // Eras grid (hidden inside Unavailable tab)
  const erasBlock = el.artistErasGrid?.closest(".content-block");
  if (erasBlock) erasBlock.classList.toggle("hidden", isUnavailTab || state.artistData.eras.length === 0);
  el.artistErasCount.textContent = isUnavailTab ? "Unavailable archive" : `${state.artistData.eras.length} eras`;
  el.artistErasGrid.innerHTML = isUnavailTab
    ? ""
    : state.artistData.eras
        .map((e, idx) => {
          const img = coverUrl(e.eraImage || "", tracker.artistName, e.era);
          const bg = e.eraColor
            ? `linear-gradient(135deg, ${e.eraColor}, #111116)`
            : MIX_GRADIENTS[idx % MIX_GRADIENTS.length];
          return buildMixCardHtml({
            title: e.era,
            subtitle: `${e.count} tracks`,
            bg,
            imgUrl: img,
            dataAttrs: `data-open-era="${escapeHtml(e.era)}" data-era-tracker="${escapeHtml(tracker.trackerId)}"`,
          });
        })
        .join("");
}

function renderArtistLists() {
  if (!state.artistData) return;
  const { topHits, featuring } = state.artistData;
  const limit = state.artistShowAllHits ? Math.min(topHits.length, 30) : 5;
  el.artistTopHitsList.innerHTML = topHits.length
    ? topHits
        .slice(0, limit)
        .map((tr) => buildTrackRowHtml(tr, { ctx: "artist-hits", hideArtist: true, showPlays: true }))
        .join("")
    : `<div class="empty-inline">No playable tracks in this tab yet.</div>`;

  el.artistToggleMoreHitsBtn.classList.toggle("hidden", topHits.length <= 5);
  el.artistToggleMoreHitsBtn.textContent = state.artistShowAllHits ? "Show less" : `See more (${topHits.length})`;

  el.artistFeaturingBlock.classList.toggle("hidden", featuring.length === 0);
  el.artistFeaturingList.innerHTML = featuring
    .slice(0, 6)
    .map((tr) => buildTrackRowHtml(tr, { ctx: "artist-feat", showPlays: true }))
    .join("");
}

/* ==================== 4. PROFILE VIEW (Audio X Image 1) ==================== */
async function renderProfileView() {
  await Promise.all([refreshProfile(), refreshPlaylists(), refreshLikes(), refreshHistory(), refreshCacheStats()]);

  renderAvatarInto(el.profileBigAvatar, state.profile);
  el.profileDisplayName.textContent = state.profile.name;
  el.profileStatsLine.textContent = `${state.profileStats.followedCount} Following  •  ${state.profileStats.likedCount} Liked  •  ${state.profileStats.playlistCount} Playlists  •  ${state.profileStats.playsCount} Plays`;
  el.profileBioLine.textContent = state.profile.bio || state.profile.handle;

  el.profileTabs.querySelectorAll(".underline-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-profile-tab") === state.profileTab);
  });

  if (state.profileTab === "playlists") {
    if (state.playlists.length === 0) {
      el.profileTabContent.innerHTML = `
        <div class="empty-inline">
          No playlists yet.
          <div style="margin-top:12px">
            <button type="button" class="btn btn-accent btn-sm" id="profileCreatePlBtn">Create your first playlist</button>
          </div>
        </div>
      `;
      $("profileCreatePlBtn")?.addEventListener("click", () => openPlaylistModal());
      return;
    }
    el.profileTabContent.innerHTML = state.playlists
      .map(
        (pl) => `
        <div class="simple-row" data-open-playlist="${escapeHtml(pl.id)}">
          <div class="simple-thumb" style="background:${escapeHtml(pl.coverGradient || PLAYLIST_GRADIENTS[0])}">
            ${buildPlaylistMosaicHtml(pl)}
          </div>
          <div class="track-item-main">
            <div class="track-item-title">${escapeHtml(pl.name)}</div>
            <div class="track-item-sub">${pl.trackCount} ${pl.trackCount === 1 ? "track" : "tracks"}${pl.description ? ` · ${escapeHtml(pl.description)}` : ""}</div>
          </div>
          <div class="simple-row-right">${ICONS.chevron}</div>
        </div>
      `
      )
      .join("");
  } else if (state.profileTab === "downloaded") {
    const cachedRes = await apiJson("/api/tracks?cachedOnly=1&limit=100");
    const tracks = cachedRes.tracks || [];
    state.profileCachedTracks = tracks;
    rememberTracks(tracks);
    el.profileTabContent.innerHTML = tracks.length
      ? tracks.map((tr) => buildTrackRowHtml(tr, { ctx: "profile-cached" })).join("")
      : `<div class="empty-inline">No tracks cached offline yet. Stream or save any track to store it in ./cache.</div>`;
  } else if (state.profileTab === "liked") {
    el.profileTabContent.innerHTML = state.likedTracks.length
      ? state.likedTracks.map((tr) => buildTrackRowHtml(tr, { ctx: "profile-liked" })).join("")
      : `<div class="empty-inline">No liked songs yet. Tap the heart icon on any track to save it here.</div>`;
  } else if (state.profileTab === "history") {
    el.profileTabContent.innerHTML = state.historyItems.length
      ? state.historyItems.map((h) => buildTrackRowHtml(h.track, { ctx: "profile-history" })).join("")
      : `<div class="empty-inline">Your recently played tracks will appear here.</div>`;
  }
}

/* ==================== 5. MY LIBRARY VIEW ==================== */
async function renderLibraryView() {
  el.libraryTabs.querySelectorAll(".underline-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lib-tab") === state.libraryTab);
  });

  if (state.libraryTab === "artists") {
    if (state.trackers.length === 0) {
      el.libraryTabBody.innerHTML = `<div class="empty-inline">No ArtistGrid trackers synced yet. Click "+ Add tracker" above to get started.</div>`;
      return;
    }
    el.libraryTabBody.innerHTML = `
      <div class="artist-shelf">
        ${state.trackers
          .map((t) => {
            const img = t.coverImage ? coverUrl(t.coverImage) : "";
            return `
              <button type="button" class="artist-card" data-open-artist="${escapeHtml(t.trackerId)}">
                <div class="artist-avatar-wrap">
                  <span>${escapeHtml(monogram(t.artistName))}</span>
                  ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
                </div>
                <div class="artist-card-name">${escapeHtml(t.artistName)}</div>
                <div class="artist-card-sub">${t.trackCount} tracks · ${t.playableCount} playable</div>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  } else if (state.libraryTab === "playlists") {
    if (state.playlists.length === 0) {
      el.libraryTabBody.innerHTML = `<div class="empty-inline">No playlists created yet. Click "+ New playlist" to curate your vault.</div>`;
      return;
    }
    el.libraryTabBody.innerHTML = `
      <div class="card-shelf">
        ${state.playlists
          .map(
            (pl) => `
            <div class="media-card" data-open-playlist="${escapeHtml(pl.id)}">
              <div class="media-card-art" style="background:${escapeHtml(pl.coverGradient || PLAYLIST_GRADIENTS[0])}">
                ${buildPlaylistMosaicHtml(pl)}
                <button type="button" class="media-card-play" data-play-playlist="${escapeHtml(pl.id)}" aria-label="Play ${escapeHtml(pl.name)}">
                  ${ICONS.play}
                </button>
              </div>
              <div class="media-card-title">${escapeHtml(pl.name)}</div>
              <div class="media-card-sub">${pl.trackCount} ${pl.trackCount === 1 ? "track" : "tracks"}</div>
            </div>
          `
          )
          .join("")}
      </div>
    `;
  } else if (state.libraryTab === "lossless") {
    const data = await apiJson("/api/tracks?losslessOnly=1&playableOnly=1&limit=120");
    const tracks = data.tracks || [];
    state.libraryTracks = tracks;
    rememberTracks(tracks);
    el.libraryTabBody.innerHTML = tracks.length
      ? `<div class="clean-list">${tracks.map((tr) => buildTrackRowHtml(tr, { ctx: "lib-lossless" })).join("")}</div>`
      : `<div class="empty-inline">No lossless tracks indexed yet.</div>`;
  } else if (state.libraryTab === "downloaded") {
    const data = await apiJson("/api/tracks?cachedOnly=1&limit=120");
    const tracks = data.tracks || [];
    state.libraryTracks = tracks;
    rememberTracks(tracks);
    el.libraryTabBody.innerHTML = tracks.length
      ? `<div class="clean-list">${tracks.map((tr) => buildTrackRowHtml(tr, { ctx: "lib-cached" })).join("")}</div>`
      : `<div class="empty-inline">No tracks saved to ./cache yet. Click "Save offline" from any track menu to cache lossless audio.</div>`;
  }
}

/* ==================== 6. COLLECTION DETAIL VIEW (Liked / Playlist / Era / Mix) ==================== */
async function renderCollectionView(route) {
  state.collectionFilter = "";
  el.collectionFilterInput.value = "";
  el.collectionExtraActions.innerHTML = "";

  let eyebrow = "COLLECTION";
  let title = "Collection";
  let desc = "";
  let gradient = "linear-gradient(135deg, #6d28d9, #ec4899)";
  let coverHtml = "";
  let heroBgImg = "";
  let tracks = [];
  let playlistId = null;

  if (route.view === "liked") {
    await refreshLikes();
    eyebrow = "COLLECTION";
    title = "Liked Songs";
    desc = `Your favorite tracks across all synced trackers.`;
    gradient = "linear-gradient(135deg, #7c4dff, #ec4899)";
    coverHtml = `<svg viewBox="0 0 24 24" width="60" height="60" fill="#ffffff"><path d="M12 20.4c-.3 0-.6-.1-.8-.3C6.2 15.8 3 12.8 3 8.9 3 6.1 5.2 4 7.9 4c1.6 0 3.1.8 4.1 2.1C13 4.8 14.5 4 16.1 4 18.8 4 21 6.1 21 8.9c0 3.9-3.2 6.9-8.2 11.2-.2.2-.5.3-.8.3z"/></svg>`;
    tracks = state.likedTracks;
  } else if (route.view === "playlist") {
    const data = await apiJson(`/api/playlists/${encodeURIComponent(route.playlistId)}`);
    const pl = data.playlist;
    playlistId = pl.id;
    eyebrow = "PLAYLIST";
    title = pl.name;
    desc = pl.description || `Curated by ${state.profile.name}`;
    gradient = pl.coverGradient || PLAYLIST_GRADIENTS[0];
    coverHtml = buildPlaylistMosaicHtml(pl, "large");
    heroBgImg = pl.previewImages?.[0] ? coverUrl(pl.previewImages[0]) : "";
    tracks = pl.tracks || [];
    rememberTracks(tracks);

    el.collectionExtraActions.innerHTML = `
      <button type="button" id="colEditPlBtn" class="pill-btn">Edit details</button>
      <button type="button" id="colDeletePlBtn" class="pill-btn danger-pill">Delete</button>
    `;
    $("colEditPlBtn")?.addEventListener("click", () => openPlaylistModal(pl));
    $("colDeletePlBtn")?.addEventListener("click", async () => {
      await apiJson(`/api/playlists/${encodeURIComponent(pl.id)}`, { method: "DELETE" });
      await refreshPlaylists();
      showToast(`Deleted playlist "${pl.name}".`);
      await navigate({ view: "library", tab: "playlists" });
    });
  } else if (route.view === "era") {
    const params = new URLSearchParams({ era: route.era, playableOnly: "1", limit: "250" });
    if (route.trackerId) params.set("trackerId", route.trackerId);
    const data = await apiJson(`/api/tracks?${params.toString()}`);
    tracks = data.tracks || [];
    rememberTracks(tracks);
    const first = tracks[0];
    eyebrow = first?.artist ? `ERA · ${first.artist}` : "ERA";
    title = route.era;
    desc = `Session archive and lossless bounces from the ${route.era} era.`;
    gradient = first?.eraColor
      ? `linear-gradient(135deg, ${first.eraColor}, #111116)`
      : "linear-gradient(135deg, #4338ca, #18181b)";
    const img = first ? coverUrl(first.eraImage || "", first.artist, first.era) : "";
    heroBgImg = img;
    coverHtml = img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.remove()" />` : `<span>${escapeHtml(monogram(title))}</span>`;

    if (first?.trackerId) {
      el.collectionExtraActions.innerHTML = `<button type="button" id="colGoArtistBtn" class="pill-btn">View ${escapeHtml(first.artist)}</button>`;
      $("colGoArtistBtn")?.addEventListener("click", () => navigate({ view: "artist", trackerId: first.trackerId }));
    }
  } else if (route.view === "mix") {
    const kind = route.mixKind || "lossless";
    eyebrow = "SMART MIX";
    if (kind === "lossless") {
      title = "Lossless Vault";
      desc = "Uncompressed FLAC, WAV, and CDQ masters across your trackers.";
      gradient = "linear-gradient(135deg, #059669, #0f766e)";
      const res = await apiJson("/api/tracks?losslessOnly=1&playableOnly=1&limit=150");
      tracks = res.tracks || [];
    } else if (kind === "cached") {
      title = "Offline Vault";
      desc = "Tracks cached progressively in ./cache for instant zero-latency playback.";
      gradient = "linear-gradient(135deg, #2563eb, #1e3a8a)";
      const res = await apiJson("/api/tracks?cachedOnly=1&limit=150");
      tracks = res.tracks || [];
    } else if (kind === "collabs") {
      title = "Collaborations Mix";
      desc = "Featuring tracks, guest verses, and studio collaborations.";
      gradient = "linear-gradient(135deg, #be123c, #581c87)";
      const res = await apiJson("/api/tracks?playableOnly=1&limit=250");
      tracks = (res.tracks || []).filter((t) => /\b(?:feat|ft)\.?\b/i.test(`${t.credits} ${t.title}`));
    } else {
      title = "Late Night Vault";
      desc = "Your recently played cuts and liked favorites blended together.";
      gradient = "linear-gradient(135deg, #5b21b6, #111827)";
      const combined = [...state.historyItems.map((h) => h.track), ...state.likedTracks];
      const seen = new Set();
      tracks = combined.filter((t) => {
        if (!t?.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      if (tracks.length === 0) {
        const res = await apiJson("/api/tracks?playableOnly=1&limit=50");
        tracks = res.tracks || [];
      }
    }
    rememberTracks(tracks);
    coverHtml = `<span style="font-size:40px; font-weight:800">${escapeHtml(monogram(title))}</span>`;
  }

  state.collectionData = { title, playlistId, tracks };

  el.collectionEyebrow.textContent = eyebrow;
  el.collectionTitle.textContent = title;
  el.collectionDesc.textContent = desc;
  const playableCount = tracks.filter((t) => t.isPlayable).length;
  el.collectionStats.textContent = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"} · ${playableCount} playable`;
  el.collectionArtwork.style.background = gradient;
  el.collectionArtwork.innerHTML = coverHtml;
  el.collectionHeroBg.style.backgroundImage = heroBgImg ? `url("${heroBgImg}")` : gradient;

  renderCollectionTrackList();
}

function renderCollectionTrackList() {
  if (!state.collectionData) return;
  const q = state.collectionFilter.trim().toLowerCase();
  const filtered = q
    ? state.collectionData.tracks.filter((t) =>
        `${t.title} ${t.artist} ${t.era} ${t.credits}`.toLowerCase().includes(q)
      )
    : state.collectionData.tracks;

  el.collectionTrackList.innerHTML = filtered
    .map((tr) => buildTrackRowHtml(tr, { ctx: "collection" }))
    .join("");
  el.collectionEmpty.classList.toggle("hidden", filtered.length > 0);
}

/* ==================== PLAYBACK, QUEUE & WEB AUDIO EQ ==================== */
function initAudioGraphIfNeeded() {
  if (state.audioCtx) {
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume().catch(() => {});
    }
    return;
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(el.audioEl);
    const filters = EQ_BANDS.map((band, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      f.frequency.value = band.freq;
      f.Q.value = 1.0;
      f.gain.value = state.eqGains[i] || 0;
      return f;
    });
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;

    let node = source;
    for (const f of filters) {
      node.connect(f);
      node = f;
    }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    state.audioCtx = ctx;
    state.mediaSource = source;
    state.eqFilters = filters;
    state.analyser = analyser;
  } catch {
    // Gracefully continue with plain HTMLAudioElement playback
  }
}

function applyEqGains(gains, presetName = "custom") {
  state.eqGains = [...gains];
  state.eqPreset = presetName;
  state.eqFilters.forEach((f, idx) => {
    if (f) f.gain.value = gains[idx] || 0;
  });
  el.eqStatusBadge.textContent = EQ_PRESETS[presetName]?.label || "Custom";
  el.eqToggleBtn.classList.toggle("active", gains.some((g) => Math.abs(g) > 0.1) || state.playbackRate !== 1);
  el.eqPresetsRow.querySelectorAll("[data-eq-preset]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-eq-preset") === presetName);
  });
  renderEqSliders();
}

function renderEqSliders() {
  el.eqSlidersGrid.innerHTML = EQ_BANDS.map(
    (b, idx) => `
      <div class="eq-band">
        <span class="eq-band-db mono">${state.eqGains[idx] > 0 ? "+" : ""}${state.eqGains[idx].toFixed(0)}</span>
        <input type="range" min="-12" max="12" step="0.5" value="${state.eqGains[idx]}" data-eq-band="${idx}" />
        <span class="eq-band-label">${b.label}</span>
      </div>
    `
  ).join("");
}

function setPlayPauseIcons(playing) {
  el.playPauseSvg.innerHTML = playing
    ? `<rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/>`
    : `<path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/>`;
  el.fsPlayPauseSvg.innerHTML = el.playPauseSvg.innerHTML;
}

function updatePlayerLikeState() {
  if (!state.playingTrack) {
    el.playerLikeBtn.classList.add("hidden");
    return;
  }
  const liked = state.likedIds.has(state.playingTrack.id);
  el.playerLikeBtn.classList.remove("hidden");
  el.playerLikeBtn.classList.toggle("liked", liked);
  el.fsLikeBtn.classList.toggle("liked", liked);
}

function updateTransportButtons() {
  const hasTrack = Boolean(state.playingTrack);
  el.playPauseBtn.disabled = !hasTrack;
  el.prevTrackBtn.disabled = !hasTrack;
  const hasNext =
    state.userQueue.length > 0 ||
    state.repeat !== "off" ||
    state.shuffle ||
    (state.queueIndex >= 0 && state.queueIndex < state.queueContext.length - 1);
  el.nextTrackBtn.disabled = !hasTrack || !hasNext;
  el.shuffleBtn.classList.toggle("active", state.shuffle);
  el.fsShuffleBtn.classList.toggle("active", state.shuffle);
  el.repeatBtn.classList.toggle("active", state.repeat !== "off");
  el.fsRepeatBtn.classList.toggle("active", state.repeat !== "off");
  el.repeatOneTag.classList.toggle("hidden", state.repeat !== "one");
  el.repeatBtn.title = `Repeat: ${state.repeat === "off" ? "Off" : state.repeat === "all" ? "All" : "One"}`;
}

function startQueueAndPlay(tracks, startIndex = 0, sourceName = "VaultStream", shuffleNow = false) {
  const playable = (tracks || []).filter((t) => canAttemptPlay(t));
  if (playable.length === 0) {
    showToast("No playable audio tracks in this list.", "error");
    return;
  }
  state.queueContext = playable;
  state.playingSourceName = sourceName;
  if (shuffleNow) {
    state.shuffle = true;
    state.queueIndex = Math.floor(Math.random() * playable.length);
  } else {
    state.queueIndex = Math.max(0, Math.min(startIndex, playable.length - 1));
  }
  playTrack(playable[state.queueIndex], undefined, false);
}

async function playTrack(track, linkIndex = undefined, replaceContext = true) {
  if (!track || !canAttemptPlay(track)) return;
  hideToast();
  initAudioGraphIfNeeded();

  if (replaceContext) {
    const idx = state.queueContext.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      state.queueIndex = idx;
    } else {
      state.queueContext = [track];
      state.queueIndex = 0;
      state.playingSourceName = track.era || track.artist || "VaultStream";
    }
  }

  state.playingTrack = track;
  state.preparingTrackId = track.id;
  el.playerTitle.textContent = track.title;
  el.playerSubtitle.textContent = `${track.artist} · ${track.era}`;
  const artSrc = coverUrl(track.eraImage || "", track.artist, track.era);
  el.playerArtTrigger.innerHTML =
    `<span>${escapeHtml(monogram(track.title))}</span>` +
    (artSrc ? `<img src="${escapeHtml(artSrc)}" alt="" onerror="this.remove()" />` : "");

  el.playerCodecBadge.textContent =
    track.primaryHost === "youtube" || track.primaryHost === "soundcloud"
      ? "Preparing stream..."
      : formatCodecShort(track) || track.primaryHost;
  el.playerCodecBadge.className = "stream-pill preparing";
  el.playerInspectBtn.classList.remove("hidden");

  updatePlayerLikeState();
  updateTransportButtons();
  updateFullscreenMeta();
  if (state.fsOpen) renderFullscreenSidePanel();
  refreshVisibleTrackRows();
  if (state.openDrawer === "queue") renderQueueDrawer();
  if (state.openDrawer === "inspector" && state.selectedTrack?.id === track.id) {
    renderInspectorContent(track);
  }

  const streamUrl =
    linkIndex !== undefined
      ? `/api/tracks/${encodeURIComponent(track.id)}/stream?linkIndex=${linkIndex}`
      : `/api/tracks/${encodeURIComponent(track.id)}/stream`;

  el.audioEl.dataset.compatTried = "";
  el.audioEl.src = streamUrl;
  el.audioEl.playbackRate = state.playbackRate;

  try {
    await el.audioEl.play();
    state.preparingTrackId = null;
    if (track.isUnavailable) {
      track.isUnavailable = false;
      rememberTracks([track]);
      refreshVisibleTrackRows();
    }
    setPlayPauseIcons(true);
    const liveBadge = formatCodecShort(track) || track.primaryHost;
    el.playerCodecBadge.textContent = liveBadge;
    el.playerCodecBadge.className = `stream-pill ${isTrackLossless(track) ? "lossless" : ""}`;
    // Record listen in SQLite history
    apiJson("/api/history", {
      method: "POST",
      body: JSON.stringify({ trackId: track.id }),
    })
      .then(() => refreshHistory())
      .catch(() => {});

    // Refresh header codec + progressive cache telemetry shortly after stream starts
    setTimeout(async () => {
      await refreshCacheStats();
      const refreshed = await apiJson(`/api/tracks/${encodeURIComponent(track.id)}`).catch(() => null);
      if (refreshed?.track) {
        rememberTracks([refreshed.track]);
        if (state.playingTrack?.id === track.id) {
          state.playingTrack = refreshed.track;
          const nextBadge = formatCodecShort(refreshed.track);
          if (nextBadge) el.playerCodecBadge.textContent = nextBadge;
          el.playerCodecBadge.className = `stream-pill ${isTrackLossless(refreshed.track) ? "lossless" : ""}`;
          updateFullscreenMeta();
        }
        if (state.openDrawer === "inspector" && state.selectedTrack?.id === track.id) {
          state.selectedTrack = refreshed.track;
          renderInspectorContent(refreshed.track);
        }
        refreshVisibleTrackRows();
      }
    }, 900);
  } catch (err) {
    if (err.name === "AbortError") return;

    // Automatic ffmpeg compatibility retry before surfacing a playback error
    if (!el.audioEl.dataset.compatTried) {
      el.audioEl.dataset.compatTried = "1";
      const sep = streamUrl.includes("?") ? "&" : "?";
      el.audioEl.src = `${streamUrl}${sep}compat=1`;
      try {
        await el.audioEl.play();
        state.preparingTrackId = null;
        if (track.isUnavailable) {
          track.isUnavailable = false;
          rememberTracks([track]);
          refreshVisibleTrackRows();
        }
        setPlayPauseIcons(true);
        const compatBadge = formatCodecShort(track) || track.primaryHost;
        el.playerCodecBadge.textContent = compatBadge;
        el.playerCodecBadge.className = `stream-pill ${isTrackLossless(track) ? "lossless" : ""}`;
        apiJson("/api/history", {
          method: "POST",
          body: JSON.stringify({ trackId: track.id }),
        })
          .then(() => refreshHistory())
          .catch(() => {});
        return;
      } catch (compatErr) {
        if (compatErr?.name === "AbortError") return;
      }
    }

    state.preparingTrackId = null;
    el.audioEl.dataset.compatTried = "2";
    setPlayPauseIcons(false);
    el.playerCodecBadge.textContent = "Unavailable";
    el.playerCodecBadge.className = "stream-pill";
    track.isUnavailable = true;
    rememberTracks([track]);
    refreshVisibleTrackRows();
    try {
      const probe = await fetch(`/api/tracks/${encodeURIComponent(track.id)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkIndex, force: true }),
      });
      const data = await probe.json();
      const msg = data.resolution?.errorMessage || data.error || err.message;
      showToast(`Playback failed for "${track.title}": ${msg}`, "error");
    } catch {
      showToast(`Playback failed for "${track.title}": ${err.message}`, "error");
    }
  }
}

function playNextTrack(autoAdvance = false) {
  if (autoAdvance && state.repeat === "one" && state.playingTrack) {
    el.audioEl.currentTime = 0;
    el.audioEl.play().catch(() => {});
    return;
  }

  if (state.userQueue.length > 0) {
    const nextTrack = state.userQueue.shift();
    playTrack(nextTrack, undefined, false);
    return;
  }

  const ctx = state.queueContext;
  if (ctx.length === 0) return;

  if (state.shuffle && ctx.length > 1) {
    let pick = state.queueIndex;
    for (let tries = 0; tries < 6 && pick === state.queueIndex; tries++) {
      pick = Math.floor(Math.random() * ctx.length);
    }
    state.queueIndex = pick;
    playTrack(ctx[pick], undefined, false);
    return;
  }

  if (state.queueIndex + 1 < ctx.length) {
    state.queueIndex++;
    playTrack(ctx[state.queueIndex], undefined, false);
  } else if (state.repeat === "all") {
    state.queueIndex = 0;
    playTrack(ctx[0], undefined, false);
  }
}

function playPrevTrack() {
  if (el.audioEl.currentTime > 3) {
    el.audioEl.currentTime = 0;
    return;
  }
  const ctx = state.queueContext;
  if (ctx.length === 0) return;
  if (state.queueIndex > 0) {
    state.queueIndex--;
    playTrack(ctx[state.queueIndex], undefined, false);
  } else if (state.repeat === "all") {
    state.queueIndex = ctx.length - 1;
    playTrack(ctx[state.queueIndex], undefined, false);
  } else {
    el.audioEl.currentTime = 0;
  }
}

function addToUserQueue(track, playNext = false) {
  if (!track?.isPlayable) {
    showToast("This track has no playable audio link.", "error");
    return;
  }
  if (playNext) {
    state.userQueue.unshift(track);
    showToast(`"${track.title}" will play next.`, "success");
  } else {
    state.userQueue.push(track);
    showToast(`Added "${track.title}" to queue.`, "success");
  }
  updateTransportButtons();
  if (state.openDrawer === "queue") renderQueueDrawer();
  if (state.fsOpen && state.fsTab === "queue") renderFullscreenSidePanel();
}

async function toggleLikeTrack(trackId) {
  const currentlyLiked = state.likedIds.has(trackId);
  const next = !currentlyLiked;
  if (next) state.likedIds.add(trackId);
  else state.likedIds.delete(trackId);

  el.sidebarLikedCount.textContent = String(state.likedIds.size);
  el.sidebarLikedCount.classList.toggle("hidden", state.likedIds.size === 0);
  updatePlayerLikeState();
  refreshVisibleTrackRows();

  try {
    await apiJson(`/api/likes/${encodeURIComponent(trackId)}`, {
      method: "POST",
      body: JSON.stringify({ liked: next }),
    });
    await refreshLikes();
    if (state.route.view === "liked") {
      await renderCollectionView(state.route);
    } else if (state.route.view === "profile" && state.profileTab === "liked") {
      await renderProfileView();
    }
    if (state.openDrawer === "inspector" && state.selectedTrack?.id === trackId) {
      renderInspectorContent(state.selectedTrack);
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function precacheTrack(trackId) {
  showToast("Downloading lossless track to ./cache...");
  try {
    const data = await apiJson(`/api/tracks/${encodeURIComponent(trackId)}/cache`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (data.track) rememberTracks([data.track]);
    showToast(`Saved "${data.track?.title || trackId}" (${formatBytes(data.entry?.cachedBytes)}) offline.`, "success");
    await Promise.all([refreshCacheStats(), refreshActivity()]);
    refreshVisibleTrackRows();
    if (state.openDrawer === "inspector" && state.selectedTrack?.id === trackId && data.track) {
      state.selectedTrack = data.track;
      renderInspectorContent(data.track);
    }
  } catch (err) {
    showToast(`Save failed: ${err.message}`, "error");
  }
}

function refreshVisibleTrackRows() {
  if (state.route.view === "search") {
    if (state.searchSource !== "library") return;
    if (state.searchTracks.length) {
      el.searchTrackList.innerHTML = state.searchTracks
        .map((tr) => buildTrackRowHtml(state.trackMap.get(tr.id) || tr, { ctx: "search" }))
        .join("");
    }
  } else if (state.route.view === "artist") {
    renderArtistLists();
  } else if (["liked", "playlist", "era", "mix"].includes(state.route.view)) {
    renderCollectionTrackList();
  } else if (state.route.view === "profile") {
    if (state.profileTab === "liked" && state.likedTracks.length) {
      el.profileTabContent.innerHTML = state.likedTracks
        .map((tr) => buildTrackRowHtml(state.trackMap.get(tr.id) || tr, { ctx: "profile-liked" }))
        .join("");
    } else if (state.profileTab === "downloaded" && state.profileCachedTracks.length) {
      el.profileTabContent.innerHTML = state.profileCachedTracks
        .map((tr) => buildTrackRowHtml(state.trackMap.get(tr.id) || tr, { ctx: "profile-cached" }))
        .join("");
    } else if (state.profileTab === "history" && state.historyItems.length) {
      el.profileTabContent.innerHTML = state.historyItems
        .map((h) => buildTrackRowHtml(state.trackMap.get(h.track.id) || h.track, { ctx: "profile-history" }))
        .join("");
    }
  } else if (state.route.view === "library" && (state.libraryTab === "lossless" || state.libraryTab === "downloaded") && state.libraryTracks.length) {
    const ctx = state.libraryTab === "lossless" ? "lib-lossless" : "lib-cached";
    el.libraryTabBody.innerHTML = `<div class="clean-list">${state.libraryTracks
      .map((tr) => buildTrackRowHtml(state.trackMap.get(tr.id) || tr, { ctx }))
      .join("")}</div>`;
  }
}

/* ==================== DRAWERS: INSPECTOR & UP NEXT QUEUE ==================== */
function openDrawer(kind) {
  closeAllPopovers();
  state.openDrawer = kind;
  el.drawerBackdrop.classList.remove("hidden");
  el.inspectorDrawer.classList.toggle("open", kind === "inspector");
  el.inspectorDrawer.setAttribute("aria-hidden", String(kind !== "inspector"));
  el.queueDrawer.classList.toggle("open", kind === "queue");
  el.queueDrawer.setAttribute("aria-hidden", String(kind !== "queue"));
  el.queueToggleBtn.classList.toggle("active", kind === "queue");
  if (kind === "queue") renderQueueDrawer();
}

function closeDrawers() {
  state.openDrawer = null;
  state.selectedTrack = null;
  el.drawerBackdrop.classList.add("hidden");
  el.inspectorDrawer.classList.remove("open");
  el.inspectorDrawer.setAttribute("aria-hidden", "true");
  el.queueDrawer.classList.remove("open");
  el.queueDrawer.setAttribute("aria-hidden", "true");
  el.queueToggleBtn.classList.remove("active");
  refreshVisibleTrackRows();
}

function openInspector(track) {
  if (!track) return;
  state.selectedTrack = state.trackMap.get(track.id) || track;
  renderInspectorContent(state.selectedTrack);
  openDrawer("inspector");
  refreshVisibleTrackRows();
}

function renderInspectorContent(track) {
  const isPlaying = state.playingTrack?.id === track.id && !el.audioEl.paused;
  const isLiked = state.likedIds.has(track.id);
  const codecLine = formatCodecFull(track);
  const imgSrc = coverUrl(track.eraImage || "", track.artist, track.era);
  const cacheInfo = track.cacheStatus
    ? `${formatBytes(track.cacheStatus.cachedBytes)} / ${formatBytes(track.cacheStatus.totalBytes)} (${track.cacheStatus.isComplete ? "100% offline" : "partial"})`
    : "Not cached in ./cache yet";

  el.inspectorContent.innerHTML = `
    <div class="inspector-hero">
      <div class="inspector-art">
        <span>${escapeHtml(monogram(track.title))}</span>
        ${imgSrc ? `<img src="${escapeHtml(imgSrc)}" alt="" onerror="this.remove()" />` : ""}
      </div>
      <div style="min-width:0">
        <div style="font-size:17px; font-weight:800; line-height:1.25">${escapeHtml(track.title)}</div>
        ${track.credits ? `<div class="muted small" style="margin-top:3px">${escapeHtml(track.credits)}</div>` : ""}
        <div class="small muted" style="margin-top:4px">${escapeHtml(track.artist)} · ${escapeHtml(track.era)}</div>
      </div>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <button type="button" id="inspPlayBtn" class="btn btn-accent" style="flex:1" ${track.isPlayable ? "" : "disabled"}>
        ${isPlaying ? ICONS.pause : ICONS.play}
        <span>${isPlaying ? "Pause" : "Play Stream"}</span>
      </button>
      <button type="button" id="inspLikeBtn" class="btn btn-ghost" title="Like song">
        ${isLiked ? "♥ Liked" : "♡ Like"}
      </button>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <button type="button" id="inspAddPlBtn" class="pill-btn" style="flex:1">+ Add to playlist</button>
      <button type="button" id="inspQueueBtn" class="pill-btn" ${track.isPlayable ? "" : "disabled"}>Play next</button>
      <button type="button" id="inspCacheBtn" class="pill-btn" ${track.isPlayable ? "" : "disabled"}>
        ${track.cacheStatus?.isComplete ? "Offline ✓" : "Save offline"}
      </button>
      <button type="button" id="inspMbBtn" class="pill-btn" title="Normalize artist/album & fetch square cover art">
        Enrich Metadata
      </button>
    </div>

    <div class="inspector-block">
      <div class="block-label">Audio &amp; Metadata</div>
      <div class="small">Quality / Codec: <strong>${escapeHtml(codecLine)}</strong></div>
      ${track.subEra && track.subEra !== "Default" ? `<div class="small muted">Session: ${escapeHtml(track.subEra)}</div>` : ""}
      ${track.trackLength ? `<div class="small muted">Length: ${escapeHtml(track.trackLength)}</div>` : ""}
      ${track.leakDate ? `<div class="small muted">Date: ${escapeHtml(track.leakDate)}</div>` : ""}
      <div class="small muted">Disk Cache: ${escapeHtml(cacheInfo)}</div>
    </div>

    ${
      track.notes
        ? `<div class="inspector-block">
             <div class="block-label">Recording Notes</div>
             <div class="notes-text">${escapeHtml(track.notes)}</div>
           </div>`
        : ""
    }

    <div class="inspector-block">
      <div class="block-label">Host Mirrors (${track.links.length})</div>
      ${
        track.links.length === 0
          ? `<div class="small muted">No URLs listed for this track.</div>`
          : track.links
              .map(
                (l, idx) => `
              <div class="mirror-row">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px">
                  <span class="soft-tag ${l.playable ? "lossless" : ""}">${escapeHtml(l.host)}</span>
                  <div style="display:flex; gap:6px">
                    ${l.playable ? `<button type="button" class="pill-btn" data-play-mirror="${idx}">Play</button>` : ""}
                    ${l.url.startsWith("http") ? `<a class="pill-btn" style="text-decoration:none" href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">Open</a>` : ""}
                  </div>
                </div>
                <div class="mirror-url mono">${escapeHtml(l.url)}</div>
              </div>
            `
              )
              .join("")
      }
    </div>
  `;

  $("inspPlayBtn")?.addEventListener("click", async () => {
    if (state.playingTrack?.id === track.id && el.audioEl.src) {
      if (el.audioEl.paused) await el.audioEl.play();
      else el.audioEl.pause();
      renderInspectorContent(track);
    } else {
      await playTrack(track);
    }
  });
  $("inspLikeBtn")?.addEventListener("click", () => toggleLikeTrack(track.id));
  $("inspAddPlBtn")?.addEventListener("click", () => openAddToPlaylistModal(track.id));
  $("inspQueueBtn")?.addEventListener("click", () => addToUserQueue(track, true));
  $("inspCacheBtn")?.addEventListener("click", () => precacheTrack(track.id));
  $("inspMbBtn")?.addEventListener("click", async () => {
    const btn = $("inspMbBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Matching...";
    }
    try {
      const res = await apiJson("/api/metadata/musicbrainz", {
        method: "POST",
        body: JSON.stringify({ trackId: track.id }),
      });
      if (!res.matched || !res.track) {
        showToast("No MusicBrainz match found for this track.");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Enrich Metadata";
        }
        return;
      }
      rememberTracks([res.track]);
      state.selectedTrack = res.track;
      if (state.playingTrack?.id === res.track.id) {
        state.playingTrack = res.track;
        el.playerTitle.textContent = res.track.title;
        el.playerSubtitle.textContent = `${res.track.artist} · ${res.track.era}`;
        const artSrc = coverUrl(res.track.eraImage || "", res.track.artist, res.track.era);
        el.playerArtTrigger.innerHTML =
          `<span>${escapeHtml(monogram(res.track.title))}</span>` +
          (artSrc ? `<img src="${escapeHtml(artSrc)}" alt="" onerror="this.remove()" />` : "");
        updateFullscreenMeta();
      }
      renderInspectorContent(res.track);
      refreshVisibleTrackRows();
      await refreshActivity();
      showToast(`Updated metadata from MusicBrainz: ${res.track.artist} — ${res.track.title}`, "success");
    } catch (err) {
      showToast(err.message, "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Enrich Metadata";
      }
    }
  });
  el.inspectorContent.querySelectorAll("[data-play-mirror]").forEach((btn) => {
    btn.addEventListener("click", () => playTrack(track, Number(btn.getAttribute("data-play-mirror"))));
  });
}

function buildQueueHtml() {
  const parts = [];
  if (state.playingTrack) {
    parts.push(`
      <div>
        <div class="queue-section-title">Now Playing</div>
        ${buildQueueMiniRow(state.playingTrack, "now")}
      </div>
    `);
  }

  if (state.userQueue.length > 0) {
    parts.push(`
      <div>
        <div class="queue-section-title">Next in Queue (${state.userQueue.length})</div>
        <div class="clean-list">
          ${state.userQueue.map((t, i) => buildQueueMiniRow(t, "user", i)).join("")}
        </div>
      </div>
    `);
  }

  const upcoming = state.queueContext.slice(Math.max(0, state.queueIndex + 1), Math.max(0, state.queueIndex + 1) + 25);
  if (upcoming.length > 0) {
    parts.push(`
      <div>
        <div class="queue-section-title">Next from ${escapeHtml(state.playingSourceName)}</div>
        <div class="clean-list">
          ${upcoming.map((t, idx) => buildQueueMiniRow(t, "ctx", state.queueIndex + 1 + idx)).join("")}
        </div>
      </div>
    `);
  }

  if (parts.length === 0) {
    return `<div class="empty-inline">Your play queue is empty. Play any track or choose "Add to queue" from a track menu.</div>`;
  }
  return parts.join("");
}

function buildQueueMiniRow(tr, kind, index = 0) {
  const img = coverUrl(tr.eraImage || "", tr.artist, tr.era);
  return `
    <div class="simple-row ${kind === "now" ? "active" : ""}" data-q-kind="${kind}" data-q-idx="${index}">
      <div class="simple-thumb">
        <span>${escapeHtml(monogram(tr.title))}</span>
        ${img ? `<img src="${escapeHtml(img)}" alt="" onerror="this.remove()" />` : ""}
      </div>
      <div class="track-item-main">
        <div class="track-item-title" style="${kind === "now" ? "color:var(--accent-hover)" : ""}">${escapeHtml(tr.title)}</div>
        <div class="track-item-sub">${escapeHtml(tr.artist)} · ${escapeHtml(tr.era)}</div>
      </div>
      <div class="simple-row-right">
        ${kind === "user" ? `<button type="button" class="row-remove-x" style="opacity:1" data-rm-user-q="${index}" title="Remove">${ICONS.x}</button>` : ""}
      </div>
    </div>
  `;
}

function renderQueueDrawer() {
  el.queueContent.innerHTML = buildQueueHtml();
}

function handleQueueListClick(ev) {
  const rmBtn = ev.target.closest("[data-rm-user-q]");
  if (rmBtn) {
    ev.stopPropagation();
    state.userQueue.splice(Number(rmBtn.getAttribute("data-rm-user-q")), 1);
    updateTransportButtons();
    renderQueueDrawer();
    if (state.fsOpen && state.fsTab === "queue") renderFullscreenSidePanel();
    return;
  }
  const row = ev.target.closest("[data-q-kind]");
  if (!row) return;
  const kind = row.getAttribute("data-q-kind");
  const idx = Number(row.getAttribute("data-q-idx"));
  if (kind === "user") {
    const [picked] = state.userQueue.splice(idx, 1);
    if (picked) playTrack(picked, undefined, false);
  } else if (kind === "ctx") {
    state.queueIndex = idx;
    const picked = state.queueContext[idx];
    if (picked) playTrack(picked, undefined, false);
  }
}

/* ==================== FULLSCREEN CINEMA PLAYER & VISUALIZER ==================== */
function openFullscreenPlayer() {
  if (!state.playingTrack) {
    showToast("Play a track first to open Fullscreen Now Playing.");
    return;
  }
  closeAllPopovers();
  state.fsOpen = true;
  el.fullscreenPlayer.classList.remove("hidden");
  updateFullscreenMeta();
  renderFullscreenSidePanel();
  startVisualizerLoop();
}

function closeFullscreenPlayer() {
  state.fsOpen = false;
  el.fullscreenPlayer.classList.add("hidden");
  stopVisualizerLoop();
}

function updateFullscreenMeta() {
  const tr = state.playingTrack;
  if (!tr) return;
  const artSrc = coverUrl(tr.eraImage || "", tr.artist, tr.era);
  el.fsBackdrop.style.backgroundImage = artSrc
    ? `url("${artSrc}")`
    : "linear-gradient(135deg, #4c1d95, #09090b)";
  el.fsCoverWrap.innerHTML =
    `<span>${escapeHtml(monogram(tr.title))}</span>` +
    (artSrc ? `<img src="${escapeHtml(artSrc)}" alt="" onerror="this.remove()" />` : "");
  el.fsSourceText.textContent = state.playingSourceName || tr.era;
  el.fsTitle.textContent = tr.title;
  el.fsArtist.textContent = `${tr.artist}${tr.credits ? ` ${tr.credits}` : ""} · ${tr.era}`;
  el.fsCodecPill.textContent = formatCodecFull(tr);
  updatePlayerLikeState();
}

function renderFullscreenSidePanel() {
  const tr = state.playingTrack;
  document.querySelectorAll("[data-fs-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-fs-tab") === state.fsTab);
  });

  if (state.fsTab === "queue") {
    el.fsSidePanel.innerHTML = buildQueueHtml();
    return;
  }

  if (!tr) {
    el.fsSidePanel.innerHTML = `<div class="empty-inline">Select a track to view studio notes and lossless telemetry.</div>`;
    return;
  }

  el.fsSidePanel.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px">
      <div>
        <div class="block-label" style="margin-bottom:8px">Studio &amp; Recording Notes</div>
        <div style="font-size:15.5px; line-height:1.7; color:var(--text-secondary)">
          ${tr.notes ? escapeHtml(tr.notes) : "No studio notes recorded for this track yet."}
        </div>
      </div>

      <div class="inspector-block">
        <div class="block-label">Lossless Stream Telemetry</div>
        <div class="small">Format: <strong>${escapeHtml(formatCodecFull(tr))}</strong></div>
        <div class="small muted">Era: ${escapeHtml(tr.era)}${tr.subEra && tr.subEra !== "Default" ? ` · ${escapeHtml(tr.subEra)}` : ""}</div>
        ${tr.leakDate ? `<div class="small muted">Archive Date: ${escapeHtml(tr.leakDate)}</div>` : ""}
        <div class="small muted">Host: ${escapeHtml(tr.primaryHost)}</div>
      </div>
    </div>
  `;
}

function startVisualizerLoop() {
  stopVisualizerLoop();
  const canvas = el.fsVisualizerCanvas;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) return;

  const draw = () => {
    if (!state.fsOpen) return;
    state.visRafId = requestAnimationFrame(draw);

    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);

    const barCount = 36;
    const gap = 4;
    const barW = (w - gap * (barCount - 1)) / barCount;
    const playing = !el.audioEl.paused;

    let freqData = null;
    if (state.analyser && playing) {
      freqData = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(freqData);
    }

    const grad = ctx2d.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, "rgba(124, 77, 255, 0.45)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.92)");
    ctx2d.fillStyle = grad;

    const now = performance.now() * 0.004;
    for (let i = 0; i < barCount; i++) {
      let norm = 0.08;
      if (freqData && freqData.length > 0) {
        const bin = Math.min(freqData.length - 1, Math.floor((i / barCount) * (freqData.length * 0.72)));
        norm = Math.max(0.08, freqData[bin] / 255);
      } else if (playing) {
        norm = 0.14 + 0.25 * Math.abs(Math.sin(now + i * 0.45));
      }
      const barH = Math.max(4, norm * (h - 6));
      const x = i * (barW + gap);
      const y = (h - barH) / 2;
      ctx2d.beginPath();
      ctx2d.roundRect(x, y, barW, barH, 3);
      ctx2d.fill();
    }
  };
  draw();
}

function stopVisualizerLoop() {
  if (state.visRafId) {
    cancelAnimationFrame(state.visRafId);
    state.visRafId = null;
  }
}

/* ==================== CONTEXT MENU (Track ••• & Right-Click) ==================== */
function openTrackContextMenu(track, x, y) {
  closeAllPopovers();
  const liked = state.likedIds.has(track.id);
  const inPlaylist = state.route.view === "playlist" ? state.route.playlistId : null;

  el.trackContextMenu.innerHTML = `
    <button type="button" class="context-menu-btn" data-cm="play">▶ Play now</button>
    <button type="button" class="context-menu-btn" data-cm="playNext">↥ Play next</button>
    <button type="button" class="context-menu-btn" data-cm="queue">+ Add to queue</button>
    <div class="context-sep"></div>
    <button type="button" class="context-menu-btn" data-cm="like">${liked ? "♥ Remove from Liked" : "♡ Save to Liked songs"}</button>
    <button type="button" class="context-menu-btn" data-cm="addPlaylist">＋ Add to playlist...</button>
    ${inPlaylist ? `<button type="button" class="context-menu-btn danger" data-cm="removePlaylist">✕ Remove from this playlist</button>` : ""}
    <div class="context-sep"></div>
    <button type="button" class="context-menu-btn" data-cm="cache">${track.cacheStatus?.isComplete ? "✓ Cached offline" : "↓ Save offline (./cache)"}</button>
    <button type="button" class="context-menu-btn" data-cm="artist">Go to Artist (${escapeHtml(track.artist)})</button>
    <button type="button" class="context-menu-btn" data-cm="era">Go to Era (${escapeHtml(track.era)})</button>
    <div class="context-sep"></div>
    <button type="button" class="context-menu-btn" data-cm="inspect">ⓘ Track Inspector &amp; Notes</button>
  `;

  el.trackContextMenu.classList.remove("hidden");
  const rect = el.trackContextMenu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 12);
  const top = Math.min(y, window.innerHeight - rect.height - 12);
  el.trackContextMenu.style.left = `${Math.max(10, left)}px`;
  el.trackContextMenu.style.top = `${Math.max(10, top)}px`;

  el.trackContextMenu.onclick = async (ev) => {
    const btn = ev.target.closest("[data-cm]");
    if (!btn) return;
    const action = btn.getAttribute("data-cm");
    el.trackContextMenu.classList.add("hidden");

    if (action === "play") playTrack(track);
    else if (action === "playNext") addToUserQueue(track, true);
    else if (action === "queue") addToUserQueue(track, false);
    else if (action === "like") await toggleLikeTrack(track.id);
    else if (action === "addPlaylist") openAddToPlaylistModal(track.id);
    else if (action === "removePlaylist" && inPlaylist) {
      await apiJson(`/api/playlists/${encodeURIComponent(inPlaylist)}/tracks/${encodeURIComponent(track.id)}`, {
        method: "DELETE",
      });
      await refreshPlaylists();
      await renderCollectionView(state.route);
      showToast(`Removed "${track.title}" from playlist.`);
    } else if (action === "cache") await precacheTrack(track.id);
    else if (action === "artist") await navigate({ view: "artist", trackerId: track.trackerId });
    else if (action === "era") await navigate({ view: "era", era: track.era, trackerId: track.trackerId });
    else if (action === "inspect") openInspector(track);
  };
}

/* ==================== MODALS: PLAYLIST, PROFILE, SYNC, CACHE ==================== */
function openPlaylistModal(existing = null) {
  state.editingPlaylistId = existing?.id || null;
  el.playlistModalTitle.textContent = existing ? "Edit playlist" : "Create playlist";
  el.playlistNameInput.value = existing?.name || "";
  el.playlistDescInput.value = existing?.description || "";
  state.selectedPlaylistGradient = existing?.coverGradient || PLAYLIST_GRADIENTS[0];

  el.playlistGradientPicker.innerHTML = PLAYLIST_GRADIENTS.map(
    (g) =>
      `<button type="button" class="swatch-btn ${g === state.selectedPlaylistGradient ? "selected" : ""}" style="background:${g}" data-pl-grad="${escapeHtml(g)}"></button>`
  ).join("");

  el.playlistModal.classList.remove("hidden");
  el.playlistNameInput.focus();
}

function openAddToPlaylistModal(trackId) {
  state.addToPlaylistTrackId = trackId;
  const track = state.trackMap.get(trackId);
  el.addToPlTrackPreview.textContent = track ? `Adding "${track.title}" — ${track.artist}` : "";

  if (state.playlists.length === 0) {
    el.addToPlList.innerHTML = `<div class="muted small" style="padding:12px 0">No playlists yet. Create one below!</div>`;
  } else {
    el.addToPlList.innerHTML = state.playlists
      .map(
        (pl) => `
        <div class="simple-row" data-pick-pl="${escapeHtml(pl.id)}">
          <div class="simple-thumb" style="background:${escapeHtml(pl.coverGradient || PLAYLIST_GRADIENTS[0])}">
            ${buildPlaylistMosaicHtml(pl)}
          </div>
          <div class="track-item-main">
            <div class="track-item-title">${escapeHtml(pl.name)}</div>
            <div class="track-item-sub">${pl.trackCount} tracks</div>
          </div>
          <span class="pill-btn">Add</span>
        </div>
      `
      )
      .join("");
  }
  el.addToPlaylistModal.classList.remove("hidden");
}

function openProfileModal() {
  el.profileNameInput.value = state.profile.name;
  el.profileHandleInput.value = state.profile.handle;
  el.profileBioInput.value = state.profile.bio;
  el.profileAvatarUrlInput.value = state.profile.avatarUrl || "";
  state.profileDraftPreset = state.profile.avatarPreset || "violet";
  state.profileDraftAccent = state.profile.accentColor || "#7c4dff";

  el.avatarPresetPicker.innerHTML = Object.entries(AVATAR_PRESETS)
    .map(
      ([key, grad]) =>
        `<button type="button" class="swatch-btn ${key === state.profileDraftPreset ? "selected" : ""}" style="background:${grad}" data-avatar-preset="${key}" title="${key}"></button>`
    )
    .join("");

  el.accentColorPicker.innerHTML = ACCENT_OPTIONS.map(
    (opt) =>
      `<button type="button" class="swatch-btn ${opt.hex.toLowerCase() === state.profileDraftAccent.toLowerCase() ? "selected" : ""}" style="background:${opt.hex}" data-accent-hex="${opt.hex}" title="${opt.name}"></button>`
  ).join("");

  el.profileModal.classList.remove("hidden");
  el.profileNameInput.focus();
}

function switchSyncTab(tabName) {
  el.syncModalTabs?.querySelectorAll("[data-sync-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-sync-tab") === tabName);
  });
  el.syncTabArtistGrid?.classList.toggle("hidden", tabName !== "artistgrid");
  el.syncTabUrl?.classList.toggle("hidden", tabName !== "url");
  el.syncTabLocal?.classList.toggle("hidden", tabName !== "local");
  el.syncTabSpotify?.classList.toggle("hidden", tabName !== "spotify");
}

async function openSyncModal() {
  el.syncModal.classList.remove("hidden");
  switchSyncTab("artistgrid");
  el.trackerInput.focus();
  if (state.directoryArtists.length === 0) {
    el.directoryList.innerHTML = `<div class="muted small">Loading ArtistGrid directory...</div>`;
    try {
      const data = await apiJson("/api/directory");
      state.directoryArtists = data.artists || [];
    } catch (err) {
      el.directoryList.innerHTML = `<div class="muted small">Directory unavailable offline (${escapeHtml(err.message)}). Paste a tracker ID or click "Load demo" above.</div>`;
      return;
    }
  }
  renderDirectoryList();
}

function renderDirectoryList() {
  const q = el.directorySearchInput.value.trim().toLowerCase();
  const filtered = (q
    ? state.directoryArtists.filter((a) => a.name.toLowerCase().includes(q))
    : state.directoryArtists
  ).slice(0, 75);

  if (!filtered.length) {
    el.directoryList.innerHTML = `<div class="muted small">No matching artists found.</div>`;
    return;
  }

  el.directoryList.innerHTML = filtered
    .map(
      (a) => `
      <div class="directory-row" data-dir-id="${escapeHtml(a.trackerId)}">
        <div>
          <div style="font-weight:600">${escapeHtml(a.name)}</div>
          <div class="mono muted" style="font-size:11px">${escapeHtml(a.trackerId)}</div>
        </div>
        <div style="display:flex; gap:6px">
          ${a.isStarred ? `<span class="soft-tag partial">Starred</span>` : ""}
          ${a.isLinkWorking ? `<span class="soft-tag lossless">Working</span>` : ""}
        </div>
      </div>
    `
    )
    .join("");
}

async function syncTracker(input, tabMeta = {}) {
  el.syncBtn.disabled = true;
  el.syncBtn.textContent = "Syncing...";
  showToast("Syncing tracker from ArtistGrid...");
  try {
    const result = await apiJson("/api/trackers/sync", {
      method: "POST",
      body: JSON.stringify({
        input,
        tabGid: tabMeta.gid || undefined,
        tabSlug: tabMeta.slug || undefined,
        tabName: tabMeta.name || undefined,
      }),
    });
    state.activeTrackerId = result.tracker.trackerId;
    state.activeTabName = result.tabSynced;
    el.syncModal.classList.add("hidden");
    showToast(
      `Synced ${result.tracker.artistName} (${result.tabSynced}): ${result.tracksSynced} tracks in ${result.elapsedMs} ms.`,
      "success"
    );
    await Promise.all([refreshTrackers(), refreshActivity()]);
    await navigate({ view: "artist", trackerId: result.tracker.trackerId, tabName: result.tabSynced });
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    el.syncBtn.disabled = false;
    el.syncBtn.textContent = "Sync";
  }
}

async function seedDemoShowcase() {
  showToast("Loading interactive Studio Demo Vault...");
  try {
    const res = await apiJson("/api/demo/seed", { method: "POST" });
    el.syncModal.classList.add("hidden");
    await refreshAllCore();
    showToast(
      `Loaded ${res.trackersCount} artists & ${res.tracksCount} lossless WAV studio masters!`,
      "success"
    );
    await navigate({ view: "home" }, false);
  } catch (err) {
    showToast(err.message, "error");
  }
}

function renderCacheModal(stats) {
  el.cacheUsedValue.textContent = formatBytes(stats.totalCachedBytes);
  el.cacheCapValue.textContent = formatBytes(stats.maxCacheBytes);
  el.cacheCountValue.textContent = `${stats.entryCount} (${stats.completeCount} full)`;
  el.cacheProgressBar.style.width = `${stats.utilizationPercent}%`;

  if (!stats.entries.length) {
    el.cacheEntriesList.innerHTML = `<div class="empty-inline">Cache is empty.</div>`;
    return;
  }

  el.cacheEntriesList.innerHTML = stats.entries
    .map((e) => {
      const label = e.trackTitle || e.filename || e.cacheKey;
      const pct = e.totalBytes ? Math.min(100, Math.round((e.cachedBytes / e.totalBytes) * 100)) : null;
      return `
        <div class="simple-row" style="cursor:default">
          <div class="simple-thumb">${escapeHtml(monogram(label))}</div>
          <div class="track-item-main">
            <div class="track-item-title">${escapeHtml(label)}</div>
            <div class="track-item-sub">${escapeHtml(e.artist || e.sourceUrl)} · ${formatBytes(e.cachedBytes)} / ${formatBytes(e.totalBytes)} (${e.isComplete ? "100%" : `${pct ?? 0}%`})</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center">
            <span class="soft-tag ${e.audioMeta?.lossless ? "lossless" : ""}">${escapeHtml(e.audioMeta?.codec || "audio")}</span>
            <button type="button" class="pill-btn danger-pill" data-del-cache="${escapeHtml(e.cacheKey)}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderNotifPopover() {
  if (state.activity.length === 0) {
    el.notifList.innerHTML = `<div class="empty-inline" style="padding:26px 12px">No activity yet. Sync a tracker or save tracks offline!</div>`;
    return;
  }
  el.notifList.innerHTML = state.activity
    .map(
      (a) => `
      <div class="notif-item ${a.isRead ? "" : "unread"}">
        <div style="display:flex; justify-content:space-between; gap:8px">
          <span class="notif-item-title">${escapeHtml(a.title)}</span>
          <span class="muted" style="font-size:11px; white-space:nowrap">${timeAgo(a.createdAt)}</span>
        </div>
        ${a.detail ? `<div class="notif-item-detail">${escapeHtml(a.detail)}</div>` : ""}
      </div>
    `
    )
    .join("");
}

/* ==================== CUSTOM SCRUBBERS (Seek & Volume) ==================== */
function bindScrubber(barEl, onRatioChange, onCommit) {
  let active = false;
  const getRatio = (ev) => {
    const rect = barEl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (ev.clientX - rect.left) / Math.max(1, rect.width)));
  };

  barEl.addEventListener("pointerdown", (ev) => {
    active = true;
    barEl.classList.add("dragging");
    barEl.setPointerCapture(ev.pointerId);
    onRatioChange(getRatio(ev), true);
  });

  barEl.addEventListener("pointermove", (ev) => {
    if (!active) return;
    onRatioChange(getRatio(ev), true);
  });

  const end = (ev) => {
    if (!active) return;
    active = false;
    barEl.classList.remove("dragging");
    const r = getRatio(ev);
    if (onCommit) onCommit(r);
  };

  barEl.addEventListener("pointerup", end);
  barEl.addEventListener("pointercancel", end);
}

function updateVolumeUI() {
  const vol = el.audioEl.muted ? 0 : el.audioEl.volume;
  const pct = `${Math.round(vol * 100)}%`;
  el.volumeFill.style.width = pct;
  el.volumeThumb.style.left = pct;
  el.volumeSvg.innerHTML = vol === 0 ? ICONS.volMute : vol < 0.5 ? ICONS.volLow : ICONS.volHigh;
}

/* ==================== TRACK ROW EVENT DELEGATION ==================== */
function getListForContext(ctx) {
  if (ctx === "home") return state.homeTracks;
  if (ctx === "search") return state.searchTracks;
  if (ctx === "artist-hits") return state.artistData?.topHits || [];
  if (ctx === "artist-feat") return state.artistData?.featuring || [];
  if (ctx === "collection") return state.collectionData?.tracks || [];
  if (ctx === "profile-liked") return state.likedTracks;
  if (ctx === "profile-cached") return state.profileCachedTracks;
  if (ctx === "profile-history") return state.historyItems.map((h) => h.track);
  if (ctx === "lib-lossless" || ctx === "lib-cached") return state.libraryTracks;
  return [];
}

function getSourceNameForContext(ctx) {
  if (ctx === "artist-hits" || ctx === "artist-feat") return state.artistData?.tracker?.artistName || "Artist";
  if (ctx === "collection") return state.collectionData?.title || "Collection";
  if (ctx === "profile-liked") return "Liked Songs";
  if (ctx === "profile-cached" || ctx === "lib-cached") return "Downloaded Offline";
  if (ctx === "lib-lossless") return "Lossless Vault";
  if (ctx === "profile-history") return "Recently Played";
  if (ctx === "search") return state.searchQuery ? `Search: ${state.searchQuery}` : "Vault Search";
  return "Quick Stream";
}

function handleTrackListInteraction(ev) {
  const row = ev.target.closest(".track-item[data-track-id]");
  if (!row) return;
  const trackId = row.getAttribute("data-track-id");
  const ctx = row.getAttribute("data-list-ctx");
  const track = state.trackMap.get(trackId);
  if (!track) return;

  const actionBtn = ev.target.closest("[data-action]");
  const action = actionBtn?.getAttribute("data-action");

  if (action === "like") {
    ev.stopPropagation();
    toggleLikeTrack(track.id);
    return;
  }

  if (action === "menu") {
    ev.stopPropagation();
    const r = actionBtn.getBoundingClientRect();
    openTrackContextMenu(track, r.left - 180, r.bottom + 6);
    return;
  }

  if (action === "play") {
    ev.stopPropagation();
    if (state.playingTrack?.id === track.id && el.audioEl.src) {
      if (el.audioEl.paused) el.audioEl.play();
      else el.audioEl.pause();
    } else {
      const list = getListForContext(ctx);
      const playable = list.filter((t) => canAttemptPlay(t));
      const idx = playable.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        startQueueAndPlay(playable, idx, getSourceNameForContext(ctx), false);
      } else {
        playTrack(track);
      }
      if (state.route.view === "search" && state.searchQuery.trim()) {
        recordRecentSearch({
          query: track.title,
          itemType: "track",
          itemId: track.id,
          subtitle: `Song · ${track.artist}`,
          imageUrl: track.eraImage,
        });
      }
    }
    return;
  }

  // Single-click lightly selects row; double-click plays the track without popping Inspector open
  state.selectedTrack = track;
  document.querySelectorAll(".track-item.active").forEach((elRow) => elRow.classList.remove("active"));
  row.classList.add("active");
}

async function recordRecentSearch(payload) {
  try {
    const res = await apiJson("/api/recent-searches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.recentSearches = res.items || state.recentSearches;
  } catch {
    // ignore
  }
}

/* ==================== WIRE ALL EVENT LISTENERS ==================== */
function bindEvents() {
  // Header scroll blur
  el.stageScroll.addEventListener("scroll", () => {
    el.stageHeader.classList.toggle("scrolled", el.stageScroll.scrollTop > 22);
  });

  // Back / Forward
  el.navBackBtn.addEventListener("click", () => {
    if (state.navIndex > 0) {
      state.navIndex--;
      navigate(state.navStack[state.navIndex], false);
    }
  });
  el.navForwardBtn.addEventListener("click", () => {
    if (state.navIndex < state.navStack.length - 1) {
      state.navIndex++;
      navigate(state.navStack[state.navIndex], false);
    }
  });

  // Sidebar navigation
  el.brandHomeBtn.addEventListener("click", () => navigate({ view: "home" }));
  el.navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      navigate({ view });
      if (view === "search") setTimeout(() => el.searchInput.focus(), 40);
    });
  });

  el.sidebarPlaylistsList.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-sidebar-pl]");
    if (!btn) return;
    navigate({ view: "playlist", playlistId: btn.getAttribute("data-sidebar-pl") });
  });

  el.navNewPlaylistBtn.addEventListener("click", () => openPlaylistModal());
  el.navSyncBtn.addEventListener("click", openSyncModal);
  el.homeSyncBtn.addEventListener("click", openSyncModal);
  el.heroAddTrackerBtn.addEventListener("click", openSyncModal);
  el.libSyncBtn.addEventListener("click", openSyncModal);
  el.libNewPlaylistBtn.addEventListener("click", () => openPlaylistModal());
  el.heroSeedDemoBtn.addEventListener("click", seedDemoShowcase);
  el.modalSeedDemoBtn.addEventListener("click", seedDemoShowcase);

  el.navSettingsBtn.addEventListener("click", async () => {
    el.cacheModal.classList.remove("hidden");
    await refreshCacheStats();
    if (state.cacheStats) renderCacheModal(state.cacheStats);
    void refreshUpdateStatus(false);
    void refreshNetworkSettings();
  });
  el.sidebarCacheSummary.addEventListener("click", async () => {
    el.cacheModal.classList.remove("hidden");
    await refreshCacheStats();
    if (state.cacheStats) renderCacheModal(state.cacheStats);
    void refreshUpdateStatus(false);
    void refreshNetworkSettings();
  });

  // Mobile sidebar
  el.mobileMenuBtn.addEventListener("click", () => {
    el.sidebar.classList.toggle("mobile-open");
    el.mobileSidebarBackdrop.classList.toggle("hidden", !el.sidebar.classList.contains("mobile-open"));
  });
  el.mobileSidebarBackdrop.addEventListener("click", closeMobileSidebar);

  // Top-right Profile & Notifications
  el.profileAvatarBtn.addEventListener("click", () => navigate({ view: "profile" }));

  el.notifBellBtn.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    const opening = el.notifPopover.classList.contains("hidden");
    closeAllPopovers();
    if (opening) {
      await refreshActivity();
      renderNotifPopover();
      el.notifPopover.classList.remove("hidden");
    }
  });

  el.markAllReadBtn.addEventListener("click", async () => {
    await apiJson("/api/activity/read", { method: "POST" });
    await refreshActivity();
    renderNotifPopover();
  });

  // Global Search Bar
  let searchTimer = null;
  el.searchInput.addEventListener("input", () => {
    const val = el.searchInput.value;
    el.clearSearchInputBtn.classList.toggle("hidden", !val);
    clearTimeout(searchTimer);
    const delayMs = state.searchSource === "library" ? 100 : 320;
    searchTimer = setTimeout(async () => {
      state.searchQuery = val;
      state.searchOffset = 0;
      if (state.route.view !== "search") {
        await navigate({ view: "search" });
      } else {
        await renderSearchView();
      }
    }, delayMs);
  });

  el.searchSourceTabs?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-search-source]");
    if (!btn) return;
    const src = btn.getAttribute("data-search-source") || "library";
    if (state.searchSource === src) return;
    state.searchSource = src;
    state.searchOffset = 0;
    await renderSearchView();
  });

  el.searchTrackList.addEventListener("click", async (ev) => {
    const playOnline = ev.target.closest("[data-online-play]");
    if (playOnline) {
      ev.stopPropagation();
      await importOnlineResult(Number(playOnline.getAttribute("data-online-play")), true);
      return;
    }
    const saveOnline = ev.target.closest("[data-online-save]");
    if (saveOnline) {
      ev.stopPropagation();
      await importOnlineResult(Number(saveOnline.getAttribute("data-online-save")), false);
    }
  });

  el.searchCollectionsGrid?.addEventListener("click", async (ev) => {
    const saveCol = ev.target.closest("[data-online-col-save]");
    if (saveCol) {
      ev.stopPropagation();
      await importOnlineCollection(Number(saveCol.getAttribute("data-online-col-save")), false);
      return;
    }
    const playCol = ev.target.closest("[data-online-col-play]");
    if (playCol) {
      ev.stopPropagation();
      await importOnlineCollection(Number(playCol.getAttribute("data-online-col-play")), true);
    }
  });

  el.libMbBatchBtn?.addEventListener("click", async () => {
    el.libMbBatchBtn.disabled = true;
    el.libMbBatchBtn.textContent = "Auto-tagging...";
    showToast("Matching missing album metadata & artwork via MusicBrainz...");
    try {
      const res = await apiJson("/api/metadata/musicbrainz/batch", {
        method: "POST",
        body: JSON.stringify({ limit: 12 }),
      });
      if (res.updatedTracks?.length) rememberTracks(res.updatedTracks);
      await Promise.all([refreshTrackers(), refreshActivity()]);
      if (state.route.view === "library") await renderLibraryView();
      showToast(
        res.matched > 0
          ? `Matched ${res.matched} of ${res.processed} track(s) with clean metadata & art.`
          : `Checked ${res.processed} track(s); no new matches found.`,
        res.matched > 0 ? "success" : "info"
      );
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      el.libMbBatchBtn.disabled = false;
      el.libMbBatchBtn.textContent = "Auto-Tag Missing Art";
    }
  });

  el.searchInput.addEventListener("keydown", async (ev) => {
    if (ev.key === "Enter" && el.searchInput.value.trim()) {
      await recordRecentSearch({
        query: el.searchInput.value.trim(),
        itemType: "query",
        subtitle: "Search query",
      });
    }
  });

  el.clearSearchInputBtn.addEventListener("click", async () => {
    el.searchInput.value = "";
    el.clearSearchInputBtn.classList.add("hidden");
    state.searchQuery = "";
    state.searchTrackerId = "";
    state.searchEra = "";
    state.searchHost = "";
    state.losslessOnly = false;
    state.searchOffset = 0;
    if (state.route.view === "search") await renderSearchView();
  });

  // Home interactions
  el.quickAccessGrid.addEventListener("click", async (ev) => {
    const tile = ev.target.closest("[data-quick-route]");
    if (!tile) return;
    const spec = tile.getAttribute("data-quick-route");
    const clickedPlay = Boolean(ev.target.closest(".quick-tile-play"));

    if (clickedPlay) {
      ev.stopPropagation();
      if (spec === "liked") {
        startQueueAndPlay(state.likedTracks, 0, "Liked Songs");
      } else if (spec === "mix:lossless") {
        const res = await apiJson("/api/tracks?losslessOnly=1&playableOnly=1&limit=100");
        rememberTracks(res.tracks);
        startQueueAndPlay(res.tracks, 0, "Lossless Vault");
      } else if (spec === "mix:cached") {
        const res = await apiJson("/api/tracks?cachedOnly=1&limit=100");
        rememberTracks(res.tracks);
        startQueueAndPlay(res.tracks, 0, "Downloaded Offline");
      } else if (spec.startsWith("playlist:")) {
        const res = await apiJson(`/api/playlists/${encodeURIComponent(spec.slice(9))}`);
        rememberTracks(res.playlist?.tracks);
        startQueueAndPlay(res.playlist?.tracks, 0, res.playlist?.name || "Playlist");
      } else if (spec.startsWith("artist:")) {
        const tid = spec.slice(7);
        const res = await apiJson(`/api/tracks?trackerId=${encodeURIComponent(tid)}&playableOnly=1&limit=100`);
        rememberTracks(res.tracks);
        const trk = state.trackers.find((x) => x.trackerId === tid);
        startQueueAndPlay(res.tracks, 0, trk?.artistName || "Artist");
      }
      return;
    }

    if (spec === "liked") navigate({ view: "liked" });
    else if (spec.startsWith("mix:")) navigate({ view: "mix", mixKind: spec.slice(4) });
    else if (spec.startsWith("playlist:")) navigate({ view: "playlist", playlistId: spec.slice(9) });
    else if (spec.startsWith("artist:")) navigate({ view: "artist", trackerId: spec.slice(7) });
  });

  el.homeSeeLibraryBtn.addEventListener("click", () => navigate({ view: "library", tab: "artists" }));
  el.homeSeeHistoryBtn.addEventListener("click", () => navigate({ view: "profile", tab: "history" }));

  el.homeRecentShelf.addEventListener("click", (ev) => {
    const playBtn = ev.target.closest("[data-card-play]");
    if (playBtn) {
      ev.stopPropagation();
      const tr = state.trackMap.get(playBtn.getAttribute("data-card-play"));
      if (tr) playTrack(tr);
      return;
    }
    const card = ev.target.closest("[data-card-track]");
    if (!card) return;
    const tr = state.trackMap.get(card.getAttribute("data-card-track"));
    if (tr) playTrack(tr);
  });

  // Search discover & filters
  el.clearRecentSearchesBtn.addEventListener("click", async () => {
    await apiJson("/api/recent-searches", { method: "DELETE" });
    state.recentSearches = [];
    renderSearchDiscover();
  });

  el.recentSearchesList.addEventListener("click", async (ev) => {
    const delBtn = ev.target.closest("[data-del-recent]");
    if (delBtn) {
      ev.stopPropagation();
      const id = Number(delBtn.getAttribute("data-del-recent"));
      const res = await apiJson(`/api/recent-searches/${id}`, { method: "DELETE" });
      state.recentSearches = res.items || [];
      renderSearchDiscover();
      return;
    }
    const row = ev.target.closest("[data-recent-id]");
    if (!row) return;
    const rs = state.recentSearches.find((r) => r.id === Number(row.getAttribute("data-recent-id")));
    if (!rs) return;
    if (rs.itemType === "artist" && rs.itemId) {
      await navigate({ view: "artist", trackerId: rs.itemId });
    } else if (rs.itemType === "era") {
      await navigate({ view: "era", era: rs.query, trackerId: rs.itemId || undefined });
    } else if (rs.itemType === "track" && rs.itemId) {
      const tr = state.trackMap.get(rs.itemId) || (await apiJson(`/api/tracks/${encodeURIComponent(rs.itemId)}`).catch(() => null))?.track;
      if (tr) {
        rememberTracks([tr]);
        playTrack(tr);
      }
    } else {
      el.searchInput.value = rs.query;
      el.clearSearchInputBtn.classList.remove("hidden");
      state.searchQuery = rs.query;
      state.searchOffset = 0;
      await renderSearchView();
    }
  });

  el.trackerSelect.addEventListener("change", () => {
    state.searchTrackerId = el.trackerSelect.value;
    state.searchTabName = "";
    state.searchEra = "";
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.tabSelect.addEventListener("change", async () => {
    const tabName = el.tabSelect.value;
    const tid = state.searchTrackerId || (state.trackers.length === 1 ? state.trackers[0].trackerId : "");
    const tracker = state.trackers.find((t) => t.trackerId === tid);
    if (tracker && tabName && !tracker.syncedTabs.includes(tabName)) {
      const meta = tracker.tabs.find((x) => x.name === tabName);
      await syncTracker(tracker.trackerId, meta || { name: tabName });
      return;
    }
    state.searchTabName = tabName;
    state.searchEra = "";
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.eraSelect.addEventListener("change", () => {
    state.searchEra = el.eraSelect.value;
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.hostSelect.addEventListener("change", () => {
    state.searchHost = el.hostSelect.value;
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.losslessFilterBtn.addEventListener("click", () => {
    state.losslessOnly = !state.losslessOnly;
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.playableFilterBtn.addEventListener("click", () => {
    state.playableOnly = !state.playableOnly;
    state.searchOffset = 0;
    loadSearchResults();
  });
  el.clearFiltersBtn.addEventListener("click", () => {
    state.searchQuery = "";
    state.searchTrackerId = "";
    state.searchTabName = "";
    state.searchEra = "";
    state.searchHost = "";
    state.losslessOnly = false;
    state.searchOffset = 0;
    el.searchInput.value = "";
    el.clearSearchInputBtn.classList.add("hidden");
    renderSearchView();
  });
  el.prevPageBtn.addEventListener("click", () => {
    state.searchOffset = Math.max(0, state.searchOffset - state.searchLimit);
    loadSearchResults();
  });
  el.nextPageBtn.addEventListener("click", () => {
    if (state.searchOffset + state.searchLimit < state.searchTotal) {
      state.searchOffset += state.searchLimit;
      loadSearchResults();
    }
  });

  // Global delegated card/artist/era/mix/playlist clicks inside stageScroll
  el.stageScroll.addEventListener("click", async (ev) => {
    const playPlBtn = ev.target.closest("[data-play-playlist]");
    if (playPlBtn) {
      ev.stopPropagation();
      const plId = playPlBtn.getAttribute("data-play-playlist");
      const data = await apiJson(`/api/playlists/${encodeURIComponent(plId)}`);
      const tracks = data.playlist?.tracks || [];
      rememberTracks(tracks);
      startQueueAndPlay(tracks, 0, data.playlist?.name || "Playlist");
      return;
    }

    const artistTrigger = ev.target.closest("[data-open-artist]");
    if (artistTrigger) {
      const tid = artistTrigger.getAttribute("data-open-artist");
      const t = state.trackers.find((x) => x.trackerId === tid);
      if (t && state.route.view === "search" && state.searchQuery.trim()) {
        recordRecentSearch({
          query: t.artistName,
          itemType: "artist",
          itemId: t.trackerId,
          subtitle: "Artist",
          imageUrl: t.coverImage,
        });
      }
      navigate({ view: "artist", trackerId: tid });
      return;
    }

    const plTrigger = ev.target.closest("[data-open-playlist]");
    if (plTrigger) {
      navigate({ view: "playlist", playlistId: plTrigger.getAttribute("data-open-playlist") });
      return;
    }

    const eraTrigger = ev.target.closest("[data-open-era]");
    if (eraTrigger) {
      navigate({
        view: "era",
        era: eraTrigger.getAttribute("data-open-era"),
        trackerId: eraTrigger.getAttribute("data-era-tracker") || undefined,
      });
      return;
    }

    const mixTrigger = ev.target.closest("[data-open-mix]");
    if (mixTrigger) {
      navigate({ view: "mix", mixKind: mixTrigger.getAttribute("data-open-mix") });
      return;
    }

    const allTrigger = ev.target.closest("[data-show-all-tracks]");
    if (allTrigger) {
      el.searchDiscoverWrap.classList.add("hidden");
      el.searchResultsWrap.classList.remove("hidden");
      await loadSearchResults();
      return;
    }

    handleTrackListInteraction(ev);
  });

  // Double-click any track row (or online search result) to play immediately
  el.stageScroll.addEventListener("dblclick", async (ev) => {
    const onlineRow = ev.target.closest(".online-result-row[data-online-idx]");
    if (onlineRow) {
      await importOnlineResult(Number(onlineRow.getAttribute("data-online-idx")), true);
      return;
    }
    const row = ev.target.closest(".track-item[data-track-id]");
    if (!row) return;
    const track = state.trackMap.get(row.getAttribute("data-track-id"));
    const ctx = row.getAttribute("data-list-ctx");
    if (track && canAttemptPlay(track)) {
      const list = getListForContext(ctx).filter((t) => canAttemptPlay(t));
      const idx = list.findIndex((t) => t.id === track.id);
      if (idx !== -1) startQueueAndPlay(list, idx, getSourceNameForContext(ctx), false);
      else playTrack(track);
    }
  });

  // Right-click context menu on track rows
  el.stageScroll.addEventListener("contextmenu", (ev) => {
    const row = ev.target.closest(".track-item[data-track-id]");
    if (!row) return;
    const track = state.trackMap.get(row.getAttribute("data-track-id"));
    if (!track) return;
    ev.preventDefault();
    openTrackContextMenu(track, ev.clientX, ev.clientY);
  });

  // Artist Hero View Controls
  el.artistPlayBtn.addEventListener("click", () => {
    if (!state.artistData) return;
    startQueueAndPlay(state.artistData.topHits, 0, state.artistData.tracker.artistName, false);
  });
  el.artistShuffleBtn.addEventListener("click", () => {
    if (!state.artistData) return;
    startQueueAndPlay(state.artistData.topHits, 0, state.artistData.tracker.artistName, true);
  });
  el.artistFollowBtn.addEventListener("click", async () => {
    if (!state.artistData) return;
    const tid = state.artistData.tracker.trackerId;
    const res = await apiJson(`/api/trackers/${encodeURIComponent(tid)}/follow`, { method: "POST", body: "{}" });
    state.artistData.tracker.isFollowed = res.followed;
    el.artistFollowBtn.classList.toggle("liked", res.followed);
    await refreshTrackers();
    showToast(res.followed ? `Following ${state.artistData.tracker.artistName}` : `Unfollowed ${state.artistData.tracker.artistName}`);
  });
  el.artistToggleMoreHitsBtn.addEventListener("click", () => {
    state.artistShowAllHits = !state.artistShowAllHits;
    renderArtistLists();
  });
  el.artistTabsRow.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-artist-tab-name]");
    if (!btn || !state.artistData) return;
    const name = btn.getAttribute("data-artist-tab-name");
    const gid = btn.getAttribute("data-artist-tab-gid");
    const slug = btn.getAttribute("data-artist-tab-slug");
    const tracker = state.artistData.tracker;
    if (tracker.syncedTabs.includes(name)) {
      await renderArtistView(tracker.trackerId, name);
    } else {
      await syncTracker(tracker.trackerId, { name, gid, slug });
    }
  });
  el.artistMoreBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (!state.artistData) return;
    const trk = state.artistData.tracker;
    const r = el.artistMoreBtn.getBoundingClientRect();
    el.trackContextMenu.innerHTML = `
      <button type="button" class="context-menu-btn" data-am="resync">↻ Re-sync from ArtistGrid</button>
      <button type="button" class="context-menu-btn" data-am="search">⌕ Search inside ${escapeHtml(trk.artistName)}</button>
      <div class="context-sep"></div>
      <button type="button" class="context-menu-btn danger" data-am="remove">✕ Remove tracker</button>
    `;
    el.trackContextMenu.classList.remove("hidden");
    el.trackContextMenu.style.left = `${Math.max(12, r.left)}px`;
    el.trackContextMenu.style.top = `${r.bottom + 8}px`;
    el.trackContextMenu.onclick = async (e2) => {
      const b = e2.target.closest("[data-am]");
      if (!b) return;
      const act = b.getAttribute("data-am");
      el.trackContextMenu.classList.add("hidden");
      if (act === "resync") {
        if (trk.trackerId.startsWith("demo_")) {
          showToast("Demo studio artist is already up to date.");
        } else {
          await syncTracker(trk.trackerId, { name: state.artistData.tabName });
        }
      } else if (act === "search") {
        state.searchTrackerId = trk.trackerId;
        state.searchQuery = "";
        await navigate({ view: "search" });
      } else if (act === "remove") {
        await apiJson(`/api/trackers/${encodeURIComponent(trk.trackerId)}`, { method: "DELETE" });
        await refreshAllCore();
        showToast(`Removed ${trk.artistName}.`);
        await navigate({ view: "home" });
      }
    };
  });

  // Profile & Library Underline Tabs
  el.editProfileBtn.addEventListener("click", openProfileModal);
  el.profileTabs.addEventListener("click", (ev) => {
    const tab = ev.target.closest("[data-profile-tab]");
    if (!tab) return;
    state.profileTab = tab.getAttribute("data-profile-tab");
    renderProfileView();
  });
  el.libraryTabs.addEventListener("click", (ev) => {
    const tab = ev.target.closest("[data-lib-tab]");
    if (!tab) return;
    state.libraryTab = tab.getAttribute("data-lib-tab");
    renderLibraryView();
  });

  // Collection Controls
  el.collectionPlayBtn.addEventListener("click", () => {
    if (!state.collectionData) return;
    startQueueAndPlay(state.collectionData.tracks, 0, state.collectionData.title, false);
  });
  el.collectionShuffleBtn.addEventListener("click", () => {
    if (!state.collectionData) return;
    startQueueAndPlay(state.collectionData.tracks, 0, state.collectionData.title, true);
  });
  el.collectionFilterInput.addEventListener("input", () => {
    state.collectionFilter = el.collectionFilterInput.value;
    renderCollectionTrackList();
  });

  // Player Transport & Controls
  el.playerArtTrigger.addEventListener("click", openFullscreenPlayer);
  el.fullscreenToggleBtn.addEventListener("click", openFullscreenPlayer);
  el.closeFullscreenBtn.addEventListener("click", closeFullscreenPlayer);

  el.playerTitle.addEventListener("click", () => {
    if (state.playingTrack) openInspector(state.playingTrack);
  });
  el.playerSubtitle.addEventListener("click", () => {
    if (state.playingTrack?.trackerId) {
      navigate({ view: "artist", trackerId: state.playingTrack.trackerId });
    }
  });
  el.playerCodecBadge.addEventListener("click", () => {
    if (state.playingTrack) openInspector(state.playingTrack);
  });
  el.playerInspectBtn.addEventListener("click", () => {
    if (state.playingTrack) openInspector(state.playingTrack);
  });
  el.playerLikeBtn.addEventListener("click", () => {
    if (state.playingTrack) toggleLikeTrack(state.playingTrack.id);
  });
  el.fsLikeBtn.addEventListener("click", () => {
    if (state.playingTrack) toggleLikeTrack(state.playingTrack.id);
  });

  const togglePlayPause = async () => {
    if (!el.audioEl.src) return;
    initAudioGraphIfNeeded();
    if (el.audioEl.paused) await el.audioEl.play().catch(() => {});
    else el.audioEl.pause();
  };
  el.playPauseBtn.addEventListener("click", togglePlayPause);
  el.fsPlayPauseBtn.addEventListener("click", togglePlayPause);
  el.prevTrackBtn.addEventListener("click", playPrevTrack);
  el.fsPrevBtn.addEventListener("click", playPrevTrack);
  el.nextTrackBtn.addEventListener("click", () => playNextTrack(false));
  el.fsNextBtn.addEventListener("click", () => playNextTrack(false));

  const toggleShuffle = () => {
    state.shuffle = !state.shuffle;
    updateTransportButtons();
  };
  el.shuffleBtn.addEventListener("click", toggleShuffle);
  el.fsShuffleBtn.addEventListener("click", toggleShuffle);

  const cycleRepeat = () => {
    state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    updateTransportButtons();
  };
  el.repeatBtn.addEventListener("click", cycleRepeat);
  el.fsRepeatBtn.addEventListener("click", cycleRepeat);

  // Scrubber bindings (bottom + fullscreen + volume)
  const handleSeekPreview = (ratio) => {
    state.isSeeking = true;
    const pct = `${ratio * 100}%`;
    el.seekProgressFill.style.width = pct;
    el.seekThumb.style.left = pct;
    el.fsSeekFill.style.width = pct;
    el.fsSeekThumb.style.left = pct;
    if (Number.isFinite(el.audioEl.duration) && el.audioEl.duration > 0) {
      const t = formatTime(ratio * el.audioEl.duration);
      el.currentTimeLabel.textContent = t;
      el.fsCurrentTime.textContent = t;
    }
  };
  const handleSeekCommit = (ratio) => {
    if (Number.isFinite(el.audioEl.duration) && el.audioEl.duration > 0) {
      el.audioEl.currentTime = ratio * el.audioEl.duration;
    }
    state.isSeeking = false;
  };
  bindScrubber(el.seekBar, handleSeekPreview, handleSeekCommit);
  bindScrubber(el.fsSeekBar, handleSeekPreview, handleSeekCommit);

  const onSeekKey = (ev) => {
    if (!Number.isFinite(el.audioEl.duration) || el.audioEl.duration <= 0) return;
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      el.audioEl.currentTime = Math.min(el.audioEl.duration, el.audioEl.currentTime + 5);
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      el.audioEl.currentTime = Math.max(0, el.audioEl.currentTime - 5);
    }
  };
  el.seekBar.addEventListener("keydown", onSeekKey);
  el.fsSeekBar.addEventListener("keydown", onSeekKey);

  bindScrubber(el.volumeBar, (ratio) => {
    state.volume = ratio;
    el.audioEl.volume = ratio;
    el.audioEl.muted = false;
    updateVolumeUI();
  });
  el.volumeBar.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
      ev.preventDefault();
      el.audioEl.muted = false;
      el.audioEl.volume = Math.min(1, el.audioEl.volume + 0.05);
      updateVolumeUI();
    } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
      ev.preventDefault();
      el.audioEl.volume = Math.max(0, el.audioEl.volume - 0.05);
      updateVolumeUI();
    }
  });

  el.muteBtn.addEventListener("click", () => {
    el.audioEl.muted = !el.audioEl.muted;
    updateVolumeUI();
  });

  // Audio Element Events
  el.audioEl.addEventListener("play", () => {
    setPlayPauseIcons(true);
    refreshVisibleTrackRows();
    if (state.openDrawer === "inspector" && state.selectedTrack?.id === state.playingTrack?.id) {
      renderInspectorContent(state.selectedTrack);
    }
  });
  el.audioEl.addEventListener("pause", () => {
    setPlayPauseIcons(false);
    refreshVisibleTrackRows();
    if (state.openDrawer === "inspector" && state.selectedTrack?.id === state.playingTrack?.id) {
      renderInspectorContent(state.selectedTrack);
    }
  });
  el.audioEl.addEventListener("timeupdate", () => {
    if (state.isSeeking) return;
    const cur = el.audioEl.currentTime || 0;
    const dur = el.audioEl.duration;
    el.currentTimeLabel.textContent = formatTime(cur);
    el.fsCurrentTime.textContent = formatTime(cur);
    if (Number.isFinite(dur) && dur > 0) {
      el.durationLabel.textContent = formatTime(dur);
      el.fsDuration.textContent = formatTime(dur);
      const pct = `${Math.min(100, (cur / dur) * 100)}%`;
      el.seekProgressFill.style.width = pct;
      el.seekThumb.style.left = pct;
      el.fsSeekFill.style.width = pct;
      el.fsSeekThumb.style.left = pct;
      if (el.audioEl.buffered.length > 0) {
        const bufEnd = el.audioEl.buffered.end(el.audioEl.buffered.length - 1);
        el.seekBufferFill.style.width = `${Math.min(100, (bufEnd / dur) * 100)}%`;
      }
    }
  });
  el.audioEl.addEventListener("ended", async () => {
    await refreshCacheStats();
    playNextTrack(true);
  });
  el.audioEl.addEventListener("canplay", () => {
    state.preparingTrackId = null;
    if (state.playingTrack) {
      const liveBadge = formatCodecShort(state.playingTrack) || state.playingTrack.primaryHost;
      el.playerCodecBadge.textContent = liveBadge;
      el.playerCodecBadge.className = `stream-pill ${isTrackLossless(state.playingTrack) ? "lossless" : ""}`;
      if (state.playingTrack.isUnavailable) {
        state.playingTrack.isUnavailable = false;
        rememberTracks([state.playingTrack]);
        refreshVisibleTrackRows();
      }
    }
  });
  el.audioEl.addEventListener("error", () => {
    if (!state.playingTrack) return;
    if (!el.audioEl.dataset.compatTried && el.audioEl.src && !el.audioEl.src.includes("compat=1")) {
      el.audioEl.dataset.compatTried = "1";
      const sep = el.audioEl.src.includes("?") ? "&" : "?";
      el.audioEl.src = `${el.audioEl.src}${sep}compat=1`;
      el.audioEl.play().catch(() => {});
      return;
    }
    if (el.audioEl.dataset.compatTried === "1") {
      state.preparingTrackId = null;
      el.audioEl.dataset.compatTried = "2";
      el.playerCodecBadge.textContent = "Unavailable";
      el.playerCodecBadge.className = "stream-pill";
      state.playingTrack.isUnavailable = true;
      rememberTracks([state.playingTrack]);
      refreshVisibleTrackRows();
      showToast(`Could not decode/play "${state.playingTrack.title}". Try another mirror in Track Inspector.`, "error");
    }
  });

  // EQ & Speed Popover
  el.eqToggleBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const opening = el.eqPopover.classList.contains("hidden");
    closeAllPopovers();
    if (opening) {
      renderEqSliders();
      el.eqPopover.classList.remove("hidden");
    }
  });
  el.eqPresetsRow.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-eq-preset]");
    if (!btn) return;
    initAudioGraphIfNeeded();
    const key = btn.getAttribute("data-eq-preset");
    applyEqGains(EQ_PRESETS[key].gains, key);
  });
  el.eqSlidersGrid.addEventListener("input", (ev) => {
    const slider = ev.target.closest("[data-eq-band]");
    if (!slider) return;
    initAudioGraphIfNeeded();
    const idx = Number(slider.getAttribute("data-eq-band"));
    const next = [...state.eqGains];
    next[idx] = Number(slider.value);
    applyEqGains(next, "custom");
  });
  el.speedPills.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-speed]");
    if (!btn) return;
    state.playbackRate = Number(btn.getAttribute("data-speed"));
    el.audioEl.playbackRate = state.playbackRate;
    el.speedPills.querySelectorAll("[data-speed]").forEach((b) => {
      b.classList.toggle("active", Number(b.getAttribute("data-speed")) === state.playbackRate);
    });
    el.eqToggleBtn.classList.toggle("active", state.eqGains.some((g) => Math.abs(g) > 0.1) || state.playbackRate !== 1);
  });
  el.sleepPills.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-sleep]");
    if (!btn) return;
    const mins = Number(btn.getAttribute("data-sleep"));
    clearTimeout(state.sleepTimerId);
    state.sleepMinutes = mins;
    el.sleepPills.querySelectorAll("[data-sleep]").forEach((b) => {
      b.classList.toggle("active", Number(b.getAttribute("data-sleep")) === mins);
    });
    if (mins > 0) {
      state.sleepTimerId = setTimeout(() => {
        el.audioEl.pause();
        state.sleepMinutes = 0;
        showToast("Sleep timer ended — playback paused.");
      }, mins * 60 * 1000);
      showToast(`Sleep timer set for ${mins} minutes.`);
    } else {
      showToast("Sleep timer turned off.");
    }
  });

  // Queue & Inspector Drawers
  el.queueToggleBtn.addEventListener("click", () => {
    if (state.openDrawer === "queue") closeDrawers();
    else openDrawer("queue");
  });
  el.closeQueueBtn.addEventListener("click", closeDrawers);
  el.closeInspectorBtn.addEventListener("click", closeDrawers);
  el.drawerBackdrop.addEventListener("click", closeDrawers);
  el.clearQueueBtn.addEventListener("click", () => {
    state.userQueue = [];
    updateTransportButtons();
    renderQueueDrawer();
    showToast("Cleared upcoming queue.");
  });
  el.queueContent.addEventListener("click", handleQueueListClick);
  el.fsSidePanel.addEventListener("click", handleQueueListClick);

  document.querySelectorAll("[data-fs-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.fsTab = btn.getAttribute("data-fs-tab");
      renderFullscreenSidePanel();
    });
  });

  // Playlist Create/Edit Modal
  el.closePlaylistModalBtn.addEventListener("click", () => el.playlistModal.classList.add("hidden"));
  el.cancelPlaylistModalBtn.addEventListener("click", () => el.playlistModal.classList.add("hidden"));
  el.playlistModal.addEventListener("click", (ev) => {
    if (ev.target === el.playlistModal) el.playlistModal.classList.add("hidden");
  });
  el.playlistGradientPicker.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-pl-grad]");
    if (!btn) return;
    state.selectedPlaylistGradient = btn.getAttribute("data-pl-grad");
    el.playlistGradientPicker.querySelectorAll(".swatch-btn").forEach((b) => {
      b.classList.toggle("selected", b === btn);
    });
  });
  el.playlistForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const name = el.playlistNameInput.value.trim();
    if (!name) return;
    const payload = {
      name,
      description: el.playlistDescInput.value.trim(),
      coverGradient: state.selectedPlaylistGradient,
    };
    try {
      let pl;
      if (state.editingPlaylistId) {
        const res = await apiJson(`/api/playlists/${encodeURIComponent(state.editingPlaylistId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        pl = res.playlist;
        showToast(`Updated "${pl.name}".`, "success");
      } else {
        const res = await apiJson("/api/playlists", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        pl = res.playlist;
        showToast(`Created playlist "${pl.name}".`, "success");
        if (state.addToPlaylistTrackId) {
          await apiJson(`/api/playlists/${encodeURIComponent(pl.id)}/tracks`, {
            method: "POST",
            body: JSON.stringify({ trackId: state.addToPlaylistTrackId }),
          });
          state.addToPlaylistTrackId = null;
        }
      }
      el.playlistModal.classList.add("hidden");
      await Promise.all([refreshPlaylists(), refreshActivity()]);
      await navigate({ view: "playlist", playlistId: pl.id });
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Add to Playlist Picker Modal
  el.closeAddToPlModalBtn.addEventListener("click", () => el.addToPlaylistModal.classList.add("hidden"));
  el.addToPlaylistModal.addEventListener("click", (ev) => {
    if (ev.target === el.addToPlaylistModal) el.addToPlaylistModal.classList.add("hidden");
  });
  el.addToPlCreateNewBtn.addEventListener("click", () => {
    el.addToPlaylistModal.classList.add("hidden");
    openPlaylistModal();
  });
  el.addToPlList.addEventListener("click", async (ev) => {
    const row = ev.target.closest("[data-pick-pl]");
    if (!row || !state.addToPlaylistTrackId) return;
    const plId = row.getAttribute("data-pick-pl");
    const res = await apiJson(`/api/playlists/${encodeURIComponent(plId)}/tracks`, {
      method: "POST",
      body: JSON.stringify({ trackId: state.addToPlaylistTrackId }),
    });
    el.addToPlaylistModal.classList.add("hidden");
    state.addToPlaylistTrackId = null;
    await refreshPlaylists();
    showToast(
      res.added
        ? `Added to "${res.playlist?.name}".`
        : `"${res.playlist?.name}" already has this version of the song.`
    );
  });

  // Profile Edit Modal
  el.closeProfileModalBtn.addEventListener("click", () => el.profileModal.classList.add("hidden"));
  el.cancelProfileModalBtn.addEventListener("click", () => el.profileModal.classList.add("hidden"));
  el.profileModal.addEventListener("click", (ev) => {
    if (ev.target === el.profileModal) el.profileModal.classList.add("hidden");
  });
  el.avatarPresetPicker.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-avatar-preset]");
    if (!btn) return;
    state.profileDraftPreset = btn.getAttribute("data-avatar-preset");
    el.avatarPresetPicker.querySelectorAll(".swatch-btn").forEach((b) => b.classList.toggle("selected", b === btn));
  });
  el.accentColorPicker.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-accent-hex]");
    if (!btn) return;
    state.profileDraftAccent = btn.getAttribute("data-accent-hex");
    el.accentColorPicker.querySelectorAll(".swatch-btn").forEach((b) => b.classList.toggle("selected", b === btn));
    applyAccentColor(state.profileDraftAccent);
  });
  el.profileForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await apiJson("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: el.profileNameInput.value.trim(),
          handle: el.profileHandleInput.value.trim(),
          bio: el.profileBioInput.value.trim(),
          avatarUrl: el.profileAvatarUrlInput.value.trim() || null,
          avatarPreset: state.profileDraftPreset,
          accentColor: state.profileDraftAccent,
        }),
      });
      el.profileModal.classList.add("hidden");
      await refreshProfile();
      if (state.route.view === "profile") await renderProfileView();
      else if (state.route.view === "home") el.homeGreetingTitle.textContent = `${getGreeting()}, ${state.profile.name}`;
      showToast("Profile updated.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Sync & Imports Modal
  el.closeSyncModalBtn.addEventListener("click", () => el.syncModal.classList.add("hidden"));
  el.syncModal.addEventListener("click", (ev) => {
    if (ev.target === el.syncModal) el.syncModal.classList.add("hidden");
  });
  el.syncModalTabs?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-sync-tab]");
    if (!btn) return;
    switchSyncTab(btn.getAttribute("data-sync-tab"));
  });
  el.syncForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = el.trackerInput.value.trim();
    if (input) syncTracker(input);
  });
  el.directorySearchInput.addEventListener("input", renderDirectoryList);
  el.directoryList.addEventListener("click", async (ev) => {
    const row = ev.target.closest("[data-dir-id]");
    if (!row) return;
    const id = row.getAttribute("data-dir-id");
    el.trackerInput.value = id;
    await syncTracker(id);
  });

  el.importUrlForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const targetUrl = el.importUrlInput.value.trim();
    if (!targetUrl) return;
    el.importUrlBtn.disabled = true;
    el.importUrlBtn.textContent = "Importing...";
    showToast("Resolving media stream & metadata...");
    try {
      const res = await apiJson("/api/discover/import-url", {
        method: "POST",
        body: JSON.stringify({
          url: targetUrl,
          enrichMusicBrainz: Boolean(el.importUrlMbCheck?.checked),
        }),
      });
      el.importUrlInput.value = "";
      el.syncModal.classList.add("hidden");
      if (res.isCollection && res.playlist) {
        rememberTracks(res.tracks || []);
        await Promise.all([refreshPlaylists(), refreshTrackers(), refreshActivity()]);
        showToast(`Imported "${res.playlist.name}" (${res.tracks?.length ?? 0} tracks)`, "success");
        await navigate({ view: "playlist", playlistId: res.playlist.id });
        if (res.tracks?.length) startQueueAndPlay(res.tracks, 0, res.playlist.name);
        return;
      }
      rememberTracks([res.track]);
      await Promise.all([refreshTrackers(), refreshActivity()]);
      showToast(`Imported "${res.track.title}" by ${res.track.artist}`, "success");
      await playTrack(res.track);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      el.importUrlBtn.disabled = false;
      el.importUrlBtn.textContent = "Import & Play";
    }
  });

  el.localScanForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const folderPath = el.localFolderInput.value.trim();
    if (!folderPath) return;
    el.localScanBtn.disabled = true;
    el.localScanBtn.textContent = "Scanning...";
    el.localScanStatus.classList.remove("hidden");
    el.localScanStatus.textContent = `Scanning "${folderPath}" with music-metadata...`;
    try {
      const res = await apiJson("/api/library/scan-local", {
        method: "POST",
        body: JSON.stringify({ folderPath }),
      });
      el.localScanStatus.textContent = `Indexed ${res.indexedTracks} audio files across ${res.albumsCount} album(s) in ${res.elapsedMs} ms.`;
      await Promise.all([refreshTrackers(), refreshActivity()]);
      showToast(`Scanned ${res.indexedTracks} local tracks!`, "success");
      if (res.indexedTracks > 0) {
        el.syncModal.classList.add("hidden");
        await navigate({ view: "artist", trackerId: "local_files" });
      }
    } catch (err) {
      el.localScanStatus.textContent = err.message;
      showToast(err.message, "error");
    } finally {
      el.localScanBtn.disabled = false;
      el.localScanBtn.textContent = "Scan Folder";
    }
  });

  el.spotifyFileInput?.addEventListener("change", async () => {
    const file = el.spotifyFileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    el.spotifyContentInput.value = text;
    if (!el.spotifyPlaylistNameInput.value.trim()) {
      el.spotifyPlaylistNameInput.value = file.name.replace(/\.(csv|json|txt)$/i, "").replace(/[_-]+/g, " ");
    }
  });

  el.spotifyImportForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const content = el.spotifyContentInput.value.trim();
    if (!content) return;
    el.spotifyImportBtn.disabled = true;
    el.spotifyImportBtn.textContent = "Matching & Importing...";
    el.spotifyImportStatus.classList.remove("hidden");
    el.spotifyImportStatus.textContent = "Matching Spotify tracks against local archive and online sources...";
    try {
      const res = await apiJson("/api/import/spotify", {
        method: "POST",
        body: JSON.stringify({
          content,
          playlistName: el.spotifyPlaylistNameInput.value.trim() || "Spotify Import",
          sourcePreference: el.spotifySourceSelect.value || "ytmusic",
          resolveOnline: true,
          createPlaylist: true,
        }),
      });
      el.spotifyImportStatus.textContent = `Imported ${res.tracksAdded}/${res.totalParsed} tracks (${res.matchedLocal} local, ${res.matchedOnline} online).`;
      await Promise.all([refreshAllCore()]);
      showToast(`Created "${res.playlist?.name || "Spotify Import"}" (${res.tracksAdded} tracks)`, "success");
      if (res.playlist?.id) {
        el.syncModal.classList.add("hidden");
        await navigate({ view: "playlist", playlistId: res.playlist.id });
      }
    } catch (err) {
      el.spotifyImportStatus.textContent = err.message;
      showToast(err.message, "error");
    } finally {
      el.spotifyImportBtn.disabled = false;
      el.spotifyImportBtn.textContent = "Migrate Playlist";
    }
  });

  // Cache / Settings Modal
  el.closeCacheBtn.addEventListener("click", () => el.cacheModal.classList.add("hidden"));
  el.cacheModal.addEventListener("click", (ev) => {
    if (ev.target === el.cacheModal) el.cacheModal.classList.add("hidden");
  });
  el.cacheModal.querySelectorAll(".cap-preset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mb = Number(btn.getAttribute("data-mb"));
      const data = await apiJson("/api/cache/config", {
        method: "POST",
        body: JSON.stringify({ maxCacheMb: mb }),
      });
      renderCacheModal(data.cache);
      await refreshCacheStats();
    });
  });
  el.customCapForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const mb = Number(el.customCapMbInput.value);
    if (!Number.isFinite(mb) || mb < 1) return;
    const data = await apiJson("/api/cache/config", {
      method: "POST",
      body: JSON.stringify({ maxCacheMb: mb }),
    });
    renderCacheModal(data.cache);
    await refreshCacheStats();
  });
  el.clearAllCacheBtn.addEventListener("click", async () => {
    const data = await apiJson("/api/cache", { method: "DELETE" });
    renderCacheModal(data.cache);
    await refreshCacheStats();
    refreshVisibleTrackRows();
  });
  el.cookiesBrowserSelect?.addEventListener("change", async () => {
    const val = el.cookiesBrowserSelect.value;
    try {
      await apiJson("/api/settings/media", {
        method: "POST",
        body: JSON.stringify({ cookiesBrowser: val }),
      });
      showToast(val ? `yt-dlp will use cookies from ${val}.` : "Disabled browser cookie extraction.", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });
  el.cacheEntriesList.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-del-cache]");
    if (!btn) return;
    const key = btn.getAttribute("data-del-cache");
    const data = await apiJson(`/api/cache/${encodeURIComponent(key)}`, { method: "DELETE" });
    renderCacheModal(data.cache);
    await refreshCacheStats();
    refreshVisibleTrackRows();
  });
  el.testResolveForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const url = el.testResolveInput.value.trim();
    if (!url) return;
    el.testResolveOutput.classList.remove("hidden");
    el.testResolveOutput.textContent = "Resolving...";
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      el.testResolveOutput.textContent = JSON.stringify(await res.json(), null, 2);
    } catch (err) {
      el.testResolveOutput.textContent = err.message;
    }
  });

  // Network & iPhone LAN access controls
  el.lanAccessToggle?.addEventListener("change", async () => {
    try {
      const res = await apiJson("/api/settings/network", {
        method: "POST",
        body: JSON.stringify({ allowLanAccess: Boolean(el.lanAccessToggle.checked) }),
      });
      renderNetworkSettings(res);
      showToast(
        res.needsRestart
          ? "Saved LAN setting — click Restart Server to apply."
          : res.allowLanAccess
            ? "iPhone / LAN access enabled."
            : "Restricted to localhost only.",
        "info"
      );
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  el.restartLanBtn?.addEventListener("click", async () => {
    try {
      await apiJson("/api/update/restart", { method: "POST", body: "{}" });
      if (el.lanStatusText) el.lanStatusText.textContent = "Restarting server...";
      setTimeout(() => location.reload(), 1800);
    } catch (err) {
      showToast(`Restart failed: ${err.message}`, "error");
    }
  });

  // GitHub auto-updater controls
  el.checkUpdateBtn.addEventListener("click", () => refreshUpdateStatus(false));

  el.applyUpdateBtn.addEventListener("click", async () => {
    el.applyUpdateBtn.disabled = true;
    el.applyUpdateBtn.textContent = "Pulling...";
    try {
      const res = await apiJson("/api/update/apply", { method: "POST", body: "{}" });
      el.applyUpdateBtn.classList.add("hidden");
      if (res.updated) {
        el.updateStatusText.textContent = `Updated ${res.previousCommit} → ${res.currentCommit}.`;
        if (res.needsServerRestart) {
          el.restartAppBtn.classList.remove("hidden");
        }
        showToast(`Pulled latest from GitHub (${res.previousCommit} → ${res.currentCommit}).`, "success");
      } else {
        el.updateStatusText.textContent = `Already up to date (${res.currentCommit}).`;
      }
    } catch (err) {
      el.updateStatusText.textContent = `Update failed: ${err.message}`;
    } finally {
      el.applyUpdateBtn.disabled = false;
      el.applyUpdateBtn.textContent = "Pull & Update";
    }
  });

  el.restartAppBtn.addEventListener("click", async () => {
    try {
      await apiJson("/api/update/restart", { method: "POST", body: "{}" });
      el.updateStatusText.textContent = "Restarting server...";
      setTimeout(() => location.reload(), 1800);
    } catch (err) {
      showToast(`Restart failed: ${err.message}`, "error");
    }
  });

  el.audioEl.addEventListener("pause", () => {
    if (pendingFrontendReload) {
      setTimeout(() => {
        if (el.audioEl.paused) location.reload();
      }, 600);
    }
  });

  // Close popovers on outside click
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("#notifPopover, #notifBellBtn")) el.notifPopover.classList.add("hidden");
    if (!ev.target.closest("#eqPopover, #eqToggleBtn")) el.eqPopover.classList.add("hidden");
    if (!ev.target.closest("#trackContextMenu, .row-more-btn, #artistMoreBtn")) {
      el.trackContextMenu.classList.add("hidden");
    }
  });

  // Keyboard Shortcuts
  document.addEventListener("keydown", (ev) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (ev.key === "/" && !typing) {
      ev.preventDefault();
      navigate({ view: "search" });
      el.searchInput.focus();
    } else if (ev.key === " " && !typing && el.audioEl.src) {
      ev.preventDefault();
      togglePlayPause();
    } else if (ev.key === "ArrowRight" && ev.shiftKey && !typing) {
      ev.preventDefault();
      playNextTrack(false);
    } else if (ev.key === "ArrowLeft" && ev.shiftKey && !typing) {
      ev.preventDefault();
      playPrevTrack();
    } else if ((ev.key === "m" || ev.key === "M") && !typing) {
      el.audioEl.muted = !el.audioEl.muted;
      updateVolumeUI();
    } else if ((ev.key === "l" || ev.key === "L") && !typing && state.playingTrack) {
      toggleLikeTrack(state.playingTrack.id);
    } else if ((ev.key === "f" || ev.key === "F") && !typing && state.playingTrack) {
      if (state.fsOpen) closeFullscreenPlayer();
      else openFullscreenPlayer();
    } else if (ev.key === "Escape") {
      if (state.fsOpen) closeFullscreenPlayer();
      closeDrawers();
      closeAllPopovers();
      closeMobileSidebar();
      el.syncModal.classList.add("hidden");
      el.cacheModal.classList.add("hidden");
      el.playlistModal.classList.add("hidden");
      el.addToPlaylistModal.classList.add("hidden");
      el.profileModal.classList.add("hidden");
    }
  });
}

/* ==================== GITHUB AUTO-UPDATER ==================== */
let bootCommit = null;
let pendingFrontendReload = false;

function renderNetworkSettings(data) {
  if (!data || !el.lanStatusText) return;
  if (el.lanAccessToggle) el.lanAccessToggle.checked = Boolean(data.allowLanAccess);
  if (el.restartLanBtn) el.restartLanBtn.classList.toggle("hidden", !data.needsRestart);

  const isListeningAll = data.boundHost === "0.0.0.0";
  if (data.allowLanAccess) {
    el.lanStatusText.textContent = isListeningAll
      ? `Enter one of these URLs into the VaultStream iPhone app (same Wi-Fi or Tailscale):`
      : `Enabled — click Restart Server to bind ${data.port} for iPhone access.`;
  } else {
    el.lanStatusText.textContent = "LAN access disabled (localhost only).";
  }

  if (el.lanUrlsList) {
    const urls = Array.isArray(data.interfaces) ? data.interfaces : [];
    if (!data.allowLanAccess || urls.length === 0) {
      el.lanUrlsList.innerHTML = `<span class="small muted">${data.allowLanAccess ? "No LAN IPv4 addresses detected." : ""}</span>`;
      return;
    }
    el.lanUrlsList.innerHTML = urls
      .map(
        (u) =>
          `<button type="button" class="pill-btn" data-copy-lan="${escapeHtml(u.url)}" title="${escapeHtml(u.name)}">${escapeHtml(u.url)} · Copy</button>`
      )
      .join("");
    el.lanUrlsList.querySelectorAll("[data-copy-lan]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const val = btn.getAttribute("data-copy-lan") || "";
        try {
          await navigator.clipboard.writeText(val);
          showToast(`Copied ${val} for iPhone app!`, "success");
        } catch {
          showToast(val, "info");
        }
      });
    });
  }
}

async function refreshNetworkSettings() {
  try {
    const data = await apiJson("/api/settings/network");
    renderNetworkSettings(data);
  } catch {
    if (el.lanStatusText) el.lanStatusText.textContent = "Network status unavailable.";
  }
}

async function refreshUpdateStatus(notifyToast = false) {
  try {
    const status = await apiJson("/api/update/status");
    if (!status.supported) {
      el.updateStatusText.textContent = status.reason || "Updates unavailable";
      el.applyUpdateBtn.classList.add("hidden");
      return;
    }
    const modeLabel = status.autoUpdateEnabled ? "Auto-update ON (20s)" : "Manual mode";
    if (status.behindCount > 0) {
      el.updateStatusText.textContent = `${modeLabel} · Pulling ${status.behindCount} new commit(s) (${status.localCommit} → ${status.remoteCommit})`;
      el.applyUpdateBtn.classList.remove("hidden");
      if (notifyToast) {
        showToast(
          `GitHub update detected (${status.behindCount} new commit${status.behindCount > 1 ? "s" : ""}) — auto-updating...`,
          "info"
        );
      }
    } else {
      el.updateStatusText.textContent = `${modeLabel} · Up to date (${status.localCommit || "main"})`;
      el.applyUpdateBtn.classList.add("hidden");
    }
  } catch {
    el.updateStatusText.textContent = "Could not reach GitHub";
  }
}

async function pollServerVersion() {
  try {
    const health = await apiJson("/api/health");
    if (!health.commit) return;
    if (!bootCommit) {
      bootCommit = health.commit;
      return;
    }
    if (health.commit !== bootCommit) {
      pendingFrontendReload = true;
      if (el.audioEl.paused || !el.audioEl.src) {
        showToast(`Updated from GitHub (${health.commit}) — refreshing...`, "success");
        setTimeout(() => location.reload(), 900);
      } else {
        showToast(`Updated from GitHub (${health.commit}) — will reload when playback pauses.`, "info");
      }
    }
  } catch {
    // ignore transient restart window while server swaps processes
  }
}

/* ==================== BOOTSTRAP ==================== */
(async function init() {
  el.audioEl.volume = state.volume;
  updateVolumeUI();
  renderEqSliders();
  bindEvents();
  await Promise.all([
    refreshAllCore(),
    pollServerVersion(),
    apiJson("/api/settings/media")
      .then((m) => {
        if (el.cookiesBrowserSelect) el.cookiesBrowserSelect.value = m.cookiesBrowser || "";
      })
      .catch(() => {}),
  ]);
  await navigate({ view: "home" });
  setInterval(() => void pollServerVersion(), 12000);
})();
