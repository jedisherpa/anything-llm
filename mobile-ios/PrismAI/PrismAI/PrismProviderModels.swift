import Foundation

enum PrismOnboardingMode: String, CaseIterable, Identifiable, Codable {
    case provider
    case desktop

    var id: String { rawValue }

    var title: String {
        switch self {
        case .provider:
            return "Cloud / API"
        case .desktop:
            return "Desktop Pairing"
        }
    }
}

enum PrismConnectionKind: String, Codable {
    case provider
    case desktop
}

enum PrismProviderPreset: String, CaseIterable, Identifiable, Codable {
    case openAICompatible
    case openRouter
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .openAICompatible:
            return "OpenAI-Compatible"
        case .openRouter:
            return "OpenRouter"
        case .custom:
            return "Custom / Local"
        }
    }

    var suggestedBaseURL: String {
        switch self {
        case .openAICompatible:
            return "https://api.openai.com/v1"
        case .openRouter:
            return "https://openrouter.ai/api/v1"
        case .custom:
            return ""
        }
    }

    var suggestedModelPlaceholder: String {
        switch self {
        case .openAICompatible:
            return "Enter your model id"
        case .openRouter:
            return "openai/your-model"
        case .custom:
            return "your-model"
        }
    }
}

struct PrismProviderConfiguration: Codable, Equatable {
    var preset: PrismProviderPreset
    var baseURLString: String
    var model: String
    var apiKey: String

    static var `default`: PrismProviderConfiguration {
        PrismProviderConfiguration(
            preset: .openAICompatible,
            baseURLString: PrismProviderPreset.openAICompatible.suggestedBaseURL,
            model: "",
            apiKey: ""
        )
    }

    var trimmedBaseURLString: String {
        baseURLString.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var trimmedModel: String {
        model.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var trimmedAPIKey: String {
        apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var requiresAPIKey: Bool {
        preset != .custom
    }

    var connectionLabel: String {
        switch preset {
        case .openAICompatible:
            return "OpenAI-Compatible"
        case .openRouter:
            return "OpenRouter"
        case .custom:
            if let host = URL(string: trimmedBaseURLString)?.host, !host.isEmpty {
                return host
            }
            return "Custom / Local API"
        }
    }

    var connectionSummary: String {
        let modelSummary = trimmedModel
        guard !modelSummary.isEmpty else { return connectionLabel }
        return "\(connectionLabel) • \(modelSummary)"
    }

    var chatCompletionsURL: URL? {
        let rawValue = trimmedBaseURLString
        guard !rawValue.isEmpty else { return nil }

        let normalized: String
        if rawValue.contains("://") {
            normalized = rawValue
        } else {
            normalized = "https://\(rawValue)"
        }

        guard let baseURL = URL(string: normalized) else { return nil }
        let path = baseURL.path.lowercased()

        if path.hasSuffix("/chat/completions") {
            return baseURL
        }

        if path.hasSuffix("/v1") || path.hasSuffix("/api/v1") {
            return baseURL
                .appendingPathComponent("chat")
                .appendingPathComponent("completions")
        }

        if path.isEmpty || path == "/" {
            return baseURL
                .appendingPathComponent("v1")
                .appendingPathComponent("chat")
                .appendingPathComponent("completions")
        }

        return baseURL
            .appendingPathComponent("chat")
            .appendingPathComponent("completions")
    }

    func applyingPreset(_ nextPreset: PrismProviderPreset) -> PrismProviderConfiguration {
        var next = self
        next.preset = nextPreset
        if next.trimmedBaseURLString.isEmpty || next.trimmedBaseURLString == preset.suggestedBaseURL {
            next.baseURLString = nextPreset.suggestedBaseURL
        }
        if nextPreset == .custom && next.trimmedAPIKey.isEmpty {
            next.apiKey = ""
        }
        return next
    }

    func sanitized() -> PrismProviderConfiguration {
        PrismProviderConfiguration(
            preset: preset,
            baseURLString: trimmedBaseURLString,
            model: trimmedModel,
            apiKey: trimmedAPIKey
        )
    }
}

struct PrismBundledLibraryIndex: Decodable {
    let generatedAt: String?
    let counts: PrismLibraryManifest.Counts
    let aliases: PrismBundledLibraryAliases?
    let lookup: PrismBundledLibraryLookup?
}

struct PrismBundledLibraryAliases: Decodable {
    let lenses: PrismBundledAliasGroup?
    let constellations: PrismBundledAliasGroup?
    let councils: PrismBundledIdAliasGroup?
}

struct PrismBundledAliasGroup: Decodable {
    let byId: [String: String]?
    let byHandle: [String: String]?
}

struct PrismBundledIdAliasGroup: Decodable {
    let byId: [String: String]?
}

struct PrismBundledLibraryLookup: Decodable {
    let lenses: [PrismBundledLensEntry]?
}

struct PrismBundledLensEntry: Decodable {
    let id: String
    let handle: String?
    let title: String?
    let displayTitle: String?
    let detailPath: String?
}

struct PrismLensDetail: Decodable, Hashable {
    let id: String
    let title: String?
    let displayTitle: String?
    let handle: String?
    let content: String?
    let overview: String?
    let collectionLabel: String?
    let collectionKind: String?
    let board: String?
    let councilName: String?

    var resolvedTitle: String {
        if let displayTitle, !displayTitle.isEmpty {
            return displayTitle
        }
        if let title, !title.isEmpty {
            return title
        }
        return handle ?? "Untitled Lens"
    }

    var resolvedCollectionLabel: String? {
        if let collectionLabel, !collectionLabel.isEmpty {
            return collectionLabel
        }
        if let councilName, !councilName.isEmpty {
            return councilName
        }
        if let board, !board.isEmpty {
            return board
        }
        return nil
    }
}
