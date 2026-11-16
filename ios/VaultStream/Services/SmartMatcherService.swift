import Foundation

enum SmartMatchSourceKind: String, Sendable {
    case artistgrid = "ArtistGrid"
    case library = "Library"
    case ytmusic = "YT Music"
    case soundcloud = "SoundCloud"
    case youtube = "YouTube"
    case direct = "Direct URL"
}

struct SmartPartialCandidate: Identifiable, Sendable {
    var id: String { url }
    let title: String
    let artist: String
    let album: String?
    let source: SmartMatchSourceKind
    let url: String
    let score: Int
}

struct SmartMatchedItem: Identifiable, Sendable {
    var id: String { trackId + ":" + inputTitle }
    let inputTitle: String
    let inputArtist: String
    let inputAlbum: String?
    let trackId: String
    let matchedTitle: String
    let matchedArtist: String
    let matchedAlbum: String?
    let matchedSource: SmartMatchSourceKind
    let score: Int
    let matchReason: String
}

struct SmartUnmatchedItem: Identifiable, Sendable {
    let id = UUID()
    let title: String
    let artist: String
    let album: String?
    let reason: String
    let sourcesChecked: [String]
    let bestPartialCandidate: SmartPartialCandidate?
}

struct SmartDuplicateItem: Identifiable, Sendable {
    let id = UUID()
    let title: String
    let artist: String
    let reason: String
}

struct SmartBatchImportReport: Sendable {
    var playlist: PlaylistRecord?
    var totalParsed: Int
    var tracksAdded: Int
    var artistgridCount: Int
    var libraryCount: Int
    var ytmusicCount: Int
    var soundcloudCount: Int
    var youtubeCount: Int
    var autoSyncedTrackers: [String]
    var matchedItems: [SmartMatchedItem]
    var duplicateSkipped: [SmartDuplicateItem]
    var unmatched: [SmartUnmatchedItem]
}

@MainActor
final class SmartMatcherService {
    static let shared = SmartMatcherService()

    private let versionPattern = #"\b(remix|acoustic|live|slowed|sped\s*up|reverb|demo|instrumental|acapella|chopped|deluxe|extended|radio\s*edit|clean|explicit|v\d+|alt)\b"#
    private let noisePattern = #"\b(type\s*beat|free\s*beat|reaction|tutorial|karaoke|nightcore|8d\s*audio|bass\s*boosted|piano\s*cover|guitar\s*cover|drum\s*cover|vocal\s*cover|1\s*hour|looped)\b"#
    private let internalTrackerIds: Set<String> = ["imported_web", "spotify_imports", "local_files"]

    private init() {}

    func importSongsSmart(
        playlistName: String,
        content: String,
        sourcePriority: String = "auto",
        onProgress: ((Int, Int, String) -> Void)? = nil
    ) async -> SmartBatchImportReport {
        let items = MetadataService.parseSpotifyInput(content)
        let capped = Array(items.prefix(80))
        guard !capped.isEmpty else {
            return SmartBatchImportReport(
                playlist: nil, totalParsed: 0, tracksAdded: 0,
                artistgridCount: 0, libraryCount: 0, ytmusicCount: 0, soundcloudCount: 0, youtubeCount: 0,
                autoSyncedTrackers: [], matchedItems: [], duplicateSkipped: [], unmatched: []
            )
        }

        let library = LibraryStore.shared
        await library.loadDirectoryIfNeeded()

        let existingTrackerIds = Set(library.trackers.map { $0.trackerId })
        var syncedSet = existingTrackerIds
        var autoSyncedTrackers: [String] = []
        var matchedTracks: [(TrackRecord, SmartMatchedItem)] = []
        var unmatched: [SmartUnmatchedItem] = []

        var agCount = 0
        var libCount = 0
        var ytmCount = 0
        var scCount = 0
        var ytCount = 0

        let order: [String]
        switch sourcePriority {
        case "soundcloud": order = ["soundcloud", "ytmusic", "youtube"]
        case "youtube": order = ["youtube", "ytmusic", "soundcloud"]
        case "ytmusic": order = ["ytmusic", "soundcloud", "youtube"]
        default: order = ["ytmusic", "soundcloud", "youtube"]
        }

        for (idx, item) in capped.enumerated() {
            onProgress?(idx + 1, capped.count, item.title)

            var checked = ["Library", "ArtistGrid"]
            var bestPartial: SmartPartialCandidate?

            func trackPartial(_ candidate: SmartPartialCandidate?) {
                guard let candidate else { return }
                if bestPartial == nil || candidate.score > bestPartial!.score {
                    bestPartial = candidate
                }
            }

            // 1) Check already-synced library & ArtistGrid trackers
            let localHit = bestLocalMatch(for: item, in: library.allTracks)
            if let localHit, localHit.score >= 64 {
                if localHit.source == .artistgrid { agCount += 1 } else { libCount += 1 }
                matchedTracks.append((
                    localHit.track,
                    SmartMatchedItem(
                        inputTitle: item.title,
                        inputArtist: item.artist,
                        inputAlbum: item.album,
                        trackId: localHit.track.id,
                        matchedTitle: localHit.track.title,
                        matchedArtist: localHit.track.artist,
                        matchedAlbum: localHit.track.era.isEmpty ? nil : localHit.track.era,
                        matchedSource: localHit.source,
                        score: localHit.score,
                        matchReason: localHit.reason
                    )
                ))
                continue
            }

            // 2) Auto-discover & sync matching ArtistGrid tracker if artist exists in Directory
            var discoveredHit = localHit
            if !item.artist.isEmpty && item.artist.lowercased() != "unknown artist" {
                let dirMatches = findDirectoryMatches(for: item.artist, directory: library.directoryArtists)
                for dirEntry in dirMatches {
                    if !syncedSet.contains(dirEntry.trackerId) {
                        syncedSet.insert(dirEntry.trackerId)
                        if let synced = try? await library.syncArtistGridTracker(input: dirEntry.trackerId) {
                            autoSyncedTrackers.append("\(synced.artistName) (\(synced.trackCount))")
                        }
                    }
                    let scoped = library.allTracks.filter { $0.trackerId == dirEntry.trackerId }
                    if let hit = bestLocalMatch(for: item, in: scoped) {
                        if discoveredHit == nil || hit.score > discoveredHit!.score {
                            discoveredHit = hit
                        }
                    }
                }
            }

            if let discoveredHit, discoveredHit.score >= 58 {
                if discoveredHit.source == .artistgrid { agCount += 1 } else { libCount += 1 }
                matchedTracks.append((
                    discoveredHit.track,
                    SmartMatchedItem(
                        inputTitle: item.title,
                        inputArtist: item.artist,
                        inputAlbum: item.album,
                        trackId: discoveredHit.track.id,
                        matchedTitle: discoveredHit.track.title,
                        matchedArtist: discoveredHit.track.artist,
                        matchedAlbum: discoveredHit.track.era.isEmpty ? nil : discoveredHit.track.era,
                        matchedSource: discoveredHit.source,
                        score: discoveredHit.score,
                        matchReason: discoveredHit.reason
                    )
                ))
                continue
            }

            // 3) Smart Online Discovery (YouTube Music -> SoundCloud -> YouTube)
            let cleanTitle = stripNoise(item.title)
            let baseQuery = item.artist.isEmpty ? cleanTitle : "\(item.artist) - \(cleanTitle)"
            let albumQuery = (item.album?.isEmpty == false && !item.artist.isEmpty)
                ? "\(item.artist) \(cleanTitle) \(item.album!)"
                : nil

            var bestOnline: (hit: OnlineSearchResult, kind: SmartMatchSourceKind, score: Int, signals: [String])?

            for src in order {
                let srcKind: SmartMatchSourceKind = src == "soundcloud" ? .soundcloud : (src == "youtube" ? .youtube : .ytmusic)
                checked.append(srcKind.rawValue)

                var queries = [baseQuery]
                if let albumQuery, albumQuery != baseQuery {
                    queries.append(albumQuery)
                }

                for q in queries {
                    let hits = await fetchOnlineCandidates(query: q, source: src)
                    for hit in hits {
                        let dur = hit.durationSec ?? YouTubeService.parseDurationText(hit.durationText)
                        let scored = scoreCandidate(
                            targetTitle: item.title,
                            targetArtist: item.artist,
                            targetAlbum: item.album,
                            targetDurationSec: nil,
                            candTitle: hit.title,
                            candArtist: hit.artist,
                            candAlbumOrEra: hit.album,
                            candExtra: nil,
                            candDurationSec: dur,
                            source: srcKind
                        )
                        if scored.score >= 52 {
                            if bestOnline == nil || scored.score > bestOnline!.score {
                                bestOnline = (hit, srcKind, scored.score, scored.signals)
                            }
                        } else if scored.score > 0 {
                            trackPartial(SmartPartialCandidate(
                                title: hit.title,
                                artist: hit.artist,
                                album: hit.album,
                                source: srcKind,
                                url: hit.url,
                                score: scored.score
                            ))
                        }
                    }
                    if let cur = bestOnline, cur.kind == srcKind, cur.score >= 66 {
                        break
                    }
                }
                if let cur = bestOnline, cur.score >= 72 {
                    break
                }
            }

            if let bestOnline {
                let host = bestOnline.kind == .soundcloud ? "soundcloud" : "youtube"
                let saved = library.upsertOnlineTrack(
                    sourceUrl: bestOnline.hit.url,
                    title: item.title,
                    artist: item.artist.isEmpty ? bestOnline.hit.artist : item.artist,
                    album: item.album ?? bestOnline.hit.album,
                    thumbnail: bestOnline.hit.thumbnail,
                    durationSec: bestOnline.hit.durationSec,
                    host: host,
                    trackerId: "spotify_imports",
                    trackerName: "Imported Playlists",
                    tabName: playlistName
                )
                switch bestOnline.kind {
                case .soundcloud: scCount += 1
                case .youtube: ytCount += 1
                default: ytmCount += 1
                }
                matchedTracks.append((
                    saved,
                    SmartMatchedItem(
                        inputTitle: item.title,
                        inputArtist: item.artist,
                        inputAlbum: item.album,
                        trackId: saved.id,
                        matchedTitle: bestOnline.hit.title,
                        matchedArtist: bestOnline.hit.artist,
                        matchedAlbum: bestOnline.hit.album,
                        matchedSource: bestOnline.kind,
                        score: bestOnline.score,
                        matchReason: "\(bestOnline.kind.rawValue) via \(bestOnline.signals.joined(separator: " + "))"
                    )
                ))
            } else {
                let reason: String
                if let bestPartial {
                    reason = "No close match across \(checked.joined(separator: ", ")) (closest: \"\(bestPartial.title)\" by \(bestPartial.artist) on \(bestPartial.source.rawValue), \(bestPartial.score)/100)."
                } else {
                    reason = "No playable match found across \(checked.joined(separator: ", "))."
                }
                unmatched.append(SmartUnmatchedItem(
                    title: item.title,
                    artist: item.artist,
                    album: item.album,
                    reason: reason,
                    sourcesChecked: checked,
                    bestPartialCandidate: bestPartial
                ))
            }
        }

        let created = library.createPlaylist(
            name: playlistName,
            description: "Imported \(matchedTracks.count)/\(capped.count) tracks (\(unmatched.count) unavailable)"
        )
        var addedCount = 0
        var dupes: [SmartDuplicateItem] = []
        for (track, detail) in matchedTracks {
            if library.addTrack(track, toPlaylist: created.id) {
                addedCount += 1
            } else {
                dupes.append(SmartDuplicateItem(
                    title: detail.inputTitle,
                    artist: detail.inputArtist,
                    reason: "Duplicate same song & version already in playlist"
                ))
            }
        }

        let refreshedPl = library.playlists.first(where: { $0.id == created.id }) ?? created
        return SmartBatchImportReport(
            playlist: refreshedPl,
            totalParsed: capped.count,
            tracksAdded: addedCount,
            artistgridCount: agCount,
            libraryCount: libCount,
            ytmusicCount: ytmCount,
            soundcloudCount: scCount,
            youtubeCount: ytCount,
            autoSyncedTrackers: autoSyncedTrackers,
            matchedItems: matchedTracks.map { $0.1 },
            duplicateSkipped: dupes,
            unmatched: unmatched
        )
    }

    // MARK: - Helpers

    private func fetchOnlineCandidates(query: String, source: String) async -> [OnlineSearchResult] {
        switch source {
        case "soundcloud":
            return (try? await SoundCloudService.shared.search(query: query, limit: 5).tracks) ?? []
        case "youtube":
            return (try? await YouTubeService.shared.searchYouTubeVideos(query: query, limit: 5)) ?? []
        default:
            return (try? await YouTubeService.shared.searchYouTubeMusic(query: query, limit: 5).tracks) ?? []
        }
    }

    private func bestLocalMatch(for item: SpotifyTrackInput, in pool: [TrackRecord]) -> (track: TrackRecord, source: SmartMatchSourceKind, score: Int, reason: String)? {
        var best: (track: TrackRecord, source: SmartMatchSourceKind, score: Int, reason: String)?
        for cand in pool where !cand.unavailableFlag {
            let srcKind: SmartMatchSourceKind = internalTrackerIds.contains(cand.trackerId) ? .library : .artistgrid
            let candDur = cand.audioMeta?.durationSec ?? YouTubeService.parseDurationText(cand.trackLength)
            let scored = scoreCandidate(
                targetTitle: item.title,
                targetArtist: item.artist,
                targetAlbum: item.album,
                targetDurationSec: nil,
                candTitle: cand.title,
                candArtist: cand.artist,
                candAlbumOrEra: cand.era,
                candExtra: "\(cand.credits) \(cand.notes)",
                candDurationSec: candDur,
                source: srcKind
            )
            if scored.score >= 58 && (best == nil || scored.score > best!.score) {
                let prefix = srcKind == .artistgrid ? "ArtistGrid (\(cand.artist) • \(cand.era))" : "Library"
                best = (cand, srcKind, scored.score, "\(prefix) via \(scored.signals.joined(separator: " + "))")
            }
        }
        return best
    }

    private func findDirectoryMatches(for artistName: String, directory: [DirectoryArtist]) -> [DirectoryArtist] {
        let primary = artistName.components(separatedBy: CharacterSet(charactersIn: ",&")).first ?? artistName
        let cleanArtist = normalizeTokens(primary)
        guard !cleanArtist.isEmpty && cleanArtist.count >= 2 && cleanArtist != "unknown artist" else { return [] }

        var ranked: [(DirectoryArtist, Int)] = []
        for entry in directory {
            let baseName = entry.name.replacingOccurrences(of: #"\s*\[Alt(?:\s*#\d+)?\]$"#, with: "", options: .regularExpression)
            let normEntry = normalizeTokens(baseName)
            guard !normEntry.isEmpty else { continue }
            var rank = 0
            if normEntry == cleanArtist { rank = 100 }
            else if (normEntry.contains(cleanArtist) || cleanArtist.contains(normEntry)) && min(normEntry.count, cleanArtist.count) >= 4 {
                rank = 70
            }
            if rank == 0 { continue }
            if !entry.isLinkWorking { rank -= 30 }
            if entry.isStarred { rank += 8 }
            ranked.append((entry, rank))
        }
        return Array(ranked.sorted { $0.1 > $1.1 }.prefix(2).map { $0.0 })
    }

    private func scoreCandidate(
        targetTitle: String,
        targetArtist: String,
        targetAlbum: String?,
        targetDurationSec: Double?,
        candTitle: String,
        candArtist: String,
        candAlbumOrEra: String?,
        candExtra: String?,
        candDurationSec: Double?,
        source: SmartMatchSourceKind
    ) -> (score: Int, signals: [String]) {
        var signals: [String] = []
        var score = 0

        let rawArtistLower = candArtist.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let isGenericArtist = rawArtistLower.isEmpty
            || rawArtistLower == "unknown artist"
            || rawArtistLower == "various artists"
            || rawArtistLower == "youtube"
            || rawArtistLower == "youtube music"
            || rawArtistLower == "soundcloud"
            || source == .youtube
            || source == .soundcloud

        var cTitleRaw = candTitle
        var cArtistRaw = "\(candArtist) \(candExtra ?? "")"
        let dashParts = candTitle.components(separatedBy: " - ")
        if isGenericArtist, dashParts.count >= 2 {
            let leftNorm = normalizeTokens(dashParts[0])
            let tArtNorm = normalizeTokens(targetArtist)
            if !tArtNorm.isEmpty && (leftNorm.contains(tArtNorm) || tArtNorm.contains(leftNorm)) {
                cArtistRaw += " \(dashParts[0])"
                cTitleRaw = dashParts.dropFirst().joined(separator: " - ")
            }
        }

        let tTitle = normalizeTokens(targetTitle)
        let cTitle = normalizeTokens(cTitleRaw)
        let cTitleFull = normalizeTokens(candTitle)
        guard !tTitle.isEmpty, !cTitle.isEmpty || !cTitleFull.isEmpty else { return (0, []) }

        let overlap = max(jaccard(tTitle, cTitle), jaccard(tTitle, cTitleFull))
        if tTitle == cTitle {
            score += 46
            signals.append("exact title")
        } else if (cTitle.hasPrefix(tTitle) || tTitle.hasPrefix(cTitle) || cTitleFull.contains(tTitle)) && min(tTitle.count, cTitle.count) >= 4 {
            score += 36
            signals.append("title match")
        } else if overlap >= 0.45 {
            score += Int((overlap * 38).rounded())
            signals.append("similar title")
        } else {
            return (0, [])
        }

        let tVers = extractVersions(targetTitle)
        let cVers = extractVersions("\(candTitle) \(candExtra ?? "")")
        if !tVers.isEmpty {
            if tVers.contains(where: { cVers.contains($0) }) {
                score += 8
                signals.append("version")
            } else {
                score -= 22
            }
        } else if candTitle.range(of: noisePattern, options: [.regularExpression, .caseInsensitive]) != nil {
            score -= 34
        } else if cVers.contains("slowed") || cVers.contains("sped up") {
            score -= 24
        }

        let tArt = normalizeTokens(targetArtist)
        let cArt = normalizeTokens(isGenericArtist ? "\(cArtistRaw) \(candTitle)" : cArtistRaw)
        if tArt.isEmpty || tArt == "unknown artist" {
            score += 8
        } else {
            let primaryTarget = normalizeTokens(targetArtist.components(separatedBy: CharacterSet(charactersIn: ",&")).first ?? targetArtist)
            let words = primaryTarget.split(separator: " ").filter { $0.count >= 2 }.map(String.init)
            if !primaryTarget.isEmpty && cArt.contains(primaryTarget) {
                score += 28
                signals.append("artist")
            } else if !words.isEmpty && words.allSatisfy({ cArt.contains($0) }) {
                score += 24
                signals.append("artist")
            } else if words.contains(where: { cArt.contains($0) }) {
                score += 14
                signals.append("artist token")
            } else {
                score -= 20
            }
        }

        let tAlbum = normalizeTokens(targetAlbum ?? "")
        let cAlbum = normalizeTokens("\(candAlbumOrEra ?? "") \(candExtra ?? "") \(candTitle)")
        if tAlbum.count >= 2 && !cAlbum.isEmpty {
            let j = jaccard(tAlbum, cAlbum)
            if cAlbum.contains(tAlbum) || j >= 0.5 {
                score += 16
                signals.append("album/era")
            } else if j >= 0.25 {
                score += 8
                signals.append("partial album")
            } else if let rawAlb = candAlbumOrEra, normalizeTokens(rawAlb).count >= 3, normalizeTokens(rawAlb) != "imported" {
                score -= 8
            }
        }

        if let td = targetDurationSec, let cd = candDurationSec, td > 0, cd > 0 {
            let diff = abs(td - cd)
            if diff <= 3 { score += 14; signals.append("duration") }
            else if diff <= 8 { score += 9; signals.append("duration") }
            else if diff <= 15 { score += 4 }
            else if diff > 60 { score -= 22 }
        }

        switch source {
        case .artistgrid: score += 6
        case .library: score += 5
        case .ytmusic: score += 4
        default: break
        }

        return (max(0, min(115, score)), signals)
    }

    private func stripNoise(_ s: String) -> String {
        s.replacingOccurrences(of: #"\s*[\[(](?:feat|ft|with)\.?\s+[^)\]]+[\])]"#, with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func normalizeTokens(_ s: String) -> String {
        stripNoise(s)
            .lowercased()
            .replacingOccurrences(of: #"\([^)]*\)|\[[^\]]*\]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-z0-9\s]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func extractVersions(_ s: String) -> Set<String> {
        guard let regex = try? NSRegularExpression(pattern: versionPattern, options: .caseInsensitive) else { return [] }
        let matches = regex.matches(in: s, range: NSRange(s.startIndex..<s.endIndex, in: s))
        return Set(matches.compactMap { m in
            guard let r = Range(m.range, in: s) else { return nil }
            return String(s[r]).lowercased()
        })
    }

    private func jaccard(_ a: String, _ b: String) -> Double {
        let sa = Set(a.split(separator: " ").filter { !$0.isEmpty })
        let sb = Set(b.split(separator: " ").filter { !$0.isEmpty })
        guard !sa.isEmpty, !sb.isEmpty else { return 0 }
        let inter = sa.intersection(sb).count
        let union = sa.count + sb.count - inter
        return union > 0 ? Double(inter) / Double(union) : 0
    }
}
