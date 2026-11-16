import SwiftUI
import WebKit

struct AddToPlaylistSheet: View {
    let track: TrackRecord
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: LibraryStore
    @State private var newName = ""

    var body: some View {
        NavigationStack {
            List {
                Section("Quick Create") {
                    HStack {
                        TextField("New playlist name...", text: $newName)
                        Button("Create & Add") {
                            let clean = newName.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !clean.isEmpty else { return }
                            let pl = library.createPlaylist(name: clean)
                            _ = library.addTrack(track, toPlaylist: pl.id)
                            library.showToast("Added \"\(track.title)\" to \(pl.name)")
                            dismiss()
                        }
                        .disabled(newName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section("Your Playlists") {
                    if library.playlists.isEmpty {
                        Text("No playlists yet.")
                            .foregroundStyle(Theme.textSecondary)
                            .listRowBackground(Theme.surface)
                    } else {
                        ForEach(library.playlists) { playlist in
                            Button {
                                let added = library.addTrack(track, toPlaylist: playlist.id)
                                library.showToast(
                                    added
                                        ? "Added \"\(track.title)\" to \(playlist.name)"
                                        : "\"\(track.title)\" is already in \(playlist.name)"
                                )
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    PlaylistCoverView(playlist: playlist, size: 42, cornerRadius: 8)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(playlist.name)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(Theme.textPrimary)
                                        Text("\(playlist.trackCount) tracks")
                                            .font(.caption)
                                            .foregroundStyle(Theme.textSecondary)
                                    }
                                    Spacer()
                                    Image(systemName: "plus.circle")
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                            .listRowBackground(Theme.surface)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Add \"\(track.title)\"")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

struct TrackInspectorSheet: View {
    let track: TrackRecord
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var statusMessage: String?
    @State private var isWorking = false

    private var liveTrack: TrackRecord {
        library.tracksById[track.id] ?? track
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Track") {
                    LabeledContent("Title", value: liveTrack.title)
                    LabeledContent("Artist", value: liveTrack.artist)
                    if !liveTrack.era.isEmpty { LabeledContent("Era / Album", value: liveTrack.era) }
                    if !liveTrack.quality.isEmpty { LabeledContent("Quality", value: liveTrack.quality) }
                    if let meta = liveTrack.audioMeta?.summaryBadge {
                        LabeledContent("Audio Stream", value: meta)
                    }
                }
                .listRowBackground(Theme.surface)

                if !liveTrack.notes.isEmpty {
                    Section("Notes") {
                        Text(liveTrack.notes)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section("Mirrors & Links (\(liveTrack.links.count))") {
                    if liveTrack.links.isEmpty {
                        Text("No mirror URLs stored.")
                            .foregroundStyle(Theme.textSecondary)
                    } else {
                        ForEach(Array(liveTrack.links.enumerated()), id: \.offset) { idx, link in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(link.host.uppercased())
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(link.playable ? Theme.accent : Theme.textSecondary)
                                    if let fmt = link.formatHint {
                                        Text(fmt.uppercased())
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textSecondary)
                                    }
                                    Spacer()
                                    Button("Play Mirror #\(idx + 1)") {
                                        player.play(track: liveTrack, linkIndex: idx)
                                        dismiss()
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.mini)
                                }
                                Text(link.url)
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textSecondary)
                                    .lineLimit(1)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("Actions") {
                    Button {
                        Task { await probePrimaryMirror() }
                    } label: {
                        Label("Test & Resolve Stream Link", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(isWorking)

                    Button {
                        Task { await runMusicBrainzMatch() }
                    } label: {
                        Label("Auto-Tag Metadata & Cover (MusicBrainz)", systemImage: "wand.and.stars")
                    }
                    .disabled(isWorking)

                    Button {
                        Task {
                            await offline.download(track: liveTrack)
                            statusMessage = offline.isDownloaded(liveTrack.id)
                                ? "Saved locally onto your iPhone!"
                                : (offline.lastError ?? "Download failed.")
                        }
                    } label: {
                        Label(
                            offline.isDownloaded(liveTrack.id) ? "Re-Download Offline Copy" : "Save Offline on iPhone",
                            systemImage: "arrow.down.circle"
                        )
                    }
                    .disabled(isWorking)

                    Button {
                        let nextVal = !liveTrack.unavailableFlag
                        library.setTrackAvailability(liveTrack.id, unavailable: nextVal)
                        statusMessage = nextVal ? "Marked unavailable." : "Marked available."
                    } label: {
                        Label(
                            liveTrack.unavailableFlag ? "Mark as Available" : "Mark as Unavailable",
                            systemImage: liveTrack.unavailableFlag ? "checkmark.circle" : "exclamationmark.triangle"
                        )
                    }
                }
                .listRowBackground(Theme.surface)

                if let statusMessage {
                    Section("Result") {
                        Text(statusMessage)
                            .font(.caption)
                            .foregroundStyle(Theme.accent)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Track Inspector")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func probePrimaryMirror() async {
        guard let url = liveTrack.primaryUrl ?? liveTrack.links.first?.url else {
            statusMessage = "No URL attached to test."
            return
        }
        isWorking = true
        defer { isWorking = false }
        let res = await HostResolverService.shared.resolve(url: url)
        if res.ok {
            library.setTrackAvailability(liveTrack.id, unavailable: false)
            statusMessage = "Resolved OK (\(res.mimeType ?? res.host))"
        } else {
            statusMessage = res.errorMessage ?? "Mirror resolution failed."
        }
    }

    private func runMusicBrainzMatch() async {
        isWorking = true
        defer { isWorking = false }
        if let updated = await library.enrichTrackWithMusicBrainz(liveTrack.id) {
            statusMessage = "Updated: \"\(updated.title)\" — \(updated.artist)"
        } else {
            statusMessage = "No exact MusicBrainz match found."
        }
    }
}

struct SyncAndImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var player: AudioPlayerManager

    @State private var mode = 0
    @State private var trackerInput = ""
    @State private var directoryFilter = ""
    @State private var mediaUrlInput = ""
    @State private var spotifyName = "My Imported Playlist"
    @State private var spotifyContent = ""
    @State private var sourcePriority = "auto"
    @State private var importProgressText: String?
    @State private var importReport: SmartBatchImportReport?
    @State private var statusText: String?
    @State private var isBusy = false

    private var filteredDirectory: [DirectoryArtist] {
        let q = directoryFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let base = library.directoryArtists.filter { $0.isLinkWorking }
        guard !q.isEmpty else { return Array(base.prefix(30)) }
        return Array(base.filter { $0.name.lowercased().contains(q) }.prefix(30))
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Import Type", selection: $mode) {
                    Text("ArtistGrid").tag(0)
                    Text("URL / Playlist").tag(1)
                    Text("Songs / Spotify").tag(2)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)

                if mode == 0 {
                    Section("Sync by Tracker ID or Sheet URL") {
                        TextField("Tracker ID or artistgrid.cx URL", text: $trackerInput)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        Button {
                            Task { await syncTracker(input: trackerInput) }
                        } label: {
                            if isBusy { ProgressView() } else { Text("Sync Artist Tracker") }
                        }
                        .disabled(trackerInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)
                    }
                    .listRowBackground(Theme.surface)

                    Section("ArtistGrid Directory") {
                        TextField("Search artists (e.g. Kanye, Carti, Frank Ocean...)", text: $directoryFilter)
                            .autocorrectionDisabled()

                        if library.directoryArtists.isEmpty {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Loading ArtistGrid directory...")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        } else {
                            ForEach(filteredDirectory) { artist in
                                Button {
                                    Task { await syncTracker(input: artist.trackerId) }
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(artist.name)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(Theme.textPrimary)
                                            Text(artist.isStarred ? "Featured Tracker" : "Community Tracker")
                                                .font(.caption2)
                                                .foregroundStyle(artist.isStarred ? Theme.accent : Theme.textSecondary)
                                        }
                                        Spacer()
                                        Image(systemName: "arrow.down.circle")
                                            .foregroundStyle(Theme.accent)
                                    }
                                }
                                .disabled(isBusy)
                            }
                        }
                    }
                    .listRowBackground(Theme.surface)
                } else if mode == 1 {
                    Section("YouTube, YT Music, SoundCloud, Bandcamp, Direct") {
                        TextField("https://music.youtube.com/...", text: $mediaUrlInput)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        Button {
                            Task { await importUrl() }
                        } label: {
                            if isBusy { ProgressView() } else { Text("Import & Play") }
                        }
                        .disabled(mediaUrlInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)
                    }
                    .listRowBackground(Theme.surface)
                } else {
                    Section("Songs, Artist - Title | Album, or Spotify CSV") {
                        TextField("Playlist Name", text: $spotifyName)
                        Picker("Source Priority", selection: $sourcePriority) {
                            Text("Smart Auto (All Sources)").tag("auto")
                            Text("YouTube Music First").tag("ytmusic")
                            Text("SoundCloud First").tag("soundcloud")
                            Text("YouTube First").tag("youtube")
                        }
                        TextEditor(text: $spotifyContent)
                            .frame(minHeight: 110)

                        Button {
                            Task { await importSpotify() }
                        } label: {
                            if isBusy {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text(importProgressText ?? "Matching across ArtistGrid & streaming...")
                                        .font(.caption)
                                }
                            } else {
                                Text("Smart Match & Import")
                            }
                        }
                        .disabled(spotifyContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)
                    }
                    .listRowBackground(Theme.surface)

                    if let report = importReport {
                        Section("Import Summary") {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Imported \(report.tracksAdded) of \(report.totalParsed) song(s)")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Theme.accent)

                                Text("ArtistGrid: \(report.artistgridCount) • Library: \(report.libraryCount) • YT Music: \(report.ytmusicCount) • SoundCloud: \(report.soundcloudCount) • YouTube: \(report.youtubeCount)")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textSecondary)

                                if !report.autoSyncedTrackers.isEmpty {
                                    Text("Auto-checked ArtistGrid: \(report.autoSyncedTrackers.joined(separator: ", "))")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)

                        if !report.unmatched.isEmpty {
                            Section("Couldn't Be Imported (\(report.unmatched.count))") {
                                ForEach(report.unmatched) { item in
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text("\(item.title) — \(item.artist)\(item.album.map { " (\($0))" } ?? "")")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(Theme.danger)

                                        Text(item.reason)
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textSecondary)

                                        if let closest = item.bestPartialCandidate {
                                            Button("Use Closest (\(closest.source.rawValue)): \(closest.title)") {
                                                Task {
                                                    await useClosestCandidate(item: item, closest: closest, playlistId: report.playlist?.id)
                                                }
                                            }
                                            .buttonStyle(.bordered)
                                            .controlSize(.mini)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                            .listRowBackground(Theme.danger.opacity(0.08))
                        }

                        if !report.matchedItems.isEmpty {
                            Section("Matched Details (\(report.matchedItems.count))") {
                                DisclosureGroup("View Source & Metadata Matches") {
                                    ForEach(report.matchedItems) { m in
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(m.matchedTitle) — \(m.matchedArtist)")
                                                .font(.caption.weight(.semibold))
                                                .foregroundStyle(Theme.textPrimary)
                                            Text("\(m.matchedSource.rawValue) • \(m.matchReason)")
                                                .font(.caption2)
                                                .foregroundStyle(Theme.textSecondary)
                                        }
                                        .padding(.vertical, 2)
                                    }
                                }
                            }
                            .listRowBackground(Theme.surface)
                        }
                    }
                }

                if let statusText {
                    Section("Status") {
                        Text(statusText)
                            .font(.caption)
                            .foregroundStyle(Theme.accent)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Add Music")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await library.loadDirectoryIfNeeded()
            }
        }
    }

    private func syncTracker(input: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await library.syncArtistGridTracker(input: input)
            statusText = "Synced \(res.artistName) (\(res.playableCount) playable tracks)"
            library.showToast("Synced \(res.artistName)")
        } catch {
            statusText = error.localizedDescription
        }
    }

    private func importUrl() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await library.importUrl(mediaUrlInput)
            if let first = res.tracks.first {
                player.play(track: first, queue: res.tracks)
                statusText = res.playlist != nil ? "Imported \(res.tracks.count) tracks!" : "Imported \"\(first.title)\""
            }
        } catch {
            statusText = error.localizedDescription
        }
    }

    private func importSpotify() async {
        isBusy = true
        importReport = nil
        importProgressText = "Preparing metadata..."
        defer {
            isBusy = false
            importProgressText = nil
        }
        let report = await SmartMatcherService.shared.importSongsSmart(
            playlistName: spotifyName,
            content: spotifyContent,
            sourcePriority: sourcePriority
        ) { current, total, title in
            importProgressText = "Checking \(current)/\(total): \(title)"
        }
        importReport = report
        statusText = report.unmatched.isEmpty
            ? "Imported all \(report.tracksAdded)/\(report.totalParsed) tracks into \"\(spotifyName)\""
            : "Imported \(report.tracksAdded)/\(report.totalParsed) — \(report.unmatched.count) couldn't be imported (listed below)"
    }

    private func useClosestCandidate(item: SmartUnmatchedItem, closest: SmartPartialCandidate, playlistId: String?) async {
        let host = closest.source == .soundcloud ? "soundcloud" : "youtube"
        let saved = library.upsertOnlineTrack(
            sourceUrl: closest.url,
            title: item.title,
            artist: item.artist,
            album: item.album ?? closest.album,
            host: host
        )
        if let playlistId {
            _ = library.addTrack(saved, toPlaylist: playlistId)
        }
        if var rep = importReport {
            rep.unmatched.removeAll { $0.id == item.id }
            rep.tracksAdded += 1
            importReport = rep
        }
        library.showToast("Added closest match for \"\(item.title)\"")
    }
}

struct YouTubeAuthSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            YouTubeLoginWebView()
                .navigationTitle("YouTube Sign-In")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}

private struct YouTubeLoginWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        let web = WKWebView(frame: .zero, configuration: cfg)
        if let url = URL(string: "https://accounts.google.com/ServiceLogin?continue=https://www.youtube.com") {
            web.load(URLRequest(url: url))
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
