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
                        Text("Browse the ArtistGrid directory or paste a tracker ID directly on your iPhone.")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .multilineTextAlignment(.center)
                        Button("Browse ArtistGrid Directory") {
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

                                    Text("\(tracker.playableCount) playable • \(tracker.trackCount) total")
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
                                library.deleteTracker(id: tracker.trackerId)
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
    @State private var isSyncingTab = false

    private var liveTracker: TrackerRecord {
        library.trackers.first(where: { $0.trackerId == tracker.trackerId }) ?? tracker
    }

    private var availableTabs: [TrackerTabMeta] {
        var list = liveTracker.tabs
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
                        urlString: liveTracker.coverImage,
                        cornerRadius: 16,
                        fallbackIcon: "music.mic"
                    )
                    .frame(width: 96, height: 96)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(liveTracker.artistName)
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
                                library.toggleFollow(trackerId: liveTracker.trackerId)
                            } label: {
                                Image(systemName: (liveTracker.isFollowed ?? false) ? "heart.fill" : "heart")
                                    .foregroundStyle((liveTracker.isFollowed ?? false) ? Theme.accent : Theme.textSecondary)
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
                                reloadTracks()
                            }

                            ForEach(availableTabs) { tab in
                                ChipButton(title: tab.name, isSelected: selectedTab == tab.name) {
                                    selectedTab = tab.name
                                    selectedEra = ""
                                    reloadTracks()
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
                                reloadTracks()
                            }
                            ForEach(eras) { facet in
                                ChipButton(title: "\(facet.era) (\(facet.count))", isSelected: selectedEra == facet.era) {
                                    selectedEra = facet.era
                                    reloadTracks()
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }

                if isSyncingTab {
                    HStack {
                        Spacer()
                        ProgressView("Syncing from ArtistGrid...")
                        Spacer()
                    }
                    .padding(.vertical, 32)
                } else if tracks.isEmpty {
                    VStack(spacing: 10) {
                        Text("No tracks loaded in this tab yet.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)

                        if !selectedTab.isEmpty && selectedTab != "Unavailable" && liveTracker.trackerId != "imported_web" && liveTracker.trackerId != "spotify_imports" {
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
        .navigationTitle(liveTracker.artistName)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $filterText, prompt: "Filter \(liveTracker.artistName) tracks...")
        .toolbar {
            if liveTracker.trackerId != "imported_web" && liveTracker.trackerId != "spotify_imports" {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await syncSelectedTab() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isSyncingTab)
                }
            }
        }
        .onAppear {
            reloadTracks()
        }
        .onChange(of: filterText) { _ in
            reloadTracks()
        }
    }

    private func reloadTracks() {
        let res = library.searchTracks(
            trackerId: liveTracker.trackerId,
            tabName: selectedTab.isEmpty ? nil : selectedTab,
            query: filterText.isEmpty ? nil : filterText,
            era: selectedEra.isEmpty ? nil : selectedEra
        )
        tracks = res.tracks
        if !res.eras.isEmpty {
            eras = res.eras
        }
    }

    private func syncSelectedTab() async {
        isSyncingTab = true
        defer { isSyncingTab = false }
        let tabObj = liveTracker.tabs.first(where: { $0.name == selectedTab })
        do {
            let synced = try await library.syncArtistGridTracker(
                input: liveTracker.trackerId,
                tabGid: tabObj?.gid,
                tabSlug: tabObj?.slug,
                tabName: tabObj?.name ?? (selectedTab.isEmpty ? nil : selectedTab)
            )
            library.showToast("Synced \(synced.trackCount) tracks for \(synced.artistName)")
            reloadTracks()
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
