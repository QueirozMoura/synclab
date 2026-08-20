import type { DocumentSnapshot } from "../../../types/sync.js";
import type { ClockMap } from "../../../domain/vector-clock/types.js";
import { isValidTimestamp, isValidClockMap } from "../../../types/sync.js";

/**
 * Erro lançado quando a desserialização falha devido a dados inválidos.
 */
export class DocumentSnapshotDeserializationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "DocumentSnapshotDeserializationError";
  }
}

/**
 * Serializa e desserializa DocumentSnapshot para/de formato persistível.
 *
 * Garante que DocumentSnapshot pode ser convertido para JSON e vice-versa
 * sem perda de informação ou tipo.
 *
 * Coordenação:
 * - document: JSON completo do documento (id, title, content)
 * - vectorClock: ClockMap → JSON
 * - createdAt/updatedAt: ISO strings
 */
export class DocumentSnapshotSerializer {
  /**
   * Serializa um DocumentSnapshot para um objeto JSON-compatible.
   * Pode ser diretamente passado a JSON.stringify.
   */
  serialize(snapshot: DocumentSnapshot): SerializedDocumentSnapshot {
    return {
      documentId: snapshot.documentId,
      document: snapshot.document,
      operationCount: snapshot.operationCount,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      vectorClockMap: snapshot.vectorClock,
    };
  }

  /**
   * Desserializa um objeto previamente serializado de volta para DocumentSnapshot.
   * Valida todos os campos obrigatórios e lança DocumentSnapshotDeserializationError se inválido.
   */
  deserialize(data: SerializedDocumentSnapshot): DocumentSnapshot {
    this.validate(data);

    return Object.freeze({
      documentId: data.documentId,
      document: Object.freeze({ ...data.document }),
      operationCount: data.operationCount,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      vectorClock: Object.freeze({ ...data.vectorClockMap }),
    });
  }

  /**
   * Valida estrutura completa de SerializedDocumentSnapshot.
   */
  private validate(data: SerializedDocumentSnapshot): void {
    if (!data || typeof data !== "object") {
      throw new DocumentSnapshotDeserializationError("Dados devem ser um objeto");
    }

    if (typeof data.documentId !== "string" || data.documentId.length === 0) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'documentId' é obrigatório e deve ser string não vazia",
        "documentId",
      );
    }

    if (!data.document || typeof data.document !== "object") {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'document' é obrigatório e deve ser um objeto",
        "document",
      );
    }

    if (typeof data.document.id !== "string" || data.document.id.length === 0) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'document.id' é obrigatório e deve ser string não vazia",
        "document.id",
      );
    }

    if (typeof data.document.title !== "string") {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'document.title' é obrigatório e deve ser string",
        "document.title",
      );
    }

    if (typeof data.document.content !== "string") {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'document.content' é obrigatório e deve ser string",
        "document.content",
      );
    }

    if (!Number.isInteger(data.operationCount) || data.operationCount < 0) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'operationCount' deve ser inteiro não negativo",
        "operationCount",
      );
    }

    if (!isValidTimestamp(data.createdAt)) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'createdAt' deve ser string ISO 8601 válida",
        "createdAt",
      );
    }

    if (!isValidTimestamp(data.updatedAt)) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'updatedAt' deve ser string ISO 8601 válida",
        "updatedAt",
      );
    }

    if (!isValidClockMap(data.vectorClockMap)) {
      throw new DocumentSnapshotDeserializationError(
        "Campo 'vectorClockMap' deve ser objeto com chaves não vazias e valores inteiros não negativos",
        "vectorClockMap",
      );
    }
  }

  /**
   * Serializa para string JSON (para armazenamento em banco).
   */
  toJSON(snapshot: DocumentSnapshot): string {
    return JSON.stringify(this.serialize(snapshot));
  }

  /**
   * Desserializa de string JSON (do banco de dados).
   */
  fromJSON(json: string): DocumentSnapshot {
    const data = JSON.parse(json) as SerializedDocumentSnapshot;
    return this.deserialize(data);
  }
}

/**
 * Formato intermediário para serialização.
 * Tem todos os campos de DocumentSnapshot mas com tipos JSON-compatíveis.
 */
export interface SerializedDocumentSnapshot {
  documentId: string;
  document: {
    id: string;
    title: string;
    content: string;
  };
  operationCount: number;
  createdAt: string;
  updatedAt: string;
  vectorClockMap: ClockMap;
}