import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroHttp } from "./erro-http.ts";
import { FilaEventos } from "./fila-eventos.ts";
import type { EventoMotor, MensagemMotor } from "./tipos.ts";

const sinal = (n: number): EventoMotor => ({ tipo: "sinal", conectados: [`n${n}`] });
const mensagem = (i: number): MensagemMotor => ({
  idExterno: `m${i}`,
  jid: "1@g.us",
  deMim: true,
  tipo: "texto",
  enviadaEm: "2026-11-17T10:00:00.000Z",
});
const mensagens = (quantas: number): EventoMotor => ({
  tipo: "mensagens",
  numeroId: "a",
  origem: "historico",
  mensagens: Array.from({ length: quantas }, (_, i) => mensagem(i)),
});

describe("FilaEventos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("envia em lote assim que o peso chega a 500 (evento simples pesa 1)", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar);
    for (let i = 0; i < 499; i++) fila.adicionar(sinal(i));
    expect(enviar).not.toHaveBeenCalled();
    fila.adicionar(sinal(499));
    await vi.advanceTimersByTimeAsync(0);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0]).toHaveLength(500);
    fila.parar();
  });

  it("corta os lotes pelo peso: cada mensagem ou conversa conta", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar);
    // 7 eventos de 100 mensagens = peso 700: um POST com 5 eventos (500) e outro com 2.
    for (let i = 0; i < 7; i++) fila.adicionar(mensagens(100));
    await fila.esvaziar();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][0]).toHaveLength(5);
    expect(enviar.mock.calls[1][0]).toHaveLength(2);
    fila.parar();
  });

  it("evento mais pesado que o limite sai sozinho", async () => {
    const enviar = vi.fn(async (_eventos: EventoMotor[]) => {});
    const fila = new FilaEventos(enviar, { pesoMaximo: 50 });
    fila.adicionar(mensagens(80));
    fila.adicionar(sinal(1));
    await fila.esvaziar();
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0][0]).toHaveLength(1);
    expect(enviar.mock.calls[1][0]).toEqual([sinal(1)]);
    fila.parar();
  });

  it("descarta o lote recusado com 4xx (menos 401) e segue com o resto", async () => {
    const enviar = vi
      .fn(async (_eventos: EventoMotor[]) => {})
      .mockRejectedValueOnce(new ErroHttp("POST /x respondeu 400", 400));
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fila = new FilaEventos(enviar, { intervaloMs: 1000 });
    fila.adicionar(mensagens(3));
    await vi.advanceTimersByTimeAsync(1000);
    fila.adicionar(sinal(2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[1][0]).toEqual([sinal(2)]);
    expect(aviso).toHaveBeenCalledWith("[fila] lote de 1 evento(s) recusado (status 400); descartado");
    aviso.mockRestore();
    fila.parar();
  });

  it("401 (segredo errado) e 5xx não descartam: o lote volta para a fila", async () => {
    const enviar = vi
      .fn(async (_eventos: EventoMotor[]) => {})
      .mockRejectedValueOnce(new ErroHttp("POST /x respondeu 401", 401))
      .mockRejectedValueOnce(new ErroHttp("POST /x respondeu 503", 503));
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fila = new FilaEventos(enviar, { intervaloMs: 1000 });
    fila.adicionar(sinal(1));
    await vi.advanceTimersByTimeAsync(3000);
    expect(enviar).toHaveBeenCalledTimes(3);
    expect(enviar.mock.calls[2][0]).toEqual([sinal(1)]);
    aviso.mockRestore();
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
