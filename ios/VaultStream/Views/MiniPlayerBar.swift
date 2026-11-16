import SwiftUI

struct MiniPlayerBar: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var offline: OfflineStore

    var body: some View {
        if let track = player.currentTrack {
            VStack(spacing: 0) {
                Button {
                    player.showNowPlayingSheet = true
                } label: {
                    HStack(spacing: 10) {
                        ArtworkImage(urlString: track.eraImage, cornerRadius: 8)
                            .frame(width: 42, height: 42)

                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 5) {
                                Text(track.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.textPrimary)
                                    .lineLimit(1)

                                if offline.isDownloaded(track.id) {
                                    Image(systemName: "arrow.down.circle.fill")
                                        .font(.system(size: 10))
                                        .foregroundStyle(Theme.accent)
                                }
                            }

                            Text(track.artist)
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(1)
                        }

                        Spacer(minLength: 4)

                        HStack(spacing: 14) {
                            Button {
                                player.togglePlayPause()
                            } label: {
                                if player.isLoading {
                                    ProgressView()
                                        .tint(Theme.textPrimary)
                                        .frame(width: 28, height: 28)
                                } else {
                                    Image(systemName: player.isPlaying ? "pause.fill" : "play.fill")
                                        .font(.system(size: 20, weight: .semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                        .frame(width: 28, height: 28)
                                }
                            }
                            .buttonStyle(.plain)

                            Button {
                                player.next()
                            } label: {
                                Image(systemName: "forward.fill")
                                    .font(.system(size: 17))
                                    .foregroundStyle(Theme.textPrimary)
                                    .frame(width: 26, height: 28)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.plain)

                // Thin live progress bar along bottom edge
                GeometryReader { geo in
                    let pct: CGFloat = player.duration > 0 ? CGFloat(min(1, max(0, player.currentTime / player.duration))) : 0
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Color.white.opacity(0.08))
                        Rectangle()
                            .fill(Theme.accent)
                            .frame(width: geo.size.width * pct)
                    }
                }
                .frame(height: 2)
            }
            .background(.ultraThinMaterial)
            .background(Theme.surfaceElevated.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.45), radius: 12, y: 4)
            .padding(.horizontal, 10)
            .padding(.bottom, 6)
        }
    }
}
