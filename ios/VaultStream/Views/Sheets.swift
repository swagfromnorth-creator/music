import SwiftUI

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
                            Task {
                                if let pl = await library.createPlaylist(name: clean) {
                                    await library.addTrack(track, to: pl)
                                    dismiss()
                                }
                            }
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
                                Task {
                                    await library.addTrack(track, to: playlist)
                                    dismiss()
                                }
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

    var body: some View {
        NavigationStack {
            List {
                Section("Track") {
                    LabeledContent("Title", value: track.title)
                    LabeledContent("Artist", value: track.artist)
                    if !track.era.isEmpty { LabeledContent("Era / Album", value: track.era) }
                    if !track.quality.isEmpty { LabeledContent("Quality", value: track.quality) }
                    if let meta = track.audioMeta?.summaryBadge {
                        LabeledContent("Audio Stream", value: meta)
                    }
                    if let size = track.resolvedSize, size > 0 {
                        LabeledContent("File Size", value: Formatters.bytes(size))
                    }
                }
                .listRowBackground(Theme.surface)

                if !track.notes.isEmpty {
                    Section("Notes") {
                        Text(track.notes)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section("Mirrors & Links (\(track.links.count))") {
                    if track.links.isEmpty {
                        Text("No mirror URLs stored.")
                            .foregroundStyle(Theme.textSecondary)
                    } else {
                        ForEach(Array(track.links.enumerated()), id: \.offset) { idx, link in
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
                                        player.play(track: track, linkIndex: idx)
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
                        Task { await resolvePrimaryLink() }
                    } label: {
                        Label("Re-Resolve Stream Link", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(isWorking)

                    Button {
                        Task {
                            await offline.download(track: track)
                            statusMessage = offline.isDownloaded(track.id)
                                ? "Saved locally onto your iPhone!"
                                : (offline.lastError ?? "Download failed.")
                        }
                    } label: {
                        Label(
                            offline.isDownloaded(track.id) ? "Re-Download Offline Copy" : "Save Offline on iPhone",
                            systemImage: "arrow.down.circle"
                        )
                    }
                    .disabled(isWorking)

                    Button {
                        Task { await toggleManualUnavailable() }
                    } label: {
                        Label(
                            track.unavailableFlag ? "Mark as Available" : "Mark as Unavailable",
                            systemImage: track.unavailableFlag ? "checkmark.circle" : "exclamationmark.triangle"
                        )
                    }
                    .disabled(isWorking)
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

    private func resolvePrimaryLink() async {
        isWorking = true
        defer { isWorking = false }
        do {
            let res = try await APIClient.shared.resolveTrack(trackId: track.id, force: true)
            statusMessage = res.resolution.ok
                ? "Resolved OK (\(res.resolution.mimeType ?? "audio"))"
                : (res.resolution.errorMessage ?? "Could not resolve mirror.")
            await library.refreshAll()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func toggleManualUnavailable() async {
        isWorking = true
        defer { isWorking = false }
        _ = await APIClient.shared.setTrackAvailability(trackId: track.id, unavailable: !track.unavailableFlag)
        await library.refreshAll()
        statusMessage = !track.unavailableFlag ? "Marked unavailable." : "Marked available."
    }
}

struct SyncAndImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var player: AudioPlayerManager

    @State private var mode = 0
    @State private var trackerInput = ""
    @State private var mediaUrlInput = ""
    @State private var spotifyName = "My Spotify Migration"
    @State private var spotifyContent = ""
    @State private var statusText: String?
    @State private var isBusy = false

    var body: some View {
        NavigationStack {
            Form {
                Picker("Import Type", selection: $mode) {
                    Text("ArtistGrid").tag(0)
                    Text("Audio / Playlist URL").tag(1)
                    Text("Spotify CSV").tag(2)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)

                if mode == 0 {
                    Section("ArtistGrid Tracker ID or Link") {
                        TextField("e.g. 1CF... or artistgrid tracker ID", text: $trackerInput)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        Button {
                            Task { await syncTracker() }
                        } label: {
                            if isBusy { ProgressView() } else { Text("Sync Artist Tracker") }
                        }
                        .disabled(trackerInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)
                    }
                    .listRowBackground(Theme.surface)
                } else if mode == 1 {
                    Section("YouTube, YT Music, SoundCloud, Bandcamp") {
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
                    Section("Spotify Playlist / Exportify CSV") {
                        TextField("Playlist Name", text: $spotifyName)
                        TextEditor(text: $spotifyContent)
                            .frame(minHeight: 110)

                        Button {
                            Task { await importSpotify() }
                        } label: {
                            if isBusy { ProgressView() } else { Text("Migrate to VaultStream") }
                        }
                        .disabled(spotifyContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isBusy)
                    }
                    .listRowBackground(Theme.surface)
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
        }
    }

    private func syncTracker() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await APIClient.shared.syncTracker(input: trackerInput)
            statusText = "Synced \(res.tracker.artistName) (\(res.tracksSynced) tracks)"
            await library.refreshAll()
        } catch {
            statusText = error.localizedDescription
        }
    }

    private func importUrl() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await APIClient.shared.importUrl(url: mediaUrlInput)
            if let tracks = res.tracks, !tracks.isEmpty {
                player.play(track: tracks[0], queue: tracks)
                statusText = "Imported \(tracks.count) tracks!"
            } else if let track = res.track {
                player.play(track: track)
                statusText = "Imported \"\(track.title)\""
            }
            await library.refreshAll()
        } catch {
            statusText = error.localizedDescription
        }
    }

    private func importSpotify() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let res = try await APIClient.shared.importSpotify(name: spotifyName, content: spotifyContent)
            statusText = "Matched \(res.tracksAdded)/\(res.totalParsed) tracks (\(res.matchedLocal) local, \(res.matchedOnline) online)"
            await library.refreshAll()
        } catch {
            statusText = error.localizedDescription
        }
    }
}

struct ServerSetupSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: LibraryStore
    @AppStorage(APIClient.serverURLKey) private var serverURL = ""
    @State private var draftURL = ""
    @State private var testing = false
    @State private var feedback: String?
    @State private var succeeded = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Connect Your VaultStream PC", systemImage: "desktopcomputer")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        Text("Open VaultStream on your PC, click Settings, and copy the iPhone & LAN URL (for example `http://192.168.1.42:3456` on Wi-Fi or your Tailscale IP from anywhere).")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Theme.surface)

                Section("Server Address") {
                    TextField("http://192.168.1.42:3456", text: $draftURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Button {
                        Task { await testAndConnect() }
                    } label: {
                        HStack {
                            if testing { ProgressView() }
                            Text(testing ? "Connecting..." : "Connect & Sync Library")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(draftURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || testing)
                }
                .listRowBackground(Theme.surface)

                if let feedback {
                    Section("Connection Status") {
                        Text(feedback)
                            .font(.caption)
                            .foregroundStyle(succeeded ? Theme.accent : Theme.danger)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Button("Skip for Now (Offline Mode Only)") {
                        dismiss()
                    }
                    .foregroundStyle(Theme.textSecondary)
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("VaultStream Setup")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                draftURL = serverURL
            }
        }
    }

    private func testAndConnect() async {
        testing = true
        defer { testing = false }
        let normalized = APIClient.normalizeServerURL(draftURL)
        do {
            let health = try await APIClient.shared.checkHealth(against: normalized)
            if health.ok {
                serverURL = normalized
                APIClient.shared.rawServerURL = normalized
                succeeded = true
                feedback = "Connected to VaultStream PC!"
                await library.refreshAll()
                dismiss()
            } else {
                succeeded = false
                feedback = "Server responded, but reported not ready."
            }
        } catch {
            succeeded = false
            feedback = error.localizedDescription
        }
    }
}
