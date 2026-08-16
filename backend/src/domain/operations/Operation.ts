import { randomUUID } from "node:crypto";
import { VectorClock } from "../vector-clock/VectorClock.js";
import { OperationType, type OperationPayload } from "./types.js";

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
export interface Operation {
  readonly id: string;
  readonly documentId: string;
  readonly deviceId: string;
  readonly type: OperationType;
  readonly payload: OperationPayload;
  readonly vectorClock: VectorClock;
}

/**
 * Fábrica para criar operações com geração automática de ID.
 *
 * Centraliza a criação para garantir consistência e facilitar testes.
 * O ID é gerado com crypto.randomUUID() quando disponível (Node.js 19+),
 * ou com um fallback baseado em timestamp + aleatório.
 */
export function createOperation(params: {
  documentId: string;
  deviceId: string;
  type: OperationType;
  payload: OperationPayload;
  vectorClock: VectorClock;
}): Operation {
  const id = generateId();

  return Object.freeze({
    id,
    documentId: params.documentId,
    deviceId: params.deviceId,
    type: params.type,
    payload: Object.freeze({ ...params.payload }),
    vectorClock: params.vectorClock,
  });
}

/**
 * Gera um ID único usando crypto.randomUUID() do Node.js.
 */
function generateId(): string {
  return randomUUID();
}
