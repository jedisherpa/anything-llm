import SwiftUI

@main
struct PrismAIApp: App {
    @StateObject private var store = PrismAppStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
