import { describe, expect, it, vi } from "vitest";

const deleteMany = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { conversaNexu: { deleteMany } } }));

import { limparConversasAntigas } from "./limpeza";

describe("limparConversasAntigas", () => {
  it("apaga conversas sem atividade há mais de 90 dias e devolve a contagem", async () => {
    deleteMany.mockResolvedValue({ count: 7 });
    const total = await limparConversasAntigas(new Date("2026-11-17T12:00:00Z"));
    expect(deleteMany).toHaveBeenCalledWith({ where: { atualizadoEm: { lt: new Date("2026-08-19T12:00:00Z") } } });
    expect(total).toBe(7);
  });
});
