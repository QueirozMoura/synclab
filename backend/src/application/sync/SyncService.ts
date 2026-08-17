import type { Operation } from "@domain/operations/Operation.js";
import type { ServerOperationRepository } from "@domain/sync/ServerOperationRepository.js";
import { OperationSerializer } from "@domain/operations/OperationSerializer.js";
import { OperationType } from "@domain/operations/types.js";
import { VectorClock } from "@domain/vector-clock/VectorClock.js";

/**
 * Resultado de uma operação de push.
 */
export interface PushResult {
  accepted: string[];
  rejected: Array<{ operationId: string; reason: string }>;
}

/**
 * Resultado de uma operação de pull.
 */
export interface PullResult {
  operations: Operation[];
  hasMore: boolean;
}

/**
 * Erro de validação de operação.
 */
export class OperationValidationError extends Error {
  constructor(
    public readonly operationId: string,
    public readonly field: string,
    message: string,
  ) {
    super(`Operation ${operationId}: ${field} - ${message}`);
    this.name = "OperationValidationError";
  }
}

/**
 * Serviço de sincronização do lado do servidor.
 *
 * Coordena:
 * - Push: recebe operações do cliente, valida, deduplica, armazena
 * - Pull: retorna operações que o cliente ainda não possui
 *
 * A camada HTTP apenas transporta dados; regras de negócio ficam aqui.
 */
export class SyncService {
  private readonly repository: ServerOperationRepository;
  private readonly serializer = new OperationSerializer();

  constructor(repository: ServerOperationRepository) {
    this.repository = repository;
  }

  /**
   * Processa um push de operações do cliente.
   *
   * Fluxo:
   * 1. Valida cada operação
   * 2. Verifica duplicatas por operationId
   * 3. Armazena operações novas
   * 4. Retorna quais foram aceitas/rejeitadas
   */
  async push(operations: Operation[]): Promise<PushResult> {
    const accepted: string[] = [];
    const rejected: Array<{ operationId: string; reason: string }> = [];

    for (const operation of operations) {
      try {
        this.validateOperation(operation);
      } catch (error) {
        if (error instanceof OperationValidationError) {
          rejected.push({ operationId: error.operationId, reason: error.message });
          continue;
        }
        throw error;
      }

      const saved = await this.repository.save(operation);

      if (saved) {
        accepted.push(operation.id);
      } else {
        rejected.push({ operationId: operation.id, reason: "Duplicate operationId" });
      }
    }

    return { accepted, rejected };
  }

  /**
   * Processa um pull de operações para o cliente.
   *
   * O cliente informa quais operationIds já possui.
   * Retorna operações do documento que não estão no conjunto conhecido.
   */
  async pull(
    documentId: string,
    knownOperationIds: string[],
    limit?: number,
  ): Promise<PullResult> {
    const missing = await this.repository.findMissingOperations(
      documentId,
      knownOperationIds,
    );

    let operations = missing;

    if (limit && limit > 0) {
      operations = missing.slice(0, limit);
    }

    return {
      operations,
      hasMore: missing.length > (limit ?? missing.length),
    };
  }

  /**
   * Valida uma operação recebida do cliente.
   *
   * Verifica campos obrigatórios e formato básico.
   * Não valida causalidade (isso é responsabilidade do CRDT/SyncEngine).
   */
  private validateOperation(operation: Operation): void {
    const { id, documentId, deviceId, type, payload, vectorClock } = operation;

    if (!id || typeof id !== "string") {
      throw new OperationValidationError(id ?? "unknown", "id", "Operation ID is required and must be a string");
    }

    if (!documentId || typeof documentId !== "string") {
      throw new OperationValidationError(id, "documentId", "Document ID is required and must be a string");
    }

    if (!deviceId || typeof deviceId !== "string") {
      throw new OperationValidationError(id, "deviceId", "Device ID is required and must be a string");
    }

    if (type !== OperationType.INSERT && type !== OperationType.DELETE) {
      throw new OperationValidationError(id, "type", `Invalid operation type: ${type}. Must be INSERT or DELETE`);
    }

    if (!payload || typeof payload !== "object") {
      throw new OperationValidationError(id, "payload", "Payload is required and must be an object");
    }

    if (type === OperationType.INSERT) {
      const insertPayload = payload as { afterId?: string | null; content?: string };

      if (insertPayload.afterId !== null && insertPayload.afterId !== undefined && typeof insertPayload.afterId !== "string") {
        throw new OperationValidationError(id, "payload.afterId", "afterId must be a string or null");
      }

      if (typeof insertPayload.content !== "string") {
        throw new OperationValidationError(id, "payload.content", "content is required and must be a string");
      }
    } else {
      const deletePayload = payload as { elementIds?: unknown };

      if (!Array.isArray(deletePayload.elementIds)) {
        throw new OperationValidationError(id, "payload.elementIds", "elementIds is required and must be an array");
      }

      for (const elementId of deletePayload.elementIds) {
        if (typeof elementId !== "string") {
          throw new OperationValidationError(id, "payload.elementIds[]", "Each elementId must be a string");
        }
      }
    }

    if (!vectorClock || typeof vectorClock !== "object") {
      throw new OperationValidationError(id, "vectorClock", "Vector clock is required");
    }

    if (typeof vectorClock.toMap !== "function") {
      throw new OperationValidationError(id, "vectorClock", "Vector clock must have a toMap method");
    }

    let clockMap: Record<string, number>;
    try {
      clockMap = vectorClock.toMap();
    } catch {
      throw new OperationValidationError(id, "vectorClock", "Vector clock toMap() threw an error");
    }

    if (typeof clockMap !== "object" || clockMap === null || Array.isArray(clockMap)) {
      throw new OperationValidationError(id, "vectorClock", "Vector clock toMap() must return an object");
    }

    for (const [key, value] of Object.entries(clockMap)) {
      if (typeof key !== "string" || typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new OperationValidationError(id, "vectorClock", "Vector clock must map device IDs to non-negative integers");
      }
    }

    try {
      VectorClock.from(clockMap);
    } catch {
      throw new OperationValidationError(id, "vectorClock", "Invalid vector clock format");
    }
  }

  /**
   * Serializa operações para transporte HTTP.
   */
  serializeOperations(operations: Operation[]): ReturnType<OperationSerializer["serialize"]>[] {
    return operations.map((op) => this.serializer.serialize(op));
  }

  /**
   * Desserializa operações recebidas via HTTP.
   */
  deserializeOperations(data: ReturnType<OperationSerializer["serialize"]>[]): Operation[] {
    return data.map((d) => this.serializer.deserialize(d));
  }
}