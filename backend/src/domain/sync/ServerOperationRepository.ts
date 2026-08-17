import type { Operation } from "../operations/Operation.js";

/**
 * Abstração para armazenamento de operações no servidor.
 *
 * Responsabilidades:
 * - Armazenar operações recebidas dos clientes
 * - Recuperar operações para sincronização (pull)
 * - Garantir deduplicação por operationId
 * - Suportar consulta de operações que um cliente ainda não possui
 *
 * O contrato é independente de implementação (memória, PostgreSQL, etc.).
 * A camada de sincronização não deve depender de detalhes de storage.
 */
export interface ServerOperationRepository {
  /**
   * Armazena uma operação.
   * Retorna true se foi armazenada, false se já existia (duplicata).
   */
  save(operation: Operation): Promise<boolean>;

  /**
   * Armazena múltiplas operações em lote.
   * Retorna array indicando quais foram armazenadas (true) vs duplicatas (false).
   */
  saveMany(operations: Operation[]): Promise<boolean[]>;

  /**
   * Busca uma operação pelo ID.
   */
  findById(operationId: string): Promise<Operation | null>;

  /**
   * Busca todas as operações de um documento.
   */
  findByDocumentId(documentId: string): Promise<Operation[]>;

  /**
   * Busca todas as operações no repositório.
   */
  findAll(): Promise<Operation[]>;

  /**
   * Busca operações que o cliente ainda não possui.
   *
   * O cliente informa os IDs das operações que já conhece (knownOperationIds).
   * O servidor retorna apenas operações do documento que não estão nesse conjunto.
   *
   * Isso evita enviar operações já sincronizadas e permite pull incremental.
   */
  findMissingOperations(
    documentId: string,
    knownOperationIds: string[],
  ): Promise<Operation[]>;

  /**
   * Verifica se uma operação existe.
   */
  has(operationId: string): Promise<boolean>;

  /**
   * Retorna o total de operações armazenadas para um documento.
   */
  countByDocumentId(documentId: string): Promise<number>;
}