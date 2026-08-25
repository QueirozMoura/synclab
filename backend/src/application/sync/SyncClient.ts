import type { OperationRepository } from "#domain/operations/OperationRepository.js";
import { OperationSerializer } from "#domain/operations/OperationSerializer.js";

/**
 * Configuração do SyncClient.
 */
export interface SyncClientConfig {
  /** URL base do servidor de sincronização (ex: http://localhost:3000) */
  serverUrl: string;
  /** ID do documento a sincronizar */
  documentId: string;
  /** ID único deste dispositivo/cliente */
  deviceId: string;
  /** API Key para autenticação (opcional, para servidores que exigem auth) */
  apiKey?: string;
}

/**
 * Resultado de uma sincronização completa (push + pull).
 */
export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

/**
 * Cliente de sincronização HTTP.
 *
 * Responsabilidades:
 * - Encontrar operações locais não sincronizadas
 * - Enviar operações para o servidor (push)
 * - Receber operações remotas (pull)
 * - Persistir operações recebidas no repositório local
 * - Evitar duplicação
 * - Permitir reconstrução do CRDT após sincronização
 *
 * NÃO contém lógica de CRDT - trabalha apenas com operações.
 */
export class SyncClient {
  private readonly config: SyncClientConfig;
  private readonly localRepository: OperationRepository;
  private readonly serializer = new OperationSerializer();

  constructor(config: SyncClientConfig, localRepository: OperationRepository) {
    this.config = config;
    this.localRepository = localRepository;
  }

  /**
   * Executa uma sincronização completa: push + pull.
   */
  async sync(): Promise<SyncResult> {
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;

    try {
      pushed = await this.push();
    } catch (error) {
      errors.push(`Push failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      pulled = await this.pull();
    } catch (error) {
      errors.push(`Pull failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { pushed, pulled, errors };
  }

  /**
   * Cabeçalhos HTTP padrão incluindo autenticação se configurada.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  /**
   * Envia operações locais para o servidor.
   * O servidor deduplica por operationId, então é seguro enviar todas.
   * Retorna o número de operações aceitas pelo servidor.
   */
  async push(): Promise<number> {
    const localOps = await this.localRepository.findByDocumentId(this.config.documentId);

    if (localOps.length === 0) {
      return 0;
    }

    const serialized = localOps.map((op) => this.serializer.serialize(op));

    const response = await fetch(`${this.config.serverUrl}/sync/push`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ operations: serialized }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push failed with status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      accepted: string[];
      rejected: Array<{ operationId: string; reason: string }>;
    };

    return result.accepted.length;
  }

  /**
   * Busca operações remotas que o cliente ainda não possui.
   * Persiste as operações recebidas no repositório local.
   * Retorna o número de operações recebidas.
   */
  async pull(): Promise<number> {
    const localOps = await this.localRepository.findByDocumentId(this.config.documentId);
    const knownIds = localOps.map((op) => op.id);

    const params = new URLSearchParams();
    params.set("documentId", this.config.documentId);
    if (knownIds.length > 0) {
      params.set("knownOperationIds", knownIds.join(","));
    }

    const response = await fetch(`${this.config.serverUrl}/sync/pull?${params.toString()}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pull failed with status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      operations: ReturnType<OperationSerializer["serialize"]>[];
      hasMore: boolean;
    };

    if (result.operations.length === 0) {
      return 0;
    }

    const operations = result.operations.map((serialized) => this.serializer.deserialize(serialized));

    await this.localRepository.saveMany(operations);

    return operations.length;
  }

  /**
   * Força push de todas as operações locais (ignora verificação de sincronizadas).
   * Útil para primeira sincronização ou recuperação.
   */
  async pushAll(): Promise<number> {
    const localOps = await this.localRepository.findByDocumentId(this.config.documentId);

    if (localOps.length === 0) {
      return 0;
    }

    const serialized = localOps.map((op) => this.serializer.serialize(op));

    const response = await fetch(`${this.config.serverUrl}/sync/push`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ operations: serialized }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Push failed with status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as { accepted: string[] };
    return result.accepted.length;
  }

  /**
   * Força pull de todas as operações do servidor.
   * Útil para primeira sincronização ou reconstrução completa.
   */
  async pullAll(): Promise<number> {
    const params = new URLSearchParams();
    params.set("documentId", this.config.documentId);

    const response = await fetch(`${this.config.serverUrl}/sync/pull?${params.toString()}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pull failed with status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      operations: ReturnType<OperationSerializer["serialize"]>[];
      hasMore: boolean;
    };

    if (result.operations.length === 0) {
      return 0;
    }

    const operations = result.operations.map((serialized) => this.serializer.deserialize(serialized));

    await this.localRepository.saveMany(operations);

    return operations.length;
  }
}