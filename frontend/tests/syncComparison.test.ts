import { describe, it, expect } from "vitest";
import { compareSyncState } from "../src/lib/syncComparison";

describe("compareSyncState", () => {
  it("deve retornar EQUAL para dois clocks vazios", () => {
    const result = compareSyncState({}, {});
    expect(result).toBe("equal");
  });

  it("deve retornar EQUAL para clocks com mesmos valores", () => {
    const result = compareSyncState(
      { "device-A": 2, "device-B": 1 },
      { "device-A": 2, "device-B": 1 }
    );
    expect(result).toBe("equal");
  });

  it("deve retornar BEFORE quando localClock acontece antes de remoteClock", () => {
    const result = compareSyncState(
      { "device-A": 1 },
      { "device-A": 2 }
    );
    expect(result).toBe("before");
  });

  it("deve retornar AFTER quando localClock acontece depois de remoteClock", () => {
    const result = compareSyncState(
      { "device-A": 3 },
      { "device-A": 1 }
    );
    expect(result).toBe("after");
  });

  it("deve retornar BEFORE quando todos contadores são ≤ e pelo menos um é <", () => {
    const result = compareSyncState(
      { "device-A": 1, "device-B": 2 },
      { "device-A": 2, "device-B": 2 }
    );
    expect(result).toBe("before");
  });

  it("deve retornar CONCURRENT para operações concorrentes (dispositivos diferentes)", () => {
    const result = compareSyncState(
      { "device-A": 2 },
      { "device-B": 1 }
    );
    expect(result).toBe("concurrent");
  });

  it("deve retornar CONCURRENT quando ambos têm contadores maiores em dispositivos diferentes", () => {
    const result = compareSyncState(
      { "device-A": 3, "device-B": 1 },
      { "device-A": 1, "device-B": 3 }
    );
    expect(result).toBe("concurrent");
  });

  it("deve tratar dispositivos ausentes como 0", () => {
    const result = compareSyncState(
      { "device-A": 1 },
      { "device-B": 1 }
    );
    expect(result).toBe("concurrent");
  });

  it("deve funcionar com múltiplas entradas no ClockMap", () => {
    const local = { "device-A": 5, "device-B": 3, "device-C": 2 };
    const remote = { "device-A": 5, "device-B": 4, "device-C": 2 };
    const result = compareSyncState(local, remote);
    expect(result).toBe("before");
  });

  it("não deve mutar os clocks originais", () => {
    const local = { "device-A": 1 };
    const remote = { "device-A": 2 };
    const localCopy = { ...local };
    const remoteCopy = { ...remote };

    compareSyncState(local, remote);

    expect(local).toEqual(localCopy);
    expect(remote).toEqual(remoteCopy);
  });

  it("deve ser determinístico - mesma entrada sempre produz mesmo resultado", () => {
    const local = { "device-A": 2, "device-B": 1 };
    const remote = { "device-A": 1, "device-B": 3 };

    const result1 = compareSyncState(local, remote);
    const result2 = compareSyncState(local, remote);
    const result3 = compareSyncState(local, remote);

    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
    expect(result1).toBe("concurrent");
  });

  it("deve ser simétrico - se A é BEFORE que B, então B é AFTER que A", () => {
    const local = { "device-A": 1 };
    const remote = { "device-A": 2 };

    const localBeforeRemote = compareSyncState(local, remote);
    const remoteBeforeLocal = compareSyncState(remote, local);

    expect(localBeforeRemote).toBe("before");
    expect(remoteBeforeLocal).toBe("after");
  });

  it("deve ser reflexivo - clock comparado com ele mesmo é EQUAL", () => {
    const clock = { "device-A": 5, "device-B": 3 };
    const result = compareSyncState(clock, clock);
    expect(result).toBe("equal");
  });
});