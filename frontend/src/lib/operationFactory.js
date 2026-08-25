import { getDeviceId } from "./deviceIdentity";
function createOperation(documentId, type, payload, vectorClock) {
    return {
        id: crypto.randomUUID(),
        documentId,
        deviceId: getDeviceId(),
        type,
        payload,
        timestamp: new Date().toISOString(),
        vectorClock,
    };
}
export { createOperation };
