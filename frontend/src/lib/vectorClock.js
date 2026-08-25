/**
 * Resultado da comparação causal entre dois Vector Clocks.
 *
 * - BEFORE:  A aconteceu antes de B (A → B)
 * - AFTER:   A aconteceu depois de B (B → A)
 * - EQUAL:   A e B são causalmente equivalentes
 * - CONCURRENT: A e B são concorrentes (nenhum aconteceu antes do outro)
 */
export const ClockOrdering = {
    BEFORE: "before",
    AFTER: "after",
    EQUAL: "equal",
    CONCURRENT: "concurrent",
};
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
    clock;
    constructor(clock) {
        this.clock = Object.freeze({ ...clock });
    }
    /**
     * Cria um Vector Clock vazio.
     */
    static create() {
        return new VectorClock({});
    }
    /**
     * Cria um Vector Clock a partir de um mapa existente (cópia defensiva).
     */
    static from(map) {
        return new VectorClock(map);
    }
    /**
     * Incrementa o contador lógico de um dispositivo.
     * Retorna uma NOVA instância (imutável).
     */
    increment(deviceId) {
        const next = { ...this.clock };
        next[deviceId] = (next[deviceId] ?? 0) + 1;
        return new VectorClock(next);
    }
    /**
     * Retorna o contador lógico de um dispositivo (0 se ausente).
     */
    get(deviceId) {
        return this.clock[deviceId] ?? 0;
    }
    /**
     * Faz merge (pointwise max) com outro Vector Clock.
     * Retorna uma NOVA instância (imutável).
     */
    merge(other) {
        const allKeys = new Set([
            ...Object.keys(this.clock),
            ...Object.keys(other.clock),
        ]);
        const merged = {};
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
    compare(other) {
        if (!(other instanceof VectorClock)) {
            throw new TypeError("VectorClock.compare: 'other' must be a VectorClock instance");
        }
        const allKeys = new Set([
            ...Object.keys(this.clock),
            ...Object.keys(other.clock),
        ]);
        let thisLess = false;
        let thisGreater = false;
        for (const key of allKeys) {
            const a = this.get(key);
            const b = other.get(key);
            if (a < b)
                thisLess = true;
            if (a > b)
                thisGreater = true;
        }
        if (thisLess && thisGreater)
            return ClockOrdering.CONCURRENT;
        if (thisLess)
            return ClockOrdering.BEFORE;
        if (thisGreater)
            return ClockOrdering.AFTER;
        return ClockOrdering.EQUAL;
    }
    /**
     * Verifica se este clock aconteceu antes do outro (relação "happened-before").
     */
    isBefore(other) {
        return this.compare(other) === ClockOrdering.BEFORE;
    }
    /**
     * Verifica se este clock é concorrente com outro.
     */
    isConcurrentWith(other) {
        return this.compare(other) === ClockOrdering.CONCURRENT;
    }
    /**
     * Verifica se este clock é causalmente equivalente a outro.
     */
    equals(other) {
        return this.compare(other) === ClockOrdering.EQUAL;
    }
    /**
     * Retorna uma cópia do mapa interno (para serialização).
     */
    toMap() {
        return { ...this.clock };
    }
    /**
     * Representação em string para debug.
     */
    toString() {
        const entries = Object.entries(this.clock)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join(", ");
        return `VC{${entries}}`;
    }
}
