import type { Operation } from "@domain/operations/Operation.js";
import type { ServerOperationRepository } from "@domain/sync/ServerOperationRepository.js";
import type { DocumentAuthorizationRepository } from "@domain/auth/DocumentAuthorizationRepository.js";
import type { AuthContext } from "@domain/auth/AuthContext.js";
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
 * Erro de autorização - deviceId não corresponde ao autenticado.
 */
export class DeviceIdMismatchError extends Error {
  constructor(
    public readonly operationId: string,
    public readonly expectedDeviceId: string,
    public readonly actualDeviceId: string,
  ) {
    super(`Operation ${operationId}: deviceId mismatch. Expected ${expectedDeviceId}, got ${actualDeviceId}`);
    this.name = "DeviceIdMismatchError";
  }
}

/**
 * Erro de autorização - acesso negado ao documento.
 */
export class DocumentAccessDeniedError extends Error {
  constructor(
    public readonly clientId: string,
    public readonly documentId: string,
  ) {
    super(`Client ${clientId} does not have access to document ${documentId}`);
    this.name = "DocumentAccessDeniedError";
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
  private readonly authzRepository: DocumentAuthorizationRepository;
  private readonly serializer = new OperationSerializer();

  constructor(
    repository: ServerOperationRepository,
    authzRepository: DocumentAuthorizationRepository,
  ) {
    this.repository = repository;
    this.authzRepository = authzRepository;
  }

  /**
   * Processa um push de operações do cliente.
   *
   * Fluxo:
   * 1. Valida cada operação
   * 2. Verifica se deviceId da operação corresponde ao deviceId autenticado
   * 3. Verifica autorização para os documentIds envolvidos
   * 4. Verifica duplicatas por operationId
   * 5. Armazena operações novas
   * 6. Retorna quais foram aceitas/rejeitadas
   */
  async push(operations: Operation[], authContext: AuthContext): Promise<PushResult> {
    const accepted: string[] = [];
    const rejected: Array<{ operationId: string; reason: string }> = [];

    // Validate all operations first
    const validOperations: Operation[] = [];
    for (const operation of operations) {
      try {
        this.validateOperation(operation);
        this.validateDeviceId(operation, authContext);
        await this.validateDocumentAccess(authContext.clientId, operation.documentId);
        validOperations.push(operation);
      } catch (error) {
        if (error instanceof OperationValidationError) {
          rejected.push({ operationId: error.operationId, reason: error.message });
          continue;
        }
        if (error instanceof DeviceIdMismatchError) {
          rejected.push({ operationId: error.operationId, reason: error.message });
          continue;
        }
        if (error instanceof DocumentAccessDeniedError) {
          rejected.push({ operationId: operation.id, reason: error.message });
          continue;
        }
        throw error;
      }
    }

    // Check for duplicate operationIds within the same batch
    const seenIds = new Set<string>();
    const operationsToSave: Operation[] = [];
    for (const operation of validOperations) {
      if (seenIds.has(operation.id)) {
        rejected.push({ operationId: operation.id, reason: "Duplicate operationId within batch" });
      } else {
        seenIds.add(operation.id);
        operationsToSave.push(operation);
      }
    }

    // Batch save valid operations
    if (operationsToSave.length > 0) {
      const saveResults = await this.repository.saveMany(operationsToSave);
      for (let i = 0; i < operationsToSave.length; i++) {
        if (saveResults[i]) {
          accepted.push(operationsToSave[i].id);
        } else {
          rejected.push({ operationId: operationsToSave[i].id, reason: "Duplicate operationId" });
        }
      }
    }

    return { accepted, rejected };
  }

  /**
   * Processa um pull de operações para o cliente.
   *
   * O cliente informa quais operationIds já possui.
   * Retorna operações do documento que não estão no conjunto conhecido.
   *
   * Verifica autorização para o documentId antes de retornar operações.
   */
  async pull(
    documentId: string,
    knownOperationIds: string[],
    authContext: AuthContext,
    limit?: number,
  ): Promise<PullResult> {
    await this.validateDocumentAccess(authContext.clientId, documentId);

    const missing = await this.repository.findMissingOperations(
      documentId,
      knownOperationIds,
      limit,
    );

    const hasMore = limit !== undefined && limit > 0 && missing.length >= limit;

    return {
      operations: missing,
      hasMore,
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
   * Valida que o deviceId da operação corresponde ao deviceId autenticado.
   *
   * Impede spoofing de deviceId - o cliente não pode enviar operações
   * em nome de outro dispositivo.
   */
  private validateDeviceId(operation: Operation, authContext: AuthContext): void {
    if (operation.deviceId !== authContext.deviceId) {
      throw new DeviceIdMismatchError(operation.id, authContext.deviceId, operation.deviceId);
    }
  }

  /**
   * Valida se o cliente tem acesso ao documento.
   */
  private async validateDocumentAccess(clientId: string, documentId: string): Promise<void> {
    const hasAccess = await this.authzRepository.canAccessDocument(clientId, documentId);
    if (!hasAccess) {
      throw new DocumentAccessDeniedError(clientId, documentId);
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