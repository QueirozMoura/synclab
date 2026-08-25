/**
 * Abstração para autorização de acesso a documentos.
 *
 * Verifica se um cliente (identificado por clientId) possui
 * permissão para acessar um documento específico.
 *
 * A implementação concreta pode usar banco de dados, cache,
 * ou configuração estática para desenvolvimento.
 */
export interface DocumentAuthorizationRepository {
  /**
   * Verifica se o cliente tem acesso ao documento.
   *
   * @param clientId - ID do cliente autenticado
   * @param documentId - ID do documento a ser acessado
   * @returns true se o cliente tem acesso, false caso contrário
   */
  canAccessDocument(clientId: string, documentId: string): Promise<boolean>;
  grantAccess?(clientId: string, documentId: string): void | Promise<void>;
}