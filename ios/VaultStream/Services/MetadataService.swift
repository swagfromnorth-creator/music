import Foundation

struct MusicBrainzMatch: Sendable {
    let title: String
    let artist: String
    let album: String?
    let year: String?
    let coverArtUrl: String?
}

struct SpotifyTrackInput: Sendable {
    let title: String
    let artist: String
    let album: String?
}

final class MetadataService: @unchecked Sendable {
    static let shared = MetadataService()
    private let session: URLSession
    private let userAgent = "VaultStream/1.0 (https://github.com/swagfromnorth-creator/music)"

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: cfg)
    }

    static func cleanTitleAndArtist(rawTitle: String, rawArtist: String = "") -> (title: String, artist: String) {
        var text = rawTitle
            .replacingOccurrences(of: #"\((?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|explicit|clean)\)"#, with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\[(?:official\s+)?(?:music\s+)?(?:video|audio|lyric\s*video|lyrics|visualizer|hd|hq|4k|explicit|clean|prod\.?[^\]]*|cdq|lossless|snippet|leak)\]"#, with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+\|\s+.*$"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        var artist = rawArtist
            .replacingOccurrences(of: #"\s*-\s*Topic$"#, with: "", options: .caseInsensitive)
            .replacingOccurrences(of: #"VEVO$"#, with: "", options: .caseInsensitive)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let separators = [" — ", " – ", " - "]
        for sep in separators {
            let parts = text.components(separatedBy: sep)
            if parts.count >= 2 && !parts[0].trimmingCharacters(in: .whitespaces).isEmpty {
                artist = parts[0].trimmingCharacters(in: .whitespaces)
                text = parts.dropFirst().joined(separator: sep).trimmingCharacters(in: .whitespaces)
                break
            }
        }

        let cleanTitle = text
            .replacingOccurrences(of: #"\s*[\[(](?:feat|ft|with)\.?\s+[^)\]]+[\])]"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return (cleanTitle.isEmpty ? rawTitle.trimmingCharacters(in: .whitespacesAndNewlines) : cleanTitle, artist)
    }

    func lookupMusicBrainz(title rawTitle: String, artist rawArtist: String = "") async -> MusicBrainzMatch? {
        let cleaned = Self.cleanTitleAndArtist(rawTitle: rawTitle, rawArtist: rawArtist)
        guard !cleaned.title.isEmpty else { return nil }

        let esc: (String) -> String = { $0.replacingOccurrences(of: "\"", with: " ").trimmingCharacters(in: .whitespaces) }
        var q = "recording:\"\(esc(cleaned.title))\""
        if !cleaned.artist.isEmpty {
            q += " AND artist:\"\(esc(cleaned.artist))\""
        }
        guard let qEnc = q.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://musicbrainz.org/ws/2/recording/?query=\(qEnc)&fmt=json&limit=5") else {
            return nil
        }

        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        guard let (data, _) = try? await session.data(for: req),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let recs = root["recordings"] as? [[String: Any]],
              let best = recs.first else {
            return nil
        }

        let recTitle = (best["title"] as? String) ?? cleaned.title
        let credits = (best["artist-credit"] as? [[String: Any]]) ?? []
        let recArtist = credits.compactMap { $0["name"] as? String }.joined(separator: ", ")
        let releases = (best["releases"] as? [[String: Any]]) ?? []
        let rel = releases.first(where: { ($0["status"] as? String) == "Official" }) ?? releases.first
        let releaseId = rel?["id"] as? String
        let albumTitle = rel?["title"] as? String
        let dateStr = rel?["date"] as? String
        let year = dateStr.map { String($0.prefix(4)) }

        var coverUrl: String?
        if let releaseId, let probeUrl = URL(string: "https://coverartarchive.org/release/\(releaseId)/front-500") {
            var head = URLRequest(url: probeUrl)
            head.httpMethod = "HEAD"
            if let (_, res) = try? await session.data(for: head),
               let http = res as? HTTPURLResponse,
               (200...399).contains(http.statusCode) {
                coverUrl = http.url?.absoluteString ?? probeUrl.absoluteString
            }
        }

        return MusicBrainzMatch(
            title: recTitle,
            artist: recArtist.isEmpty ? cleaned.artist : recArtist,
            album: albumTitle,
            year: year,
            coverArtUrl: coverUrl
        )
    }

    static func parseSpotifyInput(_ content: String) -> [SpotifyTrackInput] {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }

        // 1) SpotDL JSON array
        if trimmed.hasPrefix("["),
           let data = trimmed.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            return arr.compactMap { obj in
                let name = (obj["name"] as? String) ?? (obj["title"] as? String) ?? ""
                guard !name.isEmpty else { return nil }
                let artistsArr = (obj["artists"] as? [String])?.joined(separator: ", ")
                let artist = artistsArr ?? (obj["artist"] as? String) ?? ""
                return SpotifyTrackInput(title: name, artist: artist, album: obj["album_name"] as? String ?? obj["album"] as? String)
            }
        }

        // 2) Exportify CSV or line-by-line "Artist - Title"
        let lines = trimmed.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        guard !lines.isEmpty else { return [] }

        if lines[0].lowercased().contains("track name") {
            let cols = parseCSVRow(lines[0]).map { $0.lowercased() }
            let nameIdx = cols.firstIndex(where: { $0.contains("track name") }) ?? 1
            let artistIdx = cols.firstIndex(where: { $0.contains("artist name") }) ?? 3
            let albumIdx = cols.firstIndex(where: { $0.contains("album name") })
            return lines.dropFirst().compactMap { line in
                let fields = parseCSVRow(line)
                guard nameIdx < fields.count else { return nil }
                let t = fields[nameIdx].trimmingCharacters(in: .whitespacesAndNewlines)
                guard !t.isEmpty else { return nil }
                let a = artistIdx < fields.count ? fields[artistIdx].trimmingCharacters(in: .whitespacesAndNewlines) : ""
                let alb = albumIdx.flatMap { $0 < fields.count ? fields[$0].trimmingCharacters(in: .whitespacesAndNewlines) : nil }
                return SpotifyTrackInput(title: t, artist: a, album: alb)
            }
        }

        return lines.compactMap { line in
            let parsed = cleanTitleAndArtist(rawTitle: line)
            return SpotifyTrackInput(title: parsed.title, artist: parsed.artist, album: nil)
        }
    }

    private static func parseCSVRow(_ line: String) -> [String] {
        var out: [String] = []
        var field = ""
        var quoted = false
        for ch in line {
            if ch == "\"" {
                quoted.toggle()
            } else if ch == "," && !quoted {
                out.append(field)
                field = ""
            } else {
                field.append(ch)
            }
        }
        out.append(field)
        return out
    }
}
