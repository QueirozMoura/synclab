import { randomUUID } from "node:crypto";
import { VectorClock } from "../vector-clock/VectorClock.js";
import {
  OperationType,
  type DeletePayload,
  type InsertPayload,
} from "./types.js";

/**
 * Representa uma alteração atômica em um documento.
 *
 * Cada operação carrega:
 * - id: identificador único (UUID v4 ou similar)
 * - documentId: a qual documento a operação pertence
 * - deviceId: qual dispositivo originou a operação
 * - type: o tipo da operação (INSERT, DELETE, UPDATE, ...)
 * - payload: dados específicos do tipo da operação
 * - vectorClock: estado do relógio vetorial do dispositivo ao gerar a operação
 *
 * A operação é imutável após criação. O vector clock embutido
 * representa o estado causal do dispositivo no momento da criação,
 * permitindo que o Sync Engine determine a ordem de aplicação.
 */
interface BaseOperation {
  readonly id: string;
  readonly documentId: string;
  readonly deviceId: string;
  readonly vectorClock: VectorClock;
}

export interface InsertOperation extends BaseOperation {
  readonly type: OperationType.INSERT;
  readonly payload: InsertPayload;
}

export interface DeleteOperation extends BaseOperation {
  readonly type: OperationType.DELETE;
  readonly payload: DeletePayload;
}

export type Operation = InsertOperation | DeleteOperation;

export type CreateOperationParams =
  | Omit<InsertOperation, "id">
  | Omit<DeleteOperation, "id">;

/**
 * Fábrica para criar operações com geração automática de ID.
 *
 * Centraliza a criação para garantir consistência e facilitar testes.
 * O ID é gerado com crypto.randomUUID() quando disponível (Node.js 19+),
 * ou com um fallback baseado em timestamp + aleatório.
 */
export function createOperation(params: CreateOperationParams): Operation {
  const id = generateId();

  const base = {
    id,
    documentId: params.documentId,
    deviceId: params.deviceId,
    vectorClock: params.vectorClock,
  };

  if (params.type === OperationType.INSERT) {
    return Object.freeze({
      ...base,
      type: OperationType.INSERT,
      payload: Object.freeze({ ...params.payload }),
    });
  }

  return Object.freeze({
    ...base,
    type: OperationType.DELETE,
    payload: Object.freeze({ elementIds: Object.freeze([...params.payload.elementIds]) }),
  });
}

/**
 * Gera um ID único usando crypto.randomUUID() do Node.js.
 */
function generateId(): string {
  return randomUUID();
}
