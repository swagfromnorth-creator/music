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
        guard let streamURL = APIClient.shared.streamURL(trackId: track.id, compatMp3: false) else {
            lastError = "Configure your server URL before downloading tracks."
            return
        }

        downloadingIds.insert(track.id)
        defer { downloadingIds.remove(track.id) }

        do {
            var (tempURL, response) = try await URLSession.shared.download(from: streamURL)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw APIError.httpError((response as? HTTPURLResponse)?.statusCode ?? 0, "Download failed.")
            }

            var mime = (http.mimeType ?? track.resolvedMime ?? "").lowercased()
            var ext = Self.extensionFor(mime: mime, fallbackHint: track.formatHint ?? track.resolvedFilename)

            // AVPlayer cannot play raw OGG/WebM offline files directly — fetch MP3 compat transcode instead
            if ext == "ogg" || ext == "webm" || ext == "opus" {
                try? FileManager.default.removeItem(at: tempURL)
                guard let mp3URL = APIClient.shared.streamURL(trackId: track.id, compatMp3: true) else { return }
                let (mp3Temp, mp3Res) = try await URLSession.shared.download(from: mp3URL)
                guard let mp3Http = mp3Res as? HTTPURLResponse, (200...299).contains(mp3Http.statusCode) else {
                    throw APIError.httpError((mp3Res as? HTTPURLResponse)?.statusCode ?? 0, "Compat transcode download failed.")
                }
                tempURL = mp3Temp
                mime = mp3Http.mimeType ?? "audio/mpeg"
                ext = "mp3"
            }

            let filename = "\(track.id).\(ext)"
            let destURL = folderURL.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: destURL.path) {
                try FileManager.default.removeItem(at: destURL)
            }
            try FileManager.default.moveItem(at: tempURL, to: destURL)

            let attrs = try FileManager.default.attributesOfItem(atPath: destURL.path)
            let bytes = (attrs[.size] as? NSNumber)?.int64Value ?? 0

            entries[track.id] = OfflineTrackEntry(
                track: track,
                localFilename: filename,
                fileSizeBytes: bytes,
                downloadedAt: Date()
            )
            saveManifest()
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
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
        if mime.contains("webm") { return "webm" }
        if mime.contains("opus") { return "opus" }
        let hint = (fallbackHint ?? "").lowercased()
        for ext in ["flac", "m4a", "mp3", "wav", "aac", "ogg", "webm"] where hint.contains(ext) {
            return ext
        }
        return "m4a"
    }
}
