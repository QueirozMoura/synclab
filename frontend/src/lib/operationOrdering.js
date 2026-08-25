function compareOperations(a, b) {
    const clockA = a.vectorClock;
    const clockB = b.vectorClock;
    const comparison = clockA.compare(clockB);
    if (comparison === "before")
        return -1;
    if (comparison === "after")
        return 1;
    if (comparison === "equal") {
        if (a.deviceId !== b.deviceId) {
            return a.deviceId.localeCompare(b.deviceId);
        }
        return a.id.localeCompare(b.id);
    }
    if (a.deviceId !== b.deviceId) {
        return a.deviceId.localeCompare(b.deviceId);
    }
    return a.id.localeCompare(b.id);
}
export function orderOperations(operations) {
    return [...operations].sort(compareOperations);
}
