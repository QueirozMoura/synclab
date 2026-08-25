import type { Operation } from "#domain/operations/index.js";
import { SyncOperationType, type SyncOperation } from "../../types/syncOperation.js";

export class SyncOperationAdapterError extends Error {
  constructor(
    message: string,
    public readonly syncOperationType: SyncOperationType,
  ) {
    super(message);
    this.name = "SyncOperationAdapterError";
  }
}

export class SyncOperationAdapter {
  static canAdapt(syncOperation: SyncOperation): boolean {
    return this.getSupportedTypes().includes(syncOperation.type);
  }

  static getSupportedTypes(): SyncOperationType[] {
    return [];
  }

  static toDomainOperation(syncOperation: SyncOperation): Operation {
    if (!this.canAdapt(syncOperation)) {
      throw new SyncOperationAdapterError(
        `Sync operation type "${syncOperation.type}" cannot be represented by current domain Operation. ` +
          `Supported domain operations: INSERT, DELETE. ` +
          `Frontend operation "${syncOperation.type}" requires document-level semantics not supported by the character-level CRDT.`,
        syncOperation.type,
      );
    }

    switch (syncOperation.type) {
      case SyncOperationType.CREATE_DOCUMENT:
        throw new SyncOperationAdapterError(
          "CREATE_DOCUMENT cannot be represented by current domain Operation",
          syncOperation.type,
        );

      case SyncOperationType.UPDATE_TITLE:
        throw new SyncOperationAdapterError(
          "UPDATE_TITLE cannot be represented by current domain Operation",
          syncOperation.type,
        );

      case SyncOperationType.UPDATE_CONTENT:
        throw new SyncOperationAdapterError(
          "UPDATE_CONTENT cannot be represented by current domain Operation",
          syncOperation.type,
        );

      case SyncOperationType.DELETE_DOCUMENT:
        throw new SyncOperationAdapterError(
          "DELETE_DOCUMENT cannot be represented by current domain Operation",
          syncOperation.type,
        );

      default:
        const exhaustiveCheck: never = syncOperation.type;
        throw new SyncOperationAdapterError(
          `Unknown sync operation type: ${exhaustiveCheck}`,
          exhaustiveCheck as SyncOperationType,
        );
    }
  }

  static tryAdapt(syncOperation: SyncOperation): { success: true; operation: Operation } | { success: false; error: SyncOperationAdapterError } {
    try {
      const operation = this.toDomainOperation(syncOperation);
      return { success: true, operation };
    } catch (error) {
      if (error instanceof SyncOperationAdapterError) {
        return { success: false, error };
      }
      throw error;
    }
  }
}