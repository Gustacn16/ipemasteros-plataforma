import { ErroHttp } from "./erro-http.ts";
import type { EventoMotor } from "./tipos.ts";

type Opcoes = { intervaloMs?: number; pesoMaximo?: number };

/**
 * Junta os eventos e manda em lote para o sistema: a cada intervalo ou quando o peso chega ao máximo.
 * Peso de um evento = quantas mensagens ou conversas ele leva (os outros pesam 1), para cada POST
 * ter trabalho limitado no sistema (cerca de 500 itens).
 * Se o envio falha, os eventos voltam para o início da fila e seguem na próxima vez; lote recusado
 * pelo sistema (4xx, menos 401) é descartado, para não travar a fila para sempre.
 */
export class FilaEventos {
  private fila: EventoMotor[] = [];
  private enviando: Promise<boolean> | null = null;
  private readonly pesoMaximo: number;
  private readonly relogio: ReturnType<typeof setInterval>;

  constructor(
    private readonly enviar: (eventos: EventoMotor[]) => Promise<void>,
    opcoes: Opcoes = {},
  ) {
    this.pesoMaximo = opcoes.pesoMaximo ?? 500;
    this.relogio = setInterval(() => void this.enviarLote(), opcoes.intervaloMs ?? 3000);
  }

  adicionar(e: EventoMotor): void {
    // QR novo substitui o antigo da mesma vaga: só o mais recente serve.
    if (e.tipo === "qr") this.fila = this.fila.filter((x) => !mesmoQr(x, e.numeroId));
    this.fila.push(e);
    if (this.fila.reduce((soma, x) => soma + peso(x), 0) >= this.pesoMaximo) void this.enviarLote();
  }

  /** Manda tudo o que está na fila; para no primeiro lote que falhar. */
  async esvaziar(): Promise<void> {
    if (this.enviando) await this.enviando;
    while (this.fila.length > 0) {
      if (!(await this.enviarLote())) return;
    }
  }

  parar(): void {
    clearInterval(this.relogio);
  }

  private enviarLote(): Promise<boolean> {
    if (this.enviando) return this.enviando;
    if (this.fila.length === 0) return Promise.resolve(true);
    const lote = this.fila.splice(0, this.quantosCabem());
    this.enviando = this.enviar(lote)
      .then(() => true)
      .catch((erro: unknown) => {
        if (erro instanceof ErroHttp && erro.status >= 400 && erro.status < 500 && erro.status !== 401) {
          // Recusado pelo sistema (dado inválido): reenviar daria o mesmo erro e travaria qr e sinal atrás dele.
          // 401 é segredo errado: continua tentando até corrigirem a configuração.
          console.warn(`[fila] lote de ${lote.length} evento(s) recusado (status ${erro.status}); descartado`);
          return true;
        }
        console.warn(`[fila] falha ao enviar ${lote.length} evento(s): ${mensagem(erro)}`);
        // Devolve ao início, sem ressuscitar QR que já foi substituído por um mais novo.
        const devolver = lote.filter(
          (x) => x.tipo !== "qr" || !this.fila.some((y) => mesmoQr(y, x.numeroId)),
        );
        this.fila.unshift(...devolver);
        return false;
      })
      .finally(() => {
        this.enviando = null;
      });
    return this.enviando;
  }

  /** Quantos eventos do início da fila cabem no peso máximo (pelo menos um). */
  private quantosCabem(): number {
    let soma = 0;
    let quantos = 0;
    for (const e of this.fila) {
      soma += peso(e);
      if (quantos > 0 && soma > this.pesoMaximo) break;
      quantos++;
    }
    return quantos;
  }
}

function peso(e: EventoMotor): number {
  if (e.tipo === "mensagens") return Math.max(1, e.mensagens.length);
  if (e.tipo === "conversas") return Math.max(1, e.conversas.length);
  return 1;
}

function mesmoQr(e: EventoMotor, numeroId: string): boolean {
  return e.tipo === "qr" && e.numeroId === numeroId;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "erro desconhecido";
}
