import SwiftUI

enum LibrarySegment: String, CaseIterable, Identifiable {
    case playlists = "Playlists"
    case liked = "Liked"
    case offline = "Offline"
    case unavailable = "Unavailable"

    var id: String { rawValue }
}

struct LibraryView: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var segment: LibrarySegment = .playlists
    @State private var showNewPlaylistAlert = false
    @State private var newPlaylistName = ""
    @State private var newPlaylistDesc = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Section", selection: $segment) {
                    ForEach(LibrarySegment.allCases) { seg in
                        Text(seg.rawValue).tag(seg)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Theme.background)

                Group {
                    switch segment {
                    case .playlists:
                        playlistsContent
                    case .liked:
                        likedContent
                    case .offline:
                        offlineContent
                    case .unavailable:
                        unavailableContent
                    }
                }
            }
            .background(Theme.background)
            .navigationTitle("Library")
            .toolbar {
                if segment == .playlists {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            newPlaylistName = ""
                            newPlaylistDesc = ""
                            showNewPlaylistAlert = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundStyle(Theme.accent)
                        }
                    }
                }
            }
            .alert("New Playlist", isPresented: $showNewPlaylistAlert) {
                TextField("Playlist name", text: $newPlaylistName)
                TextField("Description (optional)", text: $newPlaylistDesc)
                Button("Create") {
                    let clean = newPlaylistName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !clean.isEmpty else { return }
                    Task {
                        _ = await library.createPlaylist(name: clean, description: newPlaylistDesc)
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }

    private var playlistsContent: some View {
        List {
            if library.playlists.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "music.note.list")
                        .font(.system(size: 36))
                        .foregroundStyle(Theme.textSecondary.opacity(0.6))
                    Text("No Playlists Yet")
                        .font(.headline)
                        .foregroundStyle(Theme.textPrimary)
                    Button("Create Playlist") {
                        showNewPlaylistAlert = true
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 36)
                .listRowBackground(Color.clear)
            } else {
                ForEach(library.playlists) { playlist in
                    NavigationLink(value: playlist) {
                        HStack(spacing: 12) {
                            PlaylistCoverView(playlist: playlist, size: 54, cornerRadius: 10)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(playlist.name)
                                    .font(.headline)
                                    .foregroundStyle(Theme.textPrimary)
                                    .lineLimit(1)
                                Text("\(playlist.trackCount) track\(playlist.trackCount == 1 ? "" : "s")")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .padding(.vertical, 3)
                    }
                    .listRowBackground(Theme.surface)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Task {
                                try? await APIClient.shared.deletePlaylist(id: playlist.id)
                                await library.refreshAll()
                            }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .navigationDestination(for: PlaylistRecord.self) { pl in
            PlaylistDetailView(playlist: pl)
        }
        .refreshable {
            await library.refreshAll()
        }
    }

    private var likedContent: some View {
        List {
            if library.likedTracks.isEmpty {
                Text("Tap the heart on any song to save it here.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
                    .listRowBackground(Color.clear)
            } else {
                ForEach(library.likedTracks) { track in
                    TrackRowView(track: track, queue: library.likedTracks)
                        .listRowBackground(Theme.surface)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await library.refreshAll()
        }
    }

    private var offlineContent: some View {
        let entries = offline.sortedEntries
        let tracks = entries.map { $0.track }
        return List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(entries.count) Songs Stored on iPhone")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.textPrimary)
                        Text("Plays anywhere without PC or internet (\(Formatters.bytes(offline.totalBytes)))")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                    if !entries.isEmpty {
                        Button("Clear") {
                            offline.clearAll()
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.danger)
                    }
                }
                .listRowBackground(Theme.surface)
            }

            if entries.isEmpty {
                Text("Long-press any song (or open Now Playing) and tap \"Save Offline on iPhone\" to download audio locally.")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.vertical, 20)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(entries) { entry in
                    TrackRowView(track: entry.track, queue: tracks)
                        .listRowBackground(Theme.surface)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                offline.removeDownload(trackId: entry.track.id)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private var unavailableContent: some View {
        List {
            Section {
                Text("Songs marked unavailable appear greyed out in your playlists and here until their link works again. Tap any track to retry playback.")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            }

            if library.unavailableTracks.isEmpty {
                Text("No unavailable tracks right now.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(library.unavailableTracks) { track in
                    TrackRowView(track: track, queue: library.unavailableTracks)
                        .listRowBackground(Theme.surface)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable {
            await library.refreshAll()
        }
    }
}

struct PlaylistDetailView: View {
    let playlist: PlaylistRecord

    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var detail: PlaylistDetail?
    @State private var isLoading = true
    @State private var isDownloadingAll = false

    private var tracks: [TrackRecord] {
        detail?.tracks ?? []
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 14) {
                    PlaylistCoverView(playlist: playlist, size: 150, cornerRadius: 16)
                        .shadow(color: .black.opacity(0.45), radius: 14, y: 8)

                    VStack(spacing: 4) {
                        Text(detail?.name ?? playlist.name)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Theme.textPrimary)
                            .multilineTextAlignment(.center)

                        if !(detail?.description ?? playlist.description).isEmpty {
                            Text(detail?.description ?? playlist.description)
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                                .multilineTextAlignment(.center)
                        }

                        Text("\(tracks.count) tracks")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.textSecondary)
                    }

                    HStack(spacing: 12) {
                        Button {
                            if let first = tracks.first {
                                player.play(track: first, queue: tracks)
                            }
                        } label: {
                            Label("Play", systemImage: "play.fill")
                                .font(.subheadline.weight(.bold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(tracks.isEmpty)

                        Button {
                            guard !tracks.isEmpty else { return }
                            player.isShuffle = true
                            let pick = tracks.randomElement() ?? tracks[0]
                            player.play(track: pick, queue: tracks)
                        } label: {
                            Label("Shuffle", systemImage: "shuffle")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(tracks.isEmpty)

                        Button {
                            Task { await downloadEntirePlaylist() }
                        } label: {
                            if isDownloadingAll {
                                ProgressView()
                            } else {
                                Image(systemName: "arrow.down.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                        .disabled(tracks.isEmpty || isDownloadingAll)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            if isLoading {
                ProgressView("Loading playlist...")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .listRowBackground(Color.clear)
            } else if tracks.isEmpty {
                Text("This playlist is empty. Add any track using its context menu.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(tracks) { track in
                    TrackRowView(track: track, queue: tracks)
                        .listRowBackground(Theme.surface)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await removeTrack(track) }
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle(playlist.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDetail()
        }
        .refreshable {
            await loadDetail()
        }
    }

    private func loadDetail() async {
        isLoading = detail == nil
        defer { isLoading = false }
        detail = try? await APIClient.shared.fetchPlaylistDetail(id: playlist.id)
    }

    private func removeTrack(_ track: TrackRecord) async {
        if let updated = try? await APIClient.shared.removeTrackFromPlaylist(playlistId: playlist.id, trackId: track.id) {
            detail = updated
            await library.refreshAll()
        }
    }

    private func downloadEntirePlaylist() async {
        isDownloadingAll = true
        defer { isDownloadingAll = false }
        var downloadedCount = 0
        for track in tracks {
            if !offline.isDownloaded(track.id) {
                await offline.download(track: track)
            }
            if offline.isDownloaded(track.id) {
                downloadedCount += 1
            }
        }
        library.showToast("\(downloadedCount)/\(tracks.count) tracks saved offline")
    }
}

struct LikedSongsScreen: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore

    var body: some View {
        List {
            if library.likedTracks.isEmpty {
                Text("No liked tracks yet.")
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(library.likedTracks) { track in
                    TrackRowView(track: track, queue: library.likedTracks)
                        .listRowBackground(Theme.surface)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Liked Songs")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Play All") {
                    if let first = library.likedTracks.first {
                        player.play(track: first, queue: library.likedTracks)
                    }
                }
                .disabled(library.likedTracks.isEmpty)
            }
        }
    }
}

struct OfflineSongsScreen: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var offline: OfflineStore

    var body: some View {
        let entries = offline.sortedEntries
        let tracks = entries.map { $0.track }
        List {
            if entries.isEmpty {
                Text("No songs downloaded offline onto this iPhone yet.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(entries) { entry in
                    TrackRowView(track: entry.track, queue: tracks)
                        .listRowBackground(Theme.surface)
                        .swipeActions {
                            Button(role: .destructive) {
                                offline.removeDownload(trackId: entry.track.id)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Saved Offline")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Play All") {
                    if let first = tracks.first {
                        player.play(track: first, queue: tracks)
                    }
                }
                .disabled(tracks.isEmpty)
            }
        }
    }
}

struct LosslessVaultScreen: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore

    var body: some View {
        List {
            if library.losslessTracks.isEmpty {
                Text("No FLAC/WAV/ALAC tracks indexed yet.")
                    .foregroundStyle(Theme.textSecondary)
                    .listRowBackground(Theme.surface)
            } else {
                ForEach(library.losslessTracks) { track in
                    TrackRowView(track: track, queue: library.losslessTracks)
                        .listRowBackground(Theme.surface)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Lossless Vault")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Shuffle") {
                    guard !library.losslessTracks.isEmpty else { return }
                    player.isShuffle = true
                    let pick = library.losslessTracks.randomElement() ?? library.losslessTracks[0]
                    player.play(track: pick, queue: library.losslessTracks)
                }
                .disabled(library.losslessTracks.isEmpty)
            }
        }
    }
}
