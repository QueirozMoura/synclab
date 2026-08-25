function createEmptyDocument(id) {
    return {
        id,
        title: "",
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false,
    };
}
export function reduceOperations(initialDocument, operations) {
    let doc = initialDocument
        ? { ...initialDocument, deleted: false }
        : null;
    for (const op of operations) {
        switch (op.type) {
            case "CREATE_DOCUMENT": {
                if (!doc) {
                    doc = createEmptyDocument(op.documentId);
                }
                const payload = op.payload;
                doc.title = payload.title;
                doc.content = payload.content;
                doc.createdAt = op.timestamp;
                doc.updatedAt = op.timestamp;
                doc.deleted = false;
                break;
            }
            case "UPDATE_TITLE": {
                if (doc && !doc.deleted) {
                    const payload = op.payload;
                    doc.title = payload.title;
                    doc.updatedAt = op.timestamp;
                }
                break;
            }
            case "UPDATE_CONTENT": {
                if (doc && !doc.deleted) {
                    const payload = op.payload;
                    doc.content = payload.content;
                    doc.updatedAt = op.timestamp;
                }
                break;
            }
            case "DELETE_DOCUMENT": {
                if (doc) {
                    doc.deleted = true;
                    doc.updatedAt = op.timestamp;
                }
                break;
            }
        }
    }
    if (doc?.deleted) {
        return null;
    }
    return doc;
}
