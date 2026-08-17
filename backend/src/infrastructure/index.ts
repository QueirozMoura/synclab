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
