import Foundation

enum APIError: LocalizedError {
    case missingServerURL
    case invalidURL
    case httpError(Int, String)
    case decodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingServerURL:
            return "No VaultStream server URL configured. Open Settings to connect to your PC."
        case .invalidURL:
            return "Invalid server URL format. Example: http://192.168.1.42:3456"
        case let .httpError(code, message):
            return message.isEmpty ? "Server returned HTTP \(code)" : message
        case let .decodingFailed(detail):
            return "Failed to decode server response: \(detail)"
        }
    }
}

private struct ErrorEnvelope: Decodable {
    let error: String?
}

@MainActor
final class APIClient {
    static let shared = APIClient()

    static let serverURLKey = "serverBaseURL"

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 120
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder()
    }

    var rawServerURL: String {
        get { UserDefaults.standard.string(forKey: Self.serverURLKey) ?? "" }
        set { UserDefaults.standard.set(Self.normalizeServerURL(newValue), forKey: Self.serverURLKey) }
    }

    var baseURL: URL? {
        let normalized = Self.normalizeServerURL(rawServerURL)
        guard !normalized.isEmpty else { return nil }
        return URL(string: normalized)
    }

    static func normalizeServerURL(_ input: String) -> String {
        var trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if !trimmed.contains("://") {
            trimmed = "http://" + trimmed
        }
        while trimmed.hasSuffix("/") {
            trimmed.removeLast()
        }
        if let comps = URLComponents(string: trimmed), comps.port == nil, comps.scheme == "http" {
            // Append default VaultStream port 3456 if the user typed just an IP or Tailscale hostname
            if let host = comps.host, !host.isEmpty {
                var updated = comps
                updated.port = 3456
                return updated.string ?? trimmed
            }
        }
        return trimmed
    }

    func artworkURL(_ raw: String?) -> URL? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.hasPrefix("/"), let base = baseURL {
            return URL(string: base.absoluteString + raw)
        }
        if raw.hasPrefix("http://") || raw.hasPrefix("https://") {
            if let base = baseURL,
               let encoded = raw.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
               let proxied = URL(string: "\(base.absoluteString)/api/image?url=\(encoded)") {
                return proxied
            }
            return URL(string: raw)
        }
        return nil
    }

    func streamURL(trackId: String, compatMp3: Bool = false, linkIndex: Int? = nil) -> URL? {
        guard let base = baseURL else { return nil }
        var items: [URLQueryItem] = []
        if compatMp3 {
            items.append(URLQueryItem(name: "compat", value: "1"))
            items.append(URLQueryItem(name: "format", value: "mp3"))
        }
        if let linkIndex {
            items.append(URLQueryItem(name: "linkIndex", value: String(linkIndex)))
        }
        var comps = URLComponents(string: "\(base.absoluteString)/api/tracks/\(trackId)/stream")
        if !items.isEmpty {
            comps?.queryItems = items
        }
        return comps?.url
    }

    private func send<T: Decodable>(
        _ path: String,
        method: String = "GET",
        query: [URLQueryItem] = [],
        body: [String: Any]? = nil,
        timeout: TimeInterval = 25
    ) async throws -> T {
        guard let base = baseURL else { throw APIError.missingServerURL }
        guard var comps = URLComponents(string: base.absoluteString + path) else {
            throw APIError.invalidURL
        }
        if !query.isEmpty {
            comps.queryItems = (comps.queryItems ?? []) + query
        }
        guard let url = comps.url else { throw APIError.invalidURL }

        var req = URLRequest(url: url, timeoutInterval: timeout)
        req.httpMethod = method
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.httpError(0, "Invalid network response")
        }
        guard (200...299).contains(http.statusCode) else {
            let errText = (try? decoder.decode(ErrorEnvelope.self, from: data))?.error
                ?? String(data: data, encoding: .utf8)
                ?? ""
            throw APIError.httpError(http.statusCode, errText)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed(error.localizedDescription)
        }
    }

    private func sendVoid(
        _ path: String,
        method: String = "POST",
        body: [String: Any]? = nil
    ) async throws {
        struct OKEnvelope: Decodable { let ok: Bool? }
        let _: OKEnvelope = try await send(path, method: method, body: body)
    }

    // MARK: - Endpoints

    func checkHealth(against customBaseURL: String? = nil) async throws -> HealthResponse {
        let saved = rawServerURL
        if let customBaseURL {
            rawServerURL = customBaseURL
        }
        defer {
            if customBaseURL != nil {
                rawServerURL = saved
            }
        }
        return try await send("/api/health", timeout: 8)
    }

    func fetchTrackers() async throws -> [TrackerRecord] {
        let res: TrackersResponse = try await send("/api/trackers")
        return res.trackers
    }

    func fetchDirectory() async throws -> [DirectoryArtist] {
        let res: DirectoryResponse = try await send("/api/directory")
        return res.artists
    }

    func syncTracker(input: String, tabGid: String? = nil, tabName: String? = nil) async throws -> SyncTrackerResponse {
        var payload: [String: Any] = ["input": input]
        if let tabGid { payload["tabGid"] = tabGid }
        if let tabName { payload["tabName"] = tabName }
        return try await send("/api/trackers/sync", method: "POST", body: payload, timeout: 60)
    }

    func deleteTracker(id: String) async throws {
        try await sendVoid("/api/trackers/\(id)", method: "DELETE")
    }

    func followTracker(id: String, followed: Bool? = nil) async throws -> Bool {
        var body: [String: Any] = [:]
        if let followed { body["followed"] = followed }
        let res: FollowTrackerResponse = try await send("/api/trackers/\(id)/follow", method: "POST", body: body)
        return res.followed
    }

    func searchTracks(
        trackerId: String? = nil,
        tabName: String? = nil,
        q: String? = nil,
        era: String? = nil,
        host: String? = nil,
        losslessOnly: Bool = false,
        cachedOnly: Bool = false,
        playableOnly: Bool = false,
        limit: Int = 150,
        offset: Int = 0
    ) async throws -> SearchResult {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset)),
        ]
        if let trackerId, !trackerId.isEmpty { items.append(.init(name: "trackerId", value: trackerId)) }
        if let tabName, !tabName.isEmpty { items.append(.init(name: "tabName", value: tabName)) }
        if let q, !q.isEmpty { items.append(.init(name: "q", value: q)) }
        if let era, !era.isEmpty { items.append(.init(name: "era", value: era)) }
        if let host, !host.isEmpty { items.append(.init(name: "host", value: host)) }
        if losslessOnly { items.append(.init(name: "losslessOnly", value: "1")) }
        if cachedOnly { items.append(.init(name: "cachedOnly", value: "1")) }
        if playableOnly { items.append(.init(name: "playableOnly", value: "1")) }
        return try await send("/api/tracks", query: items)
    }

    func fetchLikes() async throws -> LikesResponse {
        try await send("/api/likes")
    }

    func toggleLike(trackId: String, liked: Bool? = nil) async throws -> Bool {
        var body: [String: Any] = [:]
        if let liked { body["liked"] = liked }
        let res: ToggleLikeResponse = try await send("/api/likes/\(trackId)", method: "POST", body: body)
        return res.liked
    }

    func fetchPlaylists() async throws -> [PlaylistRecord] {
        let res: PlaylistsResponse = try await send("/api/playlists")
        return res.playlists
    }

    func fetchPlaylistDetail(id: String) async throws -> PlaylistDetail? {
        let res: PlaylistDetailResponse = try await send("/api/playlists/\(id)")
        return res.playlist
    }

    func createPlaylist(name: String, description: String = "") async throws -> PlaylistRecord {
        let res: CreatePlaylistResponse = try await send(
            "/api/playlists",
            method: "POST",
            body: ["name": name, "description": description]
        )
        return res.playlist
    }

    func deletePlaylist(id: String) async throws {
        try await sendVoid("/api/playlists/\(id)", method: "DELETE")
    }

    func addTrackToPlaylist(playlistId: String, trackId: String) async throws -> PlaylistMutateResponse {
        try await send("/api/playlists/\(playlistId)/tracks", method: "POST", body: ["trackId": trackId])
    }

    func removeTrackFromPlaylist(playlistId: String, trackId: String) async throws -> PlaylistDetail? {
        let res: PlaylistDetailResponse = try await send("/api/playlists/\(playlistId)/tracks/\(trackId)", method: "DELETE")
        return res.playlist
    }

    func fetchHistory(limit: Int = 30) async throws -> [PlayHistoryItem] {
        let res: HistoryResponse = try await send("/api/history", query: [.init(name: "limit", value: String(limit))])
        return res.items
    }

    func recordPlay(trackId: String) async {
        try? await sendVoid("/api/history", method: "POST", body: ["trackId": trackId])
    }

    func discoverSearch(query: String, source: String, limit: Int = 15) async throws -> DiscoverSearchResponse {
        try await send(
            "/api/discover/search",
            query: [
                .init(name: "q", value: query),
                .init(name: "source", value: source),
                .init(name: "limit", value: String(limit)),
            ],
            timeout: 35
        )
    }

    func importUrl(
        url: String,
        title: String? = nil,
        artist: String? = nil,
        album: String? = nil,
        thumbnail: String? = nil,
        playlistId: String? = nil
    ) async throws -> ImportURLResponse {
        var body: [String: Any] = ["url": url, "enrichMusicBrainz": true]
        if let title { body["title"] = title }
        if let artist { body["artist"] = artist }
        if let album { body["album"] = album }
        if let thumbnail { body["thumbnail"] = thumbnail }
        if let playlistId { body["playlistId"] = playlistId }
        return try await send("/api/discover/import-url", method: "POST", body: body, timeout: 60)
    }

    func importCollection(_ collection: OnlineCollectionResult, savePlaylist: Bool = true) async throws -> ImportCollectionResponse {
        var body: [String: Any] = [
            "kind": collection.kind,
            "source": collection.source,
            "idOrUrl": collection.browseId.isEmpty ? collection.url : collection.browseId,
            "title": collection.title,
            "artist": collection.artist,
            "savePlaylist": savePlaylist,
        ]
        if let thumb = collection.thumbnail {
            body["thumbnail"] = thumb
        }
        return try await send("/api/discover/import-collection", method: "POST", body: body, timeout: 90)
    }

    func resolveTrack(trackId: String, linkIndex: Int? = nil, force: Bool = true) async throws -> TrackResolveResponse {
        var body: [String: Any] = ["force": force]
        if let linkIndex { body["linkIndex"] = linkIndex }
        return try await send("/api/tracks/\(trackId)/resolve", method: "POST", body: body, timeout: 35)
    }

    func setTrackAvailability(trackId: String, unavailable: Bool) async -> TrackRecord? {
        let res: TrackAvailabilityResponse? = try? await send(
            "/api/tracks/\(trackId)/availability",
            method: "POST",
            body: ["unavailable": unavailable]
        )
        return res?.track
    }

    func fetchMediaSettings() async throws -> MediaSettingsResponse {
        try await send("/api/settings/media")
    }

    func saveCookiesBrowser(_ browser: String) async throws -> MediaSettingsResponse {
        try await send("/api/settings/media", method: "POST", body: ["cookiesBrowser": browser])
    }

    func importSpotify(name: String, content: String, sourcePreference: String = "youtube") async throws -> SpotifyImportResponse {
        try await send(
            "/api/import/spotify",
            method: "POST",
            body: [
                "playlistName": name,
                "content": content,
                "sourcePreference": sourcePreference,
                "createPlaylist": true,
            ],
            timeout: 120
        )
    }

    func enrichMusicBrainzBatch() async throws -> Int {
        let res: BatchMusicBrainzResponse = try await send(
            "/api/metadata/musicbrainz/batch",
            method: "POST",
            body: ["limit": 15],
            timeout: 60
        )
        return res.updatedCount ?? 0
    }
}
