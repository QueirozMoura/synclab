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
 * Serviço de sincronização do lado do servidor (legado - baseado em Operation/CRDT).
 *
 * Coordena:
 * - Push: recebe operações do cliente, valida, deduplica, armazena
 * - Pull: retorna operações que o cliente ainda não possui
 *
 * A camada HTTP apenas transporta dados; regras de negócio ficam aqui.
 *
 * @deprecated Use DocumentSyncService para sincronização baseada em DocumentOperation
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

import type { DocumentOperationRepository } from "@domain/document-operations/DocumentOperationRepository.js";
import type { DocumentOperation } from "@domain/document-operations/DocumentOperation.js";
import { DocumentOperationAdapter } from "./DocumentOperationAdapter.js";
import type { SyncPayload, SyncResult } from "../../types/sync.js";
import type { SyncOperation } from "../../types/syncOperation.js";

/**
 * Serviço de sincronização para operações de documento (DocumentOperation).
 *
 * Fluxo:
 * SyncPayload → SyncService → DocumentOperationAdapter → DocumentOperation → DocumentOperationRepository → SyncResult
 *
 * Este serviço NÃO usa HTTP - é destinado para transporte via WebRTC ou outros meios.
 */
export class DocumentSyncService {
  private readonly repository: DocumentOperationRepository;

  constructor(repository: DocumentOperationRepository) {
    this.repository = repository;
  }

  async synchronize(payload: SyncPayload): Promise<SyncResult> {
    this.validatePayload(payload);

    const domainOperations = this.convertOperations(payload.operations);

    const newOperations = await this.identifyNewOperations(domainOperations);

    await this.persistNewOperations(newOperations);

    const acceptedOperations = this.determineAcceptedOperations(payload.operations, newOperations);

    const missingOperations = await this.findMissingOperations(payload.operations);

    return {
      acceptedOperations,
      missingOperations,
      snapshots: [],
    };
  }

  private validatePayload(payload: SyncPayload): void {
    if (!payload || typeof payload !== "object") {
      throw new Error("SyncPayload is required and must be an object");
    }

    if (!payload.deviceId || typeof payload.deviceId !== "string") {
      throw new Error("deviceId is required and must be a string");
    }

    if (!Array.isArray(payload.operations)) {
      throw new Error("operations is required and must be an array");
    }

    if (!Array.isArray(payload.snapshots)) {
      throw new Error("snapshots is required and must be an array");
    }
  }

  private convertOperations(syncOperations: readonly SyncOperation[]): DocumentOperation[] {
    const domainOperations: DocumentOperation[] = [];

    for (const syncOp of syncOperations) {
      const result = DocumentOperationAdapter.tryAdapt(syncOp);
      if (!result.success) {
        throw new Error(
          `Failed to adapt operation ${syncOp.id}: ${result.error.message}`,
        );
      }
      domainOperations.push(result.operation);
    }

    return domainOperations;
  }

  private async identifyNewOperations(
    domainOperations: readonly DocumentOperation[],
  ): Promise<DocumentOperation[]> {
    const newOperations: DocumentOperation[] = [];
    const seenIds = new Set<string>();

    for (const operation of domainOperations) {
      if (seenIds.has(operation.id)) {
        continue;
      }
      const exists = await this.repository.has(operation.id);
      if (!exists) {
        seenIds.add(operation.id);
        newOperations.push(operation);
      }
    }

    return newOperations;
  }

  private async persistNewOperations(newOperations: readonly DocumentOperation[]): Promise<void> {
    if (newOperations.length > 0) {
      await this.repository.saveMany(newOperations);
    }
  }

  private determineAcceptedOperations(
    syncOperations: readonly SyncOperation[],
    newOperations: readonly DocumentOperation[],
  ): SyncOperation[] {
    const newOperationIds = new Set(newOperations.map((op) => op.id));
    const seenIds = new Set<string>();

    return syncOperations.filter((op) => {
      if (seenIds.has(op.id)) {
        return false;
      }
      if (newOperationIds.has(op.id)) {
        seenIds.add(op.id);
        return true;
      }
      return false;
    });
  }

  private async findMissingOperations(
    syncOperations: readonly SyncOperation[],
  ): Promise<SyncOperation[]> {
    const knownIds = new Set(syncOperations.map((op) => op.id));
    const allOperations = await this.repository.getAll();

    const missingDomainOps = allOperations.filter((op) => !knownIds.has(op.id));

    return missingDomainOps.map(this.domainToSyncOperation);
  }

  private domainToSyncOperation(domainOp: DocumentOperation): SyncOperation {
    const syncOp: SyncOperation = {
      id: domainOp.id,
      documentId: domainOp.documentId,
      deviceId: domainOp.deviceId,
      type: domainOp.type as unknown as SyncOperation["type"],
      payload: domainOp.payload as unknown as SyncOperation["payload"],
      timestamp: domainOp.timestamp,
      vectorClock: Object.freeze({ ...domainOp.vectorClock }),
    };
    return Object.freeze(syncOp);
  }
}