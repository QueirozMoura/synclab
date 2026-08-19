import { describe, it, expect } from "vitest";
import { VectorClock, ClockOrdering } from "../src/lib/vectorClock";

describe("VectorClock", () => {
  describe("create", () => {
    it("deve criar um clock vazio", () => {
      const vc = VectorClock.create();
      expect(vc.get("device-A")).toBe(0);
      expect(vc.get("device-B")).toBe(0);
    });

    it("deve criar a partir de um mapa existente (cópia defensiva)", () => {
      const map = { "device-A": 3, "device-B": 1 };
      const vc = VectorClock.from(map);

      expect(vc.get("device-A")).toBe(3);
      expect(vc.get("device-B")).toBe(1);

      map["device-A"] = 999;
      expect(vc.get("device-A")).toBe(3);
    });
  });

  describe("increment", () => {
    it("deve incrementar o contador de um dispositivo", () => {
      const vc = VectorClock.create();
      const vc1 = vc.increment("device-A");

      expect(vc1.get("device-A")).toBe(1);
      expect(vc.get("device-A")).toBe(0);
    });

    it("deve incrementar múltiplas vezes o mesmo dispositivo", () => {
      let vc = VectorClock.create();
      vc = vc.increment("device-A");
      vc = vc.increment("device-A");
      vc = vc.increment("device-A");

      expect(vc.get("device-A")).toBe(3);
    });

    it("deve incrementar dispositivos diferentes independentemente", () => {
      let vc = VectorClock.create();
      vc = vc.increment("device-A");
      vc = vc.increment("device-B");
      vc = vc.increment("device-A");

      expect(vc.get("device-A")).toBe(2);
      expect(vc.get("device-B")).toBe(1);
    });

    it("não deve mutar a instância original", () => {
      const vc = VectorClock.create();
      const vc1 = vc.increment("device-A");

      expect(vc.get("device-A")).toBe(0);
      expect(vc1.get("device-A")).toBe(1);
    });
  });

  describe("compare", () => {
    it("deve retornar EQUAL para dois clocks vazios", () => {
      const a = VectorClock.create();
      const b = VectorClock.create();
      expect(a.compare(b)).toBe(ClockOrdering.EQUAL);
    });

    it("deve retornar EQUAL para clocks com mesmos valores", () => {
      const a = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const b = VectorClock.from({ "device-A": 2, "device-B": 1 });
      expect(a.compare(b)).toBe(ClockOrdering.EQUAL);
    });

    it("deve retornar BEFORE quando A aconteceu antes de B", () => {
      const a = VectorClock.from({ "device-A": 1 });
      const b = VectorClock.from({ "device-A": 2 });
      expect(a.compare(b)).toBe(ClockOrdering.BEFORE);
    });

    it("deve retornar AFTER quando A aconteceu depois de B", () => {
      const a = VectorClock.from({ "device-A": 3 });
      const b = VectorClock.from({ "device-A": 1 });
      expect(a.compare(b)).toBe(ClockOrdering.AFTER);
    });

    it("deve retornar BEFORE quando todos os contadores são ≤ e pelo menos um é <", () => {
      const a = VectorClock.from({ "device-A": 1, "device-B": 2 });
      const b = VectorClock.from({ "device-A": 2, "device-B": 2 });
      expect(a.compare(b)).toBe(ClockOrdering.BEFORE);
    });

    it("deve retornar CONCURRENT para operações concorrentes", () => {
      const a = VectorClock.from({ "device-A": 2 });
      const b = VectorClock.from({ "device-B": 1 });
      expect(a.compare(b)).toBe(ClockOrdering.CONCURRENT);
    });

    it("deve retornar CONCURRENT quando ambos têm contadores maiores em dispositivos diferentes", () => {
      const a = VectorClock.from({ "device-A": 3, "device-B": 1 });
      const b = VectorClock.from({ "device-A": 1, "device-B": 3 });
      expect(a.compare(b)).toBe(ClockOrdering.CONCURRENT);
    });

    it("deve tratar dispositivos ausentes como 0", () => {
      const a = VectorClock.from({ "device-A": 1 });
      const b = VectorClock.from({ "device-B": 1 });
      expect(a.compare(b)).toBe(ClockOrdering.CONCURRENT);
    });

    it("deve lançar TypeError quando 'other' não é VectorClock (null)", () => {
      const a = VectorClock.from({ "device-A": 1 });
      expect(() => a.compare(null as unknown)).toThrow(TypeError);
    });

    it("deve lançar TypeError quando 'other' não é VectorClock (objeto plano)", () => {
      const a = VectorClock.from({ "device-A": 1 });
      expect(() => a.compare({ "device-A": 1 } as unknown)).toThrow(TypeError);
    });

    it("deve lançar TypeError quando 'other' não é VectorClock (array)", () => {
      const a = VectorClock.from({ "device-A": 1 });
      expect(() => a.compare([] as unknown)).toThrow(TypeError);
    });

    it("deve lançar TypeError quando 'other' não é VectorClock (string)", () => {
      const a = VectorClock.from({ "device-A": 1 });
      expect(() => a.compare("invalid" as unknown)).toThrow(TypeError);
    });
  });

  describe("isBefore / isConcurrentWith / equals", () => {
    it("isBefore deve retornar true apenas para BEFORE", () => {
      const a = VectorClock.from({ "device-A": 1 });
      const b = VectorClock.from({ "device-A": 2 });
      expect(a.isBefore(b)).toBe(true);
      expect(b.isBefore(a)).toBe(false);
    });

    it("isConcurrentWith deve retornar true apenas para CONCURRENT", () => {
      const a = VectorClock.from({ "device-A": 1 });
      const b = VectorClock.from({ "device-B": 1 });
      expect(a.isConcurrentWith(b)).toBe(true);
    });

    it("equals deve retornar true apenas para EQUAL", () => {
      const a = VectorClock.from({ "device-A": 1, "device-B": 1 });
      const b = VectorClock.from({ "device-A": 1, "device-B": 1 });
      expect(a.equals(b)).toBe(true);
    });
  });

  describe("merge", () => {
    it("deve fazer merge (pointwise max) de dois clocks", () => {
      const a = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const b = VectorClock.from({ "device-A": 1, "device-B": 3 });
      const merged = a.merge(b);

      expect(merged.get("device-A")).toBe(2);
      expect(merged.get("device-B")).toBe(3);
    });

    it("não deve mutar as instâncias originais", () => {
      const a = VectorClock.from({ "device-A": 2 });
      const b = VectorClock.from({ "device-B": 1 });
      const merged = a.merge(b);

      expect(a.get("device-B")).toBe(0);
      expect(b.get("device-A")).toBe(0);
      expect(merged.get("device-A")).toBe(2);
      expect(merged.get("device-B")).toBe(1);
    });

    it("deve incluir dispositivos de ambos os clocks", () => {
      const a = VectorClock.from({ "device-A": 5 });
      const b = VectorClock.from({ "device-B": 3, "device-C": 1 });
      const merged = a.merge(b);

      expect(merged.get("device-A")).toBe(5);
      expect(merged.get("device-B")).toBe(3);
      expect(merged.get("device-C")).toBe(1);
    });
  });

  describe("comportamento determinístico", () => {
    it("compare deve ser simétrico: se A→B então B.compare(A) = AFTER", () => {
      const a = VectorClock.from({ "device-A": 1 });
      const b = VectorClock.from({ "device-A": 2 });

      expect(a.compare(b)).toBe(ClockOrdering.BEFORE);
      expect(b.compare(a)).toBe(ClockOrdering.AFTER);
    });

    it("compare deve ser reflexivo: A.compare(A) = EQUAL", () => {
      const a = VectorClock.from({ "device-A": 5, "device-B": 3 });
      expect(a.compare(a)).toBe(ClockOrdering.EQUAL);
    });

    it("merge deve ser comutativo: merge(A,B) ≡ merge(B,A)", () => {
      const a = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const b = VectorClock.from({ "device-A": 1, "device-B": 3 });

      const mergedAB = a.merge(b);
      const mergedBA = b.merge(a);

      expect(mergedAB.equals(mergedBA)).toBe(true);
    });

    it("merge deve ser idempotente: merge(A,A) ≡ A", () => {
      const a = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const merged = a.merge(a);

      expect(merged.equals(a)).toBe(true);
    });
  });

  describe("toMap e toString", () => {
    it("toMap deve retornar uma cópia do mapa interno", () => {
      const vc = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const map = vc.toMap();

      expect(map).toEqual({ "device-A": 2, "device-B": 1 });

      map["device-A"] = 999;
      expect(vc.get("device-A")).toBe(2);
    });

    it("toString deve retornar uma representação legível", () => {
      const vc = VectorClock.from({ "device-A": 2, "device-B": 1 });
      const str = vc.toString();

      expect(str).toContain("device-A:2");
      expect(str).toContain("device-B:1");
      expect(str).toContain("VC{");
    });
  });

  describe("imutabilidade em runtime", () => {
    it("não deve permitir mutar o mapa interno por acesso adversarial", () => {
      const clock = VectorClock.from({ "device-A": 1 });

      expect(() => {
        (clock as unknown as { clock: Record<string, number> }).clock["device-A"] = 999;
      }).toThrow();
      expect(clock.get("device-A")).toBe(1);
    });
  });
});