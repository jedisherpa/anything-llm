import Foundation
import UniformTypeIdentifiers

struct PrismPairingTarget {
    let mobileAPIBaseURL: URL
    let registrationToken: String
}

final class PrismAPIClient {
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private let urlSession: URLSession

    init(urlSession: URLSession = .shared) {
        self.urlSession = urlSession
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    func register(pairingURLString: String, deviceName: String) async throws -> PrismSession {
        let target = try parsePairingTarget(from: pairingURLString)
        var request = URLRequest(url: target.mobileAPIBaseURL.appendingPathComponent("register"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(target.registrationToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(RegisterPayload(deviceOs: "ios", deviceName: deviceName))

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)

        let payload = try decoder.decode(PrismRegisterResponse.self, from: data)
        return PrismSession(
            baseURLString: target.mobileAPIBaseURL.absoluteString,
            deviceToken: payload.token,
            deviceName: deviceName,
            deviceOS: "ios"
        )
    }

    func authenticate(session: PrismSession) async throws {
        guard let baseURL = session.baseURL else {
            throw PrismAPIError.invalidServerResponse
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("auth"))
        applyDeviceHeaders(to: &request, session: session)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
    }

    func bootstrap(session: PrismSession) async throws -> PrismBootstrapResponse {
        guard let baseURL = session.baseURL else {
            throw PrismAPIError.invalidServerResponse
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("bootstrap"))
        applyDeviceHeaders(to: &request, session: session)
        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(PrismBootstrapResponse.self, from: data)
    }

    func fetchLibraryCollection(
        session: PrismSession,
        tab: PrismLibraryTab
    ) async throws -> [PrismLibraryItem] {
        let payload = try await sendCommand(
            session: session,
            command: "library-collection",
            body: LibraryCollectionPayload(tab: tab.rawValue),
            decodeAs: PrismCollectionResponse.self
        )
        return payload.items
    }

    func createWorkspace(
        session: PrismSession,
        name: String
    ) async throws -> PrismWorkspace {
        let payload = try await sendCommand(
            session: session,
            command: "create-workspace",
            body: CreateWorkspacePayload(name: name, chatMode: PrismChatMode.chat.rawValue),
            decodeAs: PrismWorkspaceCommandResponse.self
        )

        if let workspace = payload.workspace {
            return workspace
        }
        throw PrismAPIError.server(payload.error ?? payload.message ?? "Workspace creation failed.")
    }

    func fetchWorkspaceDocuments(
        session: PrismSession,
        workspaceSlug: String
    ) async throws -> [PrismWorkspaceDocument] {
        let payload = try await sendCommand(
            session: session,
            command: "workspace-documents",
            body: WorkspaceDocumentsPayload(workspaceSlug: workspaceSlug),
            decodeAs: PrismWorkspaceDocumentsResponse.self
        )
        return payload.documents
    }

    func fetchWorkspaceContent(
        session: PrismSession,
        workspaceSlug: String
    ) async throws -> PrismWorkspaceContentResponse {
        try await sendCommand(
            session: session,
            command: "workspace-content",
            body: WorkspaceDocumentsPayload(workspaceSlug: workspaceSlug),
            decodeAs: PrismWorkspaceContentResponse.self
        )
    }

    func updateWorkspaceDocumentPin(
        session: PrismSession,
        workspaceSlug: String,
        documentID: Int,
        pinned: Bool
    ) async throws -> PrismWorkspaceDocument {
        let payload = try await sendCommand(
            session: session,
            command: "update-document-pin",
            body: WorkspaceDocumentPinPayload(
                workspaceSlug: workspaceSlug,
                documentId: documentID,
                pinStatus: pinned
            ),
            decodeAs: PrismWorkspaceDocumentMutationResponse.self
        )

        if let document = payload.document {
            return document
        }
        throw PrismAPIError.server(payload.error ?? "Document update failed.")
    }

    func removeWorkspaceDocument(
        session: PrismSession,
        workspaceSlug: String,
        documentID: Int
    ) async throws {
        let payload = try await sendCommand(
            session: session,
            command: "remove-workspace-document",
            body: WorkspaceDocumentRemovalPayload(
                workspaceSlug: workspaceSlug,
                documentId: documentID
            ),
            decodeAs: PrismWorkspaceDocumentRemovalResponse.self
        )

        if payload.success {
            return
        }
        throw PrismAPIError.server(payload.error ?? "Document removal failed.")
    }

    func uploadWorkspaceDocument(
        session: PrismSession,
        workspaceSlug: String,
        fileURL: URL
    ) async throws -> PrismWorkspaceUploadResponse {
        guard let baseURL = session.baseURL else {
            throw PrismAPIError.invalidServerResponse
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(
            url: baseURL
                .appendingPathComponent("workspace")
                .appendingPathComponent(workspaceSlug)
                .appendingPathComponent("upload-and-embed")
        )
        request.httpMethod = "POST"
        request.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        request.setValue(
            session.deviceToken,
            forHTTPHeaderField: "x-anythingllm-mobile-device-token"
        )
        request.httpBody = try multipartBody(fileURL: fileURL, boundary: boundary)

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        let payload = try decoder.decode(PrismWorkspaceUploadResponse.self, from: data)
        if !payload.success {
            throw PrismAPIError.server(payload.error ?? "Document upload failed.")
        }
        return payload
    }

    func unregister(session: PrismSession) async {
        do {
            _ = try await sendCommand(
                session: session,
                command: "unregister-device",
                body: EmptyPayload(),
                decodeAs: [String: Bool].self
            )
        } catch {
            // Best effort only.
        }
    }

    func streamChat(
        session: PrismSession,
        workspaceSlug: String,
        mode: PrismChatMode,
        message: String,
        attachments: [PrismPendingAttachment] = []
    ) -> AsyncThrowingStream<PrismStreamChunk, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    try await self.performChatStream(
                        session: session,
                        workspaceSlug: workspaceSlug,
                        mode: mode,
                        message: message,
                        attachments: attachments,
                        continuation: continuation
                    )
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    private func performChatStream(
        session: PrismSession,
        workspaceSlug: String,
        mode: PrismChatMode,
        message: String,
        attachments: [PrismPendingAttachment],
        continuation: AsyncThrowingStream<PrismStreamChunk, Error>.Continuation
    ) async throws {
        guard let baseURL = session.baseURL else {
            throw PrismAPIError.invalidServerResponse
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("send/stream-chat"))
        request.httpMethod = "POST"
        request.timeoutInterval = 300
        applyDeviceHeaders(to: &request, session: session)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = try encoder.encode(StreamChatPayload(
            workspaceSlug: workspaceSlug,
            mode: mode.rawValue,
            message: message,
            attachments: attachments
        ))

        let (bytes, response) = try await urlSession.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PrismAPIError.invalidServerResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            var errorBody = Data()
            for try await byte in bytes {
                errorBody.append(byte)
            }
            throw parsedServerError(from: errorBody, fallback: "Prism chat failed to start.")
        }

        for try await line in bytes.lines {
            guard line.hasPrefix("data: ") else { continue }
            let jsonString = String(line.dropFirst(6))
            guard let jsonData = jsonString.data(using: .utf8) else { continue }
            let chunk = try decoder.decode(PrismStreamChunk.self, from: jsonData)
            continuation.yield(chunk)
            if chunk.close == true && chunk.type != "textResponseChunk" {
                break
            }
        }

        continuation.finish()
    }

    private func sendCommand<Body: Encodable, Response: Decodable>(
        session: PrismSession,
        command: String,
        body: Body,
        decodeAs responseType: Response.Type
    ) async throws -> Response {
        guard let baseURL = session.baseURL else {
            throw PrismAPIError.invalidServerResponse
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("send").appendingPathComponent(command))
        request.httpMethod = "POST"
        applyDeviceHeaders(to: &request, session: session)
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await urlSession.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(responseType, from: data)
    }

    private func parsePairingTarget(from rawValue: String) throws -> PrismPairingTarget {
        var normalized = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalized.isEmpty {
            throw PrismAPIError.invalidPairingURL
        }

        if !normalized.contains("://") {
            normalized = "http://\(normalized)"
        }

        guard
            let url = URL(string: normalized),
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let token = components.queryItems?.first(where: { $0.name == "t" })?.value,
            !token.isEmpty
        else {
            throw PrismAPIError.invalidPairingURL
        }

        guard var baseComponents = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw PrismAPIError.invalidPairingURL
        }
        baseComponents.query = nil
        baseComponents.fragment = nil

        guard let baseURL = baseComponents.url else {
            throw PrismAPIError.invalidPairingURL
        }

        return PrismPairingTarget(
            mobileAPIBaseURL: baseURL,
            registrationToken: token
        )
    }

    private func applyDeviceHeaders(to request: inout URLRequest, session: PrismSession) {
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(session.deviceToken, forHTTPHeaderField: "x-anythingllm-mobile-device-token")
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PrismAPIError.invalidServerResponse
        }

        guard (200 ..< 300).contains(httpResponse.statusCode) else {
            throw parsedServerError(from: data, fallback: "The Prism server returned an error.")
        }
    }

    private func parsedServerError(from data: Data, fallback: String) -> PrismAPIError {
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

        return .server(fallback)
    }

    private func multipartBody(fileURL: URL, boundary: String) throws -> Data {
        let filename = fileURL.lastPathComponent
        let mimeType = UTType(filenameExtension: fileURL.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        let fileData = try Data(contentsOf: fileURL)
        let newline = "\r\n"
        var body = Data()

        body.append("--\(boundary)\(newline)".data(using: .utf8)!)
        body.append(
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\(newline)"
                .data(using: .utf8)!
        )
        body.append("Content-Type: \(mimeType)\(newline)\(newline)".data(using: .utf8)!)
        body.append(fileData)
        body.append(newline.data(using: .utf8)!)
        body.append("--\(boundary)--\(newline)".data(using: .utf8)!)
        return body
    }
}

private struct RegisterPayload: Encodable {
    let deviceOs: String
    let deviceName: String
}

private struct LibraryCollectionPayload: Encodable {
    let tab: String
}

private struct CreateWorkspacePayload: Encodable {
    let name: String
    let chatMode: String
}

private struct WorkspaceDocumentsPayload: Encodable {
    let workspaceSlug: String
}

private struct WorkspaceDocumentPinPayload: Encodable {
    let workspaceSlug: String
    let documentId: Int
    let pinStatus: Bool
}

private struct WorkspaceDocumentRemovalPayload: Encodable {
    let workspaceSlug: String
    let documentId: Int
}

private struct StreamChatPayload: Encodable {
    let workspaceSlug: String
    let mode: String
    let message: String
    let attachments: [PrismPendingAttachment]
}

private struct EmptyPayload: Encodable {}
