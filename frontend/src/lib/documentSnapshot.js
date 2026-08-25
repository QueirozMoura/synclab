export function createDocumentSnapshot(documentId, document, operationCount, vectorClock) {
    const now = new Date().toISOString();
    return {
        documentId,
        document: { ...document },
        operationCount,
        createdAt: now,
        updatedAt: now,
        vectorClock: vectorClock?.toMap() ?? {},
    };
}
