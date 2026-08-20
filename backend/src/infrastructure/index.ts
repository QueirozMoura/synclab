/**
 * Camada de infraestrutura do SyncLab.
 *
 * Esta camada implementa padrões técnicos para persistência, cache, etc.
 * O domínio não depende desta camada - é uma dependência reversa.
 *
 * Exporta as implementações concretas que serão injetadas no domínio.
 */

export { SqliteOperationRepository } from "./persistence/sqlite/SqliteOperationRepository.js";
export { SqliteFactory } from "./persistence/sqlite/SqliteFactory.js";
export { SCHEMA, QUERIES } from "./persistence/sqlite/schema.js";
export { InMemoryOperationRepository } from "./persistence/server/InMemoryOperationRepository.js";
export { PostgresOperationRepository } from "./persistence/postgres/PostgresOperationRepository.js";

export { InMemoryDocumentOperationRepository } from "./persistence/document-operations/InMemoryDocumentOperationRepository.js";
export { SqliteDocumentOperationRepository } from "./persistence/document-operations/SqliteDocumentOperationRepository.js";
export { PostgresDocumentOperationRepository } from "./persistence/document-operations/PostgresDocumentOperationRepository.js";
export { DocumentOperationSerializer } from "./persistence/document-operations/DocumentOperationSerializer.js";
export { DOCUMENT_OPERATIONS_SCHEMA, DOCUMENT_OPERATIONS_QUERIES } from "./persistence/document-operations/schema.js";

export * from "./auth/index.js";
