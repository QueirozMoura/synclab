import type { Operation } from "./Operation.js";
import { OperationType, type DeletePayload, type InsertPayload } from "./types.js";
import { VectorClock } from "../vector-clock/VectorClock.js";

/**
 * Serializa e desserializa operações para/de formato persistível.
 *
 * Garante que Operation pode ser convertida para JSON e vice-versa
 * sem perda de informação ou tipo.
 *
 * Coordenação:
 * - payload: InsertPayload ou DeletePayload → JSON
 * - vectorClock: ClockMap (via toMap()) → JSON
 *
 * JSON normalizado: não permite perda de dados.
 */
export class OperationSerializer {
  /**
   * Serializa uma Operation para um objeto JSON-compatible.
   * Pode ser diretamente passado a JSON.stringify.
   */
  serialize(operation: Operation): SerializedOperation {
    return {
      id: operation.id,
      documentId: operation.documentId,
      deviceId: operation.deviceId,
      type: operation.type,
      payload: operation.payload,
      vectorClockMap: operation.vectorClock.toMap(),
    };
  }

  /**
   * Desserializa um objeto previamente serializado de volta para Operation.
   */
  deserialize(data: SerializedOperation): Operation {
    const vectorClock = VectorClock.from(data.vectorClockMap);

    if (data.type === OperationType.INSERT) {
      const insertPayload = data.payload as InsertPayload;
      return Object.freeze({
        id: data.id,
        documentId: data.documentId,
        deviceId: data.deviceId,
        type: OperationType.INSERT,
        payload: Object.freeze({ ...insertPayload }),
        vectorClock,
      });
    }

    const deletePayload = data.payload as DeletePayload;
    return Object.freeze({
      id: data.id,
      documentId: data.documentId,
      deviceId: data.deviceId,
      type: OperationType.DELETE,
      payload: Object.freeze({ elementIds: Object.freeze([...deletePayload.elementIds]) }),
      vectorClock,
    });
  }

  /**
   * Serializa para string JSON (para armazenamento em banco).
   */
  toJSON(operation: Operation): string {
    return JSON.stringify(this.serialize(operation));
  }

  /**
   * Desserializa de string JSON (do banco de dados).
   */
  fromJSON(json: string): Operation {
    const data = JSON.parse(json) as SerializedOperation;
    return this.deserialize(data);
  }
}

/**
 * Formato intermediário para serialização.
 * Tem todos os campos de Operation mas com tipos JSON-compatíveis.
 */
export interface SerializedOperation {
  id: string;
  documentId: string;
  deviceId: string;
  type: OperationType;
  payload: InsertPayload | DeletePayload;
  vectorClockMap: Record<string, number>;
}
