import CryptoKit
import Foundation

struct TrackLink: Codable, Hashable, Sendable {
    var url: String
    var text: String?
    var host: String
    var playable: Bool
    var formatHint: String?

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
    var codec: String?
    var sampleRateHz: Int?
    var bitsPerSample: Int?
    var channels: Int?
    var durationSec: Double?
    var lossless: Bool?

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

struct TrackRecord: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var trackerId: String
    var tabName: String
    var title: String
    var rawName: String
    var credits: String
    var artist: String
    var era: String
    var subEra: String
    var eraOrder: Int
    var trackOrder: Int
    var eraColor: String?
    var eraTextColor: String?
    var eraImage: String?
    var notes: String
    var quality: String
    var formatHint: String?
    var trackLength: String?
    var availableLength: String?
    var leakDate: String?
    var fileDate: String?
    var trackType: String?
    var primaryUrl: String?
    var primaryHost: String
    var links: [TrackLink]
    var resolvedUrl: String?
    var resolvedMime: String?
    var resolvedSize: Int64?
    var resolvedFilename: String?
    var resolvedAt: Double?
    var isPlayable: Bool
    var isUnavailable: Bool?
    var audioMeta: AudioHeaderInfo?
    var isLiked: Bool?
    var playCount: Int?

    init(
        id: String,
        trackerId: String,
        tabName: String,
        title: String,
        rawName: String? = nil,
        credits: String = "",
        artist: String,
        era: String = "",
        subEra: String = "",
        eraOrder: Int = 0,
        trackOrder: Int = 0,
        eraColor: String? = nil,
        eraTextColor: String? = nil,
        eraImage: String? = nil,
        notes: String = "",
        quality: String = "",
        formatHint: String? = nil,
        trackLength: String? = nil,
        availableLength: String? = nil,
        leakDate: String? = nil,
        fileDate: String? = nil,
        trackType: String? = nil,
        primaryUrl: String? = nil,
        primaryHost: String = "unknown",
        links: [TrackLink] = [],
        resolvedUrl: String? = nil,
        resolvedMime: String? = nil,
        resolvedSize: Int64? = nil,
        resolvedFilename: String? = nil,
        resolvedAt: Double? = nil,
        isPlayable: Bool = true,
        isUnavailable: Bool? = false,
        audioMeta: AudioHeaderInfo? = nil,
        isLiked: Bool? = false,
        playCount: Int? = 0
    ) {
        self.id = id
        self.trackerId = trackerId
        self.tabName = tabName
        self.title = title
        self.rawName = rawName ?? title
        self.credits = credits
        self.artist = artist
        self.era = era
        self.subEra = subEra
        self.eraOrder = eraOrder
        self.trackOrder = trackOrder
        self.eraColor = eraColor
        self.eraTextColor = eraTextColor
        self.eraImage = eraImage
        self.notes = notes
        self.quality = quality
        self.formatHint = formatHint
        self.trackLength = trackLength
        self.availableLength = availableLength
        self.leakDate = leakDate
        self.fileDate = fileDate
        self.trackType = trackType
        self.primaryUrl = primaryUrl
        self.primaryHost = primaryHost
        self.links = links
        self.resolvedUrl = resolvedUrl
        self.resolvedMime = resolvedMime
        self.resolvedSize = resolvedSize
        self.resolvedFilename = resolvedFilename
        self.resolvedAt = resolvedAt
        self.isPlayable = isPlayable
        self.isUnavailable = isUnavailable
        self.audioMeta = audioMeta
        self.isLiked = isLiked
        self.playCount = playCount
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
        isLiked = try? c.decodeIfPresent(Bool.self, forKey: .isLiked)
        playCount = try? c.decodeIfPresent(Int.self, forKey: .playCount)
    }

    var unavailableFlag: Bool {
        if isUnavailable == true { return true }
        if tabName.caseInsensitiveCompare("Unavailable") == .orderedSame { return true }
        return !isPlayable
    }

    var likedFlag: Bool { isLiked ?? false }

    var isLossless: Bool {
        if audioMeta?.lossless == true { return true }
        let q = (quality + " " + (formatHint ?? "") + " " + (resolvedMime ?? "")).lowercased()
        return q.contains("flac") || q.contains("wav") || q.contains("alac") || q.contains("lossless") || q.contains("aiff") || q.contains("cdq")
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
}

struct TrackerTabMeta: Codable, Hashable, Identifiable, Sendable {
    var gid: String?
    var name: String
    var slug: String?
    var id: String { (gid ?? "") + ":" + name }
}

struct TrackerRecord: Codable, Identifiable, Hashable, Sendable {
    var trackerId: String
    var name: String
    var artistName: String
    var currentTab: String
    var tabs: [TrackerTabMeta]
    var syncedTabs: [String]
    var trackCount: Int
    var playableCount: Int
    var credits: String?
    var lastSyncedAt: Double
    var isFollowed: Bool?
    var coverImage: String?

    var id: String { trackerId }

    init(
        trackerId: String,
        name: String,
        artistName: String,
        currentTab: String,
        tabs: [TrackerTabMeta] = [],
        syncedTabs: [String] = [],
        trackCount: Int = 0,
        playableCount: Int = 0,
        credits: String? = nil,
        lastSyncedAt: Double = Date().timeIntervalSince1970 * 1000,
        isFollowed: Bool? = true,
        coverImage: String? = nil
    ) {
        self.trackerId = trackerId
        self.name = name
        self.artistName = artistName
        self.currentTab = currentTab
        self.tabs = tabs
        self.syncedTabs = syncedTabs
        self.trackCount = trackCount
        self.playableCount = playableCount
        self.credits = credits
        self.lastSyncedAt = lastSyncedAt
        self.isFollowed = isFollowed
        self.coverImage = coverImage
    }
}

struct EraFacet: Codable, Hashable, Identifiable, Sendable {
    let era: String
    let count: Int
    let eraColor: String?
    let eraImage: String?
    var id: String { era }
}

struct PlaylistRecord: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var name: String
    var description: String
    var coverGradient: String
    var coverImage: String?
    var trackCount: Int
    var previewImages: [String]
    var createdAt: Double
    var updatedAt: Double
}

struct PlayHistoryItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
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
    let sourceUrl: String
    let resolvedUrl: String?
    let downloadableUrl: String?
    let host: String
    let mimeType: String?
    let filename: String?
    let sizeBytes: Int64?
    let formatHint: String?
    let httpHeaders: [String: String]?
    let title: String?
    let artist: String?
    let album: String?
    let thumbnail: String?
    let durationSec: Double?
    let errorCode: String?
    let errorMessage: String?

    init(
        ok: Bool,
        sourceUrl: String,
        resolvedUrl: String? = nil,
        downloadableUrl: String? = nil,
        host: String,
        mimeType: String? = nil,
        filename: String? = nil,
        sizeBytes: Int64? = nil,
        formatHint: String? = nil,
        httpHeaders: [String: String]? = nil,
        title: String? = nil,
        artist: String? = nil,
        album: String? = nil,
        thumbnail: String? = nil,
        durationSec: Double? = nil,
        errorCode: String? = nil,
        errorMessage: String? = nil
    ) {
        self.ok = ok
        self.sourceUrl = sourceUrl
        self.resolvedUrl = resolvedUrl
        self.downloadableUrl = downloadableUrl
        self.host = host
        self.mimeType = mimeType
        self.filename = filename
        self.sizeBytes = sizeBytes
        self.formatHint = formatHint
        self.httpHeaders = httpHeaders
        self.title = title
        self.artist = artist
        self.album = album
        self.thumbnail = thumbnail
        self.durationSec = durationSec
        self.errorCode = errorCode
        self.errorMessage = errorMessage
    }
}

struct OfflineTrackEntry: Codable, Identifiable, Hashable, Sendable {
    var id: String { track.id }
    let track: TrackRecord
    let localFilename: String
    let fileSizeBytes: Int64
    let downloadedAt: Date
}

struct DirectoryArtist: Codable, Identifiable, Hashable, Sendable {
    var id: String { trackerId + ":" + name }
    let trackerId: String
    let name: String
    let url: String
    let isLinkWorking: Bool
    let isUpdated: Bool
    let isStarred: Bool
}

enum HashHelper {
    static func shortSHA256(_ input: String, length: Int = 20) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined().prefix(length).description
    }

    static func sha1Hex(_ input: String) -> String {
        let digest = Insecure.SHA1.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
