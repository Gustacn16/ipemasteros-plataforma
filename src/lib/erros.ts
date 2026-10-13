/** Erro de regra de negócio com mensagem segura para mostrar ao usuário. */
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}
