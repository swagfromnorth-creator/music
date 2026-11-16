import Foundation

private struct VaultLibrarySnapshot: Codable {
    var trackers: [TrackerRecord]
    var tracks: [String: TrackRecord]
    var playlists: [PlaylistRecord]
    var playlistTrackIds: [String: [String]]
    var likedIds: [String]
    var history: [PlayHistoryItem]
}

@MainActor
final class LibraryStore: ObservableObject {
    static let shared = LibraryStore()

    @Published private(set) var trackers: [TrackerRecord] = []
    @Published private(set) var tracksById: [String: TrackRecord] = [:]
    @Published private(set) var playlists: [PlaylistRecord] = []
    @Published private(set) var playlistTrackIds: [String: [String]] = [:]
    @Published private(set) var likedIds: Set<String> = []
    @Published private(set) var likedOrder: [String] = []
    @Published private(set) var recentHistory: [PlayHistoryItem] = []
    @Published var directoryArtists: [DirectoryArtist] = []
    @Published var isLoading = false
    @Published var toastMessage: String?

    private let storeFileURL: URL
    private let playlistGradients = [
        "linear-gradient(135deg, #6d28d9, #10b981)",
        "linear-gradient(135deg, #0284c7, #7c3aed)",
        "linear-gradient(135deg, #db2777, #f59e0b)",
        "linear-gradient(135deg, #059669, #0ea5e9)",
        "linear-gradient(135deg, #4f46e5, #ec4899)",
    ]

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let folder = appSupport.appendingPathComponent("VaultStream", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        self.storeFileURL = folder.appendingPathComponent("vault_library.json")
        loadSnapshot()
    }

    func showToast(_ message: String) {
        toastMessage = message
        Task {
            try? await Task.sleep(nanoseconds: 2_800_000_000)
            if toastMessage == message {
                toastMessage = nil
            }
        }
    }

    // MARK: - Computed Library Slices

    var allTracks: [TrackRecord] {
        Array(tracksById.values).sorted {
            if $0.eraOrder != $1.eraOrder { return $0.eraOrder < $1.eraOrder }
            return $0.trackOrder < $1.trackOrder
        }
    }

    var likedTracks: [TrackRecord] {
        likedOrder.compactMap { tracksById[$0] }
    }

    var losslessTracks: [TrackRecord] {
        allTracks.filter { !$0.unavailableFlag && $0.isLossless }
    }

    var unavailableTracks: [TrackRecord] {
        allTracks.filter { $0.unavailableFlag }
    }

    func playlistTracks(for playlistId: String) -> [TrackRecord] {
        let ids = playlistTrackIds[playlistId] ?? []
        return ids.compactMap { tracksById[$0] }
    }

    func searchTracks(
        trackerId: String? = nil,
        tabName: String? = nil,
        query: String? = nil,
        era: String? = nil,
        losslessOnly: Bool = false
    ) -> (tracks: [TrackRecord], eras: [EraFacet]) {
        let cleanQ = (query ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        var pool = allTracks
        if let trackerId, !trackerId.isEmpty {
            pool = pool.filter { $0.trackerId == trackerId }
        }
        if let tabName, !tabName.isEmpty {
            if tabName.caseInsensitiveCompare("Unavailable") == .orderedSame {
                pool = pool.filter { $0.unavailableFlag }
            } else {
                pool = pool.filter { $0.tabName.caseInsensitiveCompare(tabName) == .orderedSame && !$0.unavailableFlag }
            }
        }

        // Build Era facets before applying era/text filter
        var eraCounts: [String: (count: Int, color: String?, image: String?)] = [:]
        for tr in pool where !tr.era.isEmpty {
            let cur = eraCounts[tr.era] ?? (0, tr.eraColor, tr.eraImage)
            eraCounts[tr.era] = (cur.count + 1, cur.color ?? tr.eraColor, cur.image ?? tr.eraImage)
        }
        let eras = eraCounts.map { EraFacet(era: $0.key, count: $0.value.count, eraColor: $0.value.color, eraImage: $0.value.image) }
            .sorted { $0.count > $1.count }

        if let era, !era.isEmpty {
            pool = pool.filter { $0.era == era }
        }
        if losslessOnly {
            pool = pool.filter { $0.isLossless }
        }
        if !cleanQ.isEmpty {
            pool = pool.filter {
                $0.title.lowercased().contains(cleanQ) ||
                $0.artist.lowercased().contains(cleanQ) ||
                $0.era.lowercased().contains(cleanQ) ||
                $0.notes.lowercased().contains(cleanQ)
            }
        }
        return (pool, eras)
    }

    // MARK: - ArtistGrid Sync & Directory

    func loadDirectoryIfNeeded() async {
        guard directoryArtists.isEmpty else { return }
        if let list = try? await ArtistGridService.shared.fetchDirectory() {
            directoryArtists = list
        }
    }

    func syncArtistGridTracker(input: String, tabGid: String? = nil, tabSlug: String? = nil, tabName: String? = nil) async throws -> TrackerRecord {
        isLoading = true
        defer { isLoading = false }

        let (tracker, syncedTracks) = try await ArtistGridService.shared.syncTracker(
            input: input,
            tabGid: tabGid,
            tabSlug: tabSlug,
            tabName: tabName
        )

        for tr in syncedTracks {
            var updated = tr
            if let existing = tracksById[tr.id] {
                updated.isLiked = existing.isLiked
                updated.playCount = existing.playCount
                updated.isUnavailable = existing.isUnavailable ?? tr.isUnavailable
            }
            tracksById[tr.id] = updated
        }

        if let idx = trackers.firstIndex(where: { $0.trackerId == tracker.trackerId }) {
            var merged = tracker
            merged.syncedTabs = Array(Set(trackers[idx].syncedTabs + tracker.syncedTabs))
            merged.isFollowed = trackers[idx].isFollowed
            trackers[idx] = merged
        } else {
            trackers.insert(tracker, at: 0)
        }

        recomputeTrackerStats(trackerId: tracker.trackerId)
        saveSnapshot()
        return trackers.first(where: { $0.trackerId == tracker.trackerId }) ?? tracker
    }

    func deleteTracker(id: String) {
        trackers.removeAll { $0.trackerId == id }
        let removedIds = tracksById.values.filter { $0.trackerId == id }.map { $0.id }
        for tid in removedIds {
            tracksById.removeValue(forKey: tid)
        }
        saveSnapshot()
    }

    func toggleFollow(trackerId: String) {
        if let idx = trackers.firstIndex(where: { $0.trackerId == trackerId }) {
            trackers[idx].isFollowed = !(trackers[idx].isFollowed ?? false)
            saveSnapshot()
        }
    }

    // MARK: - Importing Online Tracks & Collections (Standalone!)

    @discardableResult
    func upsertOnlineTrack(
        sourceUrl: String,
        title: String,
        artist: String,
        album: String? = nil,
        thumbnail: String? = nil,
        durationSec: Double? = nil,
        host: String? = nil,
        trackerId: String = "imported_web",
        trackerName: String = "Saved & Streamed",
        tabName: String = "Saved"
    ) -> TrackRecord {
        let normUrl = HostResolverService.normalizeUrl(sourceUrl)
        let detectedHost = host ?? HostResolverService.detectHost(normUrl)
        let dedupeKey = ArtistGridService.songDedupeKey(title: title, artist: artist)
        let verKey = ArtistGridService.versionKey(title)

        // Reuse/merge existing track if same song + same version exists in library
        if let existing = tracksById.values.first(where: {
            ArtistGridService.songDedupeKey(title: $0.title, artist: $0.artist) == dedupeKey &&
            ArtistGridService.versionKey($0.title) == verKey
        }) {
            var merged = existing
            if !merged.links.contains(where: { $0.url == normUrl }) {
                merged.links.append(TrackLink(url: normUrl, host: detectedHost, playable: true, formatHint: HostResolverService.extractExtension(normUrl)))
                merged.links.sort { HostResolverService.hostPriority($0.host) > HostResolverService.hostPriority($1.host) }
                merged.primaryUrl = merged.links.first?.url ?? normUrl
                merged.primaryHost = merged.links.first?.host ?? detectedHost
            }
            if merged.eraImage == nil, let thumbnail { merged.eraImage = thumbnail }
            merged.isUnavailable = false
            tracksById[merged.id] = merged
            saveSnapshot()
            return merged
        }

        let id = "tr_" + HashHelper.shortSHA256("\(normUrl)\0\(title)")
        let durText = durationSec.map { Formatters.duration($0) }
        let record = TrackRecord(
            id: id,
            trackerId: trackerId,
            tabName: tabName,
            title: title,
            artist: artist.isEmpty ? "Unknown Artist" : artist,
            era: album ?? "",
            eraImage: thumbnail,
            quality: detectedHost == "soundcloud" || detectedHost == "youtube" ? "Online Stream" : "",
            formatHint: HostResolverService.extractExtension(normUrl),
            trackLength: durText,
            primaryUrl: normUrl,
            primaryHost: detectedHost,
            links: [TrackLink(url: normUrl, host: detectedHost, playable: true, formatHint: HostResolverService.extractExtension(normUrl))],
            isPlayable: true,
            isUnavailable: false,
            audioMeta: durationSec.map { AudioHeaderInfo(codec: nil, sampleRateHz: nil, bitsPerSample: nil, channels: nil, durationSec: $0, lossless: false) }
        )
        tracksById[id] = record
        ensureBucketTracker(id: trackerId, name: trackerName, artistName: trackerName, cover: thumbnail)
        saveSnapshot()
        return record
    }

    func importUrl(_ rawUrl: String, title: String? = nil, artist: String? = nil, album: String? = nil, thumbnail: String? = nil, enrichMB: Bool = true) async throws -> (playlist: PlaylistRecord?, tracks: [TrackRecord]) {
        let url = rawUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else {
            throw NSError(domain: "VaultStream", code: 400, userInfo: [NSLocalizedDescriptionKey: "Paste a valid URL first."])
        }

        // Collection detection (YouTube Music Album / YouTube Playlist / SoundCloud Set)
        if Self.isCollectionUrl(url) {
            let col = try await fetchCollectionFromUrl(url)
            var saved: [TrackRecord] = []
            for item in col.tracks {
                saved.append(upsertOnlineTrack(
                    sourceUrl: item.url,
                    title: item.title,
                    artist: item.artist,
                    album: item.album ?? col.title,
                    thumbnail: item.thumbnail ?? col.thumbnail,
                    durationSec: item.durationSec,
                    host: item.source == "soundcloud" ? "soundcloud" : "youtube"
                ))
            }
            let pl = createPlaylist(name: col.title, description: "\(saved.count) tracks • \(col.artist)", coverImage: col.thumbnail)
            for tr in saved { _ = addTrack(tr, toPlaylist: pl.id) }
            return (playlists.first(where: { $0.id == pl.id }), saved)
        }

        let res = await HostResolverService.shared.resolve(url: url)
        guard res.ok else {
            throw NSError(domain: "VaultStream", code: 422, userInfo: [NSLocalizedDescriptionKey: res.errorMessage ?? "Could not extract stream from URL."])
        }

        let cleaned = MetadataService.cleanTitleAndArtist(
            rawTitle: title ?? res.title ?? res.filename ?? url,
            rawArtist: artist ?? res.artist ?? ""
        )
        var finalTitle = cleaned.title
        var finalArtist = cleaned.artist
        var finalAlbum = album ?? res.album
        var finalThumb = thumbnail ?? res.thumbnail

        if enrichMB, let mb = await MetadataService.shared.lookupMusicBrainz(title: finalTitle, artist: finalArtist) {
            finalTitle = mb.title
            finalArtist = mb.artist
            finalAlbum = mb.album ?? finalAlbum
            finalThumb = mb.coverArtUrl ?? finalThumb
        }

        let saved = upsertOnlineTrack(
            sourceUrl: url,
            title: finalTitle,
            artist: finalArtist.isEmpty ? "Unknown Artist" : finalArtist,
            album: finalAlbum,
            thumbnail: finalThumb,
            durationSec: res.durationSec,
            host: res.host
        )
        return (nil, [saved])
    }

    func importCollection(_ collection: OnlineCollectionResult, savePlaylist: Bool = true) async throws -> (playlist: PlaylistRecord?, tracks: [TrackRecord]) {
        let fetched: (title: String, artist: String, thumbnail: String?, tracks: [OnlineSearchResult])
        if collection.source == "soundcloud" {
            fetched = try await SoundCloudService.shared.fetchPlaylist(url: collection.url)
        } else {
            fetched = try await YouTubeService.shared.fetchCollection(
                idOrUrl: collection.browseId.isEmpty ? collection.url : collection.browseId,
                titleHint: collection.title,
                artistHint: collection.artist,
                thumbHint: collection.thumbnail
            )
        }

        var saved: [TrackRecord] = []
        for item in fetched.tracks {
            saved.append(upsertOnlineTrack(
                sourceUrl: item.url,
                title: item.title,
                artist: item.artist,
                album: item.album ?? fetched.title,
                thumbnail: item.thumbnail ?? fetched.thumbnail,
                durationSec: item.durationSec,
                host: item.source == "soundcloud" ? "soundcloud" : "youtube"
            ))
        }

        var createdPlaylist: PlaylistRecord?
        if savePlaylist && !saved.isEmpty {
            let pl = createPlaylist(name: fetched.title, description: "\(saved.count) tracks • \(fetched.artist)", coverImage: fetched.thumbnail)
            for tr in saved { _ = addTrack(tr, toPlaylist: pl.id) }
            createdPlaylist = playlists.first(where: { $0.id == pl.id })
        }
        return (createdPlaylist, saved)
    }

    func importSpotify(name: String, content: String) async -> (playlist: PlaylistRecord?, matched: Int, total: Int) {
        let items = MetadataService.parseSpotifyInput(content)
        guard !items.isEmpty else { return (nil, 0, 0) }

        var matchedTracks: [TrackRecord] = []
        for item in items.prefix(40) {
            let localKey = ArtistGridService.songDedupeKey(title: item.title, artist: item.artist)
            if let existing = tracksById.values.first(where: { ArtistGridService.songDedupeKey(title: $0.title, artist: $0.artist) == localKey }) {
                matchedTracks.append(existing)
                continue
            }

            let q = item.artist.isEmpty ? item.title : "\(item.artist) \(item.title)"
            if let ytm = try? await YouTubeService.shared.searchYouTubeMusic(query: q, limit: 3), let hit = ytm.tracks.first {
                matchedTracks.append(upsertOnlineTrack(
                    sourceUrl: hit.url,
                    title: item.title,
                    artist: item.artist.isEmpty ? hit.artist : item.artist,
                    album: item.album ?? hit.album,
                    thumbnail: hit.thumbnail,
                    durationSec: hit.durationSec,
                    host: "youtube",
                    trackerId: "spotify_imports",
                    trackerName: "Spotify Migrations",
                    tabName: name
                ))
            }
        }

        let pl = createPlaylist(name: name, description: "Migrated \(matchedTracks.count)/\(items.count) tracks")
        for tr in matchedTracks { _ = addTrack(tr, toPlaylist: pl.id) }
        return (playlists.first(where: { $0.id == pl.id }), matchedTracks.count, items.count)
    }

    func enrichTrackWithMusicBrainz(_ trackId: String) async -> TrackRecord? {
        guard var tr = tracksById[trackId],
              let mb = await MetadataService.shared.lookupMusicBrainz(title: tr.title, artist: tr.artist) else {
            return nil
        }
        tr.title = mb.title
        tr.artist = mb.artist
        if let album = mb.album, !album.isEmpty { tr.era = album }
        if let cover = mb.coverArtUrl { tr.eraImage = cover }
        tracksById[trackId] = tr
        saveSnapshot()
        return tr
    }

    func enrichBatchMusicBrainz() async -> Int {
        let candidates = allTracks.filter { $0.eraImage == nil }.prefix(12)
        var count = 0
        for tr in candidates {
            if await enrichTrackWithMusicBrainz(tr.id) != nil {
                count += 1
            }
        }
        return count
    }

    // MARK: - Playlists, Likes & History

    @discardableResult
    func createPlaylist(name: String, description: String = "", coverImage: String? = nil) -> PlaylistRecord {
        let now = Date().timeIntervalSince1970 * 1000
        let grad = playlistGradients[playlists.count % playlistGradients.count]
        let pl = PlaylistRecord(
            id: "pl_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(12),
            name: name,
            description: description,
            coverGradient: grad,
            coverImage: coverImage,
            trackCount: 0,
            previewImages: [],
            createdAt: now,
            updatedAt: now
        )
        playlists.insert(pl, at: 0)
        playlistTrackIds[pl.id] = []
        saveSnapshot()
        return pl
    }

    func deletePlaylist(id: String) {
        playlists.removeAll { $0.id == id }
        playlistTrackIds.removeValue(forKey: id)
        saveSnapshot()
    }

    func addTrack(_ track: TrackRecord, toPlaylist playlistId: String) -> Bool {
        tracksById[track.id] = track
        var ids = playlistTrackIds[playlistId] ?? []
        if ids.contains(track.id) { return false }

        // Block duplicate same song + same version, while allowing distinct versions (e.g. [V2] / Acoustic)
        let targetKey = ArtistGridService.songDedupeKey(title: track.title, artist: track.artist)
        let targetVer = ArtistGridService.versionKey(track.title)
        let hasDupe = ids.compactMap { tracksById[$0] }.contains {
            ArtistGridService.songDedupeKey(title: $0.title, artist: $0.artist) == targetKey &&
            ArtistGridService.versionKey($0.title) == targetVer
        }
        if hasDupe { return false }

        ids.append(track.id)
        playlistTrackIds[playlistId] = ids
        refreshPlaylistMetadata(playlistId)
        saveSnapshot()
        return true
    }

    func removeTrack(_ trackId: String, fromPlaylist playlistId: String) {
        playlistTrackIds[playlistId]?.removeAll { $0 == trackId }
        refreshPlaylistMetadata(playlistId)
        saveSnapshot()
    }

    func toggleLike(track: TrackRecord) {
        tracksById[track.id] = track
        if likedIds.contains(track.id) {
            likedIds.remove(track.id)
            likedOrder.removeAll { $0 == track.id }
            tracksById[track.id]?.isLiked = false
        } else {
            likedIds.insert(track.id)
            likedOrder.removeAll { $0 == track.id }
            likedOrder.insert(track.id, at: 0)
            tracksById[track.id]?.isLiked = true
        }
        saveSnapshot()
    }

    func recordPlay(track: TrackRecord) {
        var updated = tracksById[track.id] ?? track
        updated.playCount = (updated.playCount ?? 0) + 1
        tracksById[track.id] = updated

        let entry = PlayHistoryItem(
            id: UUID().uuidString,
            trackId: track.id,
            playedAt: Date().timeIntervalSince1970 * 1000,
            track: updated
        )
        recentHistory.insert(entry, at: 0)
        if recentHistory.count > 40 {
            recentHistory = Array(recentHistory.prefix(40))
        }
        saveSnapshot()
    }

    func setTrackAvailability(_ trackId: String, unavailable: Bool) {
        guard var tr = tracksById[trackId] else { return }
        tr.isUnavailable = unavailable
        tracksById[trackId] = tr
        recomputeTrackerStats(trackerId: tr.trackerId)
        saveSnapshot()
    }

    // MARK: - Internal Helpers & Persistence

    private func fetchCollectionFromUrl(_ url: String) async throws -> (title: String, artist: String, thumbnail: String?, tracks: [OnlineSearchResult]) {
        if url.lowercased().contains("soundcloud.com") {
            return try await SoundCloudService.shared.fetchPlaylist(url: url)
        }
        return try await YouTubeService.shared.fetchCollection(idOrUrl: url)
    }

    static func isCollectionUrl(_ url: String) -> Bool {
        let lower = url.lowercased()
        return lower.contains("/browse/mpreb_")
            || lower.contains("list=")
            || (lower.contains("soundcloud.com") && lower.contains("/sets/"))
    }

    private func ensureBucketTracker(id: String, name: String, artistName: String, cover: String?) {
        if trackers.contains(where: { $0.trackerId == id }) {
            recomputeTrackerStats(trackerId: id)
            return
        }
        let tr = TrackerRecord(
            trackerId: id,
            name: name,
            artistName: artistName,
            currentTab: "Saved",
            tabs: [TrackerTabMeta(gid: nil, name: "Saved", slug: "saved")],
            syncedTabs: ["Saved"],
            trackCount: 1,
            playableCount: 1,
            isFollowed: true,
            coverImage: cover
        )
        trackers.append(tr)
    }

    private func recomputeTrackerStats(trackerId: String) {
        guard let idx = trackers.firstIndex(where: { $0.trackerId == trackerId }) else { return }
        let items = tracksById.values.filter { $0.trackerId == trackerId }
        trackers[idx].trackCount = items.count
        trackers[idx].playableCount = items.filter { !$0.unavailableFlag }.count
        if trackers[idx].coverImage == nil {
            trackers[idx].coverImage = items.first(where: { $0.eraImage != nil })?.eraImage
        }
    }

    private func refreshPlaylistMetadata(_ playlistId: String) {
        guard let idx = playlists.firstIndex(where: { $0.id == playlistId }) else { return }
        let items = playlistTracks(for: playlistId)
        playlists[idx].trackCount = items.count
        playlists[idx].previewImages = Array(items.compactMap { $0.eraImage }.prefix(4))
        playlists[idx].updatedAt = Date().timeIntervalSince1970 * 1000
    }

    private func loadSnapshot() {
        guard let data = try? Data(contentsOf: storeFileURL),
              let snap = try? JSONDecoder().decode(VaultLibrarySnapshot.self, from: data) else {
            return
        }
        trackers = snap.trackers
        tracksById = snap.tracks
        playlists = snap.playlists
        playlistTrackIds = snap.playlistTrackIds
        likedOrder = snap.likedIds
        likedIds = Set(snap.likedIds)
        recentHistory = snap.history
    }

    private func saveSnapshot() {
        let snap = VaultLibrarySnapshot(
            trackers: trackers,
            tracks: tracksById,
            playlists: playlists,
            playlistTrackIds: playlistTrackIds,
            likedIds: likedOrder,
            history: recentHistory
        )
        guard let data = try? JSONEncoder().encode(snap) else { return }
        try? data.write(to: storeFileURL, options: [.atomic])
    }
}
