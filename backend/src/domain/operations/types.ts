/**
 * Tipos de operação suportados pelo SyncLab.
 *
 * O design é extensível: novos tipos podem ser adicionados
 * sem alterar a estrutura base de Operation.
 *
 * INSERT e DELETE usam identificadores estáveis de elementos, nunca índices
 * numéricos do texto visível.
 */
export enum OperationType {
  INSERT = "INSERT",
  DELETE = "DELETE",
}

/** Identificador estável de um elemento do documento. */
export type ElementId = string;

/**
 * Deriva o ID de cada caractere de uma operação. Operation ID e Element ID
 * são conceitos distintos: uma única operação INSERT pode criar vários IDs.
 */
export function createElementId(operationId: string, index: number): ElementId {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Element index must be a non-negative integer");
  }
  return `${operationId}:${index}`;
}

/**
 * Payload de uma operação INSERT.
 * Insere o conteúdo após uma âncora estável; null representa o início.
 */
export interface InsertPayload {
  /** Elemento que precede o primeiro caractere inserido, ou null no início. */
  afterId: ElementId | null;
  /** Conteúdo textual a ser inserido. */
  content: string;
}

/** Payload de DELETE baseado diretamente em IDs de elementos. */
export interface DeletePayload {
  readonly elementIds: readonly ElementId[];
}

/**
 * Union type dos payloads possíveis.
 */
export type OperationPayload = InsertPayload | DeletePayload;
