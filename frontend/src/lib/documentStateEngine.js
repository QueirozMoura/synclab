import { orderOperations } from "./operationOrdering";
import { reduceOperations } from "./documentReducer";
export function reconstructDocument(initialDocument, operations) {
    const orderedOperations = orderOperations(operations);
    const reduced = reduceOperations(initialDocument, orderedOperations);
    if (!reduced) {
        return null;
    }
    const document = {
        id: reduced.id,
        title: reduced.title,
        content: reduced.content,
        createdAt: reduced.createdAt,
        updatedAt: reduced.updatedAt,
    };
    return document;
}
