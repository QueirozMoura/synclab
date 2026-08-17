import type { Operation } from "./Operation.js";

/**
 * Abstração para persistência de operações.
 *
 * Responsabilidades:
 * - Armazenar operações
 * - Recuperar operações por critérios
 * - Garantir deduplicação (mesma operação salva 2x = 1 operação)
 *
 * A implementação é independente de SQLite, arquivo, etc.
 * O domínio não deve depender da implementação concreta.
 *
 * As operações devem ser persistidas de forma que possam ser
 * reconstruídas exatamente como eram originalmente.
 */
export interface OperationRepository {
  /**
   * Salva uma operação no repositório.
   * Se a operação já existe (mesmo ID), não cria duplicata.
   */
  save(operation: Operation): Promise<void>;

  /**
   * Salva múltiplas operações em lote.
   * Idempotente: duplicatas são ignoradas.
   */
  saveMany(operations: Operation[]): Promise<void>;

  /**
   * Encontra uma operação pelo ID.
   * Retorna null se não encontrada.
   */
  findById(operationId: string): Promise<Operation | null>;

  /**
   * Encontra todas as operações de um documento.
   * Retorna array vazio se nenhuma encontrada.
   */
  findByDocumentId(documentId: string): Promise<Operation[]>;

  /**
   * Encontra todas as operações no repositório.
   */
  findAll(): Promise<Operation[]>;

  /**
   * Verifica se uma operação (por ID) existe no repositório.
   */
  has(operationId: string): Promise<boolean>;
}
