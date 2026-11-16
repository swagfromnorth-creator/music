import SwiftUI

struct ArtistsView: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var searchText = ""
    @State private var showSyncSheet = false

    private var filteredTrackers: [TrackerRecord] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return library.trackers }
        return library.trackers.filter {
            $0.artistName.lowercased().contains(q) || $0.name.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if filteredTrackers.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "music.mic")
                            .font(.system(size: 40))
                            .foregroundStyle(Theme.textSecondary.opacity(0.6))
                        Text("No Artists Synced Yet")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        Text("Tap + to sync any ArtistGrid tracker or import tracks.")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                        Button("Sync Artist Tracker") {
                            showSyncSheet = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(filteredTrackers) { tracker in
                        NavigationLink(value: tracker) {
                            HStack(spacing: 14) {
                                ArtworkImage(
                                    urlString: tracker.coverImage,
                                    cornerRadius: 28,
                                    fallbackIcon: "music.mic"
                                )
                                .frame(width: 56, height: 56)

                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: 6) {
                                        Text(tracker.artistName)
                                            .font(.headline)
                                            .foregroundStyle(Theme.textPrimary)
                                            .lineLimit(1)
                                        if tracker.isFollowed == true {
                                            Image(systemName: "checkmark.seal.fill")
                                                .font(.caption)
                                                .foregroundStyle(Theme.accent)
                                        }
                                    }

                                    Text("\(tracker.playableCount) playable • \(tracker.trackCount) total • \(tracker.syncedTabs.count) tab(s)")
                                        .font(.caption)
                                        .foregroundStyle(Theme.textSecondary)
                                        .lineLimit(1)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(Theme.surface)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task {
                                    try? await APIClient.shared.deleteTracker(id: tracker.trackerId)
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
            .background(Theme.background)
            .navigationTitle("Artists")
            .searchable(text: $searchText, prompt: "Filter artists...")
            .navigationDestination(for: TrackerRecord.self) { tracker in
                ArtistDetailView(tracker: tracker)
            }
            .refreshable {
                await library.refreshAll()
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSyncSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .sheet(isPresented: $showSyncSheet) {
                SyncAndImportSheet()
            }
        }
    }
}

struct ArtistDetailView: View {
    let tracker: TrackerRecord

    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore

    @State private var selectedTab: String = ""
    @State private var selectedEra: String = ""
    @State private var filterText: String = ""
    @State private var tracks: [TrackRecord] = []
    @State private var eras: [EraFacet] = []
    @State private var isLoading = false
    @State private var isSyncingTab = false
    @State private var isFollowed = false

    private var availableTabs: [TrackerTabMeta] {
        var list = tracker.tabs
        if !list.contains(where: { $0.name.caseInsensitiveCompare("Unavailable") == .orderedSame }) {
            list.append(TrackerTabMeta(gid: nil, name: "Unavailable", slug: "unavailable"))
        }
        return list
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                // Artist Hero
                HStack(spacing: 16) {
                    ArtworkImage(
                        urlString: tracker.coverImage,
                        cornerRadius: 16,
                        fallbackIcon: "music.mic"
                    )
                    .frame(width: 96, height: 96)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(tracker.artistName)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Theme.textPrimary)

                        Text("\(tracks.count) tracks loaded")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)

                        HStack(spacing: 10) {
                            Button {
                                if let first = tracks.first(where: { !$0.unavailableFlag }) ?? tracks.first {
                                    player.play(track: first, queue: tracks)
                                }
                            } label: {
                                Label("Play", systemImage: "play.fill")
                                    .font(.subheadline.weight(.bold))
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                            .disabled(tracks.isEmpty)

                            Button {
                                guard !tracks.isEmpty else { return }
                                player.isShuffle = true
                                let pick = tracks.randomElement() ?? tracks[0]
                                player.play(track: pick, queue: tracks)
                            } label: {
                                Label("Shuffle", systemImage: "shuffle")
                                    .font(.subheadline.weight(.semibold))
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                            .disabled(tracks.isEmpty)

                            Button {
                                Task {
                                    await library.toggleFollow(tracker: tracker)
                                    isFollowed.toggle()
                                }
                            } label: {
                                Image(systemName: isFollowed ? "heart.fill" : "heart")
                                    .foregroundStyle(isFollowed ? Theme.accent : Theme.textSecondary)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)

                // Tab Switcher
                if !availableTabs.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ChipButton(title: "All Tabs", isSelected: selectedTab.isEmpty) {
                                selectedTab = ""
                                selectedEra = ""
                                Task { await loadTracks() }
                            }

                            ForEach(availableTabs) { tab in
                                ChipButton(title: tab.name, isSelected: selectedTab == tab.name) {
                                    selectedTab = tab.name
                                    selectedEra = ""
                                    Task { await loadTracks() }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }

                // Era Filter Chips
                if !eras.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ChipButton(title: "All Eras", isSelected: selectedEra.isEmpty) {
                                selectedEra = ""
                                Task { await loadTracks() }
                            }
                            ForEach(eras) { facet in
                                ChipButton(title: "\(facet.era) (\(facet.count))", isSelected: selectedEra == facet.era) {
                                    selectedEra = facet.era
                                    Task { await loadTracks() }
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }

                if isLoading || isSyncingTab {
                    HStack {
                        Spacer()
                        ProgressView(isSyncingTab ? "Syncing tab..." : "Loading tracks...")
                        Spacer()
                    }
                    .padding(.vertical, 32)
                } else if tracks.isEmpty {
                    VStack(spacing: 10) {
                        Text("No tracks indexed in this view yet.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)

                        if !selectedTab.isEmpty && selectedTab != "Unavailable" {
                            Button("Sync \"\(selectedTab)\" Tab Now") {
                                Task { await syncSelectedTab() }
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 36)
                } else {
                    ForEach(tracks) { track in
                        TrackRowView(track: track, queue: tracks)
                            .padding(.horizontal, 16)
                    }
                }
            }
            .padding(.bottom, 20)
        }
        .background(Theme.background)
        .navigationTitle(tracker.artistName)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $filterText, prompt: "Filter \(tracker.artistName) tracks...")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await syncSelectedTab() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isSyncingTab)
            }
        }
        .task {
            isFollowed = tracker.isFollowed ?? false
            await loadTracks()
        }
        .onChange(of: filterText) { _ in
            Task { await loadTracks() }
        }
    }

    private func loadTracks() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let res = try await APIClient.shared.searchTracks(
                trackerId: tracker.trackerId,
                tabName: selectedTab.isEmpty ? nil : selectedTab,
                q: filterText.isEmpty ? nil : filterText,
                era: selectedEra.isEmpty ? nil : selectedEra,
                limit: 300
            )
            tracks = res.tracks
            if let fetchedEras = res.eras, !fetchedEras.isEmpty {
                eras = fetchedEras
            }
        } catch {
            library.showToast(error.localizedDescription)
        }
    }

    private func syncSelectedTab() async {
        isSyncingTab = true
        defer { isSyncingTab = false }
        let tabObj = tracker.tabs.first(where: { $0.name == selectedTab })
        do {
            let synced = try await APIClient.shared.syncTracker(
                input: tracker.trackerId,
                tabGid: tabObj?.gid,
                tabName: tabObj?.name ?? (selectedTab.isEmpty ? nil : selectedTab)
            )
            library.showToast("Synced \(synced.tracksSynced) tracks (\(synced.tabSynced))")
            await loadTracks()
            await library.refreshAll()
        } catch {
            library.showToast(error.localizedDescription)
        }
    }
}

struct ChipButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isSelected ? Theme.accent : Theme.surface)
                .foregroundStyle(isSelected ? Color.black : Theme.textSecondary)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(isSelected ? Theme.accent : Theme.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
