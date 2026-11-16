const state = {
  view: "home", // "home" | "search" | "library" | "lossless" | "cached"
  trackers: [],
  activeTrackerId: null,
  activeTabName: null,
  selectedEra: "",
  selectedHost: "",
  losslessOnly: false,
  playableOnly: true,
  cachedOnly: false,
  searchQuery: "",
  offset: 0,
  limit: 80,
  totalTracks: 0,
  tracks: [],
  homeTracks: [],
  eras: [],
  hosts: [],
  selectedTrack: null,
  playingTrack: null,
  playingLinkIndex: undefined,
  directoryArtists: [],
  cacheStats: null,
  isSeeking: false,
};

const ERA_GRADIENTS = [
  "linear-gradient(135deg, #2b2d42, #11131c)",
  "linear-gradient(135deg, #3a2342, #181020)",
  "linear-gradient(135deg, #43341b, #19140a)",
  "linear-gradient(135deg, #163a37, #0b1817)",
  "linear-gradient(135deg, #431c24, #1b0c10)",
  "linear-gradient(135deg, #1f3349, #0e1620)",
];

const el = {
  navItems: document.querySelectorAll(".nav-item[data-view]"),
  navSyncBtn: document.getElementById("navSyncBtn"),
  navCacheBtn: document.getElementById("navCacheBtn"),
  headerSyncBtn: document.getElementById("headerSyncBtn"),
  headerCacheBtn: document.getElementById("headerCacheBtn"),
  headerCacheLabel: document.getElementById("headerCacheLabel"),
  trackerSelect: document.getElementById("trackerSelect"),
  searchInput: document.getElementById("searchInput"),
  queryTimingBadge: document.getElementById("queryTimingBadge"),
  statusToast: document.getElementById("statusToast"),

  homeView: document.getElementById("homeView"),
  homeEmptyHero: document.getElementById("homeEmptyHero"),
  heroAddTrackerBtn: document.getElementById("heroAddTrackerBtn"),
  homeContent: document.getElementById("homeContent"),
  homeTracksHeading: document.getElementById("homeTracksHeading"),
  homeSeeAllBtn: document.getElementById("homeSeeAllBtn"),
  homeTrackList: document.getElementById("homeTrackList"),
  homeErasHeading: document.getElementById("homeErasHeading"),
  homeEraCount: document.getElementById("homeEraCount"),
  eraCardsGrid: document.getElementById("eraCardsGrid"),

  listView: document.getElementById("listView"),
  listHeading: document.getElementById("listHeading"),
  listSubheading: document.getElementById("listSubheading"),
  tabSelect: document.getElementById("tabSelect"),
  eraSelect: document.getElementById("eraSelect"),
  hostSelect: document.getElementById("hostSelect"),
  losslessFilterBtn: document.getElementById("losslessFilterBtn"),
  playableFilterBtn: document.getElementById("playableFilterBtn"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  searchTrackList: document.getElementById("searchTrackList"),
  listEmptyState: document.getElementById("listEmptyState"),
  paginationBar: document.getElementById("paginationBar"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageIndicator: document.getElementById("pageIndicator"),

  libraryView: document.getElementById("libraryView"),
  libSyncBtn: document.getElementById("libSyncBtn"),
  libraryTrackersGrid: document.getElementById("libraryTrackersGrid"),
  libraryTabsWrap: document.getElementById("libraryTabsWrap"),

  audioEl: document.getElementById("audioEl"),
  playerNowTrigger: document.getElementById("playerNowTrigger"),
  playerArt: document.getElementById("playerArt"),
  playerTitle: document.getElementById("playerTitle"),
  playerSubtitle: document.getElementById("playerSubtitle"),
  prevTrackBtn: document.getElementById("prevTrackBtn"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  nextTrackBtn: document.getElementById("nextTrackBtn"),
  seekSlider: document.getElementById("seekSlider"),
  currentTimeLabel: document.getElementById("currentTimeLabel"),
  durationLabel: document.getElementById("durationLabel"),
  playerCodecBadge: document.getElementById("playerCodecBadge"),
  playerInspectBtn: document.getElementById("playerInspectBtn"),
  muteBtn: document.getElementById("muteBtn"),
  volumeSlider: document.getElementById("volumeSlider"),

  inspectorBackdrop: document.getElementById("inspectorBackdrop"),
  inspectorDrawer: document.getElementById("inspectorDrawer"),
  inspectorContent: document.getElementById("inspectorContent"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),

  syncModal: document.getElementById("syncModal"),
  closeSyncModalBtn: document.getElementById("closeSyncModalBtn"),
  syncForm: document.getElementById("syncForm"),
  trackerInput: document.getElementById("trackerInput"),
  syncBtn: document.getElementById("syncBtn"),
  directorySearchInput: document.getElementById("directorySearchInput"),
  directoryList: document.getElementById("directoryList"),

  cacheModal: document.getElementById("cacheModal"),
  closeCacheBtn: document.getElementById("closeCacheBtn"),
  cacheUsedValue: document.getElementById("cacheUsedValue"),
  cacheCapValue: document.getElementById("cacheCapValue"),
  cacheCountValue: document.getElementById("cacheCountValue"),
  cacheProgressBar: document.getElementById("cacheProgressBar"),
  customCapForm: document.getElementById("customCapForm"),
  customCapMbInput: document.getElementById("customCapMbInput"),
  clearAllCacheBtn: document.getElementById("clearAllCacheBtn"),
  cacheEntriesList: document.getElementById("cacheEntriesList"),
  updateStatusText: document.getElementById("updateStatusText"),
  checkUpdateBtn: document.getElementById("checkUpdateBtn"),
  applyUpdateBtn: document.getElementById("applyUpdateBtn"),
  restartAppBtn: document.getElementById("restartAppBtn"),
  testResolveForm: document.getElementById("testResolveForm"),
  testResolveInput: document.getElementById("testResolveInput"),
  testResolveOutput: document.getElementById("testResolveOutput"),
};

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

function formatCodecShort(track) {
  if (track.audioMeta?.codec) {
    const sr = track.audioMeta.sampleRateHz
      ? ` ${(track.audioMeta.sampleRateHz / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : "";
    return `${track.audioMeta.codec}${sr}`;
  }
  return track.formatHint ? track.formatHint.toUpperCase() : "";
}

function formatCodecFull(track) {
  if (track.audioMeta?.codec) {
    const parts = [track.audioMeta.codec];
    if (track.audioMeta.sampleRateHz) {
      parts.push(`${(track.audioMeta.sampleRateHz / 1000).toFixed(1).replace(/\.0$/, "")} kHz`);
    }
    if (track.audioMeta.bitsPerSample) {
      parts.push(`${track.audioMeta.bitsPerSample}-bit`);
    }
    return parts.join(" · ");
  }
  return track.quality || track.formatHint?.toUpperCase() || "Unknown";
}

function monogram(title) {
  const clean = (title || "?").replace(/[^\p{L}\p{N}]/gu, "");
  return (clean.slice(0, 2) || "♪").toUpperCase();
}

function coverUrl(rawUrl, artist = "", era = "") {
  if (!rawUrl && (!artist || !era)) return "";
  const params = new URLSearchParams();
  if (rawUrl) params.set("url", rawUrl);
  if (artist) params.set("artist", artist);
  if (era) params.set("era", era);
  return `/api/image?${params.toString()}`;
}

function hashIdx(str, len) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % len;
}

let toastTimer = null;
function showToast(msg, kind = "info") {
  clearTimeout(toastTimer);
  el.statusToast.textContent = msg;
  el.statusToast.className = `status-toast ${kind === "error" ? "error" : kind === "success" ? "success" : ""}`;
  if (kind !== "error") {
    toastTimer = setTimeout(() => el.statusToast.classList.add("hidden"), 4500);
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

function setView(viewName) {
  state.view = viewName;
  el.navItems.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-view") === viewName);
  });

  if (viewName === "lossless") {
    state.losslessOnly = true;
    state.cachedOnly = false;
  } else if (viewName === "cached") {
    state.cachedOnly = true;
    state.losslessOnly = false;
  } else if (viewName === "search") {
    state.cachedOnly = false;
    state.losslessOnly = false;
  }

  el.homeView.classList.toggle("hidden", viewName !== "home");
  el.libraryView.classList.toggle("hidden", viewName !== "library");
  el.listView.classList.toggle(
    "hidden",
    viewName !== "search" && viewName !== "lossless" && viewName !== "cached"
  );

  if (viewName === "library") {
    renderLibraryView();
  } else if (viewName === "home") {
    loadHomeData();
  } else {
    state.offset = 0;
    loadTrackList();
  }
}

async function refreshTrackers() {
  const data = await apiJson("/api/trackers");
  state.trackers = data.trackers || [];
  if (!state.activeTrackerId && state.trackers.length > 0) {
    state.activeTrackerId = state.trackers[0].trackerId;
    state.activeTabName = state.trackers[0].currentTab;
  }
  renderTrackerSelect();
}

function renderTrackerSelect() {
  if (state.trackers.length === 0) {
    el.trackerSelect.classList.add("hidden");
    return;
  }
  el.trackerSelect.classList.remove("hidden");
  el.trackerSelect.innerHTML = state.trackers
    .map(
      (t) =>
        `<option value="${escapeHtml(t.trackerId)}">${escapeHtml(t.artistName)} (${t.trackCount})</option>`
    )
    .join("");
  if (state.activeTrackerId) {
    el.trackerSelect.value = state.activeTrackerId;
  }
}

async function syncTracker(input, tabMeta = {}) {
  el.syncBtn.disabled = true;
  el.syncBtn.textContent = "Syncing...";
  showToast(`Syncing tracker from ArtistGrid...`);
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
    state.selectedEra = "";
    state.offset = 0;
    el.syncModal.classList.add("hidden");
    showToast(
      `Synced ${result.tracker.artistName} (${result.tabSynced}): ${result.tracksSynced} tracks in ${result.elapsedMs} ms.`,
      "success"
    );
    await refreshTrackers();
    if (state.view === "library") renderLibraryView();
    else if (state.view === "home") await loadHomeData();
    else await loadTrackList();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    el.syncBtn.disabled = false;
    el.syncBtn.textContent = "Sync";
  }
}

function buildTrackRowHtml(tr) {
  const isPlaying = state.playingTrack?.id === tr.id;
  const isSelected = state.selectedTrack?.id === tr.id;
  const codec = formatCodecShort(tr);
  const isLossless =
    tr.audioMeta?.lossless ||
    /lossless|cdq|cd quality|flac|wav|alac/i.test(`${tr.quality} ${tr.formatHint ?? ""}`);

  let statusTag = "";
  if (tr.cacheStatus?.isComplete) {
    statusTag = `<span class="soft-tag lossless">Cached</span>`;
  } else if (tr.cacheStatus?.totalBytes) {
    const pct = Math.round((tr.cacheStatus.cachedBytes / tr.cacheStatus.totalBytes) * 100);
    statusTag = `<span class="soft-tag partial">${pct}%</span>`;
  } else if (codec) {
    statusTag = `<span class="soft-tag ${isLossless ? "lossless" : ""}">${escapeHtml(codec)}</span>`;
  } else if (isLossless) {
    statusTag = `<span class="soft-tag lossless">Lossless</span>`;
  }

  const subParts = [tr.artist, tr.era];
  if (tr.quality && !/not available/i.test(tr.quality)) subParts.push(tr.quality);
  if (tr.primaryHost !== "unknown") subParts.push(tr.primaryHost);

  return `
    <div class="track-item ${isPlaying ? "playing" : ""} ${isSelected ? "active" : ""}" data-track-id="${escapeHtml(tr.id)}">
      <button
        type="button"
        class="track-thumb"
        data-action="play"
        data-track-id="${escapeHtml(tr.id)}"
        ${tr.isPlayable ? "" : "disabled"}
        title="${tr.isPlayable ? "Play" : "No playable audio URL"}"
      >
        <span class="track-thumb-fallback">${escapeHtml(monogram(tr.title))}</span>
        ${
          tr.eraImage || (tr.artist && tr.era)
            ? `<img src="${escapeHtml(coverUrl(tr.eraImage, tr.artist, tr.era))}" alt="" loading="lazy" onerror="this.remove()" />`
            : ""
        }
        <span class="track-thumb-overlay">${isPlaying && !el.audioEl.paused ? "❚❚" : "▶"}</span>
      </button>

      <div class="track-item-main">
        <div class="track-item-title">${escapeHtml(tr.title)}${tr.credits ? ` <span class="muted" style="font-weight:400">${escapeHtml(tr.credits)}</span>` : ""}</div>
        <div class="track-item-sub">${escapeHtml(subParts.filter(Boolean).join(" · "))}</div>
      </div>

      <div class="track-item-badges">
        ${
          tr.isPlayable && !tr.cacheStatus?.isComplete
            ? `<button type="button" class="row-cache-btn" data-action="cache" data-track-id="${escapeHtml(tr.id)}">Save</button>`
            : ""
        }
        ${statusTag}
      </div>

      <button
        type="button"
        class="chevron-btn"
        data-action="inspect"
        data-track-id="${escapeHtml(tr.id)}"
        title="Inspect track details &amp; host links"
      >
        ›
      </button>
    </div>
  `;
}

async function loadHomeData() {
  if (state.trackers.length === 0) {
    el.homeEmptyHero.classList.remove("hidden");
    el.homeContent.classList.add("hidden");
    return;
  }
  el.homeEmptyHero.classList.add("hidden");
  el.homeContent.classList.remove("hidden");

  const activeTracker = state.trackers.find((t) => t.trackerId === state.activeTrackerId) || state.trackers[0];
  state.activeTrackerId = activeTracker.trackerId;
  state.activeTabName = state.activeTabName || activeTracker.currentTab;

  const params = new URLSearchParams({
    trackerId: state.activeTrackerId,
    tabName: state.activeTabName,
    playableOnly: "1",
    limit: "6",
  });
  const data = await apiJson(`/api/tracks?${params.toString()}`);
  state.homeTracks = data.tracks || [];
  state.eras = data.eras || [];

  el.homeTracksHeading.textContent = `${activeTracker.artistName} — Quick stream`;
  el.homeTrackList.innerHTML = state.homeTracks.length
    ? state.homeTracks.map(buildTrackRowHtml).join("")
    : `<div class="empty-inline">No playable tracks found in this tab.</div>`;

  // Render era cards directly from SQLite facets (includes eraImage across all eras)
  el.homeErasHeading.textContent = `Eras in ${activeTracker.artistName}`;
  el.homeEraCount.textContent = `${state.eras.length} eras`;

  el.eraCardsGrid.innerHTML = state.eras
    .map((e, idx) => {
      const img = coverUrl(e.eraImage || "", activeTracker.artistName, e.era);
      const bg = e.eraColor
        ? `background: linear-gradient(135deg, ${escapeHtml(e.eraColor)}, #111116)`
        : `background: ${ERA_GRADIENTS[idx % ERA_GRADIENTS.length]}`;
      return `
        <button type="button" class="era-card" style="${bg}" data-pick-era="${escapeHtml(e.era)}">
          ${img ? `<img class="era-card-bg" src="${escapeHtml(img)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
          <span class="era-card-scrim"></span>
          <span class="era-card-title">${escapeHtml(e.era)}</span>
          <span class="era-card-count">${e.count} tracks</span>
        </button>
      `;
    })
    .join("");
}

async function loadTrackList() {
  if (state.trackers.length === 0 && !state.cachedOnly) {
    el.searchTrackList.innerHTML = "";
    el.listEmptyState.classList.remove("hidden");
    return;
  }

  const params = new URLSearchParams();
  // When searching globally or viewing cached offline across trackers, keep tracker scoped if chosen unless empty
  if (state.activeTrackerId && !state.cachedOnly) params.set("trackerId", state.activeTrackerId);
  if (state.activeTabName && !state.cachedOnly) params.set("tabName", state.activeTabName);
  if (state.searchQuery.trim()) params.set("q", state.searchQuery.trim());
  if (state.selectedEra) params.set("era", state.selectedEra);
  if (state.selectedHost) params.set("host", state.selectedHost);
  if (state.losslessOnly) params.set("losslessOnly", "1");
  if (state.playableOnly && !state.cachedOnly) params.set("playableOnly", "1");
  if (state.cachedOnly) params.set("cachedOnly", "1");
  params.set("limit", String(state.limit));
  params.set("offset", String(state.offset));

  const data = await apiJson(`/api/tracks?${params.toString()}`);
  state.tracks = data.tracks || [];
  state.totalTracks = data.total || 0;
  state.eras = data.eras || [];
  state.hosts = data.hosts || [];

  if (state.searchQuery.trim()) {
    el.queryTimingBadge.textContent = `${state.totalTracks} · ${data.queryMs}ms`;
    el.queryTimingBadge.classList.remove("hidden");
  } else {
    el.queryTimingBadge.classList.add("hidden");
  }

  // Update headings
  if (state.view === "lossless") el.listHeading.textContent = "Lossless vault";
  else if (state.view === "cached") el.listHeading.textContent = "Cached offline";
  else if (state.selectedEra) el.listHeading.textContent = state.selectedEra;
  else if (state.searchQuery.trim()) el.listHeading.textContent = `Results for "${state.searchQuery.trim()}"`;
  else el.listHeading.textContent = "All tracks";

  el.listSubheading.textContent = `${state.totalTracks} tracks (${data.queryMs} ms)`;

  // Populate filter selects
  const activeTracker = state.trackers.find((t) => t.trackerId === state.activeTrackerId);
  if (activeTracker && activeTracker.tabs.length > 0 && !state.cachedOnly) {
    el.tabSelect.classList.remove("hidden");
    el.tabSelect.innerHTML = activeTracker.tabs
      .map((tab) => {
        const synced = activeTracker.syncedTabs.includes(tab.name);
        return `<option value="${escapeHtml(tab.name)}">${escapeHtml(tab.name)}${synced ? "" : " (sync)"}</option>`;
      })
      .join("");
    el.tabSelect.value = state.activeTabName || activeTracker.currentTab;
  } else {
    el.tabSelect.classList.add("hidden");
  }

  el.eraSelect.innerHTML =
    `<option value="">All eras</option>` +
    state.eras.map((e) => `<option value="${escapeHtml(e.era)}">${escapeHtml(e.era)} (${e.count})</option>`).join("");
  el.eraSelect.value = state.selectedEra;

  el.hostSelect.innerHTML =
    `<option value="">All hosts</option>` +
    state.hosts.map((h) => `<option value="${escapeHtml(h.host)}">${escapeHtml(h.host)} (${h.count})</option>`).join("");
  el.hostSelect.value = state.selectedHost;

  el.losslessFilterBtn.classList.toggle("active", state.losslessOnly);
  el.playableFilterBtn.classList.toggle("active", state.playableOnly);
  const hasFilters = Boolean(state.selectedEra || state.selectedHost || state.losslessOnly || state.searchQuery.trim());
  el.clearFiltersBtn.classList.toggle("hidden", !hasFilters);

  el.searchTrackList.innerHTML = state.tracks.map(buildTrackRowHtml).join("");
  el.listEmptyState.classList.toggle("hidden", state.tracks.length > 0);

  const showPages = state.totalTracks > state.limit;
  el.paginationBar.classList.toggle("hidden", !showPages);
  if (showPages) {
    const page = Math.floor(state.offset / state.limit) + 1;
    const totalPages = Math.ceil(state.totalTracks / state.limit);
    el.pageIndicator.textContent = `${page} / ${totalPages}`;
    el.prevPageBtn.disabled = state.offset <= 0;
    el.nextPageBtn.disabled = state.offset + state.limit >= state.totalTracks;
  }
}

function renderLibraryView() {
  if (state.trackers.length === 0) {
    el.libraryTrackersGrid.innerHTML = `<div class="muted">No trackers synced yet. Click "+ Add tracker" to sync from ArtistGrid.</div>`;
    el.libraryTabsWrap.innerHTML = "";
    return;
  }

  el.libraryTrackersGrid.innerHTML = state.trackers
    .map((t) => {
      const active = t.trackerId === state.activeTrackerId ? "active" : "";
      return `
        <div class="tracker-card ${active}" data-lib-tracker="${escapeHtml(t.trackerId)}">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <strong style="font-size:15px">${escapeHtml(t.artistName)}</strong>
            <button type="button" class="pill-action-btn danger-pill" data-del-tracker="${escapeHtml(t.trackerId)}">Remove</button>
          </div>
          <div class="muted small">${escapeHtml(t.name)}</div>
          <div class="small mono muted">${t.trackCount} tracks · ${t.playableCount} playable</div>
        </div>
      `;
    })
    .join("");

  const activeTracker = state.trackers.find((t) => t.trackerId === state.activeTrackerId) || state.trackers[0];
  el.libraryTabsWrap.innerHTML = (activeTracker?.tabs || [])
    .map((tab) => {
      const isSynced = activeTracker.syncedTabs.includes(tab.name);
      const isCurrent = tab.name === state.activeTabName;
      return `
        <button
          type="button"
          class="chip-btn ${isCurrent ? "active" : ""}"
          data-lib-tab-name="${escapeHtml(tab.name)}"
          data-lib-tab-gid="${escapeHtml(tab.gid)}"
          data-lib-tab-slug="${escapeHtml(tab.slug)}"
        >
          ${escapeHtml(tab.name)}${isSynced ? "" : " +"}
        </button>
      `;
    })
    .join("");
}

function openInspector(track) {
  if (!track) return;
  state.selectedTrack = track;
  renderInspectorContent(track);
  el.inspectorBackdrop.classList.remove("hidden");
  el.inspectorDrawer.classList.add("open");
  el.inspectorDrawer.setAttribute("aria-hidden", "false");
  refreshVisibleLists();
}

function closeInspector() {
  state.selectedTrack = null;
  el.inspectorBackdrop.classList.add("hidden");
  el.inspectorDrawer.classList.remove("open");
  el.inspectorDrawer.setAttribute("aria-hidden", "true");
  refreshVisibleLists();
}

function renderInspectorContent(track) {
  const isPlaying = state.playingTrack?.id === track.id && !el.audioEl.paused;
  const codecLine = formatCodecFull(track);
  const cacheInfo = track.cacheStatus
    ? `${formatBytes(track.cacheStatus.cachedBytes)} / ${formatBytes(track.cacheStatus.totalBytes)} (${track.cacheStatus.isComplete ? "100% cached" : "partial"})`
    : "Not cached in ./cache yet";

  el.inspectorContent.innerHTML = `
    <div class="inspector-hero">
      <div class="inspector-art">
        <span>${escapeHtml(monogram(track.title))}</span>
        ${
          track.eraImage || (track.artist && track.era)
            ? `<img src="${escapeHtml(coverUrl(track.eraImage, track.artist, track.era))}" alt="" onerror="this.remove()" />`
            : ""
        }
      </div>
      <div style="min-width:0">
        <div style="font-size:16px; font-weight:700; line-height:1.25">${escapeHtml(track.title)}</div>
        ${track.credits ? `<div class="muted small" style="margin-top:3px">${escapeHtml(track.credits)}</div>` : ""}
        <div class="small muted" style="margin-top:4px">${escapeHtml(track.artist)} · ${escapeHtml(track.era)}</div>
      </div>
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <button type="button" id="inspectorPlayBtn" class="btn btn-white" style="flex:1" ${track.isPlayable ? "" : "disabled"}>
        ${isPlaying ? "❚❚ Pause" : "▶ Play Stream"}
      </button>
      <button type="button" id="inspectorCacheBtn" class="btn btn-ghost" ${track.isPlayable ? "" : "disabled"}>
        ${track.cacheStatus?.isComplete ? "Cached ✓" : "Save Offline"}
      </button>
    </div>

    <div class="inspector-block">
      <div class="block-label">Audio &amp; Metadata</div>
      <div class="small">Quality / Codec: <strong>${escapeHtml(codecLine)}</strong></div>
      ${track.subEra && track.subEra !== "Default" ? `<div class="small muted">Category: ${escapeHtml(track.subEra)}</div>` : ""}
      ${track.trackLength ? `<div class="small muted">Length: ${escapeHtml(track.trackLength)}</div>` : ""}
      ${track.leakDate ? `<div class="small muted">Leak Date: ${escapeHtml(track.leakDate)}</div>` : ""}
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
                    ${
                      l.playable
                        ? `<button type="button" class="pill-action-btn" data-play-mirror="${idx}">Play</button>`
                        : ""
                    }
                    <a class="pill-action-btn" style="text-decoration:none" href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">Open</a>
                  </div>
                </div>
                <div class="mirror-url mono">${escapeHtml(l.url)}</div>
              </div>
            `
              )
              .join("")
      }
    </div>

    ${
      track.resolvedUrl
        ? `<div class="inspector-block">
             <div class="block-label">Resolved Direct Stream</div>
             <div class="mirror-url mono">${escapeHtml(track.resolvedUrl)}</div>
             <div class="small muted">
               ${escapeHtml(track.resolvedMime || "")}
               ${track.resolvedSize ? ` · ${formatBytes(track.resolvedSize)}` : ""}
               ${track.resolvedFilename ? ` · ${escapeHtml(track.resolvedFilename)}` : ""}
             </div>
           </div>`
        : ""
    }
  `;

  document.getElementById("inspectorPlayBtn")?.addEventListener("click", async () => {
    if (state.playingTrack?.id === track.id && el.audioEl.src) {
      if (el.audioEl.paused) await el.audioEl.play();
      else el.audioEl.pause();
      renderInspectorContent(track);
    } else {
      await playTrack(track);
    }
  });

  document.getElementById("inspectorCacheBtn")?.addEventListener("click", () => precacheTrack(track.id));
  el.inspectorContent.querySelectorAll("[data-play-mirror]").forEach((btn) => {
    btn.addEventListener("click", () => playTrack(track, Number(btn.getAttribute("data-play-mirror"))));
  });
}

function refreshVisibleLists() {
  if (state.view === "home" && state.homeTracks.length) {
    el.homeTrackList.innerHTML = state.homeTracks.map(buildTrackRowHtml).join("");
  } else if (state.view === "search" || state.view === "lossless" || state.view === "cached") {
    el.searchTrackList.innerHTML = state.tracks.map(buildTrackRowHtml).join("");
  }
}

async function playTrack(track, linkIndex = undefined) {
  if (!track || !track.isPlayable) return;
  hideToast();

  state.playingTrack = track;
  state.playingLinkIndex = linkIndex;

  el.playerTitle.textContent = track.title;
  el.playerSubtitle.textContent = `${track.artist} · ${track.era}`;
  const pArt = coverUrl(track.eraImage || "", track.artist, track.era);
  el.playerArt.innerHTML = `<span>${escapeHtml(monogram(track.title))}</span>` +
    (pArt
      ? `<img src="${escapeHtml(pArt)}" alt="" onerror="this.remove()" />`
      : "");
  el.playerCodecBadge.textContent = formatCodecShort(track) || track.primaryHost;
  el.playerCodecBadge.className = `stream-pill ${track.audioMeta?.lossless ? "lossless" : ""}`;
  el.playerInspectBtn.classList.remove("hidden");
  el.playPauseBtn.disabled = false;
  el.seekSlider.disabled = false;
  updateNavButtons();
  refreshVisibleLists();

  if (state.selectedTrack?.id === track.id) {
    renderInspectorContent(track);
  }

  const streamUrl =
    linkIndex !== undefined
      ? `/api/tracks/${encodeURIComponent(track.id)}/stream?linkIndex=${linkIndex}`
      : `/api/tracks/${encodeURIComponent(track.id)}/stream`;

  el.audioEl.src = streamUrl;
  try {
    await el.audioEl.play();
    el.playPauseBtn.textContent = "❚❚";
    setTimeout(async () => {
      await refreshCacheStats();
      const refreshed = await apiJson(`/api/tracks/${encodeURIComponent(track.id)}`).catch(() => null);
      if (refreshed?.track) {
        const idx = state.tracks.findIndex((t) => t.id === track.id);
        if (idx !== -1) state.tracks[idx] = refreshed.track;
        const hIdx = state.homeTracks.findIndex((t) => t.id === track.id);
        if (hIdx !== -1) state.homeTracks[hIdx] = refreshed.track;
        if (state.playingTrack?.id === track.id) {
          state.playingTrack = refreshed.track;
          const badge = formatCodecShort(refreshed.track);
          if (badge) el.playerCodecBadge.textContent = badge;
          el.playerCodecBadge.className = `stream-pill ${refreshed.track.audioMeta?.lossless ? "lossless" : ""}`;
        }
        if (state.selectedTrack?.id === track.id) {
          state.selectedTrack = refreshed.track;
          renderInspectorContent(refreshed.track);
        }
        refreshVisibleLists();
      }
    }, 900);
  } catch (err) {
    if (err.name === "AbortError") return;
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

function getQueue() {
  return state.view === "home" ? state.homeTracks : state.tracks;
}

function updateNavButtons() {
  const queue = getQueue();
  const idx = queue.findIndex((t) => t.id === state.playingTrack?.id);
  el.prevTrackBtn.disabled = idx <= 0;
  el.nextTrackBtn.disabled = idx === -1 || idx >= queue.length - 1;
}

async function precacheTrack(trackId) {
  showToast("Downloading lossless track to ./cache...");
  try {
    const data = await apiJson(`/api/tracks/${encodeURIComponent(trackId)}/cache`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    showToast(`Saved "${data.track?.title || trackId}" (${formatBytes(data.entry?.cachedBytes)}) to ./cache.`, "success");
    await refreshCacheStats();
    if (state.view === "home") await loadHomeData();
    else if (state.view !== "library") await loadTrackList();
    if (state.selectedTrack?.id === trackId && data.track) {
      state.selectedTrack = data.track;
      renderInspectorContent(data.track);
    }
  } catch (err) {
    showToast(`Save failed: ${err.message}`, "error");
  }
}

async function refreshCacheStats() {
  try {
    const stats = await apiJson("/api/cache");
    state.cacheStats = stats;
    el.headerCacheLabel.textContent = formatBytes(stats.totalCachedBytes);
    if (!el.cacheModal.classList.contains("hidden")) {
      renderCacheModal(stats);
    }
  } catch {
    // ignore transient poll error
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
        <div class="track-item" style="grid-template-columns: minmax(0,1fr) auto auto">
          <div class="track-item-main">
            <div class="track-item-title">${escapeHtml(label)}</div>
            <div class="track-item-sub">${escapeHtml(e.artist || e.sourceUrl)} · ${formatBytes(e.cachedBytes)} / ${formatBytes(e.totalBytes)} (${e.isComplete ? "100%" : `${pct ?? 0}%`})</div>
          </div>
          <span class="soft-tag ${e.audioMeta?.lossless ? "lossless" : ""}">${escapeHtml(e.audioMeta?.codec || e.mimeType || "audio")}</span>
          <button type="button" class="pill-action-btn danger-pill" data-del-cache="${escapeHtml(e.cacheKey)}">Delete</button>
        </div>
      `;
    })
    .join("");
}

async function openSyncModal() {
  el.syncModal.classList.remove("hidden");
  el.trackerInput.focus();
  if (state.directoryArtists.length === 0) {
    el.directoryList.innerHTML = `<div class="muted small">Loading ArtistGrid directory...</div>`;
    try {
      const data = await apiJson("/api/directory");
      state.directoryArtists = data.artists || [];
    } catch (err) {
      el.directoryList.innerHTML = `<div class="muted small">Failed to load directory: ${escapeHtml(err.message)}</div>`;
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

function handleListClick(ev) {
  const row = ev.target.closest("[data-track-id]");
  if (!row) return;
  const trackId = row.getAttribute("data-track-id");
  const track = [...state.tracks, ...state.homeTracks].find((t) => t.id === trackId);
  if (!track) return;

  const actionEl = ev.target.closest("[data-action]");
  const action = actionEl?.getAttribute("data-action");

  if (action === "play") {
    if (state.playingTrack?.id === track.id && el.audioEl.src) {
      if (el.audioEl.paused) el.audioEl.play();
      else el.audioEl.pause();
    } else {
      playTrack(track);
    }
    return;
  }

  if (action === "cache") {
    precacheTrack(track.id);
    return;
  }

  // Clicking row or `>` chevron reliably opens the Track Inspector!
  openInspector(track);
}

// Navigation & View Events
el.navItems.forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.getAttribute("data-view")));
});

el.navSyncBtn.addEventListener("click", openSyncModal);
el.headerSyncBtn.addEventListener("click", openSyncModal);
el.heroAddTrackerBtn.addEventListener("click", openSyncModal);
el.libSyncBtn.addEventListener("click", openSyncModal);
el.closeSyncModalBtn.addEventListener("click", () => el.syncModal.classList.add("hidden"));
el.syncModal.addEventListener("click", (ev) => {
  if (ev.target === el.syncModal) el.syncModal.classList.add("hidden");
});

el.navCacheBtn.addEventListener("click", async () => {
  el.cacheModal.classList.remove("hidden");
  await refreshCacheStats();
  if (state.cacheStats) renderCacheModal(state.cacheStats);
  void refreshUpdateStatus(false);
});
el.headerCacheBtn.addEventListener("click", async () => {
  el.cacheModal.classList.remove("hidden");
  await refreshCacheStats();
  if (state.cacheStats) renderCacheModal(state.cacheStats);
  void refreshUpdateStatus(false);
});
el.closeCacheBtn.addEventListener("click", () => el.cacheModal.classList.add("hidden"));
el.cacheModal.addEventListener("click", (ev) => {
  if (ev.target === el.cacheModal) el.cacheModal.classList.add("hidden");
});

el.trackerSelect.addEventListener("change", async () => {
  const id = el.trackerSelect.value;
  const t = state.trackers.find((x) => x.trackerId === id);
  if (!t) return;
  state.activeTrackerId = t.trackerId;
  state.activeTabName = t.currentTab;
  state.selectedEra = "";
  state.offset = 0;
  if (state.view === "home") await loadHomeData();
  else if (state.view === "library") renderLibraryView();
  else await loadTrackList();
});

let searchTimer = null;
el.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    state.searchQuery = el.searchInput.value;
    state.offset = 0;
    if (state.searchQuery.trim() && state.view === "home") {
      setView("search");
    } else if (state.view === "home") {
      await loadHomeData();
    } else if (state.view !== "library") {
      await loadTrackList();
    }
  }, 110);
});

el.homeSeeAllBtn.addEventListener("click", () => {
  state.selectedEra = "";
  setView("search");
});

el.eraCardsGrid.addEventListener("click", (ev) => {
  const card = ev.target.closest("[data-pick-era]");
  if (!card) return;
  state.selectedEra = card.getAttribute("data-pick-era");
  setView("search");
});

el.homeTrackList.addEventListener("click", handleListClick);
el.searchTrackList.addEventListener("click", handleListClick);

el.homeTrackList.addEventListener("dblclick", (ev) => {
  const row = ev.target.closest("[data-track-id]");
  const track = state.homeTracks.find((t) => t.id === row?.getAttribute("data-track-id"));
  if (track?.isPlayable) playTrack(track);
});

el.searchTrackList.addEventListener("dblclick", (ev) => {
  const row = ev.target.closest("[data-track-id]");
  const track = state.tracks.find((t) => t.id === row?.getAttribute("data-track-id"));
  if (track?.isPlayable) playTrack(track);
});

el.tabSelect.addEventListener("change", async () => {
  const tabName = el.tabSelect.value;
  const tracker = state.trackers.find((t) => t.trackerId === state.activeTrackerId);
  if (!tracker) return;
  if (tracker.syncedTabs.includes(tabName)) {
    state.activeTabName = tabName;
    state.selectedEra = "";
    state.offset = 0;
    await loadTrackList();
  } else {
    const tabMeta = tracker.tabs.find((x) => x.name === tabName);
    await syncTracker(tracker.trackerId, tabMeta || { name: tabName });
  }
});

el.eraSelect.addEventListener("change", async () => {
  state.selectedEra = el.eraSelect.value;
  state.offset = 0;
  await loadTrackList();
});

el.hostSelect.addEventListener("change", async () => {
  state.selectedHost = el.hostSelect.value;
  state.offset = 0;
  await loadTrackList();
});

el.losslessFilterBtn.addEventListener("click", async () => {
  state.losslessOnly = !state.losslessOnly;
  state.offset = 0;
  await loadTrackList();
});

el.playableFilterBtn.addEventListener("click", async () => {
  state.playableOnly = !state.playableOnly;
  state.offset = 0;
  await loadTrackList();
});

el.clearFiltersBtn.addEventListener("click", async () => {
  state.selectedEra = "";
  state.selectedHost = "";
  state.losslessOnly = false;
  state.searchQuery = "";
  el.searchInput.value = "";
  state.offset = 0;
  await loadTrackList();
});

el.prevPageBtn.addEventListener("click", async () => {
  state.offset = Math.max(0, state.offset - state.limit);
  await loadTrackList();
});

el.nextPageBtn.addEventListener("click", async () => {
  if (state.offset + state.limit < state.totalTracks) {
    state.offset += state.limit;
    await loadTrackList();
  }
});

el.libraryTrackersGrid.addEventListener("click", async (ev) => {
  const delBtn = ev.target.closest("[data-del-tracker]");
  if (delBtn) {
    ev.stopPropagation();
    const id = delBtn.getAttribute("data-del-tracker");
    await apiJson(`/api/trackers/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (state.activeTrackerId === id) {
      state.activeTrackerId = null;
      state.activeTabName = null;
    }
    await refreshTrackers();
    renderLibraryView();
    return;
  }
  const card = ev.target.closest("[data-lib-tracker]");
  if (!card) return;
  const id = card.getAttribute("data-lib-tracker");
  const t = state.trackers.find((x) => x.trackerId === id);
  if (!t) return;
  state.activeTrackerId = t.trackerId;
  state.activeTabName = t.currentTab;
  renderTrackerSelect();
  setView("home");
});

el.libraryTabsWrap.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-lib-tab-name]");
  if (!btn || !state.activeTrackerId) return;
  const name = btn.getAttribute("data-lib-tab-name");
  const gid = btn.getAttribute("data-lib-tab-gid");
  const slug = btn.getAttribute("data-lib-tab-slug");
  const tracker = state.trackers.find((t) => t.trackerId === state.activeTrackerId);
  if (tracker?.syncedTabs.includes(name)) {
    state.activeTabName = name;
    setView("search");
  } else {
    await syncTracker(state.activeTrackerId, { name, gid, slug });
  }
});

// Inspector Drawer Events
el.closeInspectorBtn.addEventListener("click", closeInspector);
el.inspectorBackdrop.addEventListener("click", closeInspector);
el.playerNowTrigger.addEventListener("click", () => {
  if (state.playingTrack) openInspector(state.playingTrack);
});
el.playerInspectBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  if (state.playingTrack) openInspector(state.playingTrack);
});

// Sync Form & Directory
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

// Cache Controls & Host Tester
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
  refreshVisibleLists();
});

el.cacheEntriesList.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-del-cache]");
  if (!btn) return;
  const key = btn.getAttribute("data-del-cache");
  const data = await apiJson(`/api/cache/${encodeURIComponent(key)}`, { method: "DELETE" });
  renderCacheModal(data.cache);
  await refreshCacheStats();
  refreshVisibleLists();
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

// Audio Player Transport
el.playPauseBtn.addEventListener("click", async () => {
  if (!el.audioEl.src) return;
  if (el.audioEl.paused) await el.audioEl.play();
  else el.audioEl.pause();
});

el.prevTrackBtn.addEventListener("click", () => {
  const q = getQueue();
  const idx = q.findIndex((t) => t.id === state.playingTrack?.id);
  for (let i = idx - 1; i >= 0; i--) {
    if (q[i].isPlayable) {
      playTrack(q[i]);
      break;
    }
  }
});

el.nextTrackBtn.addEventListener("click", () => {
  const q = getQueue();
  const idx = q.findIndex((t) => t.id === state.playingTrack?.id);
  for (let i = idx + 1; i < q.length; i++) {
    if (q[i].isPlayable) {
      playTrack(q[i]);
      break;
    }
  }
});

el.audioEl.addEventListener("play", () => {
  el.playPauseBtn.textContent = "❚❚";
  refreshVisibleLists();
  if (state.selectedTrack?.id === state.playingTrack?.id) {
    renderInspectorContent(state.selectedTrack);
  }
});

el.audioEl.addEventListener("pause", () => {
  el.playPauseBtn.textContent = "▶";
  refreshVisibleLists();
  if (state.selectedTrack?.id === state.playingTrack?.id) {
    renderInspectorContent(state.selectedTrack);
  }
});

el.audioEl.addEventListener("timeupdate", () => {
  if (state.isSeeking) return;
  const cur = el.audioEl.currentTime || 0;
  const dur = el.audioEl.duration;
  el.currentTimeLabel.textContent = formatTime(cur);
  if (Number.isFinite(dur) && dur > 0) {
    el.durationLabel.textContent = formatTime(dur);
    el.seekSlider.value = String(Math.round((cur / dur) * 1000));
  }
});

el.audioEl.addEventListener("ended", async () => {
  await refreshCacheStats();
  el.nextTrackBtn.click();
});

el.audioEl.addEventListener("error", () => {
  if (!state.playingTrack) return;
  showToast(
    `Could not decode/play "${state.playingTrack.title}" (link may be rate-limited, offline, or unsupported codec in this browser).`,
    "error"
  );
});

el.seekSlider.addEventListener("input", () => {
  state.isSeeking = true;
  const dur = el.audioEl.duration;
  if (Number.isFinite(dur) && dur > 0) {
    el.currentTimeLabel.textContent = formatTime((Number(el.seekSlider.value) / 1000) * dur);
  }
});

el.seekSlider.addEventListener("change", () => {
  const dur = el.audioEl.duration;
  if (Number.isFinite(dur) && dur > 0) {
    el.audioEl.currentTime = (Number(el.seekSlider.value) / 1000) * dur;
  }
  state.isSeeking = false;
});

el.volumeSlider.addEventListener("input", () => {
  el.audioEl.volume = Number(el.volumeSlider.value);
  el.audioEl.muted = false;
  el.muteBtn.textContent = el.audioEl.volume === 0 ? "🔇" : "🔊";
});

el.muteBtn.addEventListener("click", () => {
  el.audioEl.muted = !el.audioEl.muted;
  el.muteBtn.textContent = el.audioEl.muted ? "🔇" : "🔊";
});

// Keyboard Shortcuts
document.addEventListener("keydown", (ev) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if (ev.key === "/" && !typing) {
    ev.preventDefault();
    el.searchInput.focus();
  } else if (ev.key === " " && !typing && el.audioEl.src) {
    ev.preventDefault();
    if (el.audioEl.paused) el.audioEl.play();
    else el.audioEl.pause();
  } else if (ev.key === "Escape") {
    closeInspector();
    el.syncModal.classList.add("hidden");
    el.cacheModal.classList.add("hidden");
  }
});

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
        showToast(`GitHub update detected (${status.behindCount} new commit${status.behindCount > 1 ? "s" : ""}) — auto-updating...`, "info");
      }
    } else {
      el.updateStatusText.textContent = `${modeLabel} · Up to date (${status.localCommit || "main"})`;
      el.applyUpdateBtn.classList.add("hidden");
    }
  } catch {
    el.updateStatusText.textContent = "Could not reach GitHub";
  }
}

let bootCommit = null;
let pendingFrontendReload = false;

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

el.audioEl.addEventListener("pause", () => {
  if (pendingFrontendReload) {
    setTimeout(() => {
      if (el.audioEl.paused) location.reload();
    }, 600);
  }
});

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

// Bootstrap
(async function init() {
  el.audioEl.volume = Number(el.volumeSlider.value);
  await Promise.all([refreshTrackers(), refreshCacheStats(), pollServerVersion()]);
  await loadHomeData();
  setInterval(() => void pollServerVersion(), 12000);
})();
