import { getCompactionCandidates } from "./operationCompaction";
import { deleteOperations } from "./indexedDb";
export async function compactPersistedOperations(operations, snapshot) {
    const candidates = getCompactionCandidates(operations, snapshot);
    if (candidates.length === 0) {
        return [...operations];
    }
    const candidateIds = candidates.map((op) => op.id);
    await deleteOperations(candidateIds);
    const candidateIdSet = new Set(candidateIds);
    return operations.filter((op) => !candidateIdSet.has(op.id));
}
