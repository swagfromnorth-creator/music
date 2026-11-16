import Foundation

@MainActor
final class LibraryStore: ObservableObject {
    static let shared = LibraryStore()

    @Published var isConnected = false
    @Published var isLoading = false
    @Published var serverCommit: String?
    @Published var connectionError: String?

    @Published var trackers: [TrackerRecord] = []
    @Published var playlists: [PlaylistRecord] = []
    @Published var likedTracks: [TrackRecord] = []
    @Published var likedIds: Set<String> = []
    @Published var recentHistory: [PlayHistoryItem] = []
    @Published var losslessTracks: [TrackRecord] = []
    @Published var unavailableTracks: [TrackRecord] = []
    @Published var toastMessage: String?

    private init() {
        AudioPlayerManager.shared.onTrackUnavailableChanged = { [weak self] trackId, unavailable in
            self?.patchUnavailableLocally(trackId: trackId, unavailable: unavailable)
        }
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

    func refreshAll() async {
        guard APIClient.shared.baseURL != nil else {
            isConnected = false
            return
        }
        isLoading = true
        defer { isLoading = false }

        do {
            let health = try await APIClient.shared.checkHealth()
            isConnected = health.ok
            serverCommit = health.commit
            connectionError = nil

            async let tReq = APIClient.shared.fetchTrackers()
            async let pReq = APIClient.shared.fetchPlaylists()
            async let lReq = APIClient.shared.fetchLikes()
            async let hReq = APIClient.shared.fetchHistory(limit: 20)
            async let losslessReq = APIClient.shared.searchTracks(losslessOnly: true, playableOnly: true, limit: 40)
            async let unavailReq = APIClient.shared.searchTracks(tabName: "Unavailable", limit: 100)

            let (fetchedTrackers, fetchedPlaylists, likes, history, lossless, unavail) = try await (
                tReq, pReq, lReq, hReq, losslessReq, unavailReq
            )

            trackers = fetchedTrackers
            playlists = fetchedPlaylists
            likedTracks = likes.tracks
            likedIds = Set(likes.likedIds)
            recentHistory = history
            losslessTracks = lossless.tracks
            unavailableTracks = unavail.tracks
        } catch {
            isConnected = false
            connectionError = error.localizedDescription
        }
    }

    func toggleLike(track: TrackRecord) async {
        let wasLiked = likedIds.contains(track.id)
        if wasLiked {
            likedIds.remove(track.id)
            likedTracks.removeAll { $0.id == track.id }
        } else {
            likedIds.insert(track.id)
            likedTracks.insert(track, at: 0)
        }

        do {
            let finalState = try await APIClient.shared.toggleLike(trackId: track.id, liked: !wasLiked)
            if finalState {
                likedIds.insert(track.id)
            } else {
                likedIds.remove(track.id)
                likedTracks.removeAll { $0.id == track.id }
            }
        } catch {
            await refreshAll()
            showToast("Failed to update like: \(error.localizedDescription)")
        }
    }

    func toggleFollow(tracker: TrackerRecord) async {
        do {
            let followed = try await APIClient.shared.followTracker(id: tracker.trackerId)
            if let idx = trackers.firstIndex(where: { $0.trackerId == tracker.trackerId }) {
                trackers[idx].isFollowed = followed
            }
        } catch {
            showToast(error.localizedDescription)
        }
    }

    func createPlaylist(name: String, description: String = "") async -> PlaylistRecord? {
        do {
            let created = try await APIClient.shared.createPlaylist(name: name, description: description)
            playlists.insert(created, at: 0)
            showToast("Created \"\(created.name)\"")
            return created
        } catch {
            showToast(error.localizedDescription)
            return nil
        }
    }

    func addTrack(_ track: TrackRecord, to playlist: PlaylistRecord) async {
        do {
            let res = try await APIClient.shared.addTrackToPlaylist(playlistId: playlist.id, trackId: track.id)
            if res.duplicateSong == true {
                showToast("\"\(track.title)\" is already in \"\(playlist.name)\".")
            } else {
                showToast("Added \"\(track.title)\" to \(playlist.name)")
                await refreshAll()
            }
        } catch {
            showToast(error.localizedDescription)
        }
    }

    private func patchUnavailableLocally(trackId: String, unavailable: Bool) {
        if let idx = likedTracks.firstIndex(where: { $0.id == trackId }) {
            likedTracks[idx].isUnavailable = unavailable
        }
        if let idx = recentHistory.firstIndex(where: { $0.track.id == trackId }) {
            var updated = recentHistory[idx].track
            updated.isUnavailable = unavailable
            recentHistory[idx] = PlayHistoryItem(
                id: recentHistory[idx].id,
                trackId: recentHistory[idx].trackId,
                playedAt: recentHistory[idx].playedAt,
                track: updated
            )
        }
    }
}
