import { describe, expect, it } from "vitest";
import { janelaDeOntem } from "./dia";

describe("janelaDeOntem", () => {
  it("janelaDeOntem às 02:00 UTC de 19/11 (23h do dia 18 em SP) devolve o dia 17", () => {
    const j = janelaDeOntem(new Date("2026-11-19T02:00:00Z"));
    expect(j.dia.toISOString()).toBe("2026-11-17T00:00:00.000Z");
    expect(j.inicio.toISOString()).toBe("2026-11-17T03:00:00.000Z");
    expect(j.fim.toISOString()).toBe("2026-11-18T03:00:00.000Z");
  });

  it("às 10:00 UTC de 19/11 devolve o dia 18", () => {
    const j = janelaDeOntem(new Date("2026-11-19T10:00:00Z"));
    expect(j.dia.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(j.fim.toISOString()).toBe("2026-11-19T03:00:00.000Z");
  });
});
