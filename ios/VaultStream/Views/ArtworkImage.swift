import SwiftUI
import UIKit

@MainActor
final class ImageMemoryCache {
    static let shared = ImageMemoryCache()
    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 350
    }

    func image(for url: URL) -> UIImage? {
        cache.object(forKey: url.absoluteString as NSString)
    }

    func insert(_ image: UIImage, for url: URL) {
        cache.setObject(image, forKey: url.absoluteString as NSString)
    }
}

struct ArtworkImage: View {
    let urlString: String?
    var cornerRadius: CGFloat = 10
    var fallbackColors: [Color] = [Theme.surfaceElevated, Theme.surface]
    var fallbackIcon: String = "music.note"

    @State private var loadedImage: UIImage?
    @State private var attemptedURL: URL?

    private var resolvedURL: URL? {
        guard var raw = urlString?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.hasPrefix("//") { raw = "https:" + raw }
        return URL(string: raw)
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: fallbackColors,
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            if let image = loadedImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity.animation(.easeOut(duration: 0.18)))
            } else {
                Image(systemName: fallbackIcon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary.opacity(0.65))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Theme.border, lineWidth: 0.5)
        )
        .task(id: resolvedURL?.absoluteString ?? "") {
            await fetchImageIfNeeded()
        }
    }

    private func fetchImageIfNeeded() async {
        guard let target = resolvedURL else {
            loadedImage = nil
            attemptedURL = nil
            return
        }
        if let cached = ImageMemoryCache.shared.image(for: target) {
            loadedImage = cached
            attemptedURL = target
            return
        }
        if attemptedURL == target && loadedImage != nil { return }
        attemptedURL = target

        do {
            var req = URLRequest(url: target)
            req.cachePolicy = .returnCacheDataElseLoad
            req.timeoutInterval = 15
            req.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)", forHTTPHeaderField: "User-Agent")
            let (data, _) = try await URLSession.shared.data(for: req)
            if let img = UIImage(data: data) {
                ImageMemoryCache.shared.insert(img, for: target)
                loadedImage = img
            }
        } catch {
            // Keep placeholder gradient on transient image failure
        }
    }
}

struct PlaylistCoverView: View {
    let playlist: PlaylistRecord
    var size: CGFloat = 56
    var cornerRadius: CGFloat = 10

    var body: some View {
        Group {
            if let directCover = playlist.coverImage, !directCover.isEmpty {
                ArtworkImage(
                    urlString: directCover,
                    cornerRadius: cornerRadius,
                    fallbackColors: Color.parseCSSGradientColors(playlist.coverGradient),
                    fallbackIcon: "music.note.list"
                )
            } else if playlist.previewImages.count >= 4 {
                VStack(spacing: 1) {
                    HStack(spacing: 1) {
                        ArtworkImage(urlString: playlist.previewImages[0], cornerRadius: 0)
                        ArtworkImage(urlString: playlist.previewImages[1], cornerRadius: 0)
                    }
                    HStack(spacing: 1) {
                        ArtworkImage(urlString: playlist.previewImages[2], cornerRadius: 0)
                        ArtworkImage(urlString: playlist.previewImages[3], cornerRadius: 0)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            } else if let first = playlist.previewImages.first {
                ArtworkImage(
                    urlString: first,
                    cornerRadius: cornerRadius,
                    fallbackColors: Color.parseCSSGradientColors(playlist.coverGradient),
                    fallbackIcon: "music.note.list"
                )
            } else {
                ZStack {
                    LinearGradient(
                        colors: Color.parseCSSGradientColors(playlist.coverGradient),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    Image(systemName: "music.note.list")
                        .font(.system(size: size * 0.36, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                }
                .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            }
        }
        .frame(width: size, height: size)
    }
}
