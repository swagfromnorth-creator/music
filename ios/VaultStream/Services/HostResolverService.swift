import Foundation

final class HostResolverService: @unchecked Sendable {
    static let shared = HostResolverService()

    private let session: URLSession
    private let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
    private let tidalAPIs = [
        "https://triton.squid.wtf",
        "https://tidal.kinoplus.online",
        "https://tidal-api.binimum.org",
    ]
    private let qobuzAPI = "https://qobuz.squid.wtf/api/download-music"

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 14
        self.session = URLSession(configuration: cfg)
    }

    static func normalizeUrl(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "pillowcase.su", with: "pillows.su", options: .caseInsensitive)
    }

    static func detectHost(_ rawUrl: String) -> String {
        let url = normalizeUrl(rawUrl).lowercased()
        if url.contains("pixeldrain.com/d/") || url.contains("pixeldrain.com/u/") { return "pixeldrain" }
        if url.contains("pillows.su/f/") || url.contains("pillows.su/api/download/") { return "pillows" }
        if url.contains("krakenfiles.com/view/") { return "krakenfiles" }
        if url.contains("music.froste.lol/song/") { return "froste" }
        if url.contains("imgur.gg/") { return "imgur" }
        if url.contains("tidal.com/") && url.contains("/track/") { return "tidal" }
        if url.contains("qobuz.com/") && url.contains("/track/") { return "qobuz" }
        if url.contains("drive.google.com/file/d/") { return "googledrive" }
        if url.contains("bandcamp.com/track/") { return "bandcamp" }
        if url.contains("soundcloud.com/") { return "soundcloud" }
        if url.contains("youtube.com/") || url.contains("youtu.be/") { return "youtube" }
        if url.contains("juicewrldapi.com/") { return "juicewrld" }
        if url.contains("exoshare.org/") { return "exoshare" }
        if let ext = extractExtension(url), ["flac", "wav", "alac", "aiff", "aif", "m4a", "mp3", "ogg", "aac", "opus"].contains(ext) {
            return "direct"
        }
        return "unknown"
    }

    static func isPlayableHost(_ host: String) -> Bool {
        let playable: Set<String> = [
            "pixeldrain", "pillows", "krakenfiles", "froste", "soundcloud",
            "imgur", "tidal", "qobuz", "juicewrld", "googledrive",
            "youtube", "bandcamp", "direct",
        ]
        return playable.contains(host)
    }

    static func hostPriority(_ host: String) -> Int {
        switch host {
        case "pillows": return 100
        case "pixeldrain": return 95
        case "froste": return 90
        case "direct": return 88
        case "tidal", "qobuz": return 85
        case "juicewrld": return 80
        case "bandcamp": return 75
        case "krakenfiles": return 70
        case "imgur": return 65
        case "googledrive": return 55
        case "soundcloud": return 50
        case "exoshare": return 20
        case "youtube": return 15
        default: return 1
        }
    }

    static func extractExtension(_ s: String?) -> String? {
        guard let s, !s.isEmpty else { return nil }
        let noQuery = s.components(separatedBy: "?").first?.components(separatedBy: "#").first?.lowercased() ?? ""
        guard let dot = noQuery.lastIndex(of: ".") else { return nil }
        let ext = String(noQuery[noQuery.index(after: dot)...])
        return (2...5).contains(ext.count) ? ext : nil
    }

    func resolve(url rawUrl: String) async -> HostResolution {
        let url = Self.normalizeUrl(rawUrl)
        let host = Self.detectHost(url)

        switch host {
        case "pixeldrain":
            return await resolvePixeldrain(url)
        case "pillows":
            if let id = firstCapture(url, pattern: #"pillows\.su/(?:f|api/download)/([a-f0-9]+)"#) {
                return HostResolution(ok: true, sourceUrl: url, resolvedUrl: "https://api.pillows.su/api/download/\(id)", downloadableUrl: "https://api.pillows.su/api/download/\(id)", host: "pillows")
            }
            return fail(url, host, "Could not extract Pillows file ID.")
        case "froste":
            if let id = firstCapture(url, pattern: #"music\.froste\.lol/song/([a-zA-Z0-9]+)"#) {
                let d = "https://music.froste.lol/song/\(id)/download"
                return HostResolution(ok: true, sourceUrl: url, resolvedUrl: d, downloadableUrl: d, host: "froste")
            }
            return fail(url, host, "Could not extract Froste song ID.")
        case "krakenfiles":
            return await resolveKrakenFiles(url)
        case "imgur":
            return await resolveImgur(url)
        case "googledrive":
            if let id = firstCapture(url, pattern: #"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)"#) {
                let d = "https://drive.google.com/uc?export=download&id=\(id)"
                return HostResolution(ok: true, sourceUrl: url, resolvedUrl: d, downloadableUrl: d, host: "googledrive")
            }
            return fail(url, host, "Invalid Google Drive URL.")
        case "tidal":
            return await resolveTidal(url)
        case "qobuz":
            return await resolveQobuz(url)
        case "bandcamp":
            return await resolveBandcamp(url)
        case "soundcloud":
            return await SoundCloudService.shared.resolveStream(url: url)
        case "youtube":
            return await YouTubeService.shared.resolveAudioStream(urlOrId: url)
        case "direct", "juicewrld":
            return HostResolution(ok: true, sourceUrl: url, resolvedUrl: url, downloadableUrl: url, host: host, formatHint: Self.extractExtension(url))
        default:
            return fail(url, host, "Unsupported host URL: \(url)")
        }
    }

    private func resolvePixeldrain(_ url: String) async -> HostResolution {
        guard let id = firstCapture(url, pattern: #"pixeldrain\.com/[du]/([a-zA-Z0-9]+)"#) else {
            return fail(url, "pixeldrain", "Invalid Pixeldrain URL.")
        }
        var name: String?
        var mime: String?
        var size: Int64?

        if let infoUrl = URL(string: "https://pixeldrain.com/api/file/\(id)/info"),
           let (data, res) = try? await session.data(from: infoUrl) {
            if let http = res as? HTTPURLResponse, http.statusCode == 404 {
                return fail(url, "pixeldrain", "Pixeldrain file was deleted (404).")
            }
            if let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                name = info["name"] as? String
                mime = info["mime_type"] as? String
                size = (info["size"] as? NSNumber)?.int64Value
                if let avail = info["availability"] as? String, avail.contains("captcha") {
                    return fail(url, "pixeldrain", (info["availability_message"] as? String) ?? "Pixeldrain requires captcha verification.")
                }
            }
        }
        let direct = "https://pixeldrain.com/api/file/\(id)"
        return HostResolution(ok: true, sourceUrl: url, resolvedUrl: direct, downloadableUrl: direct, host: "pixeldrain", mimeType: mime, filename: name, sizeBytes: size, formatHint: Self.extractExtension(name))
    }

    private func resolveKrakenFiles(_ url: String) async -> HostResolution {
        guard let id = firstCapture(url, pattern: #"krakenfiles\.com/view/([a-zA-Z0-9]+)"#),
              let pageUrl = URL(string: "https://krakenfiles.com/view/\(id)/file.html") else {
            return fail(url, "krakenfiles", "Invalid KrakenFiles URL.")
        }
        var req = URLRequest(url: pageUrl)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        guard let (data, _) = try? await session.data(for: req),
              let html = String(data: data, encoding: .utf8) else {
            return fail(url, "krakenfiles", "Could not load KrakenFiles page.")
        }
        let match = firstCapture(html, pattern: #"m4a:\s*['"]([^'"]+)['"]"#)
            ?? firstCapture(html, pattern: #"<source[^>]+src=['"]([^'"]+)['"]"#)
            ?? firstCapture(html, pattern: #"<audio[^>]+src=['"]([^'"]+)['"]"#)
        guard var media = match else {
            return fail(url, "krakenfiles", "No audio stream found on KrakenFiles page.")
        }
        if media.hasPrefix("//") { media = "https:" + media }
        return HostResolution(ok: true, sourceUrl: url, resolvedUrl: media, downloadableUrl: media, host: "krakenfiles", formatHint: Self.extractExtension(media) ?? "m4a")
    }

    private func resolveImgur(_ url: String) async -> HostResolution {
        guard let id = firstCapture(url, pattern: #"imgur\.gg/f/([a-zA-Z0-9]+)"#)
            ?? firstCapture(url, pattern: #"imgur\.gg/([a-zA-Z0-9]+)"#),
            let apiUrl = URL(string: "https://imgur.gg/api/file/\(id)") else {
            return fail(url, "imgur", "Invalid Imgur.gg URL.")
        }
        if let (data, _) = try? await session.data(from: apiUrl),
           let info = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let cdn = info["cdnUrl"] as? String, !cdn.isEmpty {
            let mime = (info["mediaType"] as? String) ?? (info["mimeType"] as? String)
            return HostResolution(ok: true, sourceUrl: url, resolvedUrl: cdn, downloadableUrl: cdn, host: "imgur", mimeType: mime, filename: info["fileName"] as? String, sizeBytes: (info["size"] as? NSNumber)?.int64Value)
        }
        return fail(url, "imgur", "Unable to resolve Imgur.gg media URL.")
    }

    private func resolveTidal(_ url: String) async -> HostResolution {
        guard let id = firstCapture(url, pattern: #"tidal\.com/(?:browse/)?track/(\d+)"#) else {
            return fail(url, "tidal", "Invalid Tidal track URL.")
        }
        for base in tidalAPIs {
            guard let endpoint = URL(string: "\(base)/track/?id=\(id)&quality=HI_RES_LOSSLESS"),
                  let (data, res) = try? await session.data(from: endpoint),
                  (res as? HTTPURLResponse)?.statusCode == 200,
                  let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let manifestB64 = (root["data"] as? [String: Any])?["manifest"] as? String,
                  let decodedData = Data(base64Encoded: manifestB64),
                  let decoded = try? JSONSerialization.jsonObject(with: decodedData) as? [String: Any],
                  let firstUrl = (decoded["urls"] as? [String])?.first else {
                continue
            }
            return HostResolution(ok: true, sourceUrl: url, resolvedUrl: firstUrl, downloadableUrl: firstUrl, host: "tidal", mimeType: decoded["mimeType"] as? String ?? "audio/flac", formatHint: "flac")
        }
        return fail(url, "tidal", "Tidal mirror endpoints unavailable.")
    }

    private func resolveQobuz(_ url: String) async -> HostResolution {
        guard let id = firstCapture(url, pattern: #"qobuz\.com/(?:[^/]+/)?track/(\d+)"#),
              let endpoint = URL(string: "\(qobuzAPI)?track_id=\(id)&quality=27"),
              let (data, _) = try? await session.data(from: endpoint),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let stream = (root["data"] as? [String: Any])?["url"] as? String else {
            return fail(url, "qobuz", "Unable to resolve Qobuz stream.")
        }
        return HostResolution(ok: true, sourceUrl: url, resolvedUrl: stream, downloadableUrl: stream, host: "qobuz", mimeType: "audio/flac", formatHint: "flac")
    }

    private func resolveBandcamp(_ url: String) async -> HostResolution {
        guard let target = URL(string: url) else { return fail(url, "bandcamp", "Invalid Bandcamp URL.") }
        var req = URLRequest(url: target)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        guard let (data, _) = try? await session.data(for: req),
              let html = String(data: data, encoding: .utf8) else {
            return fail(url, "bandcamp", "Could not fetch Bandcamp track page.")
        }
        guard let mp3 = firstCapture(html, pattern: #"(https://t4\.bcbits\.com/stream/[^"'\s&]+)"#)
            ?? firstCapture(html, pattern: #""mp3-128"\s*:\s*"([^"]+)""#) else {
            return fail(url, "bandcamp", "No streamable Bandcamp audio found.")
        }
        let cleanUrl = mp3.replacingOccurrences(of: "&amp;", with: "&")
        let title = firstCapture(html, pattern: #"<meta\s+property="og:title"\s+content="([^"]+)""#)
        let thumb = firstCapture(html, pattern: #"<meta\s+property="og:image"\s+content="([^"]+)""#)
        return HostResolution(ok: true, sourceUrl: url, resolvedUrl: cleanUrl, downloadableUrl: cleanUrl, host: "bandcamp", mimeType: "audio/mpeg", formatHint: "mp3", title: title, thumbnail: thumb)
    }

    private func fail(_ sourceUrl: String, _ host: String, _ message: String) -> HostResolution {
        HostResolution(ok: false, sourceUrl: sourceUrl, host: host, errorCode: "resolve_failed", errorMessage: message)
    }

    private func firstCapture(_ text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text)) else {
            return nil
        }
        let idx = match.numberOfRanges > 1 ? 1 : 0
        guard let r = Range(match.range(at: idx), in: text) else { return nil }
        return String(text[r])
    }
}
