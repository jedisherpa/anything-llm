import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @EnvironmentObject private var store: PrismAppStore

    var body: some View {
        Group {
            switch store.phase {
            case .welcome:
                WelcomeView()
            case .pendingApproval:
                ApprovalPendingView()
            case .ready:
                PrismChatShellView()
            }
        }
        .task {
            await store.restoreSessionIfNeeded()
        }
        .task(id: store.phase) {
            if store.phase == .pendingApproval {
                store.beginApprovalPolling()
            } else {
                store.stopApprovalPolling()
            }
        }
    }
}

private struct WelcomeView: View {
    @EnvironmentObject private var store: PrismAppStore

    private var providerPresetBinding: Binding<PrismProviderPreset> {
        Binding(
            get: { store.providerDraft.preset },
            set: { store.applyProviderPreset($0) }
        )
    }

    var body: some View {
        ZStack {
            PrismBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    HStack {
                        Spacer()

                        Button("Skip To Demo") {
                            store.activateDemoMode()
                        }
                        .buttonStyle(SecondaryPillButtonStyle())
                    }

                    VStack(alignment: .center, spacing: 18) {
                        PrismGlyphBadge(
                            state: .idle,
                            size: 92,
                            showsHalo: true
                        )

                        VStack(spacing: 10) {
                            PrismEyebrow("Threshold")
                            Text("How can I")
                                .font(.system(size: 42, weight: .medium, design: .serif))
                                .foregroundStyle(.white)
                            Text("help")
                                .font(.system(size: 46, weight: .semibold, design: .serif))
                                .italic()
                                .foregroundStyle(PrismPalette.helpGradient)
                            Text("you today?")
                                .font(.system(size: 42, weight: .medium, design: .serif))
                                .foregroundStyle(.white)
                            Text("Structure & Soul")
                                .font(.system(size: 14, weight: .semibold, design: .serif))
                                .italic()
                                .tracking(4)
                                .textCase(.uppercase)
                                .foregroundStyle(PrismPalette.tagline)
                        }
                        .multilineTextAlignment(.center)

                        Text("Cloud-first Prism chat with lenses, councils, and optional desktop pairing.")
                            .font(.body)
                            .foregroundStyle(PrismPalette.mist)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 420)
                    }
                    .frame(maxWidth: .infinity)

                    PrismOnboardingToggle(selection: $store.onboardingMode)

                    if store.onboardingMode == .provider {
                        VStack(alignment: .leading, spacing: 20) {
                            FieldLabel("LLM Provider")
                            Menu {
                                ForEach(PrismProviderPreset.allCases) { preset in
                                    Button(preset.title) {
                                        store.applyProviderPreset(preset)
                                    }
                                }
                            } label: {
                                HStack {
                                    Text(store.providerDraft.preset.title)
                                        .foregroundStyle(.white)
                                    Spacer()
                                    Image(systemName: "chevron.down")
                                        .foregroundStyle(PrismPalette.gold)
                                }
                                .padding(16)
                            }
                            .prismFieldShell()

                            FieldLabel("API Base URL")
                            TextField("https://api.openai.com/v1", text: $store.providerDraft.baseURLString, axis: .vertical)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .padding(16)
                                .prismFieldShell()

                            FieldLabel("Model")
                            TextField(store.providerDraft.preset.suggestedModelPlaceholder, text: $store.providerDraft.model)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(16)
                                .prismFieldShell()

                            FieldLabel("API Key")
                            SecureField(store.providerDraft.preset == .custom ? "Optional for local APIs" : "Required", text: $store.providerDraft.apiKey)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding(16)
                                .prismFieldShell()

                            Text("Use OpenAI-compatible cloud endpoints, OpenRouter, or a local hosted API running on your own machine.")
                                .font(.footnote)
                                .foregroundStyle(PrismPalette.mist)

                            Button("Use Demo Prism First") {
                                store.activateDemoMode()
                            }
                            .buttonStyle(SecondaryPillButtonStyle())

                            Button {
                                Task {
                                    await store.connectProvider()
                                }
                            } label: {
                                Text("Start Chatting")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PrimaryPillButtonStyle())
                        }
                        .prismGlassCard(radius: 30)
                    } else {
                        VStack(alignment: .leading, spacing: 20) {
                            FieldLabel("Pairing URL")
                            TextField("http://192.168.1.20:3001/api/mobile?t=...", text: $store.pairingURLInput, axis: .vertical)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .padding(16)
                                .prismFieldShell()

                            Button("Paste From Clipboard") {
                                store.usePasteboardPairingURL()
                            }
                            .buttonStyle(SecondaryPillButtonStyle())

                            FieldLabel("Device Name")
                            TextField("Paul's iPhone", text: $store.deviceName)
                                .padding(16)
                                .prismFieldShell()

                            Button {
                                Task {
                                    await store.startPairing()
                                }
                            } label: {
                                HStack {
                                    if store.isWorking {
                                        ProgressView()
                                            .tint(.black)
                                    } else {
                                        Text("Connect MetaCanon Desktop")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PrimaryPillButtonStyle())
                            .disabled(store.isWorking)
                        }
                        .prismGlassCard(radius: 30)
                    }

                    if let errorMessage = store.errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(PrismPalette.alert)
                    } else {
                        Text(store.infoMessage)
                            .font(.footnote)
                            .foregroundStyle(PrismPalette.mist)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("What works in this build")
                            .font(.system(size: 22, weight: .semibold, design: .serif))
                            .foregroundStyle(.white)
                        if store.onboardingMode == .provider {
                            FeatureBullet("Connect Prism to a cloud or hosted LLM endpoint")
                            FeatureBullet("Use any single lens or stack multiple lenses into one synthesis")
                            FeatureBullet("Browse councils and constellations, then add their lenses in one tap")
                            FeatureBullet("Keep MetaCanon desktop pairing as an optional secondary path")
                        } else {
                            FeatureBullet("Pair to a local MetaCanon instance")
                            FeatureBullet("Open chat and query workspaces")
                            FeatureBullet("Upload workspace context and attach one-off chat files")
                            FeatureBullet("Use the same Prism lens and council picker as cloud mode")
                        }
                    }
                    .prismGlassCard(radius: 28)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 28)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button {
                        store.activateDemoMode()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "sparkles")
                            Text("Open Demo And Test The UI")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(PrimaryPillButtonStyle())

                    Text("You can wire up providers and desktop pairing later. This jumps straight into the chat shell.")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(PrismPalette.mist)
                }
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 10)
                .background(
                    LinearGradient(
                        colors: [
                            PrismPalette.night.opacity(0),
                            PrismPalette.night.opacity(0.76),
                            PrismPalette.night.opacity(0.96)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
        }
    }
}

private struct ApprovalPendingView: View {
    @EnvironmentObject private var store: PrismAppStore

    var body: some View {
        ZStack {
            PrismBackground()

            VStack(spacing: 24) {
                PrismGlyphBadge(state: .thinking, size: 96, showsHalo: true)
                    .overlay {
                        ProgressView()
                            .scaleEffect(1.3)
                            .tint(PrismPalette.gold)
                    }

                PrismEyebrow("Waiting For Approval")

                Text("Connecting To Desktop")
                    .font(.system(size: 34, weight: .semibold, design: .serif))
                    .foregroundStyle(.white)

                Text(store.infoMessage)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(PrismPalette.mist)

                if let errorMessage = store.errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(PrismPalette.alert)
                }

                VStack(spacing: 12) {
                    Button("Check Again") {
                        Task {
                            await store.authenticateAndBootstrap()
                        }
                    }
                    .buttonStyle(PrimaryPillButtonStyle())

                    Button("Forget Desktop Pairing") {
                        store.forgetPairingLocally()
                    }
                    .buttonStyle(SecondaryPillButtonStyle())
                }
            }
            .padding(32)
            .prismGlassCard(radius: 32)
            .padding(24)
        }
    }
}

private struct PrismChatShellView: View {
    @EnvironmentObject private var store: PrismAppStore
    @State private var showingAlignmentSheet = false
    @State private var showingContextSheet = false
    @State private var showingSettings = false
    @State private var showingFileImporter = false
    @State private var importTarget: PrismImportTarget?

    var body: some View {
        ZStack {
            PrismBackground()

            VStack(spacing: 16) {
                header

                modeBar

                if !store.selectedAlignments.isEmpty {
                    alignmentRail
                }

                if store.canUseContext {
                    contextSummary
                }

                chatCard

                composer
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 16)
        }
        .sheet(isPresented: $showingAlignmentSheet) {
            AlignmentSheetView()
                .environmentObject(store)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showingContextSheet) {
            ContextSheetView(
                onAddWorkspaceFiles: {
                    importTarget = .workspace
                    showingFileImporter = true
                },
                onAttachChatFiles: {
                    importTarget = .chat
                    showingFileImporter = true
                }
            )
            .environmentObject(store)
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showingSettings) {
            SettingsSheet()
                .environmentObject(store)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $store.showingCreateWorkspace) {
            CreateWorkspaceSheet()
                .environmentObject(store)
                .presentationDetents([.medium])
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [.data],
            allowsMultipleSelection: true
        ) { result in
            let target = importTarget
            importTarget = nil

            Task {
                switch result {
                case .success(let urls):
                    guard let target else { return }
                    switch target {
                    case .workspace:
                        await store.uploadWorkspaceDocuments(from: urls)
                    case .chat:
                        await store.importChatAttachments(from: urls)
                    }
                case .failure(let error):
                    store.errorMessage = error.localizedDescription
                }
            }
        }
    }

    @ViewBuilder
    private var header: some View {
        if store.isProviderMode {
            HStack(spacing: 12) {
                HStack(spacing: 14) {
                    PrismGlyphBadge(state: glyphState, size: 46)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Prism Chat")
                            .font(.system(size: 20, weight: .semibold, design: .serif))
                            .foregroundStyle(.white)
                        Text(store.activeProviderSummary)
                            .font(.caption)
                            .foregroundStyle(PrismPalette.mist)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .prismGlassCard(radius: 24, padding: 0)

                Button {
                    showingAlignmentSheet = true
                } label: {
                    Image(systemName: "sparkles.rectangle.stack")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.black)
                        .frame(width: 56, height: 56)
                        .background(PrismPalette.gold, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: PrismPalette.gold.opacity(0.22), radius: 18, y: 12)
                }

                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .prismGlassCard(radius: 18, padding: 0)
                }
            }
        } else {
            HStack(spacing: 12) {
                Menu {
                    ForEach(store.workspaces) { workspace in
                        Button(workspace.name) {
                            store.selectWorkspace(workspace.slug)
                        }
                    }

                    Divider()

                    Button("Create Workspace") {
                        store.showingCreateWorkspace = true
                    }
                } label: {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(store.selectedWorkspace?.name ?? "Choose Workspace")
                                .font(.headline)
                                .foregroundStyle(.white)
                            Text("\(store.workspaces.count) workspaces ready")
                                .font(.caption)
                                .foregroundStyle(PrismPalette.mist)
                        }

                        Spacer()

                        Image(systemName: "chevron.down")
                            .foregroundStyle(PrismPalette.gold)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .leading) {
                        HStack(spacing: 12) {
                            PrismGlyphBadge(state: glyphState, size: 36)
                                .padding(.leading, 16)
                            Spacer()
                        }
                    }
                    .padding(.leading, 38)
                    .prismGlassCard(radius: 24, padding: 0)
                }

                Button {
                    showingAlignmentSheet = true
                } label: {
                    Image(systemName: "sparkles.rectangle.stack")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.black)
                        .frame(width: 56, height: 56)
                        .background(PrismPalette.gold, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .shadow(color: PrismPalette.gold.opacity(0.22), radius: 18, y: 12)
                }

                Button {
                    showingContextSheet = true
                } label: {
                    Image(systemName: "tray.and.arrow.down.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .prismGlassCard(radius: 18, padding: 0)
                }

                Button {
                    showingSettings = true
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(width: 56, height: 56)
                        .prismGlassCard(radius: 18, padding: 0)
                }
            }
        }
    }

    @ViewBuilder
    private var modeBar: some View {
        if store.isProviderMode {
            HStack(spacing: 14) {
                Text("Direct Chat")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(PrismPalette.gold)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .prismCapsuleShell(fill: PrismPalette.panel.opacity(0.96))

                Spacer(minLength: 0)

                Button {
                    showingAlignmentSheet = true
                } label: {
                    Text(store.selectedAlignments.isEmpty ? "Align Prism" : "\(store.selectedAlignments.count) Active")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(PrismPalette.gold)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .prismCapsuleShell(fill: PrismPalette.panel.opacity(0.96))
                }
            }
        } else {
            HStack(spacing: 14) {
                PrismModeToggle(selection: $store.selectedMode)

                Button {
                    showingAlignmentSheet = true
                } label: {
                    Text(store.selectedAlignments.isEmpty ? "Align Prism" : "\(store.selectedAlignments.count) Active")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(PrismPalette.gold)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        .prismCapsuleShell(fill: PrismPalette.panel.opacity(0.96))
                }
            }
        }
    }

    private var glyphState: PrismGlyphState {
        if store.errorMessage != nil {
            return .error
        }
        if store.isSending {
            return .thinking
        }
        if !store.messages.isEmpty {
            return .response
        }
        return .idle
    }

    private var alignmentRail: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(store.selectedAlignments) { chip in
                    Button {
                        store.removeAlignment(chip)
                    } label: {
                        HStack(spacing: 8) {
                            Text(chip.title)
                                .lineLimit(1)
                            Image(systemName: "xmark.circle.fill")
                        }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .prismCapsuleShell(fill: PrismPalette.ember.opacity(0.9), stroke: PrismPalette.gold.opacity(0.22))
                    }
                }

                Button("Clear") {
                    store.clearAlignments()
                }
                .font(.footnote.weight(.bold))
                .foregroundStyle(PrismPalette.gold)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .prismCapsuleShell(fill: PrismPalette.panel.opacity(0.92))
            }
            .padding(.horizontal, 2)
        }
    }

    @ViewBuilder
    private var contextSummary: some View {
        if !store.workspaceDocuments.isEmpty || !store.pendingAttachments.isEmpty {
            HStack(spacing: 12) {
                Label("\(store.workspaceDocuments.count) workspace files", systemImage: "tray.full.fill")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)

                Spacer(minLength: 0)

                if !store.pendingAttachments.isEmpty {
                    Label("\(store.pendingAttachments.count) chat attachments", systemImage: "paperclip")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(PrismPalette.gold)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .prismGlassCard(radius: 20, padding: 0)
            .onTapGesture {
                showingContextSheet = true
            }
        }
    }

    private var chatCard: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    if store.messages.isEmpty {
                        EmptyChatState()
                            .environmentObject(store)
                    } else {
                        ForEach(store.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                }
                .padding(18)
            }
            .prismGlassCard(radius: 30, padding: 0)
            .onChange(of: store.messages.last?.id) { _, value in
                guard let value else { return }
                withAnimation(.easeOut(duration: 0.24)) {
                    proxy.scrollTo(value, anchor: .bottom)
                }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 12) {
            if let errorMessage = store.errorMessage, store.phase == .ready {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(PrismPalette.alert)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if store.canUseContext && !store.pendingAttachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(store.pendingAttachments) { attachment in
                            Button {
                                store.removePendingAttachment(attachment)
                            } label: {
                                HStack(spacing: 8) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(attachment.name)
                                            .lineLimit(1)
                                        Text(attachment.sizeLabel)
                                            .font(.caption2)
                                            .foregroundStyle(PrismPalette.mist)
                                    }
                                    Image(systemName: "xmark.circle.fill")
                                }
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .prismCapsuleShell(fill: PrismPalette.panel.opacity(0.92))
                            }
                        }
                    }
                    .padding(.horizontal, 2)
                }
            }

            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        PrismEyebrow(store.isProviderMode ? "Direct Prism" : "Scrying Glass")
                        Spacer(minLength: 0)
                        if !store.selectedAlignments.isEmpty {
                            Text("\(store.selectedAlignments.count) active")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(PrismPalette.gold)
                        }
                    }

                    TextField(
                        store.isProviderMode ? "Ask Prism anything with your current lenses..." : "Ask Prism anything...",
                        text: $store.composerText,
                        axis: .vertical
                    )
                    .lineLimit(1 ... 6)
                    .font(.system(size: 17, weight: .regular, design: .serif))
                    .textInputAutocapitalization(.sentences)
                    .foregroundStyle(.white)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .prismComposerShell()

                Button {
                    Task {
                        await store.sendMessage()
                    }
                } label: {
                    HStack {
                        if store.isSending {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.title3.weight(.bold))
                        }
                    }
                    .frame(width: 58, height: 58)
                    .background(PrismPalette.gold, in: Circle())
                    .foregroundStyle(.black)
                    .shadow(color: PrismPalette.gold.opacity(0.24), radius: 20, y: 14)
                }
                .disabled(store.isSending || !store.canSendMessage)
            }
        }
    }
}

private struct AlignmentSheetView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: PrismAppStore
    @State private var selectedTab: PrismLibraryTab = .lenses
    @State private var searchText = ""

    private var filteredItems: [PrismLibraryItem] {
        let items = store.libraryCollections[selectedTab] ?? []
        guard !searchText.isEmpty else { return items }

        return items.filter { item in
            let haystack = "\(item.displayName) \(item.detailText) \(item.resolvedHandles.joined(separator: " "))"
                .lowercased()
            return haystack.contains(searchText.lowercased())
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                PrismBackground()

                VStack(spacing: 16) {
                    PrismLibraryToggle(selection: $selectedTab)

                    TextField("Search alignments", text: $searchText)
                        .padding(14)
                        .prismFieldShell()

                    if !store.selectedAlignments.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(store.selectedAlignments) { chip in
                                    Text(chip.title)
                                        .font(.footnote.weight(.semibold))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .prismCapsuleShell(fill: PrismPalette.ember.opacity(0.9), stroke: PrismPalette.gold.opacity(0.22))
                                }
                            }
                        }
                    }

                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredItems) { item in
                                AlignmentRow(
                                    item: item,
                                    tab: selectedTab,
                                    isSelected: store.itemIsSelected(item)
                                )
                            }
                        }
                        .padding(.bottom, 24)
                    }
                }
                .padding(18)
            }
            .navigationTitle("Align Prism")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .task {
                await store.ensureCollectionLoaded(selectedTab)
            }
            .task(id: selectedTab) {
                await store.ensureCollectionLoaded(selectedTab)
            }
        }
    }
}

private struct AlignmentRow: View {
    @EnvironmentObject private var store: PrismAppStore

    let item: PrismLibraryItem
    let tab: PrismLibraryTab
    let isSelected: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(isSelected ? PrismPalette.gold : PrismPalette.teal.opacity(0.72))
                .frame(width: 4)
                .padding(.vertical, 2)

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.displayName)
                            .font(.system(size: 20, weight: .semibold, design: .serif))
                            .foregroundStyle(.white)
                        if !item.detailText.isEmpty {
                            Text(item.detailText)
                                .font(.subheadline)
                                .foregroundStyle(PrismPalette.mist)
                                .lineLimit(3)
                        }
                    }

                    Spacer(minLength: 0)

                    actionButton
                }

                HStack(spacing: 10) {
                    if let kind = item.collectionKind {
                        Text(kind.capitalized)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PrismPalette.gold)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .prismCapsuleShell(fill: PrismPalette.gold.opacity(0.12), stroke: PrismPalette.gold.opacity(0.18))
                    }

                    if tab != .lenses {
                        Text("\(item.resolvedHandles.count) lens handles")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(PrismPalette.mist)
                    }
                }
            }
        }
        .padding(18)
        .prismGlassCard(radius: 22, padding: 0, stroke: isSelected ? PrismPalette.gold.opacity(0.36) : PrismPalette.stroke)
    }

    @ViewBuilder
    private var actionButton: some View {
        switch tab {
        case .lenses:
            if isSelected {
                Button("Remove") {
                    store.toggleLens(item)
                }
                .buttonStyle(SecondaryPillButtonStyle())
            } else {
                Button("Add") {
                    store.toggleLens(item)
                }
                .buttonStyle(PrimaryPillButtonStyle())
            }
        case .councils, .constellations:
            if isSelected {
                Button("Added") {
                    store.addAlignmentBundle(item)
                }
                .buttonStyle(SecondaryPillButtonStyle())
                .disabled(item.resolvedHandles.isEmpty)
            } else {
                Button("Add All") {
                    store.addAlignmentBundle(item)
                }
                .buttonStyle(PrimaryPillButtonStyle())
                .disabled(item.resolvedHandles.isEmpty)
            }
        }
    }
}

private struct CreateWorkspaceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: PrismAppStore

    var body: some View {
        NavigationStack {
            ZStack {
                PrismBackground()

                VStack(alignment: .leading, spacing: 18) {
                    PrismEyebrow("New Workspace")
                    Text("Name the next chamber for Prism.")
                        .font(.system(size: 26, weight: .semibold, design: .serif))
                        .foregroundStyle(.white)

                    TextField("Prism Workspace", text: $store.draftWorkspaceName)
                        .padding(16)
                        .prismFieldShell()

                    VStack(spacing: 12) {
                        Button("Create Workspace") {
                            Task {
                                await store.createWorkspace()
                                if !store.showingCreateWorkspace {
                                    dismiss()
                                }
                            }
                        }
                        .buttonStyle(PrimaryPillButtonStyle())
                        .disabled(store.draftWorkspaceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isWorking)

                        Button("Close") {
                            dismiss()
                        }
                        .buttonStyle(SecondaryPillButtonStyle())
                    }
                }
                .padding(24)
                .prismGlassCard(radius: 28)
                .padding(20)
            }
            .navigationTitle("New Workspace")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct ContextSheetView: View {
    @EnvironmentObject private var store: PrismAppStore

    let onAddWorkspaceFiles: () -> Void
    let onAttachChatFiles: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                PrismBackground()

                ScrollView {
                    VStack(spacing: 18) {
                        VStack(alignment: .leading, spacing: 14) {
                            PrismEyebrow("Query Context")

                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Workspace Context")
                                        .font(.system(size: 24, weight: .semibold, design: .serif))
                                        .foregroundStyle(.white)
                                    Text("These files become searchable context when Query mode is active.")
                                        .font(.subheadline)
                                        .foregroundStyle(PrismPalette.mist)
                                }

                                Spacer(minLength: 0)

                                Button("Add Files", action: onAddWorkspaceFiles)
                                    .buttonStyle(PrimaryPillButtonStyle())
                                    .disabled(store.selectedWorkspace == nil || store.isUploadingWorkspaceDocuments)
                            }

                            if store.isLoadingWorkspaceDocuments || store.isUploadingWorkspaceDocuments {
                                HStack(spacing: 10) {
                                    ProgressView()
                                        .tint(PrismPalette.gold)
                                    Text(store.isUploadingWorkspaceDocuments ? "Uploading workspace files..." : "Loading workspace files...")
                                        .foregroundStyle(PrismPalette.mist)
                                }
                            }

                            if store.workspaceDocuments.isEmpty {
                                Text("No workspace files yet.")
                                    .font(.footnote)
                                    .foregroundStyle(PrismPalette.mist)
                            } else {
                                LazyVStack(spacing: 12) {
                                    ForEach(store.workspaceDocuments) { document in
                                        WorkspaceDocumentRow(document: document)
                                    }
                                }
                            }
                        }
                        .prismGlassCard(radius: 28)

                        VStack(alignment: .leading, spacing: 14) {
                            PrismEyebrow("One Message Only")

                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Next Message Attachments")
                                        .font(.system(size: 24, weight: .semibold, design: .serif))
                                        .foregroundStyle(.white)
                                    Text("These files are attached to just one send, not the whole workspace.")
                                        .font(.subheadline)
                                        .foregroundStyle(PrismPalette.mist)
                                }

                                Spacer(minLength: 0)

                                Button("Attach Files", action: onAttachChatFiles)
                                    .buttonStyle(PrimaryPillButtonStyle())
                                    .disabled(store.selectedWorkspace == nil || store.isImportingChatAttachments)
                            }

                            if store.isImportingChatAttachments {
                                HStack(spacing: 10) {
                                    ProgressView()
                                        .tint(PrismPalette.gold)
                                    Text("Preparing chat attachments...")
                                        .foregroundStyle(PrismPalette.mist)
                                }
                            }

                            if store.pendingAttachments.isEmpty {
                                Text("No files queued for the next message.")
                                    .font(.footnote)
                                    .foregroundStyle(PrismPalette.mist)
                            } else {
                                LazyVStack(spacing: 12) {
                                    ForEach(store.pendingAttachments) { attachment in
                                        PendingAttachmentRow(attachment: attachment)
                                    }
                                }

                                Button("Clear All") {
                                    store.clearPendingAttachments()
                                }
                                .buttonStyle(SecondaryPillButtonStyle())
                            }
                        }
                        .prismGlassCard(radius: 28)
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Context")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct WorkspaceDocumentRow: View {
    @EnvironmentObject private var store: PrismAppStore

    let document: PrismWorkspaceDocument

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(document.displayName)
                .font(.system(size: 20, weight: .semibold, design: .serif))
                .foregroundStyle(.white)

            if !document.subtitle.isEmpty {
                Text(document.subtitle)
                    .font(.footnote)
                    .foregroundStyle(PrismPalette.mist)
            }

            HStack(spacing: 10) {
                Button(document.pinned ? "Unpin" : "Pin") {
                    Task {
                        await store.setDocumentPinned(document, pinned: !document.pinned)
                    }
                }
                .buttonStyle(SecondaryPillButtonStyle())

                Button("Remove", role: .destructive) {
                    Task {
                        await store.removeWorkspaceDocument(document)
                    }
                }
                .buttonStyle(SecondaryPillButtonStyle())
            }
        }
        .padding(16)
        .prismGlassCard(radius: 20, padding: 0, stroke: document.pinned ? PrismPalette.gold.opacity(0.42) : PrismPalette.stroke)
    }
}

private struct PendingAttachmentRow: View {
    @EnvironmentObject private var store: PrismAppStore

    let attachment: PrismPendingAttachment

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(attachment.name)
                    .font(.system(size: 19, weight: .semibold, design: .serif))
                    .foregroundStyle(.white)
                Text(attachment.sizeLabel)
                    .font(.footnote)
                    .foregroundStyle(PrismPalette.mist)
            }

            Spacer(minLength: 0)

            Button("Remove") {
                store.removePendingAttachment(attachment)
            }
            .buttonStyle(SecondaryPillButtonStyle())
        }
        .padding(16)
        .prismGlassCard(radius: 20, padding: 0)
    }
}

private struct SettingsSheet: View {
    @EnvironmentObject private var store: PrismAppStore
    @Environment(\.dismiss) private var dismiss

    private var providerPresetBinding: Binding<PrismProviderPreset> {
        Binding(
            get: { store.providerDraft.preset },
            set: { store.applyProviderPreset($0) }
        )
    }

    var body: some View {
        NavigationStack {
            ZStack {
                PrismBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if store.isProviderMode {
                            VStack(alignment: .leading, spacing: 16) {
                                PrismEyebrow("LLM Provider")
                                if store.isDemoMode {
                                    Text("Demo mode is active. You can test the chat shell, lens menus, council and constellation adds, and streaming bubbles without any external API connection.")
                                        .font(.footnote)
                                        .foregroundStyle(PrismPalette.mist)
                                }

                                Menu {
                                    ForEach(PrismProviderPreset.allCases) { preset in
                                        Button(preset.title) {
                                            store.applyProviderPreset(preset)
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Text(store.providerDraft.preset.title)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .foregroundStyle(PrismPalette.gold)
                                    }
                                    .foregroundStyle(.white)
                                    .padding(16)
                                }
                                .prismFieldShell()

                                TextField("Base URL", text: $store.providerDraft.baseURLString)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(16)
                                    .prismFieldShell()

                                TextField("Model", text: $store.providerDraft.model)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(16)
                                    .prismFieldShell()

                                SecureField("API Key", text: $store.providerDraft.apiKey)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(16)
                                    .prismFieldShell()
                            }
                            .prismGlassCard(radius: 28)

                            statsCard

                            VStack(spacing: 12) {
                                Button("Reconnect With These Settings") {
                                    Task {
                                        await store.connectProvider()
                                        dismiss()
                                    }
                                }
                                .buttonStyle(PrimaryPillButtonStyle())

                                Button("Disconnect Provider", role: .destructive) {
                                    Task {
                                        await store.disconnectCurrentConnection()
                                        dismiss()
                                    }
                                }
                                .buttonStyle(SecondaryPillButtonStyle())
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 16) {
                                PrismEyebrow("Connection")
                                settingsMetricRow("Server", store.sessionBaseURLString)
                                settingsMetricRow("Device", store.deviceSummary?.deviceName ?? store.deviceName)
                                settingsMetricRow("Lenses", String(store.libraryManifest?.counts.lenses ?? 0))
                                settingsMetricRow("Councils", String(store.libraryManifest?.counts.councils ?? 0))
                                settingsMetricRow("Constellations", String(store.libraryManifest?.counts.constellations ?? 0))
                            }
                            .prismGlassCard(radius: 28)

                            Button("Disconnect Desktop", role: .destructive) {
                                Task {
                                    await store.disconnectCurrentConnection()
                                    dismiss()
                                }
                            }
                            .buttonStyle(SecondaryPillButtonStyle())
                        }
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var statsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            PrismEyebrow("Library")
            settingsMetricRow("Lenses", String(store.libraryManifest?.counts.lenses ?? 0))
            settingsMetricRow("Councils", String(store.libraryManifest?.counts.councils ?? 0))
            settingsMetricRow("Constellations", String(store.libraryManifest?.counts.constellations ?? 0))
        }
        .prismGlassCard(radius: 28)
    }

    @ViewBuilder
    private func settingsMetricRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(PrismPalette.mist)
            Spacer()
            Text(value)
                .foregroundStyle(.white)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

private struct MessageBubble: View {
    let message: PrismChatMessage

    var body: some View {
        HStack {
            if message.role == .assistant {
                bubble(alignment: .leading)
                Spacer(minLength: 44)
            } else {
                Spacer(minLength: 44)
                bubble(alignment: .trailing)
            }
        }
    }

    private func bubble(alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 8) {
            HStack(spacing: 8) {
                if message.role == .assistant {
                    PrismGlyphBadge(
                        state: message.isError ? .error : (message.isStreaming ? .thinking : .response),
                        size: 22
                    )
                }
                Text(message.role == .assistant ? "Prism" : "You")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(message.role == .assistant ? PrismPalette.gold : PrismPalette.mist)
            }

            if !message.attachmentNames.isEmpty {
                VStack(alignment: alignment, spacing: 6) {
                    ForEach(message.attachmentNames, id: \.self) { name in
                        Label(name, systemImage: "paperclip")
                            .font(.caption)
                            .foregroundStyle(PrismPalette.gold)
                    }
                }
            }

            Text(message.text.isEmpty && message.isStreaming ? "..." : message.text)
                .font(.system(size: 17, weight: .regular, design: .serif))
                .foregroundStyle(.white)
                .multilineTextAlignment(message.role == .assistant ? .leading : .trailing)
        }
        .padding(16)
        .prismGlassCard(radius: 24, padding: 0, fill: backgroundColor, stroke: borderColor)
    }

    private var backgroundColor: Color {
        if message.isError {
            return PrismPalette.alert.opacity(0.18)
        }
        switch message.role {
        case .assistant:
            return PrismPalette.ink.opacity(0.9)
        case .user:
            return PrismPalette.ember.opacity(0.85)
        case .system:
            return PrismPalette.panel.opacity(0.92)
        }
    }

    private var borderColor: Color {
        if message.isError {
            return PrismPalette.alert
        }
        return message.role == .assistant ? PrismPalette.stroke : PrismPalette.gold.opacity(0.4)
    }
}

private struct EmptyChatState: View {
    @EnvironmentObject private var store: PrismAppStore

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            PrismGlyphBadge(state: .idle, size: 74, showsHalo: true)
            Text("Prism is ready.")
                .font(.system(size: 30, weight: .semibold, design: .serif))
                .foregroundStyle(.white)
            if store.isProviderMode {
                Text("Choose a single lens for a focused point of view, or stack multiple lenses so Prism synthesizes them through your connected LLM provider.")
                    .foregroundStyle(PrismPalette.mist)
                Text(store.isDemoMode ? "Demo mode is active, so chat replies are mocked locally while you test the interface." : "Desktop pairing is optional. Right now this build can already chat directly against your cloud or hosted API.")
                    .font(.footnote)
                    .foregroundStyle(PrismPalette.gold)
            } else {
                Text("Use a single Lens for a focused point of view, or stack multiple Lenses so Prism routes the same prompt through a council-style synthesis.")
                    .foregroundStyle(PrismPalette.mist)
                Text("Switch between Chat and Query above. Feed workspace files from Context for query-wide grounding, or attach files to just one message.")
                    .font(.footnote)
                    .foregroundStyle(PrismPalette.gold)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 12)
    }
}

private struct PrismBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    PrismPalette.night,
                    PrismPalette.ink,
                    PrismPalette.deepBlue
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [PrismPalette.gold.opacity(0.14), .clear],
                center: .top,
                startRadius: 10,
                endRadius: 420
            )
            .offset(y: -120)

            RadialGradient(
                colors: [PrismPalette.teal.opacity(0.09), .clear],
                center: .center,
                startRadius: 20,
                endRadius: 380
            )
            .offset(x: 140, y: -40)

            RadialGradient(
                colors: [PrismPalette.ember.opacity(0.1), .clear],
                center: .bottomLeading,
                startRadius: 10,
                endRadius: 280
            )

            PrismCathedralBackform()
                .opacity(0.34)
        }
        .ignoresSafeArea()
    }
}

private struct FieldLabel: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(PrismPalette.gold)
    }
}

private struct PrismEyebrow: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .tracking(2.8)
            .textCase(.uppercase)
            .foregroundStyle(PrismPalette.tagline)
    }
}

private enum PrismGlyphState {
    case idle
    case thinking
    case response
    case error

    var glowColor: Color {
        switch self {
        case .idle:
            return PrismPalette.gold
        case .thinking:
            return PrismPalette.teal
        case .response:
            return PrismPalette.gold
        case .error:
            return PrismPalette.alert
        }
    }
}

private struct PrismGlyphBadge: View {
    let state: PrismGlyphState
    var size: CGFloat = 64
    var showsHalo = false

    var body: some View {
        ZStack {
            Circle()
                .fill(state.glowColor.opacity(showsHalo ? 0.18 : 0.12))
                .frame(width: size * 1.35, height: size * 1.35)
                .blur(radius: showsHalo ? 24 : 14)

            Circle()
                .stroke(state.glowColor.opacity(0.22), lineWidth: 1)
                .frame(width: size * 1.18, height: size * 1.18)

            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(PrismPalette.panel.opacity(0.94))
                .frame(width: size, height: size)
                .overlay {
                    RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                        .stroke(PrismPalette.stroke, lineWidth: 1)
                }

            Image("PrismMark")
                .resizable()
                .scaledToFit()
                .frame(width: size * 0.55, height: size * 0.55)
                .shadow(color: state.glowColor.opacity(0.4), radius: 12)
        }
    }
}

private struct PrismOnboardingToggle: View {
    @Binding var selection: PrismOnboardingMode

    var body: some View {
        HStack(spacing: 8) {
            ForEach(PrismOnboardingMode.allCases) { mode in
                Button {
                    selection = mode
                } label: {
                    Text(mode.title)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .foregroundStyle(selection == mode ? .black : .white)
                        .background(
                            Capsule(style: .continuous)
                                .fill(selection == mode ? PrismPalette.gold : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .prismGlassCard(radius: 24, padding: 0)
    }
}

private struct PrismModeToggle: View {
    @Binding var selection: PrismChatMode

    var body: some View {
        HStack(spacing: 8) {
            ForEach(PrismChatMode.allCases) { mode in
                Button {
                    selection = mode
                } label: {
                    Text(mode.title)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundStyle(selection == mode ? .black : .white)
                        .background(
                            Capsule(style: .continuous)
                                .fill(selection == mode ? PrismPalette.gold : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .frame(maxWidth: .infinity)
        .prismGlassCard(radius: 22, padding: 0)
    }
}

private struct PrismLibraryToggle: View {
    @Binding var selection: PrismLibraryTab

    var body: some View {
        HStack(spacing: 8) {
            ForEach(PrismLibraryTab.allCases) { tab in
                Button {
                    selection = tab
                } label: {
                    Text(tab.title)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .foregroundStyle(selection == tab ? .black : .white)
                        .background(
                            Capsule(style: .continuous)
                                .fill(selection == tab ? PrismPalette.gold : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .prismGlassCard(radius: 22, padding: 0)
    }
}

private struct PrismCathedralBackform: View {
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Circle()
                    .stroke(PrismPalette.gold.opacity(0.16), lineWidth: 1)
                    .frame(width: min(geometry.size.width * 0.98, 620))

                RoundedRectangle(cornerRadius: 54, style: .continuous)
                    .stroke(PrismPalette.gold.opacity(0.18), lineWidth: 1)
                    .frame(width: min(geometry.size.width * 0.78, 500), height: min(geometry.size.width * 0.78, 500))
                    .rotationEffect(.degrees(45))

                RoundedRectangle(cornerRadius: 54, style: .continuous)
                    .stroke(PrismPalette.teal.opacity(0.12), lineWidth: 1)
                    .frame(width: min(geometry.size.width * 0.66, 420), height: min(geometry.size.width * 0.66, 420))
                    .rotationEffect(.degrees(45))

                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(PrismPalette.gold.opacity(0.1), lineWidth: 1)
                    .frame(width: min(geometry.size.width * 0.38, 260), height: min(geometry.size.width * 0.58, 360))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .allowsHitTesting(false)
    }
}

private struct FeatureBullet: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "sparkle")
                .foregroundStyle(PrismPalette.gold)
            Text(text)
                .foregroundStyle(PrismPalette.mist)
        }
        .font(.subheadline)
    }
}

private struct PrimaryPillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .background(PrismPalette.gold.opacity(configuration.isPressed ? 0.82 : 1), in: Capsule())
            .foregroundStyle(.black)
            .shadow(color: PrismPalette.gold.opacity(0.2), radius: 18, y: 12)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

private struct SecondaryPillButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .prismCapsuleShell(fill: PrismPalette.panel.opacity(configuration.isPressed ? 0.76 : 0.92))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

private enum PrismPalette {
    static let night = Color(red: 0.03, green: 0.04, blue: 0.09)
    static let ink = Color(red: 0.07, green: 0.09, blue: 0.15)
    static let deepBlue = Color(red: 0.09, green: 0.13, blue: 0.23)
    static let panel = Color(red: 0.12, green: 0.15, blue: 0.21)
    static let gold = Color(red: 0.86, green: 0.68, blue: 0.30)
    static let ember = Color(red: 0.49, green: 0.24, blue: 0.18)
    static let teal = Color(red: 0.16, green: 0.56, blue: 0.62)
    static let mist = Color(red: 0.78, green: 0.81, blue: 0.89)
    static let tagline = Color(red: 0.79, green: 0.71, blue: 0.50)
    static let alert = Color(red: 1.0, green: 0.49, blue: 0.45)
    static let stroke = Color.white.opacity(0.11)
    static let helpGradient = LinearGradient(
        colors: [gold, Color.white.opacity(0.92), teal.opacity(0.88)],
        startPoint: .leading,
        endPoint: .trailing
    )
}

private enum PrismImportTarget {
    case workspace
    case chat
}

private extension View {
    func prismGlassCard(
        radius: CGFloat = 28,
        padding: CGFloat = 22,
        fill: Color = PrismPalette.panel,
        stroke: Color = PrismPalette.stroke
    ) -> some View {
        modifier(
            PrismGlassCardModifier(
                radius: radius,
                padding: padding,
                fill: fill,
                stroke: stroke
            )
        )
    }

    func prismFieldShell() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(PrismPalette.panel.opacity(0.86))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(PrismPalette.stroke, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.12), radius: 14, y: 10)
    }

    func prismCapsuleShell(fill: Color, stroke: Color = PrismPalette.stroke) -> some View {
        self
            .background(fill, in: Capsule(style: .continuous))
            .overlay {
                Capsule(style: .continuous)
                    .stroke(stroke, lineWidth: 1)
            }
    }

    func prismComposerShell() -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                PrismPalette.panel.opacity(0.96),
                                PrismPalette.ink.opacity(0.92)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(PrismPalette.stroke, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.24), radius: 28, y: 20)
    }
}

private struct PrismGlassCardModifier: ViewModifier {
    let radius: CGFloat
    let padding: CGFloat
    let fill: Color
    let stroke: Color

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                fill.opacity(0.94),
                                PrismPalette.ink.opacity(0.92)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(stroke, lineWidth: 1)
            }
            .overlay(alignment: .top) {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                PrismPalette.gold.opacity(0.08),
                                .clear
                            ],
                            startPoint: .top,
                            endPoint: .center
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            }
            .shadow(color: .black.opacity(0.24), radius: 28, y: 20)
    }
}
