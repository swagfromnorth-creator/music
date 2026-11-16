import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @AppStorage(APIClient.serverURLKey) private var savedServerURL = ""
    @State private var draftURL = ""
    @State private var connectionNote: String?
    @State private var isTesting = false
    @State private var cookiesBrowser = ""
    @State private var showImportSheet = false
    @State private var isTagging = false

    private let browserOptions = [
        ("", "None"),
        ("chrome", "Chrome"),
        ("edge", "Microsoft Edge"),
        ("brave", "Brave"),
        ("firefox", "Firefox"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("PC Server Connection") {
                    TextField("http://192.168.1.42:3456", text: $draftURL)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    Button {
                        Task { await saveAndTestConnection() }
                    } label: {
                        HStack {
                            Text(isTesting ? "Connecting..." : "Save & Test Connection")
                            Spacer()
                            if isTesting {
                                ProgressView()
                            } else {
                                Image(systemName: library.isConnected ? "checkmark.circle.fill" : "bolt.horizontal.circle")
                                    .foregroundStyle(library.isConnected ? Theme.accent : Theme.textSecondary)
                            }
                        }
                    }

                    if let connectionNote {
                        Text(connectionNote)
                            .font(.caption)
                            .foregroundStyle(library.isConnected ? Theme.accent : Theme.danger)
                    }

                    if let commit = library.serverCommit {
                        LabeledContent("PC Server Build", value: commit)
                    }
                }
                .listRowBackground(Theme.surface)

                Section("iPhone Offline Downloads") {
                    LabeledContent("Tracks Saved Locally", value: "\(offline.sortedEntries.count)")
                    LabeledContent("Storage Used", value: Formatters.bytes(offline.totalBytes))
                    if !offline.sortedEntries.isEmpty {
                        Button("Clear Offline Audio", role: .destructive) {
                            offline.clearAll()
                            library.showToast("Cleared offline downloads")
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("Library Tools & Extractors") {
                    Button {
                        showImportSheet = true
                    } label: {
                        Label("Sync ArtistGrid / Import URL / Spotify", systemImage: "plus.square.on.square")
                    }

                    Button {
                        Task { await runBatchMusicBrainz() }
                    } label: {
                        HStack {
                            Label("Auto-Tag Metadata & Album Art", systemImage: "wand.and.stars")
                            Spacer()
                            if isTagging { ProgressView() }
                        }
                    }
                    .disabled(!library.isConnected || isTagging)

                    Picker("PC Browser Cookies (yt-dlp)", selection: $cookiesBrowser) {
                        ForEach(browserOptions, id: \.0) { opt in
                            Text(opt.1).tag(opt.0)
                        }
                    }
                    .onChange(of: cookiesBrowser) { nextVal in
                        Task {
                            _ = try? await APIClient.shared.saveCookiesBrowser(nextVal)
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("About VaultStream iOS") {
                    LabeledContent("Client Architecture", value: "Native SwiftUI + AVPlayer")
                    LabeledContent("Background & Lock Screen", value: "Enabled")
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Settings")
            .onAppear {
                draftURL = savedServerURL
            }
            .task {
                if let settings = try? await APIClient.shared.fetchMediaSettings() {
                    cookiesBrowser = settings.cookiesBrowser
                }
            }
            .sheet(isPresented: $showImportSheet) {
                SyncAndImportSheet()
            }
        }
    }

    private func saveAndTestConnection() async {
        isTesting = true
        defer { isTesting = false }
        let normalized = APIClient.normalizeServerURL(draftURL)
        savedServerURL = normalized
        APIClient.shared.rawServerURL = normalized
        draftURL = normalized
        await library.refreshAll()
        if library.isConnected {
            connectionNote = "Connected cleanly!"
        } else {
            connectionNote = library.connectionError ?? "Could not reach PC server at \(normalized)."
        }
    }

    private func runBatchMusicBrainz() async {
        isTagging = true
        defer { isTagging = false }
        do {
            let count = try await APIClient.shared.enrichMusicBrainzBatch()
            library.showToast("Updated metadata for \(count) track(s)")
            await library.refreshAll()
        } catch {
            library.showToast(error.localizedDescription)
        }
    }
}
