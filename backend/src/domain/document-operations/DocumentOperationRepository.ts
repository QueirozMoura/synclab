import type { DocumentOperation } from "./DocumentOperation.js";

/**
 * Abstração para persistência de operações de documento.
 *
 * Responsabilidades:
 * - Armazenar operações de documento
 * - Recuperar operações por critérios
 * - Garantir deduplicação (mesma operação salva 2x = 1 operação)
 *
 * A implementação é independente de SQLite, arquivo, etc.
 * O domínio não deve depender da implementação concreta.
 *
 * As operações devem ser persistidas de forma que possam ser
 * reconstruídas exatamente como eram originalmente.
 */
export interface DocumentOperationRepository {
  /**
   * Salva uma operação no repositório.
   * Se a operação já existe (mesmo ID), não cria duplicata.
   */
  save(operation: DocumentOperation): Promise<void>;

  /**
   * Salva múltiplas operações em lote.
   * Idempotente: duplicatas são ignoradas.
   */
  saveMany(operations: readonly DocumentOperation[]): Promise<void>;

  /**
   * Encontra uma operação pelo ID.
   * Retorna undefined se não encontrada.
   */
  getById(id: string): Promise<DocumentOperation | undefined>;

  /**
   * Encontra todas as operações de um documento.
   * Retorna array vazio se nenhuma encontrada.
   */
  getByDocumentId(documentId: string): Promise<readonly DocumentOperation[]>;

  /**
   * Encontra todas as operações no repositório.
   */
  getAll(): Promise<readonly DocumentOperation[]>;

  /**
   * Verifica se uma operação (por ID) existe no repositório.
   */
  has(id: string): Promise<boolean>;

  /**
   * Retorna o número total de operações no repositório.
   */
  count(): Promise<number>;
}