/**
 * Resultado da comparação causal entre dois Vector Clocks.
 *
 * - BEFORE:  A aconteceu antes de B (A → B)
 * - AFTER:   A aconteceu depois de B (B → A)
 * - EQUAL:   A e B são causalmente equivalentes
 * - CONCURRENT: A e B são concorrentes (nenhum aconteceu antes do outro)
 */
export enum ClockOrdering {
  BEFORE = "before",
  AFTER = "after",
  EQUAL = "equal",
  CONCURRENT = "concurrent",
}

/**
 * Representação interna de um Vector Clock.
 * Mapeia deviceId → contador lógico.
 */
export type ClockMap = Record<string, number>;
