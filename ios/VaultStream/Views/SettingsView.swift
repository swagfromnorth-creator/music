import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var isSignedInYT = false
    @State private var showYouTubeLogin = false
    @State private var showImportSheet = false
    @State private var isTagging = false

    var body: some View {
        NavigationStack {
            Form {
                Section("YouTube & Extraction") {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("YouTube Session")
                                .foregroundStyle(Theme.textPrimary)
                            Text(isSignedInYT
                                ? "Signed in (uses cookies if YouTube challenges requests)"
                                : "Optional — sign in only if YouTube asks to verify not a bot")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: isSignedInYT ? "checkmark.shield.fill" : "shield")
                            .foregroundStyle(isSignedInYT ? Theme.accent : Theme.textSecondary)
                    }

                    Button(isSignedInYT ? "Refresh YouTube Sign-In" : "Sign In to YouTube (Optional)") {
                        showYouTubeLogin = true
                    }

                    if isSignedInYT {
                        Button("Sign Out of YouTube", role: .destructive) {
                            Task {
                                await YouTubeService.shared.clearYouTubeSession()
                                isSignedInYT = false
                                library.showToast("Signed out of YouTube session")
                            }
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("iPhone Offline Downloads") {
                    LabeledContent("Tracks Saved Locally", value: "\(offline.sortedEntries.count)")
                    LabeledContent("Offline Storage Used", value: Formatters.bytes(offline.totalBytes))
                    if !offline.sortedEntries.isEmpty {
                        Button("Clear Offline Audio", role: .destructive) {
                            offline.clearAll()
                            library.showToast("Cleared offline downloads")
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("Library Tools & Metadata") {
                    Button {
                        showImportSheet = true
                    } label: {
                        Label("Sync ArtistGrid / Import URL / Spotify", systemImage: "plus.square.on.square")
                    }

                    Button {
                        Task { await runBatchMusicBrainz() }
                    } label: {
                        HStack {
                            Label("Auto-Tag Missing Art (MusicBrainz)", systemImage: "wand.and.stars")
                            Spacer()
                            if isTagging { ProgressView() }
                        }
                    }
                    .disabled(isTagging)

                    LabeledContent("Saved Library Tracks", value: "\(library.allTracks.count)")
                    LabeledContent("Synced Artists", value: "\(library.trackers.count)")
                }
                .listRowBackground(Theme.surface)

                Section("About VaultStream iOS") {
                    LabeledContent("Mode", value: "100% Standalone (No PC / Cloud)")
                    LabeledContent("Player Engine", value: "Native SwiftUI + AVPlayer")
                    LabeledContent("Background Audio & Lock Screen", value: "Enabled")
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Settings")
            .task {
                isSignedInYT = await YouTubeService.shared.hasSignedInYouTubeSession()
            }
            .sheet(isPresented: $showYouTubeLogin, onDismiss: {
                Task {
                    isSignedInYT = await YouTubeService.shared.hasSignedInYouTubeSession()
                }
            }) {
                YouTubeAuthSheet()
            }
            .sheet(isPresented: $showImportSheet) {
                SyncAndImportSheet()
            }
        }
    }

    private func runBatchMusicBrainz() async {
        isTagging = true
        defer { isTagging = false }
        let count = await library.enrichBatchMusicBrainz()
        library.showToast("Updated cover art / tags for \(count) track(s)")
    }
}
