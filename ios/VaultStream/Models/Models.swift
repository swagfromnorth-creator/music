import Foundation

struct TrackLink: Codable, Hashable, Sendable {
    let url: String
    let text: String?
    let host: String
    let playable: Bool
    let formatHint: String?

    init(url: String, text: String? = nil, host: String = "unknown", playable: Bool = true, formatHint: String? = nil) {
        self.url = url
        self.text = text
        self.host = host
        self.playable = playable
        self.formatHint = formatHint
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        text = try? c.decodeIfPresent(String.self, forKey: .text)
        host = (try? c.decode(String.self, forKey: .host)) ?? "unknown"
        playable = (try? c.decode(Bool.self, forKey: .playable)) ?? true
        formatHint = try? c.decodeIfPresent(String.self, forKey: .formatHint)
    }
}

struct AudioHeaderInfo: Codable, Hashable, Sendable {
    let codec: String?
    let sampleRateHz: Int?
    let bitsPerSample: Int?
    let channels: Int?
    let durationSec: Double?
    let lossless: Bool?

    var summaryBadge: String? {
        guard let codec, !codec.isEmpty else { return nil }
        if let sr = sampleRateHz, let bits = bitsPerSample, sr > 0 {
            let khz = Double(sr) / 1000.0
            let srLabel = sr % 1000 == 0 ? "\(sr / 1000)" : String(format: "%.1f", khz)
            return "\(codec) \(bits)b/\(srLabel)kHz"
        }
        return codec
    }
}

struct TrackCacheStatus: Codable, Hashable, Sendable {
    let cacheKey: String
    let cachedBytes: Int64
    let totalBytes: Int64?
    let isComplete: Bool
    let lastAccessedAt: Double
}

struct TrackRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let trackerId: String
    let tabName: String
    let title: String
    let rawName: String
    let credits: String
    let artist: String
    let era: String
    let subEra: String
    let eraOrder: Int
    let trackOrder: Int
    let eraColor: String?
    let eraTextColor: String?
    let eraImage: String?
    let notes: String
    let quality: String
    let formatHint: String?
    let trackLength: String?
    let availableLength: String?
    let leakDate: String?
    let fileDate: String?
    let trackType: String?
    let primaryUrl: String?
    let primaryHost: String
    let links: [TrackLink]
    let resolvedUrl: String?
    let resolvedMime: String?
    let resolvedSize: Int64?
    let resolvedFilename: String?
    let resolvedAt: Double?
    let isPlayable: Bool
    var isUnavailable: Bool?
    let audioMeta: AudioHeaderInfo?
    let cacheStatus: TrackCacheStatus?
    var isLiked: Bool?
    var playCount: Int?

    var unavailableFlag: Bool {
        if isUnavailable == true { return true }
        if tabName.caseInsensitiveCompare("Unavailable") == .orderedSame { return true }
        return !isPlayable
    }

    var likedFlag: Bool {
        isLiked ?? false
    }

    var isLossless: Bool {
        if audioMeta?.lossless == true { return true }
        let q = (quality + " " + (formatHint ?? "") + " " + (resolvedMime ?? "")).lowercased()
        return q.contains("flac") || q.contains("wav") || q.contains("alac") || q.contains("lossless") || q.contains("aiff")
    }

    var subtitleLine: String {
        let parts = [artist, era.isEmpty ? nil : era, primaryHost == "unknown" ? nil : primaryHost]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.joined(separator: " • ")
    }

    var badgeText: String? {
        if let meta = audioMeta?.summaryBadge { return meta }
        if let fmt = formatHint, !fmt.isEmpty { return fmt.uppercased() }
        if !quality.isEmpty && quality.count <= 24 { return quality }
        return primaryHost == "unknown" ? nil : primaryHost.uppercased()
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        trackerId = (try? c.decode(String.self, forKey: .trackerId)) ?? ""
        tabName = (try? c.decode(String.self, forKey: .tabName)) ?? ""
        title = (try? c.decode(String.self, forKey: .title)) ?? "Untitled"
        rawName = (try? c.decode(String.self, forKey: .rawName)) ?? title
        credits = (try? c.decode(String.self, forKey: .credits)) ?? ""
        artist = (try? c.decode(String.self, forKey: .artist)) ?? "Unknown Artist"
        era = (try? c.decode(String.self, forKey: .era)) ?? ""
        subEra = (try? c.decode(String.self, forKey: .subEra)) ?? ""
        eraOrder = (try? c.decode(Int.self, forKey: .eraOrder)) ?? 0
        trackOrder = (try? c.decode(Int.self, forKey: .trackOrder)) ?? 0
        eraColor = try? c.decodeIfPresent(String.self, forKey: .eraColor)
        eraTextColor = try? c.decodeIfPresent(String.self, forKey: .eraTextColor)
        eraImage = try? c.decodeIfPresent(String.self, forKey: .eraImage)
        notes = (try? c.decode(String.self, forKey: .notes)) ?? ""
        quality = (try? c.decode(String.self, forKey: .quality)) ?? ""
        formatHint = try? c.decodeIfPresent(String.self, forKey: .formatHint)
        trackLength = try? c.decodeIfPresent(String.self, forKey: .trackLength)
        availableLength = try? c.decodeIfPresent(String.self, forKey: .availableLength)
        leakDate = try? c.decodeIfPresent(String.self, forKey: .leakDate)
        fileDate = try? c.decodeIfPresent(String.self, forKey: .fileDate)
        trackType = try? c.decodeIfPresent(String.self, forKey: .trackType)
        primaryUrl = try? c.decodeIfPresent(String.self, forKey: .primaryUrl)
        primaryHost = (try? c.decode(String.self, forKey: .primaryHost)) ?? "unknown"
        links = (try? c.decode([TrackLink].self, forKey: .links)) ?? []
        resolvedUrl = try? c.decodeIfPresent(String.self, forKey: .resolvedUrl)
        resolvedMime = try? c.decodeIfPresent(String.self, forKey: .resolvedMime)
        resolvedSize = try? c.decodeIfPresent(Int64.self, forKey: .resolvedSize)
        resolvedFilename = try? c.decodeIfPresent(String.self, forKey: .resolvedFilename)
        resolvedAt = try? c.decodeIfPresent(Double.self, forKey: .resolvedAt)
        isPlayable = (try? c.decode(Bool.self, forKey: .isPlayable)) ?? true
        isUnavailable = try? c.decodeIfPresent(Bool.self, forKey: .isUnavailable)
        audioMeta = try? c.decodeIfPresent(AudioHeaderInfo.self, forKey: .audioMeta)
        cacheStatus = try? c.decodeIfPresent(TrackCacheStatus.self, forKey: .cacheStatus)
        isLiked = try? c.decodeIfPresent(Bool.self, forKey: .isLiked)
        playCount = try? c.decodeIfPresent(Int.self, forKey: .playCount)
    }
}

struct TrackerTabMeta: Codable, Hashable, Identifiable, Sendable {
    let gid: String?
    let name: String
    let slug: String?
    var id: String { (gid ?? "") + ":" + name }
}

struct TrackerRecord: Codable, Identifiable, Hashable, Sendable {
    let trackerId: String
    let name: String
    let artistName: String
    let currentTab: String
    let tabs: [TrackerTabMeta]
    let syncedTabs: [String]
    let trackCount: Int
    let playableCount: Int
    let credits: String?
    let lastSyncedAt: Double
    var isFollowed: Bool?
    let coverImage: String?

    var id: String { trackerId }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        trackerId = try c.decode(String.self, forKey: .trackerId)
        name = (try? c.decode(String.self, forKey: .name)) ?? "Tracker"
        artistName = (try? c.decode(String.self, forKey: .artistName)) ?? name
        currentTab = (try? c.decode(String.self, forKey: .currentTab)) ?? ""
        tabs = (try? c.decode([TrackerTabMeta].self, forKey: .tabs)) ?? []
        syncedTabs = (try? c.decode([String].self, forKey: .syncedTabs)) ?? []
        trackCount = (try? c.decode(Int.self, forKey: .trackCount)) ?? 0
        playableCount = (try? c.decode(Int.self, forKey: .playableCount)) ?? 0
        credits = try? c.decodeIfPresent(String.self, forKey: .credits)
        lastSyncedAt = (try? c.decode(Double.self, forKey: .lastSyncedAt)) ?? 0
        isFollowed = try? c.decodeIfPresent(Bool.self, forKey: .isFollowed)
        coverImage = try? c.decodeIfPresent(String.self, forKey: .coverImage)
    }
}

struct EraFacet: Codable, Hashable, Identifiable, Sendable {
    let era: String
    let count: Int
    let eraColor: String?
    let eraImage: String?
    var id: String { era }
}

struct HostFacet: Codable, Hashable, Sendable {
    let host: String
    let count: Int
}

struct QualityFacet: Codable, Hashable, Sendable {
    let quality: String
    let count: Int
}

struct SearchResult: Codable, Sendable {
    let tracks: [TrackRecord]
    let total: Int
    let queryMs: Double?
    let eras: [EraFacet]?
    let hosts: [HostFacet]?
    let qualities: [QualityFacet]?
}

struct PlaylistRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let description: String
    let coverGradient: String
    let coverImage: String?
    let trackCount: Int
    let previewImages: [String]
    let createdAt: Double
    let updatedAt: Double

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = (try? c.decode(String.self, forKey: .name)) ?? "Playlist"
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        coverGradient = (try? c.decode(String.self, forKey: .coverGradient)) ?? ""
        coverImage = try? c.decodeIfPresent(String.self, forKey: .coverImage)
        trackCount = (try? c.decode(Int.self, forKey: .trackCount)) ?? 0
        previewImages = (try? c.decode([String].self, forKey: .previewImages)) ?? []
        createdAt = (try? c.decode(Double.self, forKey: .createdAt)) ?? 0
        updatedAt = (try? c.decode(Double.self, forKey: .updatedAt)) ?? 0
    }
}

struct PlaylistDetail: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let description: String
    let coverGradient: String
    let coverImage: String?
    let trackCount: Int
    let previewImages: [String]
    let tracks: [TrackRecord]
    let createdAt: Double
    let updatedAt: Double
}

struct PlayHistoryItem: Codable, Identifiable, Hashable, Sendable {
    let id: Int
    let trackId: String
    let playedAt: Double
    let track: TrackRecord
}

struct OnlineSearchResult: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let source: String
    let url: String
    let title: String
    let artist: String
    let album: String?
    let durationSec: Double?
    let durationText: String?
    let thumbnail: String?
}

struct OnlineCollectionResult: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let kind: String
    let source: String
    let browseId: String
    let url: String
    let title: String
    let artist: String
    let subtitle: String?
    let thumbnail: String?
}

struct HostResolution: Codable, Hashable, Sendable {
    let ok: Bool
    let resolvedUrl: String?
    let host: String?
    let mimeType: String?
    let sizeBytes: Int64?
    let filename: String?
    let errorMessage: String?
    let errorCode: String?
}

struct OfflineTrackEntry: Codable, Identifiable, Hashable, Sendable {
    var id: String { track.id }
    let track: TrackRecord
    let localFilename: String
    let fileSizeBytes: Int64
    let downloadedAt: Date
}

// MARK: - API Response Wrappers

struct HealthResponse: Codable, Sendable {
    let ok: Bool
    let commit: String?
    let autoUpdateEnabled: Bool?
}

struct TrackersResponse: Codable, Sendable {
    let trackers: [TrackerRecord]
}

struct PlaylistsResponse: Codable, Sendable {
    let playlists: [PlaylistRecord]
}

struct PlaylistDetailResponse: Codable, Sendable {
    let playlist: PlaylistDetail?
}

struct PlaylistMutateResponse: Codable, Sendable {
    let added: Bool?
    let duplicateSong: Bool?
    let playlist: PlaylistDetail?
}

struct CreatePlaylistResponse: Codable, Sendable {
    let playlist: PlaylistRecord
}

struct LikesResponse: Codable, Sendable {
    let likedIds: [String]
    let tracks: [TrackRecord]
    let followedTrackerIds: [String]
}

struct ToggleLikeResponse: Codable, Sendable {
    let trackId: String
    let liked: Bool
    let likedCount: Int
}

struct FollowTrackerResponse: Codable, Sendable {
    let trackerId: String
    let followed: Bool
}

struct HistoryResponse: Codable, Sendable {
    let items: [PlayHistoryItem]
    let totalPlays: Int
}

struct DiscoverSearchResponse: Codable, Sendable {
    let query: String
    let source: String
    let results: [OnlineSearchResult]
    let collections: [OnlineCollectionResult]?
}

struct ImportURLResponse: Codable, Sendable {
    let isCollection: Bool?
    let playlist: PlaylistDetail?
    let tracks: [TrackRecord]?
    let track: TrackRecord?
}

struct ImportCollectionResponse: Codable, Sendable {
    let title: String
    let artist: String
    let thumbnail: String?
    let tracks: [TrackRecord]
    let playlist: PlaylistDetail?
}

struct TrackAvailabilityResponse: Codable, Sendable {
    let track: TrackRecord?
}

struct TrackResolveResponse: Codable, Sendable {
    let track: TrackRecord?
    let resolution: HostResolution
}

struct SyncTrackerResponse: Codable, Sendable {
    let tracker: TrackerRecord
    let tabSynced: String
    let tracksSynced: Int
    let playableTracks: Int
    let elapsedMs: Double
}

struct MediaSettingsResponse: Codable, Sendable {
    let cookiesBrowser: String
}

struct SpotifyImportResponse: Codable, Sendable {
    let totalParsed: Int
    let tracksAdded: Int
    let matchedLocal: Int
    let matchedOnline: Int
    let playlist: PlaylistDetail?
}

struct BatchMusicBrainzResponse: Codable, Sendable {
    let updatedCount: Int?
}

struct DirectoryArtist: Codable, Identifiable, Hashable, Sendable {
    var id: String { trackerId }
    let trackerId: String
    let artist: String
    let category: String?
}

struct DirectoryResponse: Codable, Sendable {
    let artists: [DirectoryArtist]
}
