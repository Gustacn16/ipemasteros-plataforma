import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilaEventos } from "./fila-eventos.ts";
import type { EventoMotor } from "./tipos.ts";

const sinal = (n: number): EventoMotor => ({ tipo: "sinal", conectados: [`n${n}`] });

describe("FilaEventos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("envia em lote assim que chega a 100 eventos", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar);
    for (let i = 0; i < 99; i++) fila.adicionar(sinal(i));
    expect(enviar).not.toHaveBeenCalled();
    fila.adicionar(sinal(99));
    await vi.advanceTimersByTimeAsync(0);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toHaveLength(100);
    fila.parar();
  });

  it("envia o que houver a cada intervalo", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar);
    fila.adicionar(sinal(1));
    await vi.advanceTimersByTimeAsync(2999);
    expect(enviar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(enviar).toHaveBeenCalledWith([sinal(1)]);
    // Fila vazia: não envia nada.
    await vi.advanceTimersByTimeAsync(3000);
    expect(enviar).toHaveBeenCalledTimes(1);
    fila.parar();
  });

  it("devolve os eventos à fila quando o envio falha e reenvia na próxima vez", async () => {
    const enviar = vi
      .fn(async (_eventos: EventoMotor[]) => {})
      .mockRejectedValueOnce(new Error("fora do ar"));
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fila = new FilaEventos(enviar, { intervaloMs: 1000 });
    fila.adicionar(sinal(1));
    await vi.advanceTimersByTimeAsync(1000);
    expect(enviar).toHaveBeenCalledTimes(1);
    fila.adicionar(sinal(2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[1][0]).toEqual([sinal(1), sinal(2)]);
    expect(aviso).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
    fila.parar();
  });

  it("mantém só o qr mais novo de cada vaga", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar);
    fila.adicionar({ tipo: "qr", numeroId: "a", qr: "velho" });
    fila.adicionar({ tipo: "qr", numeroId: "b", qr: "outra-vaga" });
    fila.adicionar({ tipo: "qr", numeroId: "a", qr: "novo" });
    await fila.esvaziar();
    expect(enviar).toHaveBeenCalledWith([
      { tipo: "qr", numeroId: "b", qr: "outra-vaga" },
      { tipo: "qr", numeroId: "a", qr: "novo" },
    ]);
    fila.parar();
  });
});
