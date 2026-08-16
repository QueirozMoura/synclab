import { ClockOrdering, type ClockMap } from "./types.js";

/**
 * Implementação simples de Vector Clock.
 *
 * Um Vector Clock mapeia cada deviceId conhecido a um contador lógico.
 * Permite ordenar eventos parcialmente e detectar concorrência.
 *
 * Não é um CRDT por si só — é uma primitiva usada pelo Operation Log
 * e futuramente pelo Sync Engine para decidir a ordem de aplicação de operações.
 */
export class VectorClock {
  private readonly clock: ClockMap;

  private constructor(clock: ClockMap) {
    // Cópia defensiva + congelamento para garantir imutabilidade em runtime
    this.clock = Object.freeze({ ...clock });
  }

  /**
   * Cria um Vector Clock vazio.
   */
  static create(): VectorClock {
    return new VectorClock({});
  }

  /**
   * Cria um Vector Clock a partir de um mapa existente (cópia defensiva).
   */
  static from(map: ClockMap): VectorClock {
    return new VectorClock(map);
  }

  /**
   * Incrementa o contador lógico de um dispositivo.
   * Retorna uma NOVA instância (imutável).
   */
  increment(deviceId: string): VectorClock {
    const next: ClockMap = { ...this.clock };
    next[deviceId] = (next[deviceId] ?? 0) + 1;
    return new VectorClock(next);
  }

  /**
   * Retorna o contador lógico de um dispositivo (0 se ausente).
   */
  get(deviceId: string): number {
    return this.clock[deviceId] ?? 0;
  }

  /**
   * Faz merge (pointwise max) com outro Vector Clock.
   * Retorna uma NOVA instância (imutável).
   */
  merge(other: VectorClock): VectorClock {
    const allKeys = new Set([
      ...Object.keys(this.clock),
      ...Object.keys(other.clock),
    ]);

    const merged: ClockMap = {};
    for (const key of allKeys) {
      merged[key] = Math.max(this.get(key), other.get(key));
    }
    return new VectorClock(merged);
  }

  /**
   * Compara causalmente este clock com outro.
   *
   * Regras:
   * - Se todos os contadores de A são ≤ B e pelo menos um é <, então A → B (BEFORE)
   * - Se todos os contadores de A são ≥ B e pelo menos um é >, então B → A (AFTER)
   * - Se todos os contadores são iguais, então A ≡ B (EQUAL)
   * - Caso contrário, são concorrentes (CONCURRENT)
   */
  compare(other: VectorClock): ClockOrdering {
    const allKeys = new Set([
      ...Object.keys(this.clock),
      ...Object.keys(other.clock),
    ]);

    let thisLess = false;
    let thisGreater = false;

    for (const key of allKeys) {
      const a = this.get(key);
      const b = other.get(key);
      if (a < b) thisLess = true;
      if (a > b) thisGreater = true;
    }

    if (thisLess && thisGreater) return ClockOrdering.CONCURRENT;
    if (thisLess) return ClockOrdering.BEFORE;
    if (thisGreater) return ClockOrdering.AFTER;
    return ClockOrdering.EQUAL;
  }

  /**
   * Verifica se este clock aconteceu antes do outro (relação "happened-before").
   */
  isBefore(other: VectorClock): boolean {
    return this.compare(other) === ClockOrdering.BEFORE;
  }

  /**
   * Verifica se este clock é concorrente com outro.
   */
  isConcurrentWith(other: VectorClock): boolean {
    return this.compare(other) === ClockOrdering.CONCURRENT;
  }

  /**
   * Verifica se este clock é causalmente equivalente a outro.
   */
  equals(other: VectorClock): boolean {
    return this.compare(other) === ClockOrdering.EQUAL;
  }

  /**
   * Retorna uma cópia do mapa interno (para serialização).
   */
  toMap(): ClockMap {
    return { ...this.clock };
  }

  /**
   * Representação em string para debug.
   */
  toString(): string {
    const entries = Object.entries(this.clock)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    return `VC{${entries}}`;
  }
}
