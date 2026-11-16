import Foundation

@MainActor
final class OfflineStore: ObservableObject {
    static let shared = OfflineStore()

    @Published private(set) var entries: [String: OfflineTrackEntry] = [:]
    @Published private(set) var downloadingIds: Set<String> = []
    @Published var lastError: String?

    private let folderURL: URL
    private let manifestURL: URL

    private init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        self.folderURL = appSupport.appendingPathComponent("OfflineAudio", isDirectory: true)
        self.manifestURL = folderURL.appendingPathComponent("manifest.json")
        try? FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
        loadManifest()
    }

    var sortedEntries: [OfflineTrackEntry] {
        entries.values.sorted { $0.downloadedAt > $1.downloadedAt }
    }

    var totalBytes: Int64 {
        entries.values.reduce(0) { $0 + $1.fileSizeBytes }
    }

    func isDownloaded(_ trackId: String) -> Bool {
        localURL(for: trackId) != nil
    }

    func localURL(for trackId: String) -> URL? {
        guard let entry = entries[trackId] else { return nil }
        let fileURL = folderURL.appendingPathComponent(entry.localFilename)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        return fileURL
    }

    func download(track: TrackRecord) async {
        guard !downloadingIds.contains(track.id) else { return }
        downloadingIds.insert(track.id)
        defer { downloadingIds.remove(track.id) }

        let candidates = track.links.isEmpty
            ? (track.primaryUrl.map { [TrackLink(url: $0, host: track.primaryHost, playable: true)] } ?? [])
            : track.links.filter { $0.playable }

        guard !candidates.isEmpty else {
            lastError = "No playable mirrors found for \"\(track.title)\"."
            return
        }

        var errorSummary: String?
        for link in candidates {
            let resolved = await HostResolverService.shared.resolve(url: link.url)
            guard resolved.ok, let targetStr = resolved.downloadableUrl ?? resolved.resolvedUrl,
                  let targetURL = URL(string: targetStr) else {
                errorSummary = resolved.errorMessage
                continue
            }

            // HLS playlists (.m3u8) aren't plain single-file downloads; check whether progressive URL or segment stitching works
            if targetStr.lowercased().contains(".m3u8") {
                do {
                    let stitched = try await downloadHLSAudioSegments(playlistURL: targetURL, headers: resolved.httpHeaders, trackId: track.id)
                    saveDownloadedFile(track: track, sourceTempURL: stitched.tempFile, ext: stitched.ext)
                    lastError = nil
                    return
                } catch {
                    errorSummary = "HLS stream is stream-only or unavailable for offline saving (\(error.localizedDescription))."
                    continue
                }
            }

            do {
                var req = URLRequest(url: targetURL)
                for (k, v) in (resolved.httpHeaders ?? [:]) {
                    req.setValue(v, forHTTPHeaderField: k)
                }
                let (tempURL, response) = try await URLSession.shared.download(for: req)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                    try? FileManager.default.removeItem(at: tempURL)
                    errorSummary = "Host returned HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)."
                    continue
                }

                let mime = (http.mimeType ?? resolved.mimeType ?? "").lowercased()
                let ext = Self.extensionFor(mime: mime, fallbackHint: resolved.formatHint ?? track.formatHint ?? link.url)
                saveDownloadedFile(track: track, sourceTempURL: tempURL, ext: ext)
                lastError = nil
                return
            } catch {
                errorSummary = error.localizedDescription
            }
        }

        lastError = errorSummary ?? "Could not save track offline."
    }

    private func saveDownloadedFile(track: TrackRecord, sourceTempURL: URL, ext: String) {
        let filename = "\(track.id).\(ext)"
        let destURL = folderURL.appendingPathComponent(filename)
        try? FileManager.default.removeItem(at: destURL)
        do {
            try FileManager.default.moveItem(at: sourceTempURL, to: destURL)
            let attrs = try FileManager.default.attributesOfItem(atPath: destURL.path)
            let bytes = (attrs[.size] as? NSNumber)?.int64Value ?? 0
            entries[track.id] = OfflineTrackEntry(track: track, localFilename: filename, fileSizeBytes: bytes, downloadedAt: Date())
            saveManifest()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func downloadHLSAudioSegments(playlistURL: URL, headers: [String: String]?, trackId: String) async throws -> (tempFile: URL, ext: String) {
        var req = URLRequest(url: playlistURL)
        for (k, v) in (headers ?? [:]) { req.setValue(v, forHTTPHeaderField: k) }
        let (data, _) = try await URLSession.shared.data(for: req)
        let text = String(data: data, encoding: .utf8) ?? ""
        if text.contains("#EXT-X-KEY") {
            throw NSError(domain: "OfflineStore", code: 403, userInfo: [NSLocalizedDescriptionKey: "Encrypted HLS stream"])
        }

        // If master playlist, follow first variant URL
        let lines = text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        if text.contains("#EXT-X-STREAM-INF"), let variant = lines.first(where: { !$0.hasPrefix("#") }),
           let variantURL = URL(string: variant, relativeTo: playlistURL) {
            return try await downloadHLSAudioSegments(playlistURL: variantURL, headers: headers, trackId: trackId)
        }

        var segmentURLs: [URL] = []
        var isMp4Init = false
        for line in lines {
            if line.hasPrefix("#EXT-X-MAP:URI=\"") {
                isMp4Init = true
                let raw = line.replacingOccurrences(of: "#EXT-X-MAP:URI=\"", with: "").replacingOccurrences(of: "\"", with: "")
                if let u = URL(string: raw, relativeTo: playlistURL) { segmentURLs.append(u) }
            } else if !line.hasPrefix("#") {
                if let u = URL(string: line, relativeTo: playlistURL) { segmentURLs.append(u) }
            }
        }
        guard !segmentURLs.isEmpty else {
            throw NSError(domain: "OfflineStore", code: 404, userInfo: [NSLocalizedDescriptionKey: "Empty HLS playlist"])
        }

        let tempOut = FileManager.default.temporaryDirectory.appendingPathComponent("\(trackId)_stitch")
        try? FileManager.default.removeItem(at: tempOut)
        FileManager.default.createFile(atPath: tempOut.path, contents: nil)
        let handle = try FileHandle(forWritingTo: tempOut)
        defer { try? handle.close() }

        for segURL in segmentURLs {
            var segReq = URLRequest(url: segURL)
            for (k, v) in (headers ?? [:]) { segReq.setValue(v, forHTTPHeaderField: k) }
            let (segData, _) = try await URLSession.shared.data(for: segReq)
            try handle.write(contentsOf: segData)
        }

        let ext = isMp4Init || segmentURLs.first?.pathExtension.lowercased() == "m4s" ? "m4a" : "aac"
        return (tempOut, ext)
    }

    func removeDownload(trackId: String) {
        if let entry = entries.removeValue(forKey: trackId) {
            let fileURL = folderURL.appendingPathComponent(entry.localFilename)
            try? FileManager.default.removeItem(at: fileURL)
            saveManifest()
        }
    }

    func clearAll() {
        for entry in entries.values {
            let fileURL = folderURL.appendingPathComponent(entry.localFilename)
            try? FileManager.default.removeItem(at: fileURL)
        }
        entries.removeAll()
        saveManifest()
    }

    private func loadManifest() {
        guard let data = try? Data(contentsOf: manifestURL),
              let decoded = try? JSONDecoder().decode([String: OfflineTrackEntry].self, from: data) else {
            return
        }
        entries = decoded.filter { _, entry in
            FileManager.default.fileExists(atPath: folderURL.appendingPathComponent(entry.localFilename).path)
        }
    }

    private func saveManifest() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        try? data.write(to: manifestURL, options: [.atomic])
    }

    private static func extensionFor(mime: String, fallbackHint: String?) -> String {
        if mime.contains("flac") { return "flac" }
        if mime.contains("wav") { return "wav" }
        if mime.contains("mp4") || mime.contains("m4a") || mime.contains("aac") { return "m4a" }
        if mime.contains("mpeg") || mime.contains("mp3") { return "mp3" }
        if mime.contains("ogg") { return "ogg" }
        let hint = (fallbackHint ?? "").lowercased()
        for ext in ["flac", "m4a", "mp3", "wav", "aac"] where hint.contains(ext) {
            return ext
        }
        return "m4a"
    }
}
