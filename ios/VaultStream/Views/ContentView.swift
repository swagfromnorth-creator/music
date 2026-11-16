import SwiftUI

enum AppTab: Hashable {
    case home
    case search
    case artists
    case library
    case settings
}

struct ContentView: View {
    @EnvironmentObject private var player: AudioPlayerManager
    @EnvironmentObject private var library: LibraryStore
    @AppStorage(APIClient.serverURLKey) private var serverBaseURL = ""

    @State private var selectedTab: AppTab = .home
    @State private var showOnboarding = false

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                Group {
                    HomeView(selectedTab: $selectedTab)
                        .safeAreaInset(edge: .bottom) { miniPlayerInset }
                        .tabItem { Label("Home", systemImage: "house.fill") }
                        .tag(AppTab.home)

                    SearchView()
                        .safeAreaInset(edge: .bottom) { miniPlayerInset }
                        .tabItem { Label("Search", systemImage: "magnifyingglass") }
                        .tag(AppTab.search)

                    ArtistsView()
                        .safeAreaInset(edge: .bottom) { miniPlayerInset }
                        .tabItem { Label("Artists", systemImage: "music.mic") }
                        .tag(AppTab.artists)

                    LibraryView()
                        .safeAreaInset(edge: .bottom) { miniPlayerInset }
                        .tabItem { Label("Library", systemImage: "square.stack.fill") }
                        .tag(AppTab.library)

                    SettingsView()
                        .safeAreaInset(edge: .bottom) { miniPlayerInset }
                        .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                        .tag(AppTab.settings)
                }
                .toolbarBackground(Theme.surface, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
            }

            if let toast = library.toastMessage {
                Text(toast)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Theme.surfaceElevated.opacity(0.96))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Theme.accent.opacity(0.5), lineWidth: 1))
                    .shadow(color: .black.opacity(0.4), radius: 10, y: 4)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .animation(.spring(response: 0.35), value: toast)
            }
        }
        .sheet(isPresented: $player.showNowPlayingSheet) {
            NowPlayingSheet()
        }
        .sheet(item: $player.activeAddToPlaylistTrack) { track in
            AddToPlaylistSheet(track: track)
        }
        .sheet(item: $player.activeInspectTrack) { track in
            TrackInspectorSheet(track: track)
        }
        .sheet(isPresented: $showOnboarding) {
            ServerSetupSheet()
        }
        .task {
            if serverBaseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                showOnboarding = true
            } else {
                await library.refreshAll()
            }
        }
    }

    @ViewBuilder
    private var miniPlayerInset: some View {
        if player.currentTrack != nil {
            MiniPlayerBar()
        }
    }
}
