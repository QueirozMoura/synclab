import type { DocumentAuthorizationRepository } from "@domain/auth/DocumentAuthorizationRepository.js";

/**
 * Implementação em memória de DocumentAuthorizationRepository.
 *
 * Usada para desenvolvimento e testes. Permite configurar
 * quais clientes têm acesso a quais documentos.
 *
 * Não persistente - dados são perdidos ao reiniciar.
 */
export class InMemoryDocumentAuthorizationRepository implements DocumentAuthorizationRepository {
  private readonly permissions: Map<string, Set<string>> = new Map();

  /**
   * Cria o repositório com permissões iniciais opcionais.
   *
   * @param initialPermissions - Array de tuplas [clientId, documentId[]]
   */
  constructor(initialPermissions: Array<[string, string[]]> = []) {
    for (const [clientId, documentIds] of initialPermissions) {
      this.grantAccess(clientId, documentIds);
    }
  }

  /**
   * Concede acesso a um ou mais documentos para um cliente.
   */
  grantAccess(clientId: string, documentIds: string | string[]): void {
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];

    let clientPermissions = this.permissions.get(clientId);
    if (!clientPermissions) {
      clientPermissions = new Set();
      this.permissions.set(clientId, clientPermissions);
    }

    for (const documentId of ids) {
      clientPermissions.add(documentId);
    }
  }

  /**
   * Revoga acesso a um documento para um cliente.
   */
  revokeAccess(clientId: string, documentId: string): boolean {
    const clientPermissions = this.permissions.get(clientId);
    if (!clientPermissions) {
      return false;
    }
    return clientPermissions.delete(documentId);
  }

  /**
   * Remove todas as permissões de um cliente.
   */
  removeClient(clientId: string): boolean {
    return this.permissions.delete(clientId);
  }

  /**
   * Verifica se o cliente tem acesso ao documento.
   */
  async canAccessDocument(clientId: string, documentId: string): Promise<boolean> {
    const clientPermissions = this.permissions.get(clientId);
    if (!clientPermissions) {
      return false;
    }
    return clientPermissions.has(documentId);
  }

  /**
   * Lista todos os documentos aos quais um cliente tem acesso.
   */
  getClientDocuments(clientId: string): string[] {
    const clientPermissions = this.permissions.get(clientId);
    if (!clientPermissions) {
      return [];
    }
    return Array.from(clientPermissions);
  }

  /**
   * Verifica se um cliente tem alguma permissão configurada.
   */
  hasClient(clientId: string): boolean {
    return this.permissions.has(clientId);
  }
}