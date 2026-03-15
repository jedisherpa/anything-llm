import Foundation

final class PrismDirectProviderClient {
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let urlSession: URLSession

    init(urlSession: URLSession = .shared) {
        self.urlSession = urlSession
    }

    func streamChat(
        configuration: PrismProviderConfiguration,
        systemPrompt: String,
        transcript: [PrismChatMessage],
        userText: String
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    try await self.performStreamChat(
                        configuration: configuration,
                        systemPrompt: systemPrompt,
                        transcript: transcript,
                        userText: userText,
                        continuation: continuation
                    )
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func performStreamChat(
        configuration: PrismProviderConfiguration,
        systemPrompt: String,
        transcript: [PrismChatMessage],
        userText: String,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        let config = configuration.sanitized()
        guard let endpoint = config.chatCompletionsURL else {
            throw PrismAPIError.invalidProviderConfiguration("Enter a valid API base URL.")
        }
        guard !config.trimmedModel.isEmpty else {
            throw PrismAPIError.invalidProviderConfiguration("Enter the model id for your provider.")
        }
        if config.requiresAPIKey && config.trimmedAPIKey.isEmpty {
            throw PrismAPIError.invalidProviderConfiguration("Enter the API key for your provider.")
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 300
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        if !config.trimmedAPIKey.isEmpty {
            request.setValue("Bearer \(config.trimmedAPIKey)", forHTTPHeaderField: "Authorization")
        }

        request.httpBody = try encoder.encode(
            PrismDirectChatCompletionRequest(
                model: config.trimmedModel,
                stream: true,
                messages: payloadMessages(
                    systemPrompt: systemPrompt,
                    transcript: transcript,
                    userText: userText
                )
            )
        )

        let (bytes, response) = try await urlSession.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PrismAPIError.invalidServerResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            var data = Data()
            for try await byte in bytes {
                data.append(byte)
            }
            throw parsedProviderError(from: data)
        }

        for try await rawLine in bytes.lines {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty, line.hasPrefix("data:") else { continue }

            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespacesAndNewlines)
            if payload == "[DONE]" {
                break
            }

            guard let data = payload.data(using: .utf8) else { continue }
            let response = try decoder.decode(PrismDirectChatCompletionStreamResponse.self, from: data)

            if let chunk = response.choices.first?.delta.content, !chunk.isEmpty {
                continuation.yield(chunk)
            }

            if response.choices.first?.finishReason != nil {
                break
            }
        }

        continuation.finish()
    }

    private func payloadMessages(
        systemPrompt: String,
        transcript: [PrismChatMessage],
        userText: String
    ) -> [PrismDirectChatPayloadMessage] {
        var messages: [PrismDirectChatPayloadMessage] = []

        let trimmedSystemPrompt = systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedSystemPrompt.isEmpty {
            messages.append(.init(role: "system", content: trimmedSystemPrompt))
        }

        for message in transcript {
            guard !message.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            switch message.role {
            case .user:
                messages.append(.init(role: "user", content: message.text))
            case .assistant:
                messages.append(.init(role: "assistant", content: message.text))
            case .system:
                continue
            }
        }

        messages.append(.init(role: "user", content: userText))
        return messages
    }

    private func parsedProviderError(from data: Data) -> PrismAPIError {
        if
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let errorObject = object["error"] as? [String: Any],
            let message = errorObject["message"] as? String,
            !message.isEmpty
        {
            return .server(message)
        }

        if
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let message = (object["error"] as? String) ?? (object["message"] as? String),
            !message.isEmpty
        {
            return .server(message)
        }

        if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            return .server(text)
        }

        return .server("The provider returned an error.")
    }
}

private struct PrismDirectChatCompletionRequest: Encodable {
    let model: String
    let stream: Bool
    let messages: [PrismDirectChatPayloadMessage]
}

private struct PrismDirectChatPayloadMessage: Encodable {
    let role: String
    let content: String
}

private struct PrismDirectChatCompletionStreamResponse: Decodable {
    let choices: [PrismDirectChatChoice]
}

private struct PrismDirectChatChoice: Decodable {
    let delta: PrismDirectChatDelta
    let finishReason: String?

    private enum CodingKeys: String, CodingKey {
        case delta
        case finishReason = "finish_reason"
    }
}

private struct PrismDirectChatDelta: Decodable {
    let content: String?
}
