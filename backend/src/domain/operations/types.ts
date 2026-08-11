/**
 * Tipos de operação suportados pelo SyncLab.
 *
 * O design é extensível: novos tipos podem ser adicionados
 * sem alterar a estrutura base de Operation.
 *
 * Por enquanto, apenas INSERT é implementado para evitar complexidade
 * desnecessária. DELETE e UPDATE serão adicionados quando o CRDT
 * precisar deles.
 */
export enum OperationType {
  INSERT = "INSERT",
}

/**
 * Payload de uma operação INSERT.
 * Representa a inserção de conteúdo em uma posição do documento.
 */
export interface InsertPayload {
  /** Posição (índice) onde inserir o conteúdo. */
  position: number;
  /** Conteúdo textual a ser inserido. */
  content: string;
}

/**
 * Union type dos payloads possíveis.
 * Futuramente: InsertPayload | DeletePayload | UpdatePayload
 */
export type OperationPayload = InsertPayload;
