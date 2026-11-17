/** Resposta não-OK do sistema: a mensagem cita só rota e status; o status decide se o lote volta à fila. */
export class ErroHttp extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
    this.name = "ErroHttp";
  }
}
