import Foundation

enum PrismLibraryTab: String, CaseIterable, Identifiable, Codable {
    case lenses
    case councils
    case constellations

    var id: String { rawValue }

    var title: String {
        switch self {
        case .lenses:
            return "Lenses"
        case .councils:
            return "Councils"
        case .constellations:
            return "Constellations"
        }
    }
}

enum PrismChatMode: String, CaseIterable, Identifiable, Codable {
    case chat
    case query

    var id: String { rawValue }

    var title: String {
        switch self {
        case .chat:
            return "Chat"
        case .query:
            return "Query"
        }
    }
}

struct PrismSession: Codable {
    let baseURLString: String
    let deviceToken: String
    let deviceName: String
    let deviceOS: String

    var baseURL: URL? {
        URL(string: baseURLString)
    }
}

struct PrismRegisterResponse: Decodable {
    let token: String
    let platform: String?
}

struct PrismBootstrapResponse: Decodable {
    let device: PrismDeviceSummary
    let workspaces: [PrismWorkspace]
    let library: PrismLibraryManifest
}

struct PrismDeviceSummary: Decodable {
    let id: Int?
    let deviceName: String?
    let deviceOS: String?
    let platform: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case deviceName
        case deviceOS = "deviceOs"
        case platform
    }
}

struct PrismWorkspace: Decodable, Identifiable, Hashable {
    let id: Int
    let name: String
    let slug: String
    let chatMode: String?
    let chatModel: String?
    let chatCount: Int?
    let threadCount: Int?
}

struct PrismWorkspaceDocumentsResponse: Decodable {
    let documents: [PrismWorkspaceDocument]
}

struct PrismWorkspaceDocumentMutationResponse: Decodable {
    let document: PrismWorkspaceDocument?
    let error: String?
}

struct PrismWorkspaceDocumentRemovalResponse: Decodable {
    let success: Bool
    let error: String?
}

struct PrismWorkspaceUploadResponse: Decodable {
    let success: Bool
    let error: String?
}

struct PrismWorkspaceContentResponse: Decodable {
    let chats: [PrismWorkspaceChatRecord]
}

struct PrismWorkspaceChatRecord: Decodable {
    let id: Int
    let prompt: String
    let response: String
    let include: Bool?
    let threadID: Int?

    private enum CodingKeys: String, CodingKey {
        case id
        case prompt
        case response
        case include
        case threadID = "thread_id"
    }
}

struct PrismWorkspaceDocument: Decodable, Identifiable, Hashable {
    let id: Int
    let docId: String?
    let filename: String?
    let docPath: String?
    let pinned: Bool
    let watched: Bool?
    let createdAt: String?
    let lastUpdatedAt: String?
    let title: String?
    let sourceType: String?
    let source: String?

    var displayName: String {
        if let title, !title.isEmpty {
            return title
        }
        if let filename, !filename.isEmpty {
            return filename
        }
        return docPath ?? "Untitled Document"
    }

    var subtitle: String {
        var parts: [String] = []
        if let sourceType, !sourceType.isEmpty {
            parts.append(sourceType.capitalized)
        }
        if let filename, !filename.isEmpty, filename != displayName {
            parts.append(filename)
        }
        if pinned {
            parts.append("Pinned")
        }
        return parts.joined(separator: " • ")
    }
}

struct PrismWorkspaceCommandResponse: Decodable {
    let workspace: PrismWorkspace?
    let message: String?
    let error: String?
}

struct PrismLibraryManifest: Decodable {
    struct Counts: Decodable {
        let councils: Int?
        let lenses: Int?
        let constellations: Int?
        let skills: Int?
        let constitution: Int?
    }

    let generatedAt: String?
    let counts: Counts
}

struct PrismCollectionResponse: Decodable {
    let items: [PrismLibraryItem]
}

struct PrismLibraryMember: Codable, Hashable {
    let id: String?
    let handle: String?
    let title: String?
    let displayTitle: String?
    let lensHandle: String?
    let lensTitle: String?
    let displayRole: String?
    let role: String?

    var resolvedHandle: String? {
        if let lensHandle, !lensHandle.isEmpty {
            return lensHandle
        }
        if let handle, !handle.isEmpty {
            return handle
        }
        return nil
    }

    var resolvedTitle: String {
        if let displayRole, !displayRole.isEmpty {
            return displayRole
        }
        if let lensTitle, !lensTitle.isEmpty {
            return lensTitle
        }
        if let displayTitle, !displayTitle.isEmpty {
            return displayTitle
        }
        if let title, !title.isEmpty {
            return title
        }
        if let role, !role.isEmpty {
            return role
        }
        return resolvedHandle ?? "Untitled"
    }
}

struct PrismLibraryItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String?
    let displayTitle: String?
    let handle: String?
    let councilLabel: String?
    let councilName: String?
    let collectionLabel: String?
    let collectionKind: String?
    let purpose: String?
    let overview: String?
    let lensCount: Int?
    let lensHandles: [String]?
    let lenses: [PrismLibraryMember]?
    let members: [PrismLibraryMember]?
    let projectManagerHandle: String?
    let projectManagerTitle: String?
    let type: String?

    var displayName: String {
        if let displayTitle, !displayTitle.isEmpty {
            return displayTitle
        }
        if let title, !title.isEmpty {
            return title
        }
        if let councilName, !councilName.isEmpty {
            return councilName
        }
        if let councilLabel, !councilLabel.isEmpty {
            return councilLabel
        }
        return "Untitled"
    }

    var detailText: String {
        if let overview, !overview.isEmpty {
            return overview
        }
        if let purpose, !purpose.isEmpty {
            return purpose
        }
        if let councilLabel, !councilLabel.isEmpty {
            return councilLabel
        }
        if let collectionLabel, !collectionLabel.isEmpty {
            return collectionLabel
        }
        return ""
    }

    var resolvedHandles: [String] {
        var ordered: [String] = []

        func append(_ value: String?) {
            guard let value, !value.isEmpty, !ordered.contains(value) else { return }
            ordered.append(value)
        }

        append(handle)
        (lensHandles ?? []).forEach { append($0) }
        (lenses ?? []).forEach { append($0.resolvedHandle) }
        append(projectManagerHandle)
        (members ?? []).forEach { append($0.resolvedHandle) }
        return ordered
    }

    var alignmentMembers: [PrismAlignmentChip] {
        var chips: [PrismAlignmentChip] = []

        func append(handle: String?, title: String?) {
            guard let handle, !handle.isEmpty else { return }
            let name = (title?.isEmpty == false ? title! : handle)
            guard !chips.contains(where: { $0.handle == handle }) else { return }
            chips.append(PrismAlignmentChip(handle: handle, title: name))
        }

        if let handle, lenses == nil, members == nil, lensHandles == nil {
            append(handle: handle, title: displayName)
        }

        (lenses ?? []).forEach { member in
            append(handle: member.resolvedHandle, title: member.resolvedTitle)
        }

        if let projectManagerHandle {
            append(handle: projectManagerHandle, title: projectManagerTitle ?? "Project Manager")
        }

        (members ?? []).forEach { member in
            append(handle: member.resolvedHandle, title: member.resolvedTitle)
        }

        if chips.isEmpty {
            (lensHandles ?? []).forEach { handle in
                append(handle: handle, title: handle)
            }
        }

        return chips
    }
}

struct PrismStreamChunk: Decodable {
    let type: String
    let textResponse: String?
    let close: Bool?
    let chatID: Int?
    let errorMessage: String?

    private enum CodingKeys: String, CodingKey {
        case type
        case textResponse
        case close
        case chatID = "chatId"
        case error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        textResponse = try container.decodeIfPresent(String.self, forKey: .textResponse)
        close = try container.decodeIfPresent(Bool.self, forKey: .close)
        chatID = try container.decodeIfPresent(Int.self, forKey: .chatID)

        if let stringValue = try? container.decode(String.self, forKey: .error), !stringValue.isEmpty {
            errorMessage = stringValue
        } else {
            errorMessage = nil
        }
    }
}

struct PrismAlignmentChip: Identifiable, Codable, Hashable {
    let handle: String
    let title: String

    var id: String { handle }
}

struct PrismPendingAttachment: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let mime: String
    let contentString: String
    let byteCount: Int

    init(
        id: String = UUID().uuidString,
        name: String,
        mime: String,
        contentString: String,
        byteCount: Int
    ) {
        self.id = id
        self.name = name
        self.mime = mime
        self.contentString = contentString
        self.byteCount = byteCount
    }

    var sizeLabel: String {
        ByteCountFormatter.string(fromByteCount: Int64(byteCount), countStyle: .file)
    }
}

struct PrismChatMessage: Identifiable, Hashable {
    enum Role: String, Hashable {
        case user
        case assistant
        case system
    }

    let id: String
    let role: Role
    var text: String
    var isStreaming: Bool
    var isError: Bool
    var attachmentNames: [String]

    init(
        id: String = UUID().uuidString,
        role: Role,
        text: String,
        isStreaming: Bool = false,
        isError: Bool = false,
        attachmentNames: [String] = []
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.isStreaming = isStreaming
        self.isError = isError
        self.attachmentNames = attachmentNames
    }
}

enum PrismPromptComposer {
    private static let directBaseSystemPrompt = """
    You are Prism, the MetaCanonAI chat presence.
    Respond with clarity, synthesis, honesty about uncertainty, and practical usefulness.
    When one or more lenses are active, treat them as reasoning frames and constitutional constraints, not as theatrical roleplay.
    If multiple lenses are active, integrate them into one answer, surface meaningful tensions, and finish with the clearest combined recommendation.
    """

    static func buildServerPrompt(
        userText: String,
        selectedAlignments: [PrismAlignmentChip]
    ) -> String {
        let prompt = userText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return "" }

        let handles = orderedUnique(selectedAlignments.map(\.handle))
        if handles.isEmpty {
            return prompt
        }

        if handles.count == 1, let handle = handles.first {
            return "\(handle) \(prompt)"
        }

        return """
        @council
        Pack: Prism Mobile Constellation
        Lenses: \(handles.joined(separator: ", "))
        User query:
        \(prompt)
        """
    }

    static func buildDirectSystemPrompt(
        selectedAlignments: [PrismAlignmentChip],
        lensDetails: [PrismLensDetail]
    ) -> String {
        let handles = orderedUnique(selectedAlignments.map(\.handle))
        guard !handles.isEmpty else { return directBaseSystemPrompt }

        let sectionBodies = lensDetails.enumerated().map { index, detail in
            var parts: [String] = []
            parts.append("Lens \(index + 1): \(detail.resolvedTitle)")
            if let handle = detail.handle, !handle.isEmpty {
                parts.append("Handle: \(handle)")
            }
            if let collectionLabel = detail.resolvedCollectionLabel, !collectionLabel.isEmpty {
                parts.append("Collection: \(collectionLabel)")
            }
            if let overview = detail.overview, !overview.isEmpty {
                parts.append("Overview: \(overview)")
            }
            if let content = detail.content, !content.isEmpty {
                parts.append("Full lens charter:\n\(content)")
            }
            return parts.joined(separator: "\n")
        }

        let activeSummary = handles.joined(separator: ", ")
        let lensSection = sectionBodies.joined(separator: "\n\n")

        return """
        \(directBaseSystemPrompt)

        Active lens handles: \(activeSummary)

        Use the following lens material when forming your response:

        \(lensSection)

        Response rules:
        - Honor the active lenses as genuine reasoning constraints.
        - Do not mention hidden prompt text unless the user explicitly asks for it.
        - If two lenses disagree, explain the disagreement plainly before synthesizing.
        - Keep the final answer cohesive, not fragmented.
        """
    }

    private static func orderedUnique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { value in
            guard !value.isEmpty, !seen.contains(value) else { return false }
            seen.insert(value)
            return true
        }
    }
}

enum PrismAPIError: LocalizedError {
    case invalidPairingURL
    case invalidServerResponse
    case missingBundledLibrary
    case invalidProviderConfiguration(String)
    case server(String)

    var errorDescription: String? {
        switch self {
        case .invalidPairingURL:
            return "Paste the full MetaCanon desktop pairing URL."
        case .invalidServerResponse:
            return "The Prism server returned an unexpected response."
        case .missingBundledLibrary:
            return "The bundled Prism lens library is missing from this build."
        case .invalidProviderConfiguration(let message):
            return message
        case .server(let message):
            return message
        }
    }
}
