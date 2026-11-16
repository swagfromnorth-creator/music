import Foundation

final class ArtistGridService: @unchecked Sendable {
    static let shared = ArtistGridService()

    private let v3Base = "https://trackerapi.artistgrid.cx"
    private let v2Base = "http://trackerapi-2.artistgrid.cx"
    private let directoryCSV = "https://artists.artistgrid.cx/artists.csv"
    private let session: URLSession
    private let userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)"

    private let nonSongTabWords = [
        "art", "cover", "covers", "visual", "visuals", "video", "videos", "mv",
        "stem", "stems", "instrumental", "instrumentals", "acapella", "acapellas",
        "info", "about", "faq", "guide", "credit", "credits", "changelog", "notes",
        "session", "sessions", "interview", "snippet", "snippets", "edit", "edits",
        "tracklist", "recent", "update", "updates", "buy", "buys", "groupbuy",
    ]

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        self.session = URLSession(configuration: cfg)
    }

    func fetchDirectory() async throws -> [DirectoryArtist] {
        guard let url = URL(string: directoryCSV) else { throw URLError(.badURL) }
        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, _) = try await session.data(for: req)
        let csv = String(data: data, encoding: .utf8) ?? ""
        return parseDirectoryCSV(csv)
    }

    static func extractTrackerId(_ input: String) throws -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.range(of: #"^[a-zA-Z0-9_-]{25,60}$"#, options: .regularExpression) != nil {
            return trimmed
        }
        let patterns = [
            #"/spreadsheets/d/([a-zA-Z0-9_-]{20,})"#,
            #"artistgrid\.cx/tracker/([a-zA-Z0-9_-]{20,})"#,
            #"[?&]id=([a-zA-Z0-9_-]{20,})"#,
        ]
        for p in patterns {
            if let r = trimmed.range(of: p, options: .regularExpression),
               let regex = try? NSRegularExpression(pattern: p),
               let m = regex.firstMatch(in: trimmed, range: NSRange(r, in: trimmed)),
               let cap = Range(m.range(at: 1), in: trimmed) {
                return String(trimmed[cap])
            }
        }
        throw NSError(domain: "ArtistGridService", code: 400, userInfo: [NSLocalizedDescriptionKey: "Could not find an ArtistGrid tracker ID in \"\(trimmed)\"."])
    }

    func syncTracker(input: String, tabGid: String? = nil, tabSlug: String? = nil, tabName: String? = nil) async throws -> (tracker: TrackerRecord, tracks: [TrackRecord]) {
        let trackerId = try Self.extractTrackerId(input)
        var targetURL = "\(v3Base)/sh/\(trackerId)"
        if let tabGid, !tabGid.isEmpty {
            targetURL += "/gid/\(tabGid.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tabGid)"
        } else if let tabSlug, !tabSlug.isEmpty {
            targetURL += "/tab/\(tabSlug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? tabSlug)"
        }

        if let v3 = try? await fetchJSON(targetURL) {
            var activeJSON = v3
            let tabs = parseTabs(v3)
            let initialTabName = ((v3["tab"] as? [String: Any])?["name"] as? String) ?? "Tracks"
            if tabGid == nil, tabSlug == nil, isNonSongTab(initialTabName),
               let firstSongTab = tabs.first(where: { !isNonSongTab($0.name) }) {
                let nextUrl = firstSongTab.gid?.isEmpty == false
                    ? "\(v3Base)/sh/\(trackerId)/gid/\(firstSongTab.gid!)"
                    : "\(v3Base)/sh/\(trackerId)/tab/\(firstSongTab.slug ?? firstSongTab.name)"
                if let switched = try? await fetchJSON(nextUrl) {
                    activeJSON = switched
                }
            }
            let artCovers = await fetchArtCovers(trackerId: trackerId, tabs: tabs)
            return normalizeAndCurateV3(trackerId: trackerId, json: activeJSON, fallbackTab: tabName, artCovers: artCovers)
        }

        // Legacy v2 fallback
        let v2Url = tabName.map { "\(v2Base)/get/\(trackerId)?tab=\($0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? $0)" }
            ?? "\(v2Base)/get/\(trackerId)"
        let v2 = try await fetchJSON(v2Url)
        return normalizeAndCurateV2(trackerId: trackerId, json: v2, fallbackTab: tabName)
    }

    // MARK: - V3 Normalization & Curation

    private func normalizeAndCurateV3(trackerId: String, json: [String: Any], fallbackTab: String?, artCovers: [String: String]) -> (TrackerRecord, [TrackRecord]) {
        let info = (json["info"] as? [String: Any]) ?? [:]
        let trackerName = ((info["name"] as? String) ?? "Tracker").trimmingCharacters(in: .whitespacesAndNewlines)
        let artistName = trackerName.replacingOccurrences(of: #"\s*tracker\s*$"#, with: "", options: .caseInsensitive).trimmingCharacters(in: .whitespacesAndNewlines)
        let tabObj = json["tab"] as? [String: Any]
        let rawTab = (tabObj?["name"] as? String) ?? fallbackTab ?? "Unreleased"
        let tabs = parseTabs(json).filter { !isNonSongTab($0.name) }

        var rawTracks: [TrackRecord] = []
        var orderCounter = 0

        for (eraOrder, era) in ((json["eras"] as? [[String: Any]]) ?? []).enumerated() {
            let eraName = ((era["name"] as? String) ?? "Unknown Era").trimmingCharacters(in: .whitespacesAndNewlines)
            let eraColor = era["backgroundColor"] as? String
            let eraTextColor = era["textColor"] as? String
            let artImg = artCovers[eraName.lowercased()]
            let eraImg = artImg ?? ((era["image"] as? String)?.contains("sheets-images-rt") == false ? (era["image"] as? String) : nil)

            let directTracks = (era["tracks"] as? [[String: Any]]) ?? []
            for tr in directTracks {
                if let built = buildV3Track(tr, trackerId: trackerId, artist: artistName, tabName: rawTab, eraName: eraName, subEra: "Default", eraOrder: eraOrder, trackOrder: &orderCounter, eraColor: eraColor, eraTextColor: eraTextColor, eraImage: eraImg) {
                    rawTracks.append(built)
                }
            }

            for group in (era["groups"] as? [[String: Any]]) ?? [] {
                let subEra = (group["name"] as? String) ?? "Default"
                for tr in (group["tracks"] as? [[String: Any]]) ?? [] {
                    if let built = buildV3Track(tr, trackerId: trackerId, artist: artistName, tabName: rawTab, eraName: eraName, subEra: subEra, eraOrder: eraOrder, trackOrder: &orderCounter, eraColor: eraColor, eraTextColor: eraTextColor, eraImage: eraImg) {
                        rawTracks.append(built)
                    }
                }
            }
        }

        return curate(trackerId: trackerId, trackerName: trackerName, artistName: artistName, currentTab: rawTab, tabs: tabs, credits: info["credits"] as? String, rawTracks: rawTracks)
    }

    private func buildV3Track(
        _ tr: [String: Any],
        trackerId: String,
        artist: String,
        tabName: String,
        eraName: String,
        subEra: String,
        eraOrder: Int,
        trackOrder: inout Int,
        eraColor: String?,
        eraTextColor: String?,
        eraImage: String?
    ) -> TrackRecord? {
        let nameDict = tr["name"] as? [String: Any]
        let title = ((tr["name"] as? String) ?? (nameDict?["title"] as? String) ?? (nameDict?["raw"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return nil }

        let notes = ((tr["notes"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let quality = ((tr["quality"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let trackType = (tr["type"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

        if isNonSongType(trackType) || looksLikeNonSong(title: title, notes: notes) {
            return nil
        }

        var rawUrls: [String] = []
        if let linkArr = tr["links"] as? [[String: Any]] {
            for l in linkArr {
                if let u = l["url"] as? String, !u.isEmpty { rawUrls.append(u) }
            }
        }
        if let u = tr["url"] as? String, !u.isEmpty { rawUrls.append(u) }
        if let extra = tr["additional"] as? [String: Any] {
            for k in ["link", "url", "other", "mirror"] {
                if let u = extra[k] as? String, u.hasPrefix("http") { rawUrls.append(u) }
            }
        }

        let links = buildTrackLinks(rawUrls, quality: quality)
        guard let primary = links.first(where: { $0.playable }) else {
            return nil
        }

        let isUnavail = looksUnavailable(quality: quality, tabName: tabName)
        let finalTab = isUnavail ? "Unavailable" : (isNonSongTab(tabName) ? "Unreleased" : tabName)
        let id = HashHelper.shortSHA256("\(trackerId)\0\(finalTab)\0\(eraName)\0\(title)\0\(primary.url)")

        let featExtras = (nameDict?["extra"] as? String) ?? (tr["extra"] as? String) ?? ""
        trackOrder += 1
        return TrackRecord(
            id: id,
            trackerId: trackerId,
            tabName: finalTab,
            title: title,
            rawName: title,
            credits: featExtras,
            artist: artist,
            era: eraName,
            subEra: subEra,
            eraOrder: eraOrder,
            trackOrder: trackOrder,
            eraColor: eraColor,
            eraTextColor: eraTextColor,
            eraImage: eraImage,
            notes: notes,
            quality: quality.hasPrefix("http") ? "" : quality,
            formatHint: primary.formatHint,
            trackLength: tr["track_length"] as? String,
            availableLength: tr["available_length"] as? String,
            leakDate: tr["leak_date"] as? String,
            fileDate: tr["file_date"] as? String,
            trackType: trackType,
            primaryUrl: primary.url,
            primaryHost: primary.host,
            links: links,
            isPlayable: true,
            isUnavailable: isUnavail
        )
    }

    private func normalizeAndCurateV2(trackerId: String, json: [String: Any], fallbackTab: String?) -> (TrackerRecord, [TrackRecord]) {
        let rawTitle = (json["title"] as? String) ?? "Tracker"
        let artistName = rawTitle.replacingOccurrences(of: #"\s*tracker\s*$"#, with: "", options: .caseInsensitive).trimmingCharacters(in: .whitespacesAndNewlines)
        let currentTab = fallbackTab ?? "Unreleased"
        var orderCounter = 0
        var tracks: [TrackRecord] = []

        if let data = json["data"] as? [String: Any] {
            var eraIdx = 0
            for (eraName, itemsAny) in data {
                defer { eraIdx += 1 }
                let items = (itemsAny as? [[String: Any]]) ?? []
                for tr in items {
                    if let built = buildV3Track(tr, trackerId: trackerId, artist: artistName, tabName: currentTab, eraName: eraName, subEra: "Default", eraOrder: eraIdx, trackOrder: &orderCounter, eraColor: nil, eraTextColor: nil, eraImage: nil) {
                        tracks.append(built)
                    }
                }
            }
        }
        return curate(trackerId: trackerId, trackerName: rawTitle, artistName: artistName, currentTab: currentTab, tabs: [TrackerTabMeta(gid: nil, name: currentTab, slug: nil)], credits: json["credits"] as? String, rawTracks: tracks)
    }

    private func curate(trackerId: String, trackerName: String, artistName: String, currentTab: String, tabs: [TrackerTabMeta], credits: String?, rawTracks: [TrackRecord]) -> (TrackerRecord, [TrackRecord]) {
        // Deduplicate same song + version inside the tracker while merging mirror links
        var byKey: [String: TrackRecord] = [:]
        var orderedKeys: [String] = []

        for var tr in rawTracks {
            let key = "\(tr.tabName.lowercased())|\(Self.songDedupeKey(title: tr.title, artist: tr.artist))|\(Self.versionKey(tr.title))"
            if var existing = byKey[key] {
                var urls = Set(existing.links.map { $0.url })
                for link in tr.links where urls.insert(link.url).inserted {
                    existing.links.append(link)
                }
                existing.links.sort { HostResolverService.hostPriority($0.host) > HostResolverService.hostPriority($1.host) }
                if let best = existing.links.first {
                    existing.primaryUrl = best.url
                    existing.primaryHost = best.host
                }
                if existing.eraImage == nil { existing.eraImage = tr.eraImage }
                byKey[key] = existing
            } else {
                tr.links.sort { HostResolverService.hostPriority($0.host) > HostResolverService.hostPriority($1.host) }
                byKey[key] = tr
                orderedKeys.append(key)
            }
        }

        let finalTracks = orderedKeys.compactMap { byKey[$0] }
        let hasUnavail = finalTracks.contains { $0.unavailableFlag }
        var finalTabs = tabs
        if hasUnavail && !finalTabs.contains(where: { $0.name == "Unavailable" }) {
            finalTabs.append(TrackerTabMeta(gid: nil, name: "Unavailable", slug: "unavailable"))
        }
        let cleanTab = isNonSongTab(currentTab) ? (finalTabs.first?.name ?? "Unreleased") : currentTab
        let playable = finalTracks.filter { !$0.unavailableFlag }.count
        let cover = finalTracks.first(where: { $0.eraImage != nil })?.eraImage

        let tracker = TrackerRecord(
            trackerId: trackerId,
            name: trackerName,
            artistName: artistName,
            currentTab: cleanTab,
            tabs: finalTabs,
            syncedTabs: Array(Set([cleanTab] + finalTracks.map { $0.tabName })),
            trackCount: finalTracks.count,
            playableCount: playable,
            credits: credits,
            lastSyncedAt: Date().timeIntervalSince1970 * 1000,
            isFollowed: true,
            coverImage: cover
        )
        return (tracker, finalTracks)
    }

    // MARK: - Helpers

    private func fetchArtCovers(trackerId: String, tabs: [TrackerTabMeta]) async -> [String: String] {
        guard let artTab = tabs.first(where: { $0.name.lowercased().contains("art") }) else { return [:] }
        let url = artTab.gid?.isEmpty == false
            ? "\(v3Base)/sh/\(trackerId)/gid/\(artTab.gid!)"
            : "\(v3Base)/sh/\(trackerId)/tab/\(artTab.slug ?? "art")"
        guard let json = try? await fetchJSON(url) else { return [:] }
        var covers: [String: String] = [:]
        for era in (json["eras"] as? [[String: Any]]) ?? [] {
            let eraName = ((era["name"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !eraName.isEmpty else { continue }
            for tr in (era["tracks"] as? [[String: Any]]) ?? [] {
                for l in (tr["links"] as? [[String: Any]]) ?? [] {
                    if let u = l["url"] as? String,
                       u.contains("ibb.co/") || u.contains("imgur.com/") || u.contains("mzstatic.com/") || u.contains("i.scdn.co/") {
                        covers[eraName] = u
                        break
                    }
                }
                if covers[eraName] != nil { break }
            }
        }
        return covers
    }

    private func parseTabs(_ json: [String: Any]) -> [TrackerTabMeta] {
        ((json["tabs"] as? [[String: Any]]) ?? []).compactMap { t in
            guard let name = t["name"] as? String else { return nil }
            return TrackerTabMeta(gid: t["gid"] as? String, name: name, slug: t["slug"] as? String)
        }
    }

    private func buildTrackLinks(_ urls: [String], quality: String) -> [TrackLink] {
        var seen = Set<String>()
        var links: [TrackLink] = []
        for raw in urls {
            let norm = HostResolverService.normalizeUrl(raw)
            guard norm.lowercased().hasPrefix("http"), seen.insert(norm).inserted else { continue }
            let host = HostResolverService.detectHost(norm)
            links.append(TrackLink(
                url: norm,
                host: host,
                playable: HostResolverService.isPlayableHost(host),
                formatHint: HostResolverService.extractExtension(norm) ?? (quality.lowercased().contains("flac") ? "flac" : nil)
            ))
        }
        return links.sorted { HostResolverService.hostPriority($0.host) > HostResolverService.hostPriority($1.host) }
    }

    private func isNonSongTab(_ name: String) -> Bool {
        let lower = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return nonSongTabWords.contains { lower == $0 || lower.contains($0) }
    }

    private func isNonSongType(_ type: String?) -> Bool {
        guard let t = type?.lowercased(), !t.isEmpty else { return false }
        return ["stem", "instrumental", "acapella", "session", "cover art", "video", "interview", "snippet"].contains { t.contains($0) }
    }

    private func looksLikeNonSong(title: String, notes: String) -> Bool {
        let t = title.lowercased()
        if t.contains("[stem") || t.contains("(instrumental)") || t.contains("[instrumental") || t.contains("cover art") {
            return true
        }
        return notes.lowercased().contains("just an instrumental")
    }

    private func looksUnavailable(quality: String, tabName: String) -> Bool {
        if tabName.caseInsensitiveCompare("Unavailable") == .orderedSame { return true }
        let q = quality.lowercased()
        return q.contains("unavailable") || q.contains("not available") || q.contains("inaudible") || q.contains("snippet")
    }

    static func songDedupeKey(title: String, artist: String) -> String {
        let cleanTitle = title.lowercased()
            .replacingOccurrences(of: #"[\[(](?:v\d+|alt|remix|demo|acoustic|slowed|reverb|feat\.?[^)\]]*|ft\.?[^)\]]*)[\])]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9]"#, with: "", options: .regularExpression)
        let primaryArtist = artist.lowercased().components(separatedBy: CharacterSet(charactersIn: ",&")).first?
            .replacingOccurrences(of: #"[^a-z0-9]"#, with: "", options: .regularExpression) ?? ""
        return "\(primaryArtist)::\(cleanTitle)"
    }

    static func versionKey(_ title: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"[\[(]([^)\]]+)[\])]"#) else { return "orig" }
        let matches = regex.matches(in: title, range: NSRange(title.startIndex..<title.endIndex, in: title))
        let tokens = matches.compactMap { m -> String? in
            guard let r = Range(m.range(at: 1), in: title) else { return nil }
            let val = String(title[r]).lowercased()
            if val.hasPrefix("feat") || val.hasPrefix("ft") { return nil }
            return val.replacingOccurrences(of: #"[^a-z0-9]"#, with: "", options: .regularExpression)
        }.filter { !$0.isEmpty }
        return tokens.isEmpty ? "orig" : tokens.joined(separator: "_")
    }

    private func fetchJSON(_ urlStr: String) async throws -> [String: Any] {
        guard let url = URL(string: urlStr) else { throw URLError(.badURL) }
        var req = URLRequest(url: url)
        req.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        let (data, res) = try await session.data(for: req)
        if let http = res as? HTTPURLResponse, http.statusCode >= 400 {
            throw NSError(domain: "ArtistGridService", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: "ArtistGrid returned HTTP \(http.statusCode)"])
        }
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func parseDirectoryCSV(_ csv: String) -> [DirectoryArtist] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var quoted = false
        var prevCR = false

        for ch in csv {
            if ch == "\"" {
                quoted.toggle()
            } else if ch == "," && !quoted {
                row.append(field)
                field = ""
            } else if (ch == "\n" || ch == "\r") && !quoted {
                if !(ch == "\n" && prevCR) {
                    row.append(field)
                    rows.append(row)
                    row = []
                    field = ""
                }
            } else {
                field.append(ch)
            }
            prevCR = (ch == "\r")
        }
        if !field.isEmpty || !row.isEmpty {
            row.append(field)
            rows.append(row)
        }
        guard let headerRaw = rows.first else { return [] }
        let headers = headerRaw.map { $0.replacingOccurrences(of: "\u{FEFF}", with: "").trimmingCharacters(in: .whitespacesAndNewlines) }
        guard let nameIdx = headers.firstIndex(of: "name"), let urlIdx = headers.firstIndex(of: "url") else { return [] }
        let worksIdx = headers.firstIndex(of: "links_work")
        let updatedIdx = headers.firstIndex(of: "updated")
        let bestIdx = headers.firstIndex(of: "best")

        var out: [DirectoryArtist] = []
        for cols in rows.dropFirst() {
            guard nameIdx < cols.count, urlIdx < cols.count else { continue }
            let name = cols[nameIdx].trimmingCharacters(in: .whitespacesAndNewlines)
            let url = cols[urlIdx].trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty, let tid = try? Self.extractTrackerId(url) else { continue }
            let works = worksIdx.flatMap { $0 < cols.count ? cols[$0] == "1" : nil } ?? true
            let updated = updatedIdx.flatMap { $0 < cols.count ? cols[$0] == "1" : nil } ?? false
            let starred = bestIdx.flatMap { $0 < cols.count ? cols[$0].trimmingCharacters(in: .whitespaces) == "true" : nil } ?? false
            out.append(DirectoryArtist(trackerId: tid, name: name, url: url, isLinkWorking: works, isUpdated: updated, isStarred: starred))
        }
        return out
    }
}
