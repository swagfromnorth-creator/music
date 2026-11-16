import Foundation

final class SoundCloudService: @unchecked Sendable {
    static let shared = SoundCloudService()

    private let session: URLSession
    private let clientIdKey = "sc_cached_client_id_v2"
    private let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 16
        self.session = URLSession(configuration: cfg)
    }

    func fetchClientId(forceRefresh: Bool = false) async throws -> String {
        if !forceRefresh, let cached = UserDefaults.standard.string(forKey: clientIdKey), !cached.isEmpty {
            return cached
        }

        guard let homeURL = URL(string: "https://soundcloud.com") else { throw URLError(.badURL) }
        var req = URLRequest(url: homeURL)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, _) = try await session.data(for: req)
        let html = String(data: data, encoding: .utf8) ?? ""

        let regex = try NSRegularExpression(pattern: #"https://a-v2\.sndcdn\.com/assets/[^\s"']+\.js"#)
        let matches = regex.matches(in: html, range: NSRange(html.startIndex..<html.endIndex, in: html))
        let scriptUrls = matches.compactMap { m -> String? in
            guard let r = Range(m.range, in: html) else { return nil }
            return String(html[r])
        }

        let cidRegex = try NSRegularExpression(pattern: #"client_id[:=]"([a-zA-Z0-9]{20,40})""#)
        for jsUrlStr in scriptUrls.suffix(6).reversed() {
            guard let jsUrl = URL(string: jsUrlStr) else { continue }
            var jsReq = URLRequest(url: jsUrl)
            jsReq.setValue(userAgent, forHTTPHeaderField: "User-Agent")
            if let (jsData, _) = try? await session.data(for: jsReq),
               let jsText = String(data: jsData, encoding: .utf8),
               let hit = cidRegex.firstMatch(in: jsText, range: NSRange(jsText.startIndex..<jsText.endIndex, in: jsText)),
               let idRange = Range(hit.range(at: 1), in: jsText) {
                let cid = String(jsText[idRange])
                UserDefaults.standard.set(cid, forKey: clientIdKey)
                return cid
            }
        }

        throw NSError(domain: "SoundCloudService", code: 500, userInfo: [NSLocalizedDescriptionKey: "Unable to acquire SoundCloud client_id."])
    }

    func search(query: String, limit: Int = 15) async throws -> (tracks: [OnlineSearchResult], collections: [OnlineCollectionResult]) {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return ([], []) }

        let cid = try await fetchClientId()
        let qEnc = clean.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? clean

        async let tracksReq = fetchJSON("https://api-v2.soundcloud.com/search/tracks?q=\(qEnc)&client_id=\(cid)&limit=\(limit)")
        async let playlistsReq = fetchJSON("https://api-v2.soundcloud.com/search/playlists?q=\(qEnc)&client_id=\(cid)&limit=6")

        var tracksData = try? await tracksReq
        if tracksData == nil {
            let freshCid = try await fetchClientId(forceRefresh: true)
            tracksData = try? await fetchJSON("https://api-v2.soundcloud.com/search/tracks?q=\(qEnc)&client_id=\(freshCid)&limit=\(limit)")
        }
        let playlistsData = try? await playlistsReq

        let tracks = ((tracksData?["collection"] as? [[String: Any]]) ?? []).compactMap { mapTrack($0) }
        let collections = ((playlistsData?["collection"] as? [[String: Any]]) ?? []).compactMap { mapCollection($0) }
        return (tracks, collections)
    }

    func resolveStream(url: String) async -> HostResolution {
        do {
            var cid = try await fetchClientId()
            let enc = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
            var resolved = try? await fetchJSON("https://api-v2.soundcloud.com/resolve?url=\(enc)&client_id=\(cid)")
            if resolved == nil {
                cid = try await fetchClientId(forceRefresh: true)
                resolved = try await fetchJSON("https://api-v2.soundcloud.com/resolve?url=\(enc)&client_id=\(cid)")
            }

            guard let trackObj = resolved else {
                return HostResolution(ok: false, sourceUrl: url, host: "soundcloud", errorCode: "not_found", errorMessage: "SoundCloud track not found.")
            }

            let media = trackObj["media"] as? [String: Any]
            let transcodings = (media?["transcodings"] as? [[String: Any]]) ?? []

            // Pick best playable transcoding: prefer progressive MP3 if present, otherwise AAC HLS (.m3u8 native in AVPlayer)
            let chosen = transcodings.first(where: {
                (($0["format"] as? [String: Any])?["protocol"] as? String) == "progressive"
            }) ?? transcodings.first(where: {
                let preset = ($0["preset"] as? String) ?? ""
                return preset.contains("aac") && (($0["format"] as? [String: Any])?["protocol"] as? String) == "hls"
            }) ?? transcodings.first(where: {
                (($0["format"] as? [String: Any])?["protocol"] as? String) == "hls"
            }) ?? transcodings.first

            guard let chosen, let transcodingURL = chosen["url"] as? String else {
                return HostResolution(ok: false, sourceUrl: url, host: "soundcloud", errorCode: "no_streams", errorMessage: "No playable SoundCloud stream found (may require Go+).")
            }

            let sep = transcodingURL.contains("?") ? "&" : "?"
            let streamInfo = try await fetchJSON("\(transcodingURL)\(sep)client_id=\(cid)")
            guard let finalUrl = streamInfo["url"] as? String, !finalUrl.isEmpty else {
                return HostResolution(ok: false, sourceUrl: url, host: "soundcloud", errorCode: "stream_missing", errorMessage: "SoundCloud did not return a CDN stream URL.")
            }

            let isHLS = finalUrl.contains(".m3u8") || (transcodingProtocol(chosen) == "hls")
            let mapped = mapTrack(trackObj)
            return HostResolution(
                ok: true,
                sourceUrl: url,
                resolvedUrl: finalUrl,
                downloadableUrl: isHLS ? nil : finalUrl,
                host: "soundcloud",
                mimeType: isHLS ? "application/vnd.apple.mpegurl" : "audio/mpeg",
                formatHint: isHLS ? "m3u8" : "mp3",
                httpHeaders: ["User-Agent": userAgent],
                title: mapped?.title,
                artist: mapped?.artist,
                thumbnail: mapped?.thumbnail,
                durationSec: mapped?.durationSec
            )
        } catch {
            return HostResolution(ok: false, sourceUrl: url, host: "soundcloud", errorCode: "resolve_failed", errorMessage: error.localizedDescription)
        }
    }

    func fetchPlaylist(url: String) async throws -> (title: String, artist: String, thumbnail: String?, tracks: [OnlineSearchResult]) {
        let cid = try await fetchClientId()
        let enc = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? url
        let obj = try await fetchJSON("https://api-v2.soundcloud.com/resolve?url=\(enc)&client_id=\(cid)")
        let title = (obj["title"] as? String) ?? "SoundCloud Set"
        let user = (obj["user"] as? [String: Any])?["username"] as? String ?? "SoundCloud"
        let thumb = upgradeArt((obj["artwork_url"] as? String) ?? ((obj["user"] as? [String: Any])?["avatar_url"] as? String))

        let rawTracks = (obj["tracks"] as? [[String: Any]]) ?? []
        var parsed: [OnlineSearchResult] = []
        var missingIds: [Int] = []
        for t in rawTracks {
            if let mapped = mapTrack(t) {
                parsed.append(mapped)
            } else if let tid = t["id"] as? Int {
                missingIds.append(tid)
            }
        }

        if !missingIds.isEmpty {
            let idsJoined = missingIds.prefix(40).map(String.init).joined(separator: ",")
            if let arr = try? await fetchJSONArray("https://api-v2.soundcloud.com/tracks?ids=\(idsJoined)&client_id=\(cid)") {
                for item in arr {
                    if let mapped = mapTrack(item) { parsed.append(mapped) }
                }
            }
        }

        return (title, user, thumb, parsed)
    }

    private func transcodingProtocol(_ t: [String: Any]) -> String? {
        (t["format"] as? [String: Any])?["protocol"] as? String
    }

    private func mapTrack(_ obj: [String: Any]) -> OnlineSearchResult? {
        guard let title = obj["title"] as? String,
              let permalink = obj["permalink_url"] as? String else {
            return nil
        }
        let idStr = (obj["id"] as? NSNumber)?.stringValue ?? permalink
        let artist = ((obj["user"] as? [String: Any])?["username"] as? String) ?? "SoundCloud"
        let ms = (obj["duration"] as? Double) ?? 0
        let secs = ms > 0 ? ms / 1000.0 : nil
        let durText = secs.map { Formatters.duration($0) }
        let thumb = upgradeArt((obj["artwork_url"] as? String) ?? ((obj["user"] as? [String: Any])?["avatar_url"] as? String))

        return OnlineSearchResult(
            id: idStr,
            source: "soundcloud",
            url: permalink,
            title: title,
            artist: artist,
            album: nil,
            durationSec: secs,
            durationText: durText,
            thumbnail: thumb
        )
    }

    private func mapCollection(_ obj: [String: Any]) -> OnlineCollectionResult? {
        guard let title = obj["title"] as? String,
              let permalink = obj["permalink_url"] as? String else {
            return nil
        }
        let idStr = (obj["id"] as? NSNumber)?.stringValue ?? permalink
        let artist = ((obj["user"] as? [String: Any])?["username"] as? String) ?? "SoundCloud"
        let thumb = upgradeArt(obj["artwork_url"] as? String)
        let count = (obj["track_count"] as? Int) ?? 0
        return OnlineCollectionResult(
            id: idStr,
            kind: (obj["is_album"] as? Bool) == true ? "album" : "playlist",
            source: "soundcloud",
            browseId: permalink,
            url: permalink,
            title: title,
            artist: artist,
            subtitle: count > 0 ? "\(count) tracks" : "SoundCloud Set",
            thumbnail: thumb
        )
    }

    private func upgradeArt(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        return raw.replacingOccurrences(of: "-large.", with: "-t500x500.")
    }

    private func fetchJSON(_ urlStr: String) async throws -> [String: Any] {
        guard let url = URL(string: urlStr) else { throw URLError(.badURL) }
        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, res) = try await session.data(for: req)
        if let http = res as? HTTPURLResponse, http.statusCode >= 400 {
            throw APIErrorCompat.http(http.statusCode)
        }
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func fetchJSONArray(_ urlStr: String) async throws -> [[String: Any]] {
        guard let url = URL(string: urlStr) else { throw URLError(.badURL) }
        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, _) = try await session.data(for: req)
        return (try JSONSerialization.jsonObject(with: data) as? [[String: Any]]) ?? []
    }
}

private enum APIErrorCompat: Error {
    case http(Int)
}
