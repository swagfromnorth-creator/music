import SwiftUI

struct TrackRowView: View {
    let track: TrackRecord
    var queue: [TrackRecord] = []
    var showLikeButton: Bool = true
    var onTap: (() -> Void)? = nil

    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var offline: OfflineStore

    private var isCurrentTrack: Bool {
        player.currentTrack?.id == track.id
    }

    private var isLiked: Bool {
        library.likedIds.contains(track.id) || track.likedFlag
    }

    private var isDownloaded: Bool {
        offline.isDownloaded(track.id)
    }

    private var isDownloading: Bool {
        offline.downloadingIds.contains(track.id)
    }

    var body: some View {
        Button {
            if let onTap {
                onTap()
            } else {
                player.play(track: track, queue: queue.isEmpty ? nil : queue)
            }
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    ArtworkImage(
                        urlString: track.eraImage,
                        cornerRadius: 8,
                        fallbackColors: eraFallbackColors
                    )
                    .frame(width: 50, height: 50)

                    if isCurrentTrack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.black.opacity(0.45))
                            .frame(width: 50, height: 50)
                        Image(systemName: player.isPlaying ? "waveform" : "pause.fill")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Theme.accent)
                    }
                }

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(track.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(
                                isCurrentTrack
                                    ? Theme.accent
                                    : (track.unavailableFlag ? Theme.textSecondary : Theme.textPrimary)
                            )
                            .lineLimit(1)

                        if track.unavailableFlag {
                            Text("Unavailable")
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Theme.textSecondary.opacity(0.18))
                                .foregroundStyle(Theme.textSecondary)
                                .clipShape(Capsule())
                        }
                    }

                    HStack(spacing: 5) {
                        if isDownloaded {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.accent)
                        } else if isDownloading {
                            ProgressView()
                                .scaleEffect(0.6)
                        }

                        if track.isLossless {
                            Text("LOSSLESS")
                                .font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(Theme.accent.opacity(0.18))
                                .foregroundStyle(Theme.accent)
                                .clipShape(RoundedRectangle(cornerRadius: 3))
                        }

                        Text(track.subtitleLine)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 4)

                if let len = track.trackLength ?? track.availableLength, !len.isEmpty {
                    Text(len)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.textSecondary)
                }

                if showLikeButton {
                    Button {
                        library.toggleLike(track: track)
                    } label: {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .font(.system(size: 15))
                            .foregroundStyle(isLiked ? Theme.accent : Theme.textSecondary)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
            .opacity(track.unavailableFlag ? 0.58 : 1.0)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                player.play(track: track, queue: queue.isEmpty ? nil : queue)
            } label: {
                Label(track.unavailableFlag ? "Retry Playback" : "Play Now", systemImage: "play.fill")
            }

            Button {
                player.playNext(track)
                library.showToast("Queued \"\(track.title)\" up next")
            } label: {
                Label("Play Next", systemImage: "text.insert")
            }

            Button {
                player.activeAddToPlaylistTrack = track
            } label: {
                Label("Add to Playlist", systemImage: "text.badge.plus")
            }

            if isDownloaded {
                Button(role: .destructive) {
                    offline.removeDownload(trackId: track.id)
                    library.showToast("Removed offline copy")
                } label: {
                    Label("Remove Offline Download", systemImage: "trash")
                }
            } else {
                Button {
                    Task {
                        await offline.download(track: track)
                        if offline.isDownloaded(track.id) {
                            library.showToast("Saved offline for Airplane Mode")
                        } else if let err = offline.lastError {
                            library.showToast(err)
                        }
                    }
                } label: {
                    Label("Save Offline on iPhone", systemImage: "arrow.down.circle")
                }
            }

            Button {
                library.toggleLike(track: track)
            } label: {
                Label(isLiked ? "Unlike" : "Like Song", systemImage: isLiked ? "heart.slash" : "heart")
            }

            Button {
                player.activeInspectTrack = track
            } label: {
                Label("Track Info & Mirrors", systemImage: "info.circle")
            }
        }
    }

    private var eraFallbackColors: [Color] {
        if let hex = track.eraColor, !hex.isEmpty {
            let base = Color(hex: hex)
            return [base.opacity(0.65), Theme.surface]
        }
        return [Theme.violet.opacity(0.35), Theme.surface]
    }
}
