import type { Operation } from "./Operation.js";
import { OperationType, type DeletePayload, type InsertPayload } from "./types.js";
import { VectorClock } from "../vector-clock/VectorClock.js";

/**
 * Erro lançado quando a desserialização falha devido a dados inválidos.
 */
export class DeserializationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "DeserializationError";
  }
}

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
   * Valida todos os campos obrigatórios e lança DeserializationError se inválido.
   */
  deserialize(data: SerializedOperation): Operation {
    this.validate(data);

    let vectorClock: VectorClock;
    try {
      vectorClock = VectorClock.from(data.vectorClockMap);
    } catch (error) {
      throw new DeserializationError(
        `vectorClockMap inválido: ${error instanceof Error ? error.message : String(error)}`,
        "vectorClockMap",
      );
    }

    if (data.type === OperationType.INSERT) {
      const insertPayload = this.validateInsertPayload(data.payload);
      return Object.freeze({
        id: data.id,
        documentId: data.documentId,
        deviceId: data.deviceId,
        type: OperationType.INSERT,
        payload: Object.freeze({ ...insertPayload }),
        vectorClock,
      });
    }

    const deletePayload = this.validateDeletePayload(data.payload);
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
   * Valida estrutura completa de SerializedOperation.
   */
  private validate(data: SerializedOperation): void {
    if (!data || typeof data !== "object") {
      throw new DeserializationError("Dados devem ser um objeto");
    }

    if (typeof data.id !== "string" || data.id.length === 0) {
      throw new DeserializationError("Campo 'id' é obrigatório e deve ser string não vazia", "id");
    }

    if (typeof data.documentId !== "string" || data.documentId.length === 0) {
      throw new DeserializationError("Campo 'documentId' é obrigatório e deve ser string não vazia", "documentId");
    }

    if (typeof data.deviceId !== "string" || data.deviceId.length === 0) {
      throw new DeserializationError("Campo 'deviceId' é obrigatório e deve ser string não vazia", "deviceId");
    }

    if (data.type !== OperationType.INSERT && data.type !== OperationType.DELETE) {
      throw new DeserializationError(
        `Campo 'type' deve ser '${OperationType.INSERT}' ou '${OperationType.DELETE}'`,
        "type",
      );
    }

    if (!data.payload || typeof data.payload !== "object") {
      throw new DeserializationError("Campo 'payload' é obrigatório e deve ser um objeto", "payload");
    }

    if (!data.vectorClockMap || typeof data.vectorClockMap !== "object") {
      throw new DeserializationError("Campo 'vectorClockMap' é obrigatório e deve ser um objeto", "vectorClockMap");
    }

    for (const [key, value] of Object.entries(data.vectorClockMap)) {
      if (typeof key !== "string" || key.length === 0) {
        throw new DeserializationError("Chaves do vectorClockMap devem ser strings não vazias", "vectorClockMap");
      }
      if (!Number.isInteger(value) || value < 0) {
        throw new DeserializationError(
          `Valor do vectorClockMap para '${key}' deve ser inteiro não negativo`,
          "vectorClockMap",
        );
      }
    }
  }

  private validateInsertPayload(payload: InsertPayload | DeletePayload): InsertPayload {
    if (!("content" in payload)) {
      throw new DeserializationError("Payload INSERT deve conter campo 'content'", "payload");
    }
    if (typeof payload.content !== "string") {
      throw new DeserializationError("Campo 'content' deve ser string", "payload.content");
    }
    if (payload.afterId !== null && (typeof payload.afterId !== "string" || payload.afterId.length === 0)) {
      throw new DeserializationError("Campo 'afterId' deve ser string não vazia ou null", "payload.afterId");
    }
    return payload as InsertPayload;
  }

  private validateDeletePayload(payload: InsertPayload | DeletePayload): DeletePayload {
    if (!("elementIds" in payload)) {
      throw new DeserializationError("Payload DELETE deve conter campo 'elementIds'", "payload");
    }
    if (!Array.isArray(payload.elementIds)) {
      throw new DeserializationError("Campo 'elementIds' deve ser array", "payload.elementIds");
    }
    for (const id of payload.elementIds) {
      if (typeof id !== "string" || id.length === 0) {
        throw new DeserializationError("Todos os elementIds devem ser strings não vazias", "payload.elementIds");
      }
    }
    return payload as DeletePayload;
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
