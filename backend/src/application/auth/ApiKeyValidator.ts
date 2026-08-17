import type { AuthContext } from "@domain/auth/AuthContext.js";

/**
 * Representa uma API Key válida mapeada para um contexto de autenticação.
 */
export interface ApiKeyEntry {
  readonly apiKey: string;
  readonly clientId: string;
  readonly deviceId: string;
}

/**
 * Erro lançado quando a API Key é inválida ou não encontrada.
 */
export class InvalidApiKeyError extends Error {
  constructor(message: string = "Invalid or missing API key") {
    super(message);
    this.name = "InvalidApiKeyError";
  }
}

/**
 * Validador de API Keys.
 *
 * Responsável por:
 * - Extrair a API Key do header Authorization
 * - Validar contra o armazenamento de chaves conhecidas
 * - Retornar o AuthContext correspondente
 *
 * Implementação simples adequada para o estágio atual do projeto.
 * Não implementa rotação de chaves, expiração, ou revogação.
 */
export class ApiKeyValidator {
  private readonly keys: Map<string, ApiKeyEntry> = new Map();

  constructor(initialKeys: ApiKeyEntry[] = []) {
    for (const entry of initialKeys) {
      this.keys.set(entry.apiKey, entry);
    }
  }

  /**
   * Adiciona uma nova API Key ao validador.
   */
  addKey(entry: ApiKeyEntry): void {
    this.keys.set(entry.apiKey, entry);
  }

  /**
   * Remove uma API Key do validador.
   */
  removeKey(apiKey: string): boolean {
    return this.keys.delete(apiKey);
  }

  /**
   * Valida uma API Key e retorna o contexto de autenticação.
   *
   * @param apiKey - A API Key a ser validada (sem o prefixo "Bearer ")
   * @returns AuthContext com clientId e deviceId
   * @throws InvalidApiKeyError se a chave for inválida ou não encontrada
   */
  validate(apiKey: string): AuthContext {
    const entry = this.keys.get(apiKey);

    if (!entry) {
      throw new InvalidApiKeyError("API key not found");
    }

    return {
      clientId: entry.clientId,
      deviceId: entry.deviceId,
    };
  }

  /**
   * Extrai a API Key do header Authorization.
   *
   * Espera formato: "Bearer <api-key>"
   *
   * @param authHeader - Valor do header Authorization
   * @returns A API Key sem o prefixo "Bearer "
   * @throws InvalidApiKeyError se o header estiver ausente ou malformado
   */
  extractFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new InvalidApiKeyError("Missing Authorization header");
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new InvalidApiKeyError("Invalid Authorization header format. Expected: Bearer <api-key>");
    }

    const apiKey = parts[1];

    if (!apiKey || apiKey.length === 0) {
      throw new InvalidApiKeyError("Empty API key");
    }

    return apiKey;
  }

  /**
   * Valida uma requisição completa extraindo e validando a API Key.
   *
   * @param authHeader - Header Authorization da requisição
   * @returns AuthContext se válido
   * @throws InvalidApiKeyError se inválido
   */
  authenticate(authHeader: string | undefined): AuthContext {
    const apiKey = this.extractFromHeader(authHeader);
    return this.validate(apiKey);
  }
}