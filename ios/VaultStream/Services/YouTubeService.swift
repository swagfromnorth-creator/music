import CryptoKit
import Foundation
import JavaScriptCore
import WebKit

struct YouTubeResolvedAudio: Sendable {
    let streamUrl: String
    let downloadableUrl: String?
    let mimeType: String
    let httpHeaders: [String: String]
    let title: String?
    let artist: String?
    let durationSec: Double?
    let thumbnail: String?
}

final class YouTubeService: @unchecked Sendable {
    static let shared = YouTubeService()

    private let session: URLSession
    private let webUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    private let iosUA = "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)"
    private let androidVRUA = "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 18
        cfg.timeoutIntervalForResource = 45
        self.session = URLSession(configuration: cfg)
    }

    // MARK: - Auth Cookie Bridge (Optional User Sign-In via WKWebView)

    @MainActor
    func hasSignedInYouTubeSession() async -> Bool {
        let cookies = await WKWebsiteDataStore.default().httpCookieStore.allCookies()
        return cookies.contains {
            $0.domain.contains("youtube.com") && ($0.name == "SAPISID" || $0.name == "__Secure-3PAPISID" || $0.name == "LOGIN_INFO")
        }
    }

    @MainActor
    func clearYouTubeSession() async {
        let store = WKWebsiteDataStore.default().httpCookieStore
        let cookies = await store.allCookies()
        for cookie in cookies where cookie.domain.contains("youtube.com") || cookie.domain.contains("google.com") {
            await store.deleteCookie(cookie)
        }
    }

    @MainActor
    private func authHeaders(origin: String = "https://www.youtube.com") async -> [String: String] {
        let cookies = await WKWebsiteDataStore.default().httpCookieStore.allCookies()
        let ytCookies = cookies.filter {
            $0.domain.contains("youtube.com") || $0.domain.contains("google.com")
        }
        guard !ytCookies.isEmpty else { return [:] }
        let cookieHeader = ytCookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
        var headers: [String: String] = ["Cookie": cookieHeader]

        if let sapisid = ytCookies.first(where: { $0.name == "SAPISID" || $0.name == "__Secure-3PAPISID" })?.value {
            let ts = Int(Date().timeIntervalSince1970)
            let sig = HashHelper.sha1Hex("\(ts) \(sapisid) \(origin)")
            headers["Authorization"] = "SAPISIDHASH \(ts)_\(sig)"
            headers["X-Origin"] = origin
        }
        return headers
    }

    // MARK: - YouTube Music Search (Songs, Albums, Playlists)

    func searchYouTubeMusic(query: String, limit: Int = 12) async throws -> (tracks: [OnlineSearchResult], collections: [OnlineCollectionResult]) {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return ([], []) }

        async let songsReq = postMusicSearch(query: clean, params: "EgWKAQIIAWoKEAkQBRAKEAMQBQ==")
        async let albumsReq = postMusicSearch(query: clean, params: "EgWKAQIYAWoKEAkQBRAKEAMQBQ==")
        async let playlistsReq = postMusicSearch(query: clean, params: "EgWKAQIoAWoKEAkQBRAKEAMQBQ==")

        let songsRaw = try? await songsReq
        let albumsRaw = try? await albumsReq
        let playlistsRaw = try? await playlistsReq

        var tracks: [OnlineSearchResult] = []
        if let songsRaw {
            tracks = parseMusicTrackRenderers(from: songsRaw, fallbackAlbum: nil, limit: limit)
        }

        var collections: [OnlineCollectionResult] = []
        if let albumsRaw {
            collections.append(contentsOf: parseMusicCollectionRenderers(from: albumsRaw, kind: "album", limit: 4))
        }
        if let playlistsRaw {
            collections.append(contentsOf: parseMusicCollectionRenderers(from: playlistsRaw, kind: "playlist", limit: 4))
        }
        return (tracks, collections)
    }

    private func postMusicSearch(query: String, params: String?) async throws -> [String: Any] {
        guard let url = URL(string: "https://music.youtube.com/youtubei/v1/search?alt=json") else {
            throw URLError(.badURL)
        }
        var payload: [String: Any] = [
            "context": [
                "client": [
                    "clientName": "WEB_REMIX",
                    "clientVersion": "1.20250101.01.00",
                    "hl": "en",
                    "gl": "US",
                ]
            ],
            "query": query,
        ]
        if let params { payload["params"] = params }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(webUA, forHTTPHeaderField: "User-Agent")
        req.setValue("https://music.youtube.com", forHTTPHeaderField: "Origin")
        req.setValue("https://music.youtube.com/", forHTTPHeaderField: "Referer")
        req.setValue("67", forHTTPHeaderField: "X-YouTube-Client-Name")
        req.setValue("1.20250101.01.00", forHTTPHeaderField: "X-YouTube-Client-Version")
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await session.data(for: req)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    // MARK: - YouTube Video Search

    func searchYouTubeVideos(query: String, limit: Int = 12) async throws -> [OnlineSearchResult] {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty, let url = URL(string: "https://www.youtube.com/youtubei/v1/search?alt=json") else {
            return []
        }

        let payload: [String: Any] = [
            "context": [
                "client": [
                    "clientName": "WEB",
                    "clientVersion": "2.20250101.00.00",
                    "hl": "en",
                    "gl": "US",
                ]
            ],
            "query": clean,
        ]

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(webUA, forHTTPHeaderField: "User-Agent")
        req.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await session.data(for: req)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return []
        }

        var renderers: [[String: Any]] = []
        collectDicts(root, matchingKey: "videoRenderer", into: &renderers)

        var seen = Set<String>()
        var out: [OnlineSearchResult] = []
        for item in renderers {
            guard let vid = item["videoId"] as? String, !vid.isEmpty, seen.insert(vid).inserted else { continue }
            let title = extractText(item["title"]) ?? "Untitled"
            let artist = extractText(item["ownerText"]) ?? extractText(item["longBylineText"]) ?? "YouTube"
            let durText = extractText(item["lengthText"])
            let durSec = Self.parseDurationText(durText)
            let thumbs = (item["thumbnail"] as? [String: Any])?["thumbnails"] as? [[String: Any]]
            let thumb = upgradeThumb(thumbs?.last?["url"] as? String)

            out.append(OnlineSearchResult(
                id: vid,
                source: "youtube",
                url: "https://www.youtube.com/watch?v=\(vid)",
                title: title,
                artist: artist,
                album: nil,
                durationSec: durSec,
                durationText: durText,
                thumbnail: thumb
            ))
            if out.count >= limit { break }
        }
        return out
    }

    // MARK: - Fetch Album or Playlist Collection

    func fetchCollection(idOrUrl: String, titleHint: String? = nil, artistHint: String? = nil, thumbHint: String? = nil) async throws -> (title: String, artist: String, thumbnail: String?, tracks: [OnlineSearchResult]) {
        let input = idOrUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        var browseId = input
        if let listRange = input.range(of: #"[?&]list=([a-zA-Z0-9_-]+)"#, options: .regularExpression) {
            let matchStr = String(input[listRange])
            if let eq = matchStr.firstIndex(of: "=") {
                let rawList = String(matchStr[matchStr.index(after: eq)...])
                browseId = rawList.hasPrefix("VL") ? rawList : "VL\(rawList)"
            }
        } else if let mpreRange = input.range(of: #"MPREb_[a-zA-Z0-9_-]+"#, options: .regularExpression) {
            browseId = String(input[mpreRange])
        } else if input.hasPrefix("PL") || input.hasPrefix("OLAK") || input.hasPrefix("RDCLAK") {
            browseId = "VL\(input)"
        }

        // 1) Try Music InnerTube Browse
        if let url = URL(string: "https://music.youtube.com/youtubei/v1/browse?alt=json") {
            let payload: [String: Any] = [
                "context": [
                    "client": [
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20250101.01.00",
                        "hl": "en",
                        "gl": "US",
                    ]
                ],
                "browseId": browseId,
            ]
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue(webUA, forHTTPHeaderField: "User-Agent")
            req.setValue("https://music.youtube.com", forHTTPHeaderField: "Origin")
            req.httpBody = try JSONSerialization.data(withJSONObject: payload)

            if let (data, _) = try? await session.data(for: req),
               let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let headerTitle = findHeaderTitle(in: root) ?? titleHint ?? "Imported Collection"
                let headerThumb = upgradeThumb(findHeaderThumb(in: root)) ?? thumbHint
                let parsed = parseMusicTrackRenderers(from: root, fallbackAlbum: headerTitle, limit: 60)
                if !parsed.isEmpty {
                    let inferredArtist = artistHint ?? parsed.first?.artist ?? "Various Artists"
                    return (headerTitle, inferredArtist, headerThumb, parsed)
                }
            }
        }

        // 2) Fallback to Standard YouTube Browse for standard playlists
        if let url = URL(string: "https://www.youtube.com/youtubei/v1/browse?alt=json") {
            let payload: [String: Any] = [
                "context": [
                    "client": [
                        "clientName": "WEB",
                        "clientVersion": "2.20250101.00.00",
                        "hl": "en",
                        "gl": "US",
                    ]
                ],
                "browseId": browseId.hasPrefix("VL") ? browseId : "VL\(browseId)",
            ]
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue(webUA, forHTTPHeaderField: "User-Agent")
            req.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (data, _) = try await session.data(for: req)
            if let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                var items: [[String: Any]] = []
                collectDicts(root, matchingKey: "playlistVideoRenderer", into: &items)
                let colTitle = findHeaderTitle(in: root) ?? titleHint ?? "YouTube Playlist"
                var tracks: [OnlineSearchResult] = []
                var seen = Set<String>()
                for item in items {
                    guard let vid = item["videoId"] as? String, !vid.isEmpty, seen.insert(vid).inserted else { continue }
                    let title = extractText(item["title"]) ?? "Untitled"
                    let artist = extractText(item["shortBylineText"]) ?? artistHint ?? "YouTube"
                    let durText = extractText(item["lengthText"])
                    let thumbs = (item["thumbnail"] as? [String: Any])?["thumbnails"] as? [[String: Any]]
                    let thumb = upgradeThumb(thumbs?.last?["url"] as? String) ?? thumbHint
                    tracks.append(OnlineSearchResult(
                        id: vid,
                        source: "youtube",
                        url: "https://www.youtube.com/watch?v=\(vid)",
                        title: title,
                        artist: artist,
                        album: colTitle,
                        durationSec: Self.parseDurationText(durText),
                        durationText: durText,
                        thumbnail: thumb
                    ))
                    if tracks.count >= 60 { break }
                }
                if !tracks.isEmpty {
                    return (colTitle, artistHint ?? tracks.first?.artist ?? "YouTube", thumbHint ?? tracks.first?.thumbnail, tracks)
                }
            }
        }

        throw NSError(domain: "YouTubeService", code: 404, userInfo: [NSLocalizedDescriptionKey: "Could not load tracks from that playlist/album."])
    }

    // MARK: - Direct Stream Resolution (IOS -> ANDROID_VR -> TVHTML5 -> WEB+JSContext)

    static func extractVideoId(from rawUrl: String) -> String? {
        if rawUrl.range(of: #"^[a-zA-Z0-9_-]{11}$"#, options: .regularExpression) != nil {
            return rawUrl
        }
        guard let comps = URLComponents(string: rawUrl) else { return nil }
        if let v = comps.queryItems?.first(where: { $0.name == "v" })?.value, !v.isEmpty {
            return v
        }
        let host = (comps.host ?? "").lowercased()
        let parts = comps.path.split(separator: "/").map(String.init)
        if host.contains("youtu.be"), let first = parts.first, !first.isEmpty {
            return first
        }
        if let idx = parts.firstIndex(where: { $0 == "shorts" || $0 == "embed" || $0 == "live" }), idx + 1 < parts.count {
            return parts[idx + 1]
        }
        return nil
    }

    func resolveAudioStream(urlOrId: String) async -> HostResolution {
        guard let videoId = Self.extractVideoId(from: urlOrId) else {
            return HostResolution(ok: false, sourceUrl: urlOrId, host: "youtube", errorCode: "invalid_url", errorMessage: "Invalid YouTube URL or video ID.")
        }

        let auth = await authHeaders()
        var lastError = "YouTube refused playback for this video."

        // 1) Try IOS client (clean direct M4A / HLS)
        if let res = await tryPlayerClient(
            videoId: videoId,
            sourceUrl: urlOrId,
            clientName: "IOS",
            clientVersion: "19.45.4",
            extraClient: [
                "deviceMake": "Apple",
                "deviceModel": "iPhone16,2",
                "osName": "iPhone",
                "osVersion": "17.5.1",
            ],
            userAgent: iosUA,
            clientIdHeader: "5",
            authHeaders: auth,
            lastError: &lastError
        ) {
            return res
        }

        // 2) Try ANDROID_VR client
        if let res = await tryPlayerClient(
            videoId: videoId,
            sourceUrl: urlOrId,
            clientName: "ANDROID_VR",
            clientVersion: "1.65.10",
            extraClient: [
                "deviceModel": "Quest 3",
                "androidSdkVersion": 32,
            ],
            userAgent: androidVRUA,
            clientIdHeader: "28",
            authHeaders: auth,
            lastError: &lastError
        ) {
            return res
        }

        // 3) Try TVHTML5_SIMPLY_EMBEDDED_PLAYER (plays age/embed-allowed tracks)
        if let res = await tryPlayerClient(
            videoId: videoId,
            sourceUrl: urlOrId,
            clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            clientVersion: "2.0",
            extraClient: [:],
            thirdParty: ["embedUrl": "https://www.youtube.com/"],
            userAgent: webUA,
            clientIdHeader: "85",
            authHeaders: auth,
            lastError: &lastError
        ) {
            return res
        }

        // 4) Try WEB + watch page base.js JavaScriptCore signature decipher fallback
        if let webRes = await tryWebWithJSContextDecipher(videoId: videoId, sourceUrl: urlOrId, authHeaders: auth) {
            return webRes
        }

        let isBotBlock = lastError.lowercased().contains("bot") || lastError.lowercased().contains("sign in")
        let hint = isBotBlock ? " (Tip: open Settings → YouTube Sign-In to bypass YouTube bot checks.)" : ""
        return HostResolution(
            ok: false,
            sourceUrl: urlOrId,
            host: "youtube",
            errorCode: isBotBlock ? "bot_check" : "resolve_failed",
            errorMessage: lastError + hint
        )
    }

    private func tryPlayerClient(
        videoId: String,
        sourceUrl: String,
        clientName: String,
        clientVersion: String,
        extraClient: [String: Any],
        thirdParty: [String: Any]? = nil,
        userAgent: String,
        clientIdHeader: String,
        authHeaders: [String: String],
        lastError: inout String
    ) async -> HostResolution? {
        guard let url = URL(string: "https://www.youtube.com/youtubei/v1/player?alt=json") else { return nil }
        var clientObj: [String: Any] = [
            "clientName": clientName,
            "clientVersion": clientVersion,
            "hl": "en",
            "gl": "US",
        ]
        for (k, v) in extraClient { clientObj[k] = v }

        var contextObj: [String: Any] = ["client": clientObj]
        if let thirdParty { contextObj["thirdParty"] = thirdParty }

        let bodyObj: [String: Any] = [
            "context": contextObj,
            "videoId": videoId,
            "contentCheckOk": true,
            "racyCheckOk": true,
        ]

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        req.setValue(clientIdHeader, forHTTPHeaderField: "X-YouTube-Client-Name")
        req.setValue(clientVersion, forHTTPHeaderField: "X-YouTube-Client-Version")
        req.setValue("https://www.youtube.com", forHTTPHeaderField: "Origin")
        for (k, v) in authHeaders { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try? JSONSerialization.data(withJSONObject: bodyObj)

        guard let (data, _) = try? await session.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        if let status = json["playabilityStatus"] as? [String: Any],
           let code = status["status"] as? String,
           code != "OK" {
            if let reason = status["reason"] as? String, !reason.isEmpty {
                lastError = reason
            }
            return nil
        }

        return extractResolution(fromPlayerJSON: json, sourceUrl: sourceUrl, userAgent: userAgent, authHeaders: authHeaders)
    }

    private func extractResolution(
        fromPlayerJSON json: [String: Any],
        sourceUrl: String,
        userAgent: String,
        authHeaders: [String: String],
        decipherJS: String? = nil
    ) -> HostResolution? {
        guard let streaming = json["streamingData"] as? [String: Any] else { return nil }
        let details = json["videoDetails"] as? [String: Any]
        let title = details?["title"] as? String
        let author = details?["author"] as? String
        let lenSec = Double((details?["lengthSeconds"] as? String) ?? "")
        let thumbs = (details?["thumbnail"] as? [String: Any])?["thumbnails"] as? [[String: Any]]
        let thumb = upgradeThumb(thumbs?.last?["url"] as? String)

        let hlsUrl = streaming["hlsManifestUrl"] as? String

        let adaptive = (streaming["adaptiveFormats"] as? [[String: Any]]) ?? []
        let mp4Audios = adaptive.filter { fmt in
            let mime = ((fmt["mimeType"] as? String) ?? "").lowercased()
            return mime.contains("audio/mp4")
        }.sorted { lhs, rhs in
            (lhs["bitrate"] as? Int ?? 0) > (rhs["bitrate"] as? Int ?? 0)
        }

        var directAudioUrl: String?
        var chosenMime = "audio/mp4"
        var chosenSize: Int64?

        for fmt in mp4Audios {
            if let direct = fmt["url"] as? String, !direct.isEmpty {
                directAudioUrl = applyNTransformIfPossible(direct, jsSource: decipherJS)
                chosenMime = (fmt["mimeType"] as? String)?.components(separatedBy: ";").first ?? "audio/mp4"
                if let lenStr = fmt["contentLength"] as? String { chosenSize = Int64(lenStr) }
                break
            } else if let cipherStr = (fmt["signatureCipher"] as? String) ?? (fmt["cipher"] as? String),
                      let decipherJS,
                      let deciphered = Self.decipherSignatureURL(cipherStr: cipherStr, jsSource: decipherJS) {
                directAudioUrl = applyNTransformIfPossible(deciphered, jsSource: decipherJS)
                chosenMime = (fmt["mimeType"] as? String)?.components(separatedBy: ";").first ?? "audio/mp4"
                if let lenStr = fmt["contentLength"] as? String { chosenSize = Int64(lenStr) }
                break
            }
        }

        let streamUrl = hlsUrl ?? directAudioUrl
        guard let finalStream = streamUrl else { return nil }

        var hdrs = authHeaders
        hdrs["User-Agent"] = userAgent

        return HostResolution(
            ok: true,
            sourceUrl: sourceUrl,
            resolvedUrl: finalStream,
            downloadableUrl: directAudioUrl,
            host: "youtube",
            mimeType: chosenMime,
            sizeBytes: chosenSize,
            formatHint: "m4a",
            httpHeaders: hdrs,
            title: title,
            artist: author,
            thumbnail: thumb,
            durationSec: lenSec
        )
    }

    private func tryWebWithJSContextDecipher(videoId: String, sourceUrl: String, authHeaders: [String: String]) async -> HostResolution? {
        guard let watchURL = URL(string: "https://www.youtube.com/watch?v=\(videoId)") else { return nil }
        var req = URLRequest(url: watchURL)
        req.setValue(webUA, forHTTPHeaderField: "User-Agent")
        req.setValue("en-US,en;q=0.9", forHTTPHeaderField: "Accept-Language")
        for (k, v) in authHeaders { req.setValue(v, forHTTPHeaderField: k) }

        guard let (htmlData, _) = try? await session.data(for: req),
              let html = String(data: htmlData, encoding: .utf8) else {
            return nil
        }

        // Extract ytInitialPlayerResponse JSON object cleanly
        var playerJSON: [String: Any]?
        if let marker = html.range(of: "ytInitialPlayerResponse = ") {
            let tail = html[marker.upperBound...]
            if let endIdx = tail.range(of: ";</script>")?.lowerBound ?? tail.range(of: ";var ")?.lowerBound {
                let jsonStr = String(tail[..<endIdx])
                if let d = jsonStr.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                    playerJSON = parsed
                }
            }
        }
        guard let playerJSON else { return nil }

        var jsSource: String?
        if let jsMatch = html.range(of: #"/s/player/[a-zA-Z0-9_-]+/player_ias\.vflset/[^"']+/base\.js|/s/player/[a-zA-Z0-9_-]+/[^"']*base\.js"#, options: .regularExpression) {
            let relPath = String(html[jsMatch])
            if let jsURL = URL(string: "https://www.youtube.com" + relPath) {
                var jsReq = URLRequest(url: jsURL)
                jsReq.setValue(webUA, forHTTPHeaderField: "User-Agent")
                if let (jsData, _) = try? await session.data(for: jsReq) {
                    jsSource = String(data: jsData, encoding: .utf8)
                }
            }
        }

        return extractResolution(
            fromPlayerJSON: playerJSON,
            sourceUrl: sourceUrl,
            userAgent: webUA,
            authHeaders: authHeaders,
            decipherJS: jsSource
        )
    }

    // MARK: - JavaScriptCore Decipher Helpers

    private static func decipherSignatureURL(cipherStr: String, jsSource: String) -> String? {
        var comps = URLComponents()
        comps.percentEncodedQuery = cipherStr
        guard let items = comps.queryItems,
              let rawUrl = items.first(where: { $0.name == "url" })?.value,
              let encSig = items.first(where: { $0.name == "s" })?.value else {
            return nil
        }
        let sp = items.first(where: { $0.name == "sp" })?.value ?? "signature"

        guard let sigRegex = try? NSRegularExpression(pattern: #"([a-zA-Z0-9$]+)\s*=\s*function\(\s*([a-zA-Z0-9$]+)\s*\)\s*\{\s*\2\s*=\s*\2\.split\(["']{2}\)\s*;([^}]+?)\s*return\s+\2\.join\(["']{2}\)\s*\}"#),
              let match = sigRegex.firstMatch(in: jsSource, range: NSRange(jsSource.startIndex..<jsSource.endIndex, in: jsSource)),
              let fullRange = Range(match.range, in: jsSource),
              let fnRange = Range(match.range(at: 1), in: jsSource) else {
            return nil
        }

        let fnName = String(jsSource[fnRange])
        let fnDecl = "var \(String(jsSource[fullRange]));"

        var helperCode = ""
        let bodyText = String(jsSource[fullRange])
        if let helperMatch = try? NSRegularExpression(pattern: #"([a-zA-Z0-9$]{2,})\.[a-zA-Z0-9$]+\("#)
            .firstMatch(in: bodyText, range: NSRange(bodyText.startIndex..<bodyText.endIndex, in: bodyText)),
           let hNameRange = Range(helperMatch.range(at: 1), in: bodyText) {
            let helperName = NSRegularExpression.escapedPattern(for: String(bodyText[hNameRange]))
            let objPattern = #"var \#(helperName)\s*=\s*\{[\s\S]*?\}\s*;"#
            if let objMatch = try? NSRegularExpression(pattern: objPattern)
                .firstMatch(in: jsSource, range: NSRange(jsSource.startIndex..<jsSource.endIndex, in: jsSource)),
               let objRange = Range(objMatch.range, in: jsSource) {
                helperCode = String(jsSource[objRange])
            }
        }

        guard let ctx = JSContext() else { return nil }
        ctx.evaluateScript(helperCode + "\n" + fnDecl)
        guard let fn = ctx.objectForKeyedSubscript(fnName),
              let decodedSig = fn.call(withArguments: [encSig])?.toString(),
              !decodedSig.isEmpty else {
            return nil
        }

        var finalComps = URLComponents(string: rawUrl)
        var queryItems = finalComps?.queryItems ?? []
        queryItems.append(URLQueryItem(name: sp, value: decodedSig))
        finalComps?.queryItems = queryItems
        return finalComps?.string
    }

    private func applyNTransformIfPossible(_ urlString: String, jsSource: String?) -> String {
        guard let jsSource,
              var comps = URLComponents(string: urlString),
              let idx = comps.queryItems?.firstIndex(where: { $0.name == "n" }),
              let nVal = comps.queryItems?[idx].value else {
            return urlString
        }

        // Best-effort n-parameter descrambling when present
        let pattern = #"([a-zA-Z0-9$]+)\s*=\s*function\(([a-zA-Z0-9$]+)\)\s*\{\s*var\s+[a-zA-Z0-9$]+\s*=\s*\2\.split\(["']{2}\)[\s\S]{50,2500}?\.join\(["']{2}\)\s*\}"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: jsSource, range: NSRange(jsSource.startIndex..<jsSource.endIndex, in: jsSource)),
              let fnRange = Range(match.range, in: jsSource),
              let nameRange = Range(match.range(at: 1), in: jsSource),
              let ctx = JSContext() else {
            return urlString
        }

        let fnName = String(jsSource[nameRange])
        ctx.evaluateScript("var \(String(jsSource[fnRange]));")
        if let result = ctx.objectForKeyedSubscript(fnName)?.call(withArguments: [nVal])?.toString(),
           !result.isEmpty, result != "undefined" {
            comps.queryItems?[idx].value = result
            return comps.string ?? urlString
        }
        return urlString
    }

    // MARK: - InnerTube JSON Parsing Helpers

    private func parseMusicTrackRenderers(from root: [String: Any], fallbackAlbum: String?, limit: Int) -> [OnlineSearchResult] {
        var renderers: [[String: Any]] = []
        collectDicts(root, matchingKey: "musicResponsiveListItemRenderer", into: &renderers)

        var seen = Set<String>()
        var tracks: [OnlineSearchResult] = []
        for item in renderers {
            let vid = extractMusicVideoId(item)
            guard let vid, !vid.isEmpty, seen.insert(vid).inserted else { continue }

            let flexCols = (item["flexColumns"] as? [[String: Any]]) ?? []
            let col0Text = flexColText(flexCols, index: 0) ?? "Untitled"
            let col1Runs = flexColRuns(flexCols, index: 1)

            var artistParts: [String] = []
            var albumText: String? = fallbackAlbum
            var durText: String?

            // Filter metadata runs separated by bullet dots (" • ")
            let segments = col1Runs.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty && $0 != "•" }
            for seg in segments {
                if Self.looksLikeDuration(seg) {
                    durText = seg
                } else if seg == "Song" || seg == "Video" || seg.contains("plays") || seg.contains("views") {
                    continue
                } else if artistParts.isEmpty {
                    artistParts.append(seg)
                } else if albumText == nil || albumText == fallbackAlbum {
                    albumText = seg
                }
            }

            if durText == nil {
                let fixedCols = (item["fixedColumns"] as? [[String: Any]]) ?? []
                if let fixedText = fixedCols.first.flatMap({
                    extractText(($0["musicResponsiveListItemFixedColumnRenderer"] as? [String: Any])?["text"])
                }), Self.looksLikeDuration(fixedText) {
                    durText = fixedText
                }
            }

            let thumb = extractMusicThumbnail(item)
            tracks.append(OnlineSearchResult(
                id: vid,
                source: "ytmusic",
                url: "https://www.youtube.com/watch?v=\(vid)",
                title: col0Text,
                artist: artistParts.isEmpty ? "YouTube Music" : artistParts.joined(separator: ", "),
                album: albumText,
                durationSec: Self.parseDurationText(durText),
                durationText: durText,
                thumbnail: thumb
            ))
            if tracks.count >= limit { break }
        }
        return tracks
    }

    private func parseMusicCollectionRenderers(from root: [String: Any], kind: String, limit: Int) -> [OnlineCollectionResult] {
        var renderers: [[String: Any]] = []
        collectDicts(root, matchingKey: "musicResponsiveListItemRenderer", into: &renderers)

        var seen = Set<String>()
        var out: [OnlineCollectionResult] = []
        for item in renderers {
            guard let nav = item["navigationEndpoint"] as? [String: Any],
                  let browse = nav["browseEndpoint"] as? [String: Any],
                  let browseId = browse["browseId"] as? String,
                  !browseId.isEmpty,
                  seen.insert(browseId).inserted else { continue }

            let flexCols = (item["flexColumns"] as? [[String: Any]]) ?? []
            let title = flexColText(flexCols, index: 0) ?? "Collection"
            let runs = flexColRuns(flexCols, index: 1).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty && $0 != "•" }
            let artist = runs.first(where: { !["Album", "EP", "Single", "Playlist"].contains($0) }) ?? "YouTube Music"
            let thumb = extractMusicThumbnail(item)
            let url = browseId.hasPrefix("VL")
                ? "https://music.youtube.com/playlist?list=\(String(browseId.dropFirst(2)))"
                : "https://music.youtube.com/browse/\(browseId)"

            out.append(OnlineCollectionResult(
                id: browseId,
                kind: kind,
                source: "ytmusic",
                browseId: browseId,
                url: url,
                title: title,
                artist: artist,
                subtitle: runs.joined(separator: " • "),
                thumbnail: thumb
            ))
            if out.count >= limit { break }
        }
        return out
    }

    private func extractMusicVideoId(_ item: [String: Any]) -> String? {
        if let playlistData = item["playlistItemData"] as? [String: Any],
           let vid = playlistData["videoId"] as? String, !vid.isEmpty {
            return vid
        }
        if let overlay = item["overlay"] as? [String: Any],
           let thumbOverlay = overlay["musicItemThumbnailOverlayRenderer"] as? [String: Any],
           let content = thumbOverlay["content"] as? [String: Any],
           let playBtn = content["musicPlayButtonRenderer"] as? [String: Any],
           let playNav = playBtn["playNavigationEndpoint"] as? [String: Any],
           let watch = playNav["watchEndpoint"] as? [String: Any],
           let vid = watch["videoId"] as? String {
            return vid
        }
        let flexCols = (item["flexColumns"] as? [[String: Any]]) ?? []
        if let col0 = flexCols.first?["musicResponsiveListItemFlexColumnRenderer"] as? [String: Any],
           let runs = (col0["text"] as? [String: Any])?["runs"] as? [[String: Any]],
           let nav = runs.first?["navigationEndpoint"] as? [String: Any],
           let watch = nav["watchEndpoint"] as? [String: Any],
           let vid = watch["videoId"] as? String {
            return vid
        }
        return nil
    }

    private func extractMusicThumbnail(_ item: [String: Any]) -> String? {
        if let t = item["thumbnail"] as? [String: Any],
           let mtr = t["musicThumbnailRenderer"] as? [String: Any],
           let inner = mtr["thumbnail"] as? [String: Any],
           let thumbs = inner["thumbnails"] as? [[String: Any]] {
            return upgradeThumb(thumbs.last?["url"] as? String)
        }
        return nil
    }

    private func findHeaderTitle(in root: [String: Any]) -> String? {
        if let header = root["header"] as? [String: Any] {
            for key in ["musicResponsiveHeaderRenderer", "musicDetailHeaderRenderer", "playlistHeaderRenderer"] {
                if let sub = header[key] as? [String: Any], let title = extractText(sub["title"]), !title.isEmpty {
                    return title
                }
            }
        }
        var found: [[String: Any]] = []
        collectDicts(root, matchingKey: "musicResponsiveHeaderRenderer", into: &found)
        if let t = found.first.flatMap({ extractText($0["title"]) }), !t.isEmpty { return t }
        return nil
    }

    private func findHeaderThumb(in root: [String: Any]) -> String? {
        var found: [[String: Any]] = []
        collectDicts(root, matchingKey: "musicResponsiveHeaderRenderer", into: &found)
        collectDicts(root, matchingKey: "musicDetailHeaderRenderer", into: &found)
        for h in found {
            if let thumbs = ((h["thumbnail"] as? [String: Any])?["musicThumbnailRenderer"] as? [String: Any])?["thumbnail"] as? [String: Any],
               let list = thumbs["thumbnails"] as? [[String: Any]],
               let url = list.last?["url"] as? String {
                return url
            }
        }
        return nil
    }

    private func flexColText(_ cols: [[String: Any]], index: Int) -> String? {
        guard index < cols.count,
              let col = cols[index]["musicResponsiveListItemFlexColumnRenderer"] as? [String: Any] else {
            return nil
        }
        return extractText(col["text"])
    }

    private func flexColRuns(_ cols: [[String: Any]], index: Int) -> [String] {
        guard index < cols.count,
              let col = cols[index]["musicResponsiveListItemFlexColumnRenderer"] as? [String: Any],
              let runs = (col["text"] as? [String: Any])?["runs"] as? [[String: Any]] else {
            return []
        }
        return runs.compactMap { $0["text"] as? String }
    }

    private func extractText(_ node: Any?) -> String? {
        guard let dict = node as? [String: Any] else { return nil }
        if let simple = dict["simpleText"] as? String { return simple }
        if let runs = dict["runs"] as? [[String: Any]] {
            return runs.compactMap { $0["text"] as? String }.joined()
        }
        return nil
    }

    private func upgradeThumb(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        return raw.replacingOccurrences(of: #"=w\d+-h\d+[^&]*"#, with: "=w544-h544-l90-rj", options: .regularExpression)
    }

    private func collectDicts(_ node: Any, matchingKey: String, into result: inout [[String: Any]]) {
        if let dict = node as? [String: Any] {
            if let matched = dict[matchingKey] as? [String: Any] {
                result.append(matched)
            }
            for (_, v) in dict {
                collectDicts(v, matchingKey: matchingKey, into: &result)
            }
        } else if let arr = node as? [Any] {
            for item in arr {
                collectDicts(item, matchingKey: matchingKey, into: &result)
            }
        }
    }

    private static func looksLikeDuration(_ s: String) -> Bool {
        s.range(of: #"^\d{1,2}:\d{2}(?::\d{2})?$"#, options: .regularExpression) != nil
    }

    static func parseDurationText(_ text: String?) -> Double? {
        guard let text, !text.isEmpty else { return nil }
        let parts = text.split(separator: ":").compactMap { Double($0) }
        guard !parts.isEmpty else { return nil }
        if parts.count == 2 { return parts[0] * 60 + parts[1] }
        if parts.count == 3 { return parts[0] * 3600 + parts[1] * 60 + parts[2] }
        return nil
    }
}
