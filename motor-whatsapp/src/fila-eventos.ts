import type { EventoMotor } from "./tipos.ts";

type Opcoes = { intervaloMs?: number; tamanhoMaximo?: number };

/**
 * Junta os eventos e manda em lote para o sistema: a cada intervalo ou quando chega ao tamanho máximo.
 * Se o envio falha, os eventos voltam para o início da fila e seguem na próxima vez.
 */
export class FilaEventos {
  private fila: EventoMotor[] = [];
  private enviando: Promise<boolean> | null = null;
  private readonly tamanhoMaximo: number;
  private readonly relogio: ReturnType<typeof setInterval>;

  constructor(
    private readonly enviar: (eventos: EventoMotor[]) => Promise<void>,
    opcoes: Opcoes = {},
  ) {
    this.tamanhoMaximo = opcoes.tamanhoMaximo ?? 100;
    this.relogio = setInterval(() => void this.enviarLote(), opcoes.intervaloMs ?? 3000);
  }

  adicionar(e: EventoMotor): void {
    // QR novo substitui o antigo da mesma vaga: só o mais recente serve.
    if (e.tipo === "qr") this.fila = this.fila.filter((x) => !mesmoQr(x, e.numeroId));
    this.fila.push(e);
    if (this.fila.length >= this.tamanhoMaximo) void this.enviarLote();
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
    const lote = this.fila.splice(0, this.tamanhoMaximo);
    this.enviando = this.enviar(lote)
      .then(() => true)
      .catch((erro: unknown) => {
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
}

function mesmoQr(e: EventoMotor, numeroId: string): boolean {
  return e.tipo === "qr" && e.numeroId === numeroId;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "erro desconhecido";
}
