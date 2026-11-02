import { Worker } from "node:worker_threads";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ErroNegocio } from "@/lib/erros";
import { interpretarIcalIsolado } from "./ical-em-worker";

/** Worker de teste a partir de código JS (sem bundler). */
function workerDe(codigo: string): () => Worker {
  return () => new Worker(`const { parentPort } = require("node:worker_threads");\n${codigo}`, { eval: true });
}

describe("interpretarIcalIsolado", () => {
  it("devolve os eventos que o worker responde", async () => {
    const criarWorker = workerDe(`parentPort.once("message", (p) => parentPort.postMessage({ ok: true, eventos: [
      { uid: p.de + "/" + p.ate, titulo: "x", inicio: new Date(0), fim: new Date(1000), diaInteiro: false, local: null },
    ] }));`);
    const eventos = await interpretarIcalIsolado("BEGIN:VCALENDAR", "2026-11-01", "2026-11-30", { criarWorker });
    expect(eventos).toEqual([
      { uid: "2026-11-01/2026-11-30", titulo: "x", inicio: new Date(0), fim: new Date(1000), diaInteiro: false, local: null },
    ]);
  });

  it("repassa o erro de negócio do worker", async () => {
    const criarWorker = workerDe(
      `parentPort.once("message", () => parentPort.postMessage({ ok: false, mensagem: "Este endereço não é de uma agenda." }));`,
    );
    await expect(interpretarIcalIsolado("x", "2026-11-01", "2026-11-30", { criarWorker })).rejects.toThrow(
      "Este endereço não é de uma agenda.",
    );
  });

  it("worker preso num laço síncrono é encerrado no timeout", async () => {
    let worker: Worker | undefined;
    const criarWorker = () => {
      worker = workerDe(`parentPort.once("message", () => { for (;;) {} });`)();
      return worker;
    };
    const saida = new Promise<number>((r) => setTimeout(() => worker!.once("exit", r), 0));
    const comeco = Date.now();
    const erro = await interpretarIcalIsolado("x", "2026-11-01", "2026-11-30", { criarWorker, timeoutMs: 200 }).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ErroNegocio);
    expect((erro as Error).message).toBe("Não consegui interpretar esta agenda.");
    expect(Date.now() - comeco).toBeLessThan(2000);
    await expect(saida).resolves.toBeTypeOf("number");
  });

  it("worker que quebra vira erro curto", async () => {
    const criarWorker = workerDe(`parentPort.once("message", () => { throw new Error("detalhe interno"); });`);
    await expect(interpretarIcalIsolado("x", "2026-11-01", "2026-11-30", { criarWorker })).rejects.toThrow(
      "Não consegui interpretar esta agenda.",
    );
  });

  it("resposta fora do formato vira erro curto", async () => {
    const criarWorker = workerDe(`parentPort.once("message", () => parentPort.postMessage({ ok: true, eventos: "x" }));`);
    await expect(interpretarIcalIsolado("x", "2026-11-01", "2026-11-30", { criarWorker })).rejects.toThrow(
      "Não consegui interpretar esta agenda.",
    );
  });
});
