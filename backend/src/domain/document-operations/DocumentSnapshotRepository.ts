import type { DocumentSnapshot } from "../../types/sync.js";

/**
 * Abstração para persistência de snapshots de documento.
 *
 * Responsabilidades:
 * - Armazenar snapshots de documento (um por documentId)
 * - Recuperar snapshots por documentId
 * - Garantir deduplicação por documentId com lógica de updatedAt
 *
 * A implementação é independente de SQLite, arquivo, etc.
 * O domínio não deve depender da implementação concreta.
 *
 * Os snapshots devem ser persistidos de forma que possam ser
 * reconstruídos exatamente como eram originalmente.
 */
export interface DocumentSnapshotRepository {
  /**
   * Salva um snapshot no repositório.
   * Se o documentId já existe:
   * - substitui somente se o novo updatedAt for mais recente
   * - se updatedAt for igual, mantém o existente
   * - se updatedAt for mais antigo, mantém o existente
   */
  save(snapshot: DocumentSnapshot): Promise<void>;

  /**
   * Salva múltiplos snapshots em lote.
   * Aplica a mesma lógica de deduplicação por documentId com updatedAt.
   */
  saveMany(snapshots: readonly DocumentSnapshot[]): Promise<void>;

  /**
   * Encontra um snapshot pelo documentId.
   * Retorna undefined se não encontrado.
   */
  getByDocumentId(documentId: string): Promise<DocumentSnapshot | undefined>;

  /**
   * Encontra todos os snapshots no repositório.
   */
  getAll(): Promise<readonly DocumentSnapshot[]>;

  /**
   * Verifica se um snapshot (por documentId) existe no repositório.
   */
  has(documentId: string): Promise<boolean>;

  /**
   * Retorna o número total de snapshots no repositório.
   */
  count(): Promise<number>;

  /**
   * Deleta um snapshot pelo documentId.
   */
  delete(documentId: string): Promise<void>;
}