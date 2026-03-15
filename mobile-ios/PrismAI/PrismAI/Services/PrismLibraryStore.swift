import Foundation

final class PrismLibraryStore {
    private var indexCache: PrismBundledLibraryIndex?
    private var collectionCache: [PrismLibraryTab: [PrismLibraryItem]] = [:]
    private var lensCache: [String: PrismLensDetail] = [:]

    func manifest() throws -> PrismLibraryManifest {
        let index = try loadIndex()
        return PrismLibraryManifest(generatedAt: index.generatedAt, counts: index.counts)
    }

    func collection(for tab: PrismLibraryTab) throws -> [PrismLibraryItem] {
        if let cached = collectionCache[tab] {
            return cached
        }

        let payload: PrismCollectionResponse = try loadJSON(
            relativePath: "library-collections/\(tab.rawValue).json",
            as: PrismCollectionResponse.self
        )
        collectionCache[tab] = payload.items
        return payload.items
    }

    func lensDetails(for handles: [String]) throws -> [PrismLensDetail] {
        let index = try loadIndex()
        let entries = index.lookup?.lenses ?? []
        var entryByHandle: [String: PrismBundledLensEntry] = [:]
        for entry in entries {
            guard let handle = entry.handle?.lowercased(), !handle.isEmpty else { continue }
            entryByHandle[handle] = entry
        }

        var details: [PrismLensDetail] = []
        for handle in handles {
            let cacheKey = handle.lowercased()
            if let cached = lensCache[cacheKey] {
                details.append(cached)
                continue
            }

            guard
                let entry = entryByHandle[cacheKey],
                let detailPath = entry.detailPath,
                !detailPath.isEmpty
            else {
                continue
            }

            let detail: PrismLensDetail = try loadJSON(
                relativePath: "library-items/\(detailPath)",
                as: PrismLensDetail.self
            )
            lensCache[cacheKey] = detail
            details.append(detail)
        }

        return details
    }

    private func loadIndex() throws -> PrismBundledLibraryIndex {
        if let indexCache {
            return indexCache
        }

        let index: PrismBundledLibraryIndex = try loadJSON(
            relativePath: "library.generated.json",
            as: PrismBundledLibraryIndex.self
        )
        indexCache = index
        return index
    }

    private func loadJSON<T: Decodable>(relativePath: String, as type: T.Type) throws -> T {
        let url = try libraryRootURL().appendingPathComponent(relativePath)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(type, from: data)
    }

    private func libraryRootURL() throws -> URL {
        if let root = Bundle.main.url(forResource: "MetacanonLibrary", withExtension: nil) {
            return root
        }

        if
            let resourceURL = Bundle.main.resourceURL?.appendingPathComponent("MetacanonLibrary"),
            FileManager.default.fileExists(atPath: resourceURL.path)
        {
            return resourceURL
        }

        throw PrismAPIError.missingBundledLibrary
    }
}
