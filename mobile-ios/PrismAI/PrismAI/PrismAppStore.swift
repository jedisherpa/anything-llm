import Foundation
import UIKit

@MainActor
final class PrismAppStore: ObservableObject {
    enum Phase {
        case welcome
        case pendingApproval
        case ready
    }

    @Published var phase: Phase = .welcome
    @Published var onboardingMode: PrismOnboardingMode = .provider
    @Published var pairingURLInput = ""
    @Published var deviceName = UIDevice.current.name
    @Published var infoMessage =
        "Connect Prism to a cloud provider, hosted API, or optional MetaCanon desktop artifact."
    @Published var errorMessage: String?
    @Published var isWorking = false
    @Published var isSending = false
    @Published var workspaces: [PrismWorkspace] = []
    @Published var selectedWorkspaceSlug: String?
    @Published var selectedMode: PrismChatMode = .chat
    @Published var deviceSummary: PrismDeviceSummary?
    @Published var libraryManifest: PrismLibraryManifest?
    @Published var libraryCollections: [PrismLibraryTab: [PrismLibraryItem]] = [:]
    @Published var selectedAlignments: [PrismAlignmentChip] = []
    @Published var messages: [PrismChatMessage] = []
    @Published var workspaceDocumentsBySlug: [String: [PrismWorkspaceDocument]] = [:]
    @Published var pendingAttachments: [PrismPendingAttachment] = []
    @Published var composerText = ""
    @Published var showingCreateWorkspace = false
    @Published var draftWorkspaceName = ""
    @Published var isLoadingWorkspaceDocuments = false
    @Published var isUploadingWorkspaceDocuments = false
    @Published var isImportingChatAttachments = false
    @Published var providerDraft = PrismProviderConfiguration.default
    @Published var activeConnectionKind: PrismConnectionKind?
    @Published var isDemoMode = false

    private let client = PrismAPIClient()
    private let directClient = PrismDirectProviderClient()
    private let libraryStore = PrismLibraryStore()
    private let storage = PrismSessionStorage()
    private var session: PrismSession?
    private var providerConfiguration: PrismProviderConfiguration?
    private var approvalTask: Task<Void, Never>?
    private var transcriptCache: [String: [PrismChatMessage]] = [:]

    init() {
        bootstrapBundledLibrary()

        if let savedProvider = storage.loadProviderConfiguration() {
            providerDraft = savedProvider
        }

        let preferredConnection = storage.loadActiveConnectionKind()
        switch preferredConnection {
        case .desktop:
            if let storedSession = storage.loadSession() {
                activateStoredDesktopSession(storedSession)
            } else if let storedProvider = storage.loadProviderConfiguration() {
                activateStoredProvider(storedProvider)
            }
        case .provider:
            if let storedProvider = storage.loadProviderConfiguration() {
                activateStoredProvider(storedProvider)
            } else if let storedSession = storage.loadSession() {
                activateStoredDesktopSession(storedSession)
            }
        case .none:
            if let storedProvider = storage.loadProviderConfiguration() {
                activateStoredProvider(storedProvider)
            } else if let storedSession = storage.loadSession() {
                activateStoredDesktopSession(storedSession)
            }
        }
    }

    deinit {
        approvalTask?.cancel()
    }

    private static let defaultInfoMessage =
        "Connect Prism to a cloud provider, hosted API, or optional MetaCanon desktop artifact."

    var selectedWorkspace: PrismWorkspace? {
        workspaces.first(where: { $0.slug == selectedWorkspaceSlug })
    }

    var workspaceDocuments: [PrismWorkspaceDocument] {
        guard let slug = selectedWorkspaceSlug else { return [] }
        return workspaceDocumentsBySlug[slug] ?? []
    }

    var isProviderMode: Bool {
        activeConnectionKind == .provider
    }

    var isDesktopMode: Bool {
        activeConnectionKind == .desktop
    }

    var canUseWorkspaces: Bool {
        isDesktopMode
    }

    var canUseContext: Bool {
        isDesktopMode
    }

    var canSendMessage: Bool {
        if isProviderMode {
            return isDemoMode || providerConfiguration != nil
        }
        return selectedWorkspace != nil
    }

    var sessionBaseURLString: String {
        session?.baseURLString ?? "Not connected"
    }

    var activeProviderSummary: String {
        if isDemoMode {
            return "Demo Prism • UI Test Mode"
        }
        return (providerConfiguration ?? providerDraft).connectionSummary
    }

    func restoreSessionIfNeeded() async {
        if isProviderMode {
            phase = .ready
            return
        }

        guard let session else { return }
        await authenticateAndBootstrap(using: session)
    }

    func applyProviderPreset(_ preset: PrismProviderPreset) {
        providerDraft = providerDraft.applyingPreset(preset)
    }

    func connectProvider() async {
        let configuration = providerDraft.sanitized()

        guard !configuration.trimmedBaseURLString.isEmpty else {
            errorMessage = "Enter the base URL for your cloud or hosted API."
            return
        }

        guard configuration.chatCompletionsURL != nil else {
            errorMessage = "Enter a valid API base URL."
            return
        }

        guard !configuration.trimmedModel.isEmpty else {
            errorMessage = "Enter the model id you want Prism to use."
            return
        }

        if configuration.requiresAPIKey && configuration.trimmedAPIKey.isEmpty {
            errorMessage = "Enter the API key for your provider."
            return
        }

        stopApprovalPolling()
        isDemoMode = false
        providerDraft = configuration
        providerConfiguration = configuration
        activeConnectionKind = .provider
        onboardingMode = .provider
        selectedMode = .chat
        phase = .ready
        messages = []
        pendingAttachments = []
        errorMessage = nil
        infoMessage = "Prism is ready with \(configuration.connectionSummary)."

        storage.saveProviderConfiguration(configuration)
        storage.saveActiveConnectionKind(.provider)
    }

    func activateDemoMode() {
        stopApprovalPolling()
        isDemoMode = true
        providerConfiguration = nil
        activeConnectionKind = .provider
        onboardingMode = .provider
        selectedMode = .chat
        phase = .ready
        messages = []
        pendingAttachments = []
        errorMessage = nil
        infoMessage = "Prism is ready in demo mode for UI and lens testing."
        storage.clearActiveConnectionKind()
    }

    func usePasteboardPairingURL() {
        if let pasted = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines), !pasted.isEmpty {
            pairingURLInput = pasted
        }
    }

    func startPairing() async {
        let trimmedName = deviceName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            errorMessage = "Name this iPhone before pairing."
            return
        }

        isWorking = true
        errorMessage = nil
        infoMessage = "Registering this iPhone with MetaCanon desktop..."

        do {
            let pairedSession = try await client.register(
                pairingURLString: pairingURLInput,
                deviceName: trimmedName
            )

            session = pairedSession
            activeConnectionKind = .desktop
            onboardingMode = .desktop
            phase = .pendingApproval
            deviceName = trimmedName
            messages = []
            pendingAttachments = []
            infoMessage = "Waiting for approval in MetaCanon desktop."

            storage.saveSession(pairedSession)
            storage.saveActiveConnectionKind(.desktop)

            await authenticateAndBootstrap(using: pairedSession)
        } catch {
            errorMessage = error.localizedDescription
            phase = .welcome
        }

        isWorking = false
    }

    func authenticateAndBootstrap(using session: PrismSession? = nil) async {
        guard let session = session ?? self.session else { return }

        do {
            try await client.authenticate(session: session)
            let bootstrap = try await client.bootstrap(session: session)
            applyBootstrap(bootstrap)
            activeConnectionKind = .desktop
            onboardingMode = .desktop
            phase = .ready
            infoMessage = "MetaCanon desktop is connected."
            errorMessage = nil
            stopApprovalPolling()
            storage.saveSession(session)
            storage.saveActiveConnectionKind(.desktop)
        } catch {
            activeConnectionKind = .desktop
            phase = .pendingApproval
            errorMessage = error.localizedDescription

            if error.localizedDescription.localizedCaseInsensitiveContains("not approved") {
                infoMessage = "Approve this iPhone in MetaCanon desktop under Mobile Connections."
            } else {
                infoMessage = "Trying to reach your MetaCanon desktop server."
            }

            beginApprovalPolling()
        }
    }

    func beginApprovalPolling() {
        approvalTask?.cancel()
        approvalTask = Task { [weak self] in
            while let self, !Task.isCancelled, self.phase == .pendingApproval, self.activeConnectionKind == .desktop {
                await self.authenticateAndBootstrap()
                try? await Task.sleep(for: .seconds(4))
            }
        }
    }

    func stopApprovalPolling() {
        approvalTask?.cancel()
        approvalTask = nil
    }

    func ensureCollectionLoaded(_ tab: PrismLibraryTab) async {
        guard libraryCollections[tab] == nil else { return }

        do {
            libraryCollections[tab] = try libraryStore.collection(for: tab)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func createWorkspace() async {
        let name = draftWorkspaceName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, let session, isDesktopMode else { return }

        isWorking = true
        errorMessage = nil
        do {
            let workspace = try await client.createWorkspace(session: session, name: name)
            workspaces.append(workspace)
            workspaces.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            draftWorkspaceName = ""
            showingCreateWorkspace = false
            selectWorkspace(workspace.slug)
        } catch {
            errorMessage = error.localizedDescription
        }
        isWorking = false
    }

    func selectWorkspace(_ slug: String) {
        guard isDesktopMode else { return }

        cacheCurrentTranscript()
        selectedWorkspaceSlug = slug
        storage.saveSelectedWorkspaceSlug(slug)
        messages = transcriptCache[slug] ?? []
        selectedMode = selectedWorkspace?.chatMode.flatMap(PrismChatMode.init(rawValue:)) ?? .chat
        pendingAttachments = []
        Task {
            await loadWorkspaceHistory(for: slug)
            await loadWorkspaceDocuments(for: slug)
        }
    }

    func clearAlignments() {
        selectedAlignments.removeAll()
    }

    func removeAlignment(_ chip: PrismAlignmentChip) {
        selectedAlignments.removeAll(where: { $0.handle == chip.handle })
    }

    func toggleLens(_ item: PrismLibraryItem) {
        guard let chip = item.alignmentMembers.first else { return }
        if selectedAlignments.contains(where: { $0.handle == chip.handle }) {
            removeAlignment(chip)
        } else {
            selectedAlignments.append(chip)
        }
    }

    func addAlignmentBundle(_ item: PrismLibraryItem) {
        for chip in item.alignmentMembers where !selectedAlignments.contains(where: { $0.handle == chip.handle }) {
            selectedAlignments.append(chip)
        }
    }

    func itemIsSelected(_ item: PrismLibraryItem) -> Bool {
        let handles = item.resolvedHandles
        guard !handles.isEmpty else { return false }
        return handles.allSatisfy { handle in
            selectedAlignments.contains(where: { $0.handle == handle })
        }
    }

    func loadWorkspaceDocuments(for workspaceSlug: String? = nil) async {
        guard let session, isDesktopMode else { return }
        let slug = workspaceSlug ?? selectedWorkspaceSlug
        guard let slug else { return }

        isLoadingWorkspaceDocuments = true
        defer { isLoadingWorkspaceDocuments = false }

        do {
            let documents = try await client.fetchWorkspaceDocuments(
                session: session,
                workspaceSlug: slug
            )
            workspaceDocumentsBySlug[slug] = documents
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadWorkspaceHistory(for workspaceSlug: String? = nil) async {
        guard let session, isDesktopMode else { return }
        let slug = workspaceSlug ?? selectedWorkspaceSlug
        guard let slug else { return }

        do {
            let payload = try await client.fetchWorkspaceContent(
                session: session,
                workspaceSlug: slug
            )
            let history = hydrateMessages(from: payload.chats)
            transcriptCache[slug] = history
            if selectedWorkspaceSlug == slug {
                messages = history
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func uploadWorkspaceDocuments(from urls: [URL]) async {
        guard let session, let workspace = selectedWorkspace, isDesktopMode else {
            errorMessage = "Choose a workspace before uploading context files."
            return
        }
        guard !urls.isEmpty else { return }

        isUploadingWorkspaceDocuments = true
        errorMessage = nil
        defer { isUploadingWorkspaceDocuments = false }

        do {
            for url in urls {
                try await withSecurityScopedAccess(to: url) {
                    _ = try await client.uploadWorkspaceDocument(
                        session: session,
                        workspaceSlug: workspace.slug,
                        fileURL: url
                    )
                }
            }
            await loadWorkspaceDocuments(for: workspace.slug)
            infoMessage = "Workspace context updated for \(workspace.name)."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setDocumentPinned(_ document: PrismWorkspaceDocument, pinned: Bool) async {
        guard let session, let workspace = selectedWorkspace, isDesktopMode else { return }

        do {
            let updated = try await client.updateWorkspaceDocumentPin(
                session: session,
                workspaceSlug: workspace.slug,
                documentID: document.id,
                pinned: pinned
            )
            replaceWorkspaceDocument(updated, in: workspace.slug)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removeWorkspaceDocument(_ document: PrismWorkspaceDocument) async {
        guard let session, let workspace = selectedWorkspace, isDesktopMode else { return }

        do {
            try await client.removeWorkspaceDocument(
                session: session,
                workspaceSlug: workspace.slug,
                documentID: document.id
            )
            workspaceDocumentsBySlug[workspace.slug]?.removeAll(where: { $0.id == document.id })
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func importChatAttachments(from urls: [URL]) async {
        guard isDesktopMode else { return }
        guard !urls.isEmpty else { return }

        isImportingChatAttachments = true
        errorMessage = nil
        defer { isImportingChatAttachments = false }

        do {
            let attachments = try await urls.asyncMap { url in
                try await withSecurityScopedAccess(to: url) {
                    let data = try Data(contentsOf: url)
                    return PrismPendingAttachment(
                        name: url.lastPathComponent,
                        mime: "application/anythingllm-document",
                        contentString: data.base64EncodedString(),
                        byteCount: data.count
                    )
                }
            }

            var merged = pendingAttachments
            for attachment in attachments where !merged.contains(where: { existing in
                existing.name == attachment.name && existing.byteCount == attachment.byteCount
            }) {
                merged.append(attachment)
            }
            pendingAttachments = merged
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func removePendingAttachment(_ attachment: PrismPendingAttachment) {
        pendingAttachments.removeAll(where: { $0.id == attachment.id })
    }

    func clearPendingAttachments() {
        pendingAttachments.removeAll()
    }

    func sendMessage() async {
        let input = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty else { return }

        errorMessage = nil

        if isProviderMode {
            await sendProviderMessage(input)
        } else {
            await sendDesktopMessage(input)
        }
    }

    func disconnectCurrentConnection() async {
        switch activeConnectionKind {
        case .desktop:
            if let session {
                await client.unregister(session: session)
            }
            clearDesktopSession()
        case .provider:
            isDemoMode = false
            providerConfiguration = nil
            storage.clearProviderConfiguration()
            if storage.loadActiveConnectionKind() == .provider {
                storage.clearActiveConnectionKind()
            }
            activeConnectionKind = nil
            phase = .welcome
            messages = []
            pendingAttachments = []
            errorMessage = nil
            infoMessage = Self.defaultInfoMessage
        case .none:
            break
        }
    }

    func forgetPairingLocally() {
        clearDesktopSession()
    }

    private func sendProviderMessage(_ input: String) async {
        let conversationHistory = messages.filter { !$0.isError && $0.role != .system }
        let assistantID = UUID().uuidString

        composerText = ""
        isSending = true
        messages.append(PrismChatMessage(role: .user, text: input))
        messages.append(PrismChatMessage(id: assistantID, role: .assistant, text: "", isStreaming: true))

        if isDemoMode {
            let response = mockDemoResponse(for: input)
            for chunk in response.chunkedForStreaming() {
                try? await Task.sleep(for: .milliseconds(90))
                updateAssistantMessage(
                    assistantID: assistantID,
                    text: chunk,
                    replace: false,
                    isStreaming: true,
                    isError: false
                )
            }

            updateAssistantMessage(
                assistantID: assistantID,
                text: "",
                replace: false,
                isStreaming: false,
                isError: false
            )
            isSending = false
            return
        }

        guard let providerConfiguration else {
            updateAssistantMessage(
                assistantID: assistantID,
                text: "Connect a provider before chatting.",
                replace: true,
                isStreaming: false,
                isError: true
            )
            errorMessage = "Connect a provider before chatting."
            isSending = false
            return
        }

        do {
            let lensDetails = try libraryStore.lensDetails(for: selectedAlignments.map(\.handle))
            let systemPrompt = PrismPromptComposer.buildDirectSystemPrompt(
                selectedAlignments: selectedAlignments,
                lensDetails: lensDetails
            )

            for try await chunk in directClient.streamChat(
                configuration: providerConfiguration,
                systemPrompt: systemPrompt,
                transcript: conversationHistory,
                userText: input
            ) {
                updateAssistantMessage(
                    assistantID: assistantID,
                    text: chunk,
                    replace: false,
                    isStreaming: true,
                    isError: false
                )
            }

            updateAssistantMessage(
                assistantID: assistantID,
                text: "",
                replace: false,
                isStreaming: false,
                isError: false
            )
        } catch {
            updateAssistantMessage(
                assistantID: assistantID,
                text: error.localizedDescription,
                replace: true,
                isStreaming: false,
                isError: true
            )
            errorMessage = error.localizedDescription
        }

        isSending = false
    }

    private func sendDesktopMessage(_ input: String) async {
        guard let workspace = selectedWorkspace, let session else {
            errorMessage = "Choose a workspace before chatting."
            return
        }

        let renderedPrompt = PrismPromptComposer.buildServerPrompt(
            userText: input,
            selectedAlignments: selectedAlignments
        )
        let attachments = pendingAttachments

        composerText = ""
        pendingAttachments = []
        isSending = true

        let assistantID = UUID().uuidString
        mutateMessages {
            $0.append(PrismChatMessage(
                role: .user,
                text: input,
                attachmentNames: attachments.map(\.name)
            ))
            $0.append(PrismChatMessage(id: assistantID, role: .assistant, text: "", isStreaming: true))
        }

        do {
            for try await chunk in client.streamChat(
                session: session,
                workspaceSlug: workspace.slug,
                mode: selectedMode,
                message: renderedPrompt,
                attachments: attachments
            ) {
                applyStreamChunk(chunk, assistantID: assistantID)
            }
        } catch {
            pendingAttachments = attachments
            updateAssistantMessage(
                assistantID: assistantID,
                text: error.localizedDescription,
                replace: true,
                isStreaming: false,
                isError: true
            )
            errorMessage = error.localizedDescription
        }

        isSending = false
    }

    private func bootstrapBundledLibrary() {
        do {
            libraryManifest = try libraryStore.manifest()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func activateStoredProvider(_ configuration: PrismProviderConfiguration) {
        isDemoMode = false
        providerDraft = configuration
        providerConfiguration = configuration
        activeConnectionKind = .provider
        onboardingMode = .provider
        selectedMode = .chat
        phase = .ready
        infoMessage = "Prism is ready with \(configuration.connectionSummary)."
    }

    private func activateStoredDesktopSession(_ storedSession: PrismSession) {
        isDemoMode = false
        session = storedSession
        deviceName = storedSession.deviceName
        activeConnectionKind = .desktop
        onboardingMode = .desktop
        phase = .pendingApproval
        infoMessage = "Checking the saved MetaCanon desktop connection..."
    }

    private func applyBootstrap(_ bootstrap: PrismBootstrapResponse) {
        isDemoMode = false
        deviceSummary = bootstrap.device
        workspaces = bootstrap.workspaces.sorted {
            $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }

        let restoredWorkspaceSlug = storage.loadSelectedWorkspaceSlug()
        if
            let restoredWorkspaceSlug,
            workspaces.contains(where: { $0.slug == restoredWorkspaceSlug })
        {
            selectWorkspace(restoredWorkspaceSlug)
        } else if let firstWorkspace = workspaces.first {
            selectWorkspace(firstWorkspace.slug)
        } else {
            selectedWorkspaceSlug = nil
            messages = []
        }
    }

    private func applyStreamChunk(_ chunk: PrismStreamChunk, assistantID: String) {
        switch chunk.type {
        case "textResponseChunk":
            updateAssistantMessage(
                assistantID: assistantID,
                text: chunk.textResponse ?? "",
                replace: false,
                isStreaming: !(chunk.close ?? false),
                isError: false
            )
        case "textResponse":
            updateAssistantMessage(
                assistantID: assistantID,
                text: chunk.textResponse ?? "",
                replace: true,
                isStreaming: false,
                isError: false
            )
        case "abort":
            updateAssistantMessage(
                assistantID: assistantID,
                text: chunk.errorMessage ?? "The chat was stopped before Prism returned a response.",
                replace: true,
                isStreaming: false,
                isError: true
            )
        case "finalizeResponseStream":
            updateAssistantMessage(
                assistantID: assistantID,
                text: "",
                replace: false,
                isStreaming: false,
                isError: false
            )
        default:
            if let text = chunk.textResponse, !text.isEmpty {
                updateAssistantMessage(
                    assistantID: assistantID,
                    text: text,
                    replace: false,
                    isStreaming: !(chunk.close ?? false),
                    isError: false
                )
            }
        }
    }

    private func updateAssistantMessage(
        assistantID: String,
        text: String,
        replace: Bool,
        isStreaming: Bool,
        isError: Bool
    ) {
        mutateMessages { messages in
            guard let index = messages.firstIndex(where: { $0.id == assistantID }) else { return }
            if replace {
                messages[index].text = text
            } else {
                messages[index].text += text
            }
            messages[index].isStreaming = isStreaming
            messages[index].isError = isError
        }
    }

    private func mutateMessages(_ mutate: (inout [PrismChatMessage]) -> Void) {
        mutate(&messages)
        if let slug = selectedWorkspaceSlug {
            transcriptCache[slug] = messages
        }
    }

    private func cacheCurrentTranscript() {
        guard let slug = selectedWorkspaceSlug else { return }
        transcriptCache[slug] = messages
    }

    private func clearDesktopSession() {
        stopApprovalPolling()
        isDemoMode = false
        session = nil
        deviceSummary = nil
        workspaces = []
        selectedWorkspaceSlug = nil
        workspaceDocumentsBySlug = [:]
        pendingAttachments = []
        transcriptCache = [:]
        messages = []
        if storage.loadActiveConnectionKind() == .desktop {
            storage.clearActiveConnectionKind()
        }
        storage.clearSession()
        activeConnectionKind = nil
        phase = .welcome
        errorMessage = nil
        infoMessage = Self.defaultInfoMessage
        onboardingMode = .provider
        selectedMode = .chat
    }

    private func replaceWorkspaceDocument(_ document: PrismWorkspaceDocument, in slug: String) {
        var documents = workspaceDocumentsBySlug[slug] ?? []
        if let index = documents.firstIndex(where: { $0.id == document.id }) {
            documents[index] = document
        } else {
            documents.append(document)
        }
        documents.sort { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        workspaceDocumentsBySlug[slug] = documents
    }

    private func hydrateMessages(from chats: [PrismWorkspaceChatRecord]) -> [PrismChatMessage] {
        chats
            .filter { ($0.include ?? true) && (($0.threadID ?? 0) == 0) }
            .sorted { $0.id < $1.id }
            .flatMap { chat in
                let parsed = parseStoredResponse(chat.response)
                guard let assistantText = parsed.text, !assistantText.isEmpty else {
                    return [PrismChatMessage]()
                }
                let userMessage = PrismChatMessage(
                    id: "user-\(chat.id)",
                    role: .user,
                    text: chat.prompt,
                    attachmentNames: parsed.attachmentNames
                )
                let assistantMessage = PrismChatMessage(
                    id: "assistant-\(chat.id)",
                    role: .assistant,
                    text: assistantText
                )
                return [userMessage, assistantMessage]
            }
    }

    private func parseStoredResponse(_ rawValue: String) -> (text: String?, attachmentNames: [String]) {
        guard
            let data = rawValue.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return (nil, [])
        }

        let text = object["text"] as? String
        let attachmentNames = (object["attachments"] as? [[String: Any]] ?? [])
            .compactMap { $0["name"] as? String }
        return (text, attachmentNames)
    }

    private func mockDemoResponse(for input: String) -> String {
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let lensNames = selectedAlignments.map(\.title)

        if lensNames.isEmpty {
            return """
            Demo mode is active, so this response is local to the app.

            You just sent: "\(trimmedInput)"

            No lenses are attached right now. Open the alignment menu, add a few lenses, councils, or constellations, and send another message to see how the active lens rail and synthesis flow behave in the UI.
            """
        }

        let joinedLenses = lensNames.joined(separator: ", ")
        return """
        Demo mode is active, so this response is local to the app.

        Active lenses:
        \(joinedLenses)

        Your prompt:
        "\(trimmedInput)"

        This mock reply is standing in for the future provider call. It lets you test the menu flow, multi-lens selection, council/constellation adds, composer behavior, streaming bubbles, and settings without wiring any external APIs yet.
        """
    }

    private func withSecurityScopedAccess<T>(
        to url: URL,
        operation: () async throws -> T
    ) async throws -> T {
        let didStartAccess = url.startAccessingSecurityScopedResource()
        defer {
            if didStartAccess {
                url.stopAccessingSecurityScopedResource()
            }
        }
        return try await operation()
    }
}

private struct PrismSessionStorage {
    private let sessionKey = "prismai.mobile.session"
    private let workspaceKey = "prismai.mobile.workspace"
    private let providerKey = "prismai.mobile.provider"
    private let activeConnectionKey = "prismai.mobile.activeConnection"

    func loadSession() -> PrismSession? {
        guard let data = UserDefaults.standard.data(forKey: sessionKey) else { return nil }
        return try? JSONDecoder().decode(PrismSession.self, from: data)
    }

    func saveSession(_ session: PrismSession) {
        if let data = try? JSONEncoder().encode(session) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        }
    }

    func clearSession() {
        UserDefaults.standard.removeObject(forKey: sessionKey)
        UserDefaults.standard.removeObject(forKey: workspaceKey)
    }

    func saveProviderConfiguration(_ configuration: PrismProviderConfiguration) {
        if let data = try? JSONEncoder().encode(configuration) {
            UserDefaults.standard.set(data, forKey: providerKey)
        }
    }

    func loadProviderConfiguration() -> PrismProviderConfiguration? {
        guard let data = UserDefaults.standard.data(forKey: providerKey) else { return nil }
        return try? JSONDecoder().decode(PrismProviderConfiguration.self, from: data)
    }

    func clearProviderConfiguration() {
        UserDefaults.standard.removeObject(forKey: providerKey)
    }

    func saveActiveConnectionKind(_ kind: PrismConnectionKind) {
        UserDefaults.standard.set(kind.rawValue, forKey: activeConnectionKey)
    }

    func loadActiveConnectionKind() -> PrismConnectionKind? {
        guard let rawValue = UserDefaults.standard.string(forKey: activeConnectionKey) else { return nil }
        return PrismConnectionKind(rawValue: rawValue)
    }

    func clearActiveConnectionKind() {
        UserDefaults.standard.removeObject(forKey: activeConnectionKey)
    }

    func saveSelectedWorkspaceSlug(_ slug: String) {
        UserDefaults.standard.set(slug, forKey: workspaceKey)
    }

    func loadSelectedWorkspaceSlug() -> String? {
        UserDefaults.standard.string(forKey: workspaceKey)
    }
}

private extension Array {
    func asyncMap<T>(_ transform: (Element) async throws -> T) async throws -> [T] {
        var mapped: [T] = []
        mapped.reserveCapacity(count)

        for value in self {
            mapped.append(try await transform(value))
        }

        return mapped
    }
}

private extension String {
    func chunkedForStreaming(chunkSize: Int = 48) -> [String] {
        guard !isEmpty else { return [] }

        var chunks: [String] = []
        var current = ""

        for word in split(separator: " ", omittingEmptySubsequences: false) {
            let candidate = current.isEmpty ? String(word) : "\(current) \(word)"
            if candidate.count > chunkSize, !current.isEmpty {
                chunks.append(current + " ")
                current = String(word)
            } else {
                current = candidate
            }
        }

        if !current.isEmpty {
            chunks.append(current)
        }

        return chunks
    }
}
