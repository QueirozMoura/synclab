export function getCompactionCandidates(operations, snapshot) {
    const snapshotTime = new Date(snapshot.updatedAt).getTime();
    return operations
        .filter((op) => op.documentId === snapshot.documentId)
        .filter((op) => new Date(op.timestamp).getTime() <= snapshotTime);
}
