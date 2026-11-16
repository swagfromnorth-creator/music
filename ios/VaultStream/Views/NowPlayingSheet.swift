import AVKit
import SwiftUI
import UIKit

struct AirPlayRoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let view = AVRoutePickerView()
        view.tintColor = UIColor.white
        view.activeTintColor = UIColor(red: 16 / 255, green: 185 / 255, blue: 129 / 255, alpha: 1)
        view.prioritizesVideoDevices = false
        return view
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}

struct NowPlayingSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    @State private var draftTime: Double = 0
    @State private var isDragging = false
    @State private var showQueueSheet = false

    private var track: TrackRecord? { player.currentTrack }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            if let art = track?.eraImage {
                ArtworkImage(urlString: art, cornerRadius: 0)
                    .ignoresSafeArea()
                    .blur(radius: 65)
                    .opacity(0.32)
            }

            LinearGradient(
                colors: [Color.black.opacity(0.2), Theme.background.opacity(0.92), Theme.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if let track {
                VStack(spacing: 18) {
                    // Top grabber + actions
                    HStack {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "chevron.down")
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(Theme.textPrimary)
                                .frame(width: 36, height: 36)
                        }

                        Spacer()

                        VStack(spacing: 2) {
                            Text(track.tabName.isEmpty ? "NOW PLAYING" : track.tabName.uppercased())
                                .font(.caption2.weight(.bold))
                                .tracking(1.1)
                                .foregroundStyle(Theme.textSecondary)
                            if let badge = track.badgeText {
                                Text(badge)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(track.isLossless ? Theme.accent : Theme.textSecondary)
                            }
                        }

                        Spacer()

                        Button {
                            player.activeInspectTrack = track
                        } label: {
                            Image(systemName: "ellipsis.circle")
                                .font(.title3)
                                .foregroundStyle(Theme.textPrimary)
                                .frame(width: 36, height: 36)
                        }
                    }
                    .padding(.top, 8)

                    Spacer(minLength: 4)

                    // Hero Album Artwork
                    ArtworkImage(
                        urlString: track.eraImage,
                        cornerRadius: 18,
                        fallbackColors: [Color(hex: track.eraColor ?? "#6d28d9"), Theme.surface]
                    )
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 340, maxHeight: 340)
                    .scaleEffect(player.isPlaying ? 1.0 : 0.94)
                    .animation(.spring(response: 0.4, dampingFraction: 0.78), value: player.isPlaying)
                    .shadow(color: .black.opacity(0.55), radius: 28, y: 12)

                    Spacer(minLength: 4)

                    // Track info + Like + Download
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(track.title)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(2)

                            Text(track.subtitleLine)
                                .font(.subheadline)
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(1)
                        }

                        Spacer()

                        // Offline save toggle
                        Button {
                            Task {
                                if offline.isDownloaded(track.id) {
                                    offline.removeDownload(trackId: track.id)
                                    library.showToast("Removed offline copy")
                                } else {
                                    await offline.download(track: track)
                                    if offline.isDownloaded(track.id) {
                                        library.showToast("Saved for offline playback")
                                    } else if let err = offline.lastError {
                                        library.showToast(err)
                                    }
                                }
                            }
                        } label: {
                            if offline.downloadingIds.contains(track.id) {
                                ProgressView()
                                    .frame(width: 32, height: 32)
                            } else {
                                Image(systemName: offline.isDownloaded(track.id) ? "arrow.down.circle.fill" : "arrow.down.circle")
                                    .font(.title3)
                                    .foregroundStyle(offline.isDownloaded(track.id) ? Theme.accent : Theme.textSecondary)
                                    .frame(width: 32, height: 32)
                            }
                        }

                        // Like Heart
                        let liked = library.likedIds.contains(track.id) || track.likedFlag
                        Button {
                            Task { await library.toggleLike(track: track) }
                        } label: {
                            Image(systemName: liked ? "heart.fill" : "heart")
                                .font(.title2)
                                .foregroundStyle(liked ? Theme.accent : Theme.textPrimary)
                                .frame(width: 36, height: 36)
                        }
                    }

                    if let err = player.errorMessage {
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 8)
                    }

                    // Interactive Scrubber
                    VStack(spacing: 4) {
                        Slider(
                            value: Binding(
                                get: { isDragging ? draftTime : player.currentTime },
                                set: { newVal in
                                    draftTime = newVal
                                    if !isDragging {
                                        isDragging = true
                                        player.beginScrubbing()
                                    }
                                }
                            ),
                            in: 0...max(player.duration, 1),
                            onEditingChanged: { editing in
                                isDragging = editing
                                if editing {
                                    draftTime = player.currentTime
                                    player.beginScrubbing()
                                } else {
                                    player.endScrubbing(at: draftTime)
                                }
                            }
                        )
                        .tint(Theme.accent)

                        HStack {
                            Text(Formatters.duration(isDragging ? draftTime : player.currentTime))
                            Spacer()
                            Text(Formatters.duration(player.duration))
                        }
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                    }

                    // Main Transport Controls
                    HStack {
                        Button {
                            player.isShuffle.toggle()
                        } label: {
                            Image(systemName: "shuffle")
                                .font(.title3)
                                .foregroundStyle(player.isShuffle ? Theme.accent : Theme.textSecondary)
                        }

                        Spacer()

                        Button {
                            player.previous()
                        } label: {
                            Image(systemName: "backward.end.fill")
                                .font(.system(size: 30))
                                .foregroundStyle(Theme.textPrimary)
                        }

                        Spacer()

                        Button {
                            player.togglePlayPause()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(Theme.textPrimary)
                                    .frame(width: 72, height: 72)

                                if player.isLoading {
                                    ProgressView()
                                        .tint(Theme.background)
                                } else {
                                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                        .font(.system(size: 30, weight: .bold))
                                        .foregroundStyle(Theme.background)
                                        .offset(x: player.isPlaying ? 0 : 2)
                                }
                            }
                        }

                        Spacer()

                        Button {
                            player.next()
                        } label: {
                            Image(systemName: "forward.end.fill")
                                .font(.system(size: 30))
                                .foregroundStyle(Theme.textPrimary)
                        }

                        Spacer()

                        Button {
                            player.cycleRepeatMode()
                        } label: {
                            Image(systemName: player.repeatMode.iconName)
                                .font(.title3)
                                .foregroundStyle(player.repeatMode == .off ? Theme.textSecondary : Theme.accent)
                        }
                    }
                    .padding(.horizontal, 6)

                    // Bottom bar: AirPlay, Add to Playlist, Queue
                    HStack {
                        AirPlayRoutePicker()
                            .frame(width: 32, height: 32)

                        Spacer()

                        Button {
                            player.activeAddToPlaylistTrack = track
                        } label: {
                            Label("Add to Playlist", systemImage: "text.badge.plus")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(Theme.surfaceElevated)
                                .foregroundStyle(Theme.textPrimary)
                                .clipShape(Capsule())
                        }

                        Spacer()

                        Button {
                            showQueueSheet = true
                        } label: {
                            Image(systemName: "list.bullet")
                                .font(.title3)
                                .foregroundStyle(Theme.textPrimary)
                                .frame(width: 32, height: 32)
                        }
                    }
                    .padding(.bottom, 10)
                }
                .padding(.horizontal, 24)
            } else {
                Text("Nothing playing")
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .sheet(isPresented: $showQueueSheet) {
            QueueSheet()
                .presentationDetents([.medium, .large])
        }
    }
}

struct QueueSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var player: AudioPlayerManager

    var body: some View {
        NavigationStack {
            List {
                if player.queue.isEmpty {
                    Text("Your queue is empty.")
                        .foregroundStyle(Theme.textSecondary)
                        .listRowBackground(Theme.surface)
                } else {
                    ForEach(Array(player.queue.enumerated()), id: \.element.id) { idx, track in
                        Button {
                            player.play(track: track)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Text("\(idx + 1)")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(idx == player.currentIndex ? Theme.accent : Theme.textSecondary)
                                    .frame(width: 22)

                                ArtworkImage(urlString: track.eraImage, cornerRadius: 6)
                                    .frame(width: 40, height: 40)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(track.title)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(idx == player.currentIndex ? Theme.accent : Theme.textPrimary)
                                        .lineLimit(1)
                                    Text(track.artist)
                                        .font(.caption)
                                        .foregroundStyle(Theme.textSecondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Up Next (\(player.queue.count))")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
