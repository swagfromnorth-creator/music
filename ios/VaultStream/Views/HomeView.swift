import SwiftUI

struct HomeView: View {
    @Binding var selectedTab: AppTab
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var showImportSheet = false

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 18 { return "Good afternoon" }
        return "Good evening"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Quick 2x2 shortcut grid
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        NavigationLink {
                            LikedSongsScreen()
                        } label: {
                            QuickTile(
                                title: "Liked Songs",
                                subtitle: "\(library.likedTracks.count) tracks",
                                icon: "heart.fill",
                                gradient: [Color(hex: "#7c3aed"), Color(hex: "#4c1d95")]
                            )
                        }

                        NavigationLink {
                            OfflineSongsScreen()
                        } label: {
                            QuickTile(
                                title: "Saved Offline",
                                subtitle: "\(offline.sortedEntries.count) on iPhone",
                                icon: "arrow.down.circle.fill",
                                gradient: [Color(hex: "#059669"), Color(hex: "#064e3b")]
                            )
                        }

                        NavigationLink {
                            LosslessVaultScreen()
                        } label: {
                            QuickTile(
                                title: "Lossless Vault",
                                subtitle: "\(library.losslessTracks.count) Hi-Res",
                                icon: "hifispeaker.fill",
                                gradient: [Color(hex: "#0284c7"), Color(hex: "#1e3a8a")]
                            )
                        }

                        Button {
                            selectedTab = .library
                        } label: {
                            QuickTile(
                                title: "Playlists",
                                subtitle: "\(library.playlists.count) collections",
                                icon: "music.note.list",
                                gradient: [Color(hex: "#db2777"), Color(hex: "#831843")]
                            )
                        }
                    }

                    if library.allTracks.isEmpty && library.trackers.isEmpty {
                        welcomeCard
                    }

                    // Recently Played Horizontal Shelf
                    if !library.recentHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recently Played")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(Theme.textPrimary)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 14) {
                                    ForEach(uniqueRecentTracks) { track in
                                        Button {
                                            player.play(track: track, queue: uniqueRecentTracks)
                                        } label: {
                                            VStack(alignment: .leading, spacing: 8) {
                                                ArtworkImage(
                                                    urlString: track.eraImage,
                                                    cornerRadius: 12,
                                                    fallbackColors: [Color(hex: track.eraColor ?? "#6d28d9"), Theme.surface]
                                                )
                                                .frame(width: 140, height: 140)

                                                Text(track.title)
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(track.unavailableFlag ? Theme.textSecondary : Theme.textPrimary)
                                                    .lineLimit(1)

                                                Text(track.artist)
                                                    .font(.caption)
                                                    .foregroundStyle(Theme.textSecondary)
                                                    .lineLimit(1)
                                            }
                                            .frame(width: 140)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    // Artists Horizontal Shelf
                    if !library.trackers.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Your Artists")
                                    .font(.title3.weight(.bold))
                                    .foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Button("See All") { selectedTab = .artists }
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.accent)
                            }

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 14) {
                                    ForEach(library.trackers) { tracker in
                                        NavigationLink(value: tracker) {
                                            VStack(spacing: 8) {
                                                ArtworkImage(
                                                    urlString: tracker.coverImage,
                                                    cornerRadius: 56,
                                                    fallbackIcon: "music.mic"
                                                )
                                                .frame(width: 112, height: 112)

                                                Text(tracker.artistName)
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(Theme.textPrimary)
                                                    .lineLimit(1)

                                                Text("\(tracker.playableCount) playable")
                                                    .font(.caption2)
                                                    .foregroundStyle(Theme.textSecondary)
                                            }
                                            .frame(width: 116)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    // High-Res Picks
                    if !library.losslessTracks.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("High-Res Highlights")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(Theme.textPrimary)

                            ForEach(Array(library.losslessTracks.prefix(8))) { track in
                                TrackRowView(track: track, queue: library.losslessTracks)
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.background)
            .navigationTitle(greeting)
            .navigationDestination(for: TrackerRecord.self) { tracker in
                ArtistDetailView(tracker: tracker)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showImportSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .sheet(isPresented: $showImportSheet) {
                SyncAndImportSheet()
            }
        }
    }

    private var uniqueRecentTracks: [TrackRecord] {
        var seen = Set<String>()
        return library.recentHistory.compactMap { item in
            guard !seen.contains(item.track.id) else { return nil }
            seen.insert(item.track.id)
            return item.track
        }
    }

    private var welcomeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "waveform.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.accent)
                Text("VaultStream Standalone")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
            }
            Text("Stream lossless ArtistGrid trackers, YouTube Music, YouTube, and SoundCloud directly on your iPhone — or save tracks for Airplane Mode.")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)

            HStack(spacing: 10) {
                Button("Search Music") {
                    selectedTab = .search
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

                Button("Sync ArtistGrid") {
                    showImportSheet = true
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }
}

private struct QuickTile: View {
    let title: String
    let subtitle: String
    let icon: String
    let gradient: [Color]

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                LinearGradient(colors: gradient, startPoint: .topLeading, endPoint: .bottomTrailing)
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
            }
            .frame(width: 48, height: 54)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
        }
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.8)
        )
    }
}
