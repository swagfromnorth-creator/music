import SwiftUI

enum SearchSource: String, CaseIterable, Identifiable {
    case library = "library"
    case ytmusic = "ytmusic"
    case youtube = "youtube"
    case soundcloud = "soundcloud"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .library: return "Library"
        case .ytmusic: return "YT Music"
        case .youtube: return "YouTube"
        case .soundcloud: return "SoundCloud"
        }
    }
}

struct SearchView: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore

    @State private var query = ""
    @State private var source: SearchSource = .library
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
                            Task { await runSearch() }
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
                                    title: query.isEmpty ? "Search Your Library" : "No Library Matches",
                                    subtitle: query.isEmpty
                                        ? "Type a song, artist, or era — or switch to YT Music / SoundCloud above."
                                        : "Try another spelling or search YT Music / SoundCloud."
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
                                        onPlay: { Task { await importAndPlayOnlineTrack(item) } },
                                        onAddLibrary: { Task { await importOnlyOnlineTrack(item) } }
                                    )
                                    .padding(.horizontal, 16)
                                }
                            } else if !isSearching && searchError == nil {
                                emptyStateView(
                                    icon: "waveform.and.magnifyingglass",
                                    title: "Search \(source.label)",
                                    subtitle: "Find songs, remixes, albums, and playlists and play them natively."
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
                let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
                if clean.isEmpty && source != .library {
                    onlineTracks = []
                    onlineCollections = []
                    return
                }
                try? await Task.sleep(nanoseconds: source == .library ? 250_000_000 : 450_000_000)
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
                Text("Fetch stream & save directly to your VaultStream library")
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

    private func runSearch() async {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        searchError = nil

        if source == .library {
            isSearching = true
            defer { isSearching = false }
            do {
                let res = try await APIClient.shared.searchTracks(
                    q: clean.isEmpty ? nil : clean,
                    losslessOnly: losslessOnly,
                    limit: 120
                )
                libraryResults = res.tracks
            } catch {
                searchError = error.localizedDescription
            }
            return
        }

        guard !clean.isEmpty, !looksLikeURL else { return }
        isSearching = true
        defer { isSearching = false }
        do {
            let res = try await APIClient.shared.discoverSearch(query: clean, source: source.rawValue, limit: 15)
            onlineTracks = res.results
            onlineCollections = res.collections ?? []
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
            let res = try await APIClient.shared.importUrl(url: target)
            if let tracks = res.tracks, !tracks.isEmpty {
                player.play(track: tracks[0], queue: tracks)
                library.showToast("Imported \"\(res.playlist?.name ?? "Collection")\" (\(tracks.count) tracks)")
            } else if let tr = res.track {
                player.play(track: tr)
                library.showToast("Imported & playing \"\(tr.title)\"")
            }
            await library.refreshAll()
        } catch {
            searchError = error.localizedDescription
        }
    }

    private func importAndPlayOnlineTrack(_ item: OnlineSearchResult) async {
        importingId = item.id
        defer { importingId = nil }
        do {
            let res = try await APIClient.shared.importUrl(
                url: item.url,
                title: item.title,
                artist: item.artist,
                album: item.album,
                thumbnail: item.thumbnail
            )
            if let track = res.track {
                player.play(track: track)
                await library.refreshAll()
            }
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func importOnlyOnlineTrack(_ item: OnlineSearchResult) async {
        importingId = item.id
        defer { importingId = nil }
        do {
            let res = try await APIClient.shared.importUrl(
                url: item.url,
                title: item.title,
                artist: item.artist,
                album: item.album,
                thumbnail: item.thumbnail
            )
            if let track = res.track {
                library.showToast("Saved \"\(track.title)\" to Library")
                await library.refreshAll()
            }
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func importAndPlayCollection(_ col: OnlineCollectionResult) async {
        importingId = col.id
        defer { importingId = nil }
        do {
            let res = try await APIClient.shared.importCollection(col, savePlaylist: true)
            if let first = res.tracks.first {
                player.play(track: first, queue: res.tracks)
                library.showToast("Playing & saved \"\(res.title)\" (\(res.tracks.count) tracks)")
                await library.refreshAll()
            }
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func saveCollectionOnly(_ col: OnlineCollectionResult) async {
        importingId = col.id
        defer { importingId = nil }
        do {
            let res = try await APIClient.shared.importCollection(col, savePlaylist: true)
            library.showToast("Saved playlist \"\(res.title)\" (\(res.tracks.count) tracks)")
            await library.refreshAll()
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

                        Text(item.album?.isEmpty == false ? "\(item.artist) • \(item.album!)" : item.artist)
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
