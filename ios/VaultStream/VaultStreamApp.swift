import SwiftUI

@main
struct VaultStreamApp: App {
    @StateObject private var player = AudioPlayerManager.shared
    @StateObject private var library = LibraryStore.shared
    @StateObject private var offline = OfflineStore.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(player)
                .environmentObject(library)
                .environmentObject(offline)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}
