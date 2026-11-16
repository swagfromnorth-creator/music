import AVFoundation
import Foundation
import MediaPlayer
import UIKit

enum RepeatMode: Int, CaseIterable {
    case off = 0
    case all = 1
    case one = 2

    var iconName: String {
        switch self {
        case .off, .all: return "repeat"
        case .one: return "repeat.1"
        }
    }
}

@MainActor
final class AudioPlayerManager: ObservableObject {
    static let shared = AudioPlayerManager()

    @Published var currentTrack: TrackRecord?
    @Published var queue: [TrackRecord] = []
    @Published var currentIndex: Int = 0
    @Published var isPlaying: Bool = false
    @Published var isLoading: Bool = false
    @Published var currentTime: Double = 0
    @Published var duration: Double = 0
    @Published var isShuffle: Bool = false
    @Published var repeatMode: RepeatMode = .off
    @Published var errorMessage: String?

    @Published var showNowPlayingSheet: Bool = false
    @Published var activeAddToPlaylistTrack: TrackRecord?
    @Published var activeInspectTrack: TrackRecord?

    private let player = AVPlayer()
    private var timeObserver: Any?
    private var statusObserver: NSKeyValueObservation?
    private var rateObserver: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var failedObserver: NSObjectProtocol?
    private var isAttemptingCompatFallback = false
    private var isUserScrubbing = false
    private var artworkTask: Task<Void, Never>?

    var onTrackUnavailableChanged: ((String, Bool) -> Void)?

    private init() {
        configureAudioSession()
        configureRemoteCommands()
        observePlayer()
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            errorMessage = "Audio session error: \(error.localizedDescription)"
        }
    }

    private func observePlayer() {
        let interval = CMTime(seconds: 0.4, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] cmTime in
            Task { @MainActor [weak self] in
                guard let self, !self.isUserScrubbing else { return }
                let secs = cmTime.seconds
                if secs.isFinite && secs >= 0 {
                    self.currentTime = secs
                }
                if let itemDur = self.player.currentItem?.duration.seconds, itemDur.isFinite, itemDur > 0 {
                    self.duration = itemDur
                }
                self.updateNowPlayingElapsed()
            }
        }

        rateObserver = player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                switch player.timeControlStatus {
                case .playing:
                    self.isPlaying = true
                    self.isLoading = false
                case .waitingToPlayAtSpecifiedRate:
                    self.isLoading = true
                case .paused:
                    self.isPlaying = false
                    self.isLoading = false
                @unknown default:
                    break
                }
                self.updateNowPlayingElapsed()
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor [weak self] in
                guard let self,
                      let item = notification.object as? AVPlayerItem,
                      item == self.player.currentItem else { return }
                self.handleTrackEnded()
            }
        }

        failedObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            Task { @MainActor [weak self] in
                guard let self,
                      let item = notification.object as? AVPlayerItem,
                      item == self.player.currentItem else { return }
                await self.handlePlaybackFailure(error: item.error)
            }
        }
    }

    private func configureRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.resume() }
            return .success
        }

        center.pauseCommand.isEnabled = true
        center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.pause() }
            return .success
        }

        center.togglePlayPauseCommand.isEnabled = true
        center.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.togglePlayPause() }
            return .success
        }

        center.nextTrackCommand.isEnabled = true
        center.nextTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.next() }
            return .success
        }

        center.previousTrackCommand.isEnabled = true
        center.previousTrackCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.previous() }
            return .success
        }

        center.changePlaybackPositionCommand.isEnabled = true
        center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let pos = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            Task { @MainActor [weak self] in self?.seek(to: pos.positionTime) }
            return .success
        }
    }

    // MARK: - Playback Actions

    func play(track: TrackRecord, queue newQueue: [TrackRecord]? = nil, linkIndex: Int? = nil) {
        if let newQueue, !newQueue.isEmpty {
            queue = newQueue
            currentIndex = newQueue.firstIndex(where: { $0.id == track.id }) ?? 0
        } else if !queue.contains(where: { $0.id == track.id }) {
            queue.insert(track, at: 0)
            currentIndex = 0
        } else if let idx = queue.firstIndex(where: { $0.id == track.id }) {
            currentIndex = idx
        }

        isAttemptingCompatFallback = false
        startPlayback(of: track, compatMp3: false, linkIndex: linkIndex)
    }

    func playNext(_ track: TrackRecord) {
        if currentTrack == nil {
            play(track: track, queue: [track])
            return
        }
        queue.removeAll { $0.id == track.id }
        let insertAt = min(currentIndex + 1, queue.count)
        queue.insert(track, at: insertAt)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func startPlayback(of track: TrackRecord, compatMp3: Bool, linkIndex: Int?) {
        configureAudioSession()
        currentTrack = track
        errorMessage = nil
        isLoading = true
        currentTime = 0
        duration = track.audioMeta?.durationSec ?? 0

        let playbackURL: URL?
        if let offlineURL = OfflineStore.shared.localURL(for: track.id) {
            playbackURL = offlineURL
        } else {
            playbackURL = APIClient.shared.streamURL(trackId: track.id, compatMp3: compatMp3, linkIndex: linkIndex)
        }

        guard let url = playbackURL else {
            isLoading = false
            errorMessage = "Configure your VaultStream server URL in Settings to stream."
            return
        }

        statusObserver?.invalidate()
        let item = AVPlayerItem(url: url)
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] playerItem, _ in
            Task { @MainActor [weak self] in
                guard let self, playerItem == self.player.currentItem else { return }
                switch playerItem.status {
                case .readyToPlay:
                    self.isLoading = false
                    self.errorMessage = nil
                    let secs = playerItem.asset.duration.seconds
                    if secs.isFinite && secs > 0 {
                        self.duration = secs
                    }
                    self.publishNowPlayingInfo(for: track)
                    if track.unavailableFlag {
                        _ = await APIClient.shared.setTrackAvailability(trackId: track.id, unavailable: false)
                        self.onTrackUnavailableChanged?(track.id, false)
                    }
                    await APIClient.shared.recordPlay(trackId: track.id)
                case .failed:
                    await self.handlePlaybackFailure(error: playerItem.error)
                default:
                    break
                }
            }
        }

        player.replaceCurrentItem(with: item)
        player.play()
        publishNowPlayingInfo(for: track)
    }

    private func handlePlaybackFailure(error: Error?) async {
        guard let track = currentTrack else { return }
        if !isAttemptingCompatFallback, OfflineStore.shared.localURL(for: track.id) == nil {
            isAttemptingCompatFallback = true
            startPlayback(of: track, compatMp3: true, linkIndex: nil)
            return
        }

        isLoading = false
        isPlaying = false
        errorMessage = error?.localizedDescription ?? "Could not play \"\(track.title)\". Marked unavailable."
        _ = await APIClient.shared.setTrackAvailability(trackId: track.id, unavailable: true)
        onTrackUnavailableChanged?(track.id, true)
    }

    func togglePlayPause() {
        if isPlaying {
            pause()
        } else {
            resume()
        }
    }

    func pause() {
        player.pause()
        isPlaying = false
        updateNowPlayingElapsed()
    }

    func resume() {
        configureAudioSession()
        if player.currentItem == nil, let track = currentTrack {
            play(track: track)
            return
        }
        player.play()
        isPlaying = true
        updateNowPlayingElapsed()
    }

    func next() {
        guard !queue.isEmpty else { return }
        if isShuffle && queue.count > 1 {
            var candidate = Int.random(in: 0..<queue.count)
            if candidate == currentIndex {
                candidate = (candidate + 1) % queue.count
            }
            currentIndex = candidate
            play(track: queue[currentIndex])
            return
        }
        if currentIndex + 1 < queue.count {
            currentIndex += 1
            play(track: queue[currentIndex])
        } else if repeatMode == .all {
            currentIndex = 0
            play(track: queue[0])
        } else {
            pause()
            seek(to: 0)
        }
    }

    func previous() {
        if currentTime > 3 {
            seek(to: 0)
            return
        }
        guard !queue.isEmpty else { return }
        if currentIndex > 0 {
            currentIndex -= 1
            play(track: queue[currentIndex])
        } else if repeatMode == .all {
            currentIndex = queue.count - 1
            play(track: queue[currentIndex])
        } else {
            seek(to: 0)
        }
    }

    func cycleRepeatMode() {
        let nextRaw = (repeatMode.rawValue + 1) % RepeatMode.allCases.count
        repeatMode = RepeatMode(rawValue: nextRaw) ?? .off
    }

    func beginScrubbing() {
        isUserScrubbing = true
    }

    func endScrubbing(at seconds: Double) {
        isUserScrubbing = false
        seek(to: seconds)
    }

    func seek(to seconds: Double) {
        let clamped = max(0, duration > 0 ? min(seconds, duration) : seconds)
        currentTime = clamped
        let target = CMTime(seconds: clamped, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.updateNowPlayingElapsed()
            }
        }
    }

    private func handleTrackEnded() {
        if repeatMode == .one {
            seek(to: 0)
            player.play()
        } else {
            next()
        }
    }

    // MARK: - Lock Screen / Control Center Now Playing

    private func publishNowPlayingInfo(for track: TrackRecord) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: track.title,
            MPMediaItemPropertyArtist: track.artist,
            MPMediaItemPropertyAlbumTitle: track.era.isEmpty ? "VaultStream" : track.era,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
        ]
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info

        artworkTask?.cancel()
        guard let artURL = APIClient.shared.artworkURL(track.eraImage) else { return }
        let trackId = track.id
        artworkTask = Task { [weak self] in
            guard let (data, _) = try? await URLSession.shared.data(from: artURL),
                  let image = UIImage(data: data),
                  !Task.isCancelled else { return }
            await MainActor.run {
                guard let self, self.currentTrack?.id == trackId else { return }
                var updated = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                updated[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                MPNowPlayingInfoCenter.default().nowPlayingInfo = updated
            }
        }
    }

    private func updateNowPlayingElapsed() {
        guard var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
        info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
        info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
        if duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }
}
