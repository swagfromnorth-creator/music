import SwiftUI

enum SearchSource: String, CaseIterable, Identifiable {
    case ytmusic = "ytmusic"
    case youtube = "youtube"
    case soundcloud = "soundcloud"
    case library = "library"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .ytmusic: return "YT Music"
        case .youtube: return "YouTube"
        case .soundcloud: return "SoundCloud"
        case .library: return "Library"
        }
    }
}

struct SearchView: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore

    @State private var query = ""
    @State private var source: SearchSource = .ytmusic
    @State private var losslessOnly = false
    @State private var isSearching = false
    @State private var importingId: String?
    @State private var searchError: String?

    @State private var libraryResults: [TrackRecord] = []
    @State private var onlineTracks: [OnlineSearchResult] = []
    @State private var onlineCollections: [OnlineCollectionResult] = []

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Source", selection: $source) {
                    ForEach(SearchSource.allCases) { src in
                        Text(src.label).tag(src)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Theme.background)

                if source == .library {
                    HStack(spacing: 8) {
                        Button {
                            losslessOnly.toggle()
                            runLibraryFilter()
                        } label: {
                            Label("Lossless Only", systemImage: losslessOnly ? "checkmark.circle.fill" : "hifispeaker")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(losslessOnly ? Theme.accent.opacity(0.22) : Theme.surface)
                                .foregroundStyle(losslessOnly ? Theme.accent : Theme.textSecondary)
                                .clipShape(Capsule())
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 6)
                }

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if looksLikeURL {
                            urlImportCard
                        }

                        if isSearching {
                            HStack(spacing: 10) {
                                ProgressView()
                                Text("Searching \(source.label)...")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 28)
                        } else if let searchError {
                            Text(searchError)
                                .font(.subheadline)
                                .foregroundStyle(Theme.danger)
                                .padding(.horizontal, 16)
                        }

                        if source == .library {
                            if libraryResults.isEmpty && !isSearching {
                                emptyStateView(
                                    icon: "magnifyingglass",
                                    title: query.isEmpty ? "Search Saved Library" : "No Library Matches",
                                    subtitle: query.isEmpty
                                        ? "Browse saved tracks & synced artists — or pick YT Music / SoundCloud."
                                        : "Try another spelling or search online above."
                                )
                            } else {
                                ForEach(libraryResults) { track in
                                    TrackRowView(track: track, queue: libraryResults)
                                        .padding(.horizontal, 16)
                                }
                            }
                        } else {
                            if !onlineCollections.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Albums & Playlists")
                                        .font(.headline.weight(.bold))
                                        .foregroundStyle(Theme.textPrimary)
                                        .padding(.horizontal, 16)

                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 12) {
                                            ForEach(onlineCollections) { col in
                                                CollectionCard(
                                                    collection: col,
                                                    isBusy: importingId == col.id,
                                                    onPlay: { Task { await importAndPlayCollection(col) } },
                                                    onSave: { Task { await saveCollectionOnly(col) } }
                                                )
                                            }
                                        }
                                        .padding(.horizontal, 16)
                                    }
                                }
                            }

                            if !onlineTracks.isEmpty {
                                Text("Songs")
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(Theme.textPrimary)
                                    .padding(.horizontal, 16)
                                    .padding(.top, 4)

                                ForEach(onlineTracks) { item in
                                    OnlineTrackRow(
                                        item: item,
                                        isBusy: importingId == item.id,
                                        onPlay: { importAndPlayOnlineTrack(item) },
                                        onAddLibrary: { saveOnlineTrackOnly(item) }
                                    )
                                    .padding(.horizontal, 16)
                                }
                            } else if !isSearching && searchError == nil {
                                emptyStateView(
                                    icon: "waveform.and.magnifyingglass",
                                    title: "Search \(source.label)",
                                    subtitle: "Stream songs, albums, and playlists directly on your iPhone."
                                )
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .background(Theme.background)
            .navigationTitle("Search")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Songs, playlists, artists, or URL...")
            .onSubmit(of: .search) {
                Task { await runSearch() }
            }
            .task(id: "\(source.rawValue)|\(query)") {
                if source == .library {
                    runLibraryFilter()
                    return
                }
                let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
                if clean.isEmpty || looksLikeURL {
                    onlineTracks = []
                    onlineCollections = []
                    return
                }
                try? await Task.sleep(nanoseconds: 450_000_000)
                if !Task.isCancelled {
                    await runSearch()
                }
            }
        }
    }

    private var looksLikeURL: Bool {
        let lower = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return lower.hasPrefix("http://") || lower.hasPrefix("https://")
    }

    private var urlImportCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "link.badge.plus")
                .font(.title2)
                .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text("Import Link or Playlist")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
                Text("Stream directly and save into your iPhone library")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Button("Import & Play") {
                Task { await importPastedURL() }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.accent.opacity(0.45), lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private func runLibraryFilter() {
        searchError = nil
        libraryResults = Array(library.searchTracks(query: query, losslessOnly: losslessOnly).tracks.prefix(150))
    }

    private func runSearch() async {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        searchError = nil

        if source == .library {
            runLibraryFilter()
            return
        }

        guard !clean.isEmpty, !looksLikeURL else { return }
        isSearching = true
        defer { isSearching = false }
        do {
            switch source {
            case .ytmusic:
                let res = try await YouTubeService.shared.searchYouTubeMusic(query: clean, limit: 15)
                onlineTracks = res.tracks
                onlineCollections = res.collections
            case .youtube:
                onlineTracks = try await YouTubeService.shared.searchYouTubeVideos(query: clean, limit: 15)
                onlineCollections = []
            case .soundcloud:
                let res = try await SoundCloudService.shared.search(query: clean, limit: 15)
                onlineTracks = res.tracks
                onlineCollections = res.collections
            case .library:
                break
            }
        } catch {
            searchError = error.localizedDescription
        }
    }

    private func importPastedURL() async {
        let target = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty else { return }
        isSearching = true
        defer { isSearching = false }
        do {
            let res = try await library.importUrl(target)
            if let first = res.tracks.first {
                player.play(track: first, queue: res.tracks)
                library.showToast(
                    res.playlist != nil
                        ? "Imported \"\(res.playlist!.name)\" (\(res.tracks.count) tracks)"
                        : "Playing \"\(first.title)\""
                )
            }
        } catch {
            searchError = error.localizedDescription
        }
    }

    private func importAndPlayOnlineTrack(_ item: OnlineSearchResult) {
        let host = item.source == "soundcloud" ? "soundcloud" : "youtube"
        let queueTracks = onlineTracks.map {
            library.upsertOnlineTrack(
                sourceUrl: $0.url,
                title: $0.title,
                artist: $0.artist,
                album: $0.album,
                thumbnail: $0.thumbnail,
                durationSec: $0.durationSec,
                host: $0.source == "soundcloud" ? "soundcloud" : "youtube"
            )
        }
        let target = library.upsertOnlineTrack(
            sourceUrl: item.url,
            title: item.title,
            artist: item.artist,
            album: item.album,
            thumbnail: item.thumbnail,
            durationSec: item.durationSec,
            host: host
        )
        player.play(track: target, queue: queueTracks)
    }

    private func saveOnlineTrackOnly(_ item: OnlineSearchResult) {
        let host = item.source == "soundcloud" ? "soundcloud" : "youtube"
        let saved = library.upsertOnlineTrack(
            sourceUrl: item.url,
            title: item.title,
            artist: item.artist,
            album: item.album,
            thumbnail: item.thumbnail,
            durationSec: item.durationSec,
            host: host
        )
        library.showToast("Saved \"\(saved.title)\" to Library")
    }

    private func importAndPlayCollection(_ col: OnlineCollectionResult) async {
        importingId = col.id
        defer { importingId = nil }
        do {
            let res = try await library.importCollection(col, savePlaylist: true)
            if let first = res.tracks.first {
                player.play(track: first, queue: res.tracks)
                library.showToast("Playing & saved \"\(col.title)\" (\(res.tracks.count) tracks)")
            }
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func saveCollectionOnly(_ col: OnlineCollectionResult) async {
        importingId = col.id
        defer { importingId = nil }
        do {
            let res = try await library.importCollection(col, savePlaylist: true)
            library.showToast("Saved playlist \"\(col.title)\" (\(res.tracks.count) tracks)")
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func emptyStateView(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 38))
                .foregroundStyle(Theme.textSecondary.opacity(0.6))
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

private struct CollectionCard: View {
    let collection: OnlineCollectionResult
    let isBusy: Bool
    let onPlay: () -> Void
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                ArtworkImage(urlString: collection.thumbnail, cornerRadius: 12, fallbackIcon: "square.stack.fill")
                    .frame(width: 146, height: 146)

                Button(action: onPlay) {
                    ZStack {
                        Circle()
                            .fill(Theme.accent)
                            .frame(width: 38, height: 38)
                        if isBusy {
                            ProgressView().tint(.black)
                        } else {
                            Image(systemName: "play.fill")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.black)
                        }
                    }
                }
                .padding(8)
                .disabled(isBusy)
            }

            Text(collection.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)

            HStack {
                Text("\(collection.kind.capitalized) • \(collection.artist)")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                Spacer()
                Button(action: onSave) {
                    Image(systemName: "plus.circle")
                        .font(.subheadline)
                        .foregroundStyle(Theme.accent)
                }
                .disabled(isBusy)
            }
        }
        .frame(width: 146)
    }
}

private struct OnlineTrackRow: View {
    let item: OnlineSearchResult
    let isBusy: Bool
    let onPlay: () -> Void
    let onAddLibrary: () -> Void

    var body: some View {
        Button(action: onPlay) {
            HStack(spacing: 12) {
                ArtworkImage(urlString: item.thumbnail, cornerRadius: 8)
                    .frame(width: 50, height: 50)

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        Text(item.source.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Theme.surfaceElevated)
                            .foregroundStyle(Theme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: 3))

                        Text((item.album?.isEmpty == false) ? "\(item.artist) • \(item.album ?? "")" : item.artist)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                if let dur = item.durationText, !dur.isEmpty {
                    Text(dur)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                }

                if isBusy {
                    ProgressView()
                        .frame(width: 28, height: 28)
                } else {
                    Button(action: onAddLibrary) {
                        Image(systemName: "plus.circle")
                            .font(.title3)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }
}
