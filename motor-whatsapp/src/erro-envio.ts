const ERROS_ENVIO_CONHECIDOS = new Set(["Número não está conectado.", "Destino não é um grupo."]);

/**
 * Texto de erro que o motor devolve ao site. Em `enviar_grupo` só as duas mensagens conhecidas passam;
 * o resto vira "Falha ao enviar (<nome do erro>)", porque a mensagem da Baileys pode trazer JID ou telefone.
 * Os demais comandos mantêm a mensagem (até 255 caracteres).
 */
export function textoDaFalha(tipo: string, mensagem: string, nomeDoErro: string): string {
  if (tipo !== "enviar_grupo") return mensagem.slice(0, 255);
  return ERROS_ENVIO_CONHECIDOS.has(mensagem) ? mensagem : `Falha ao enviar (${nomeDoErro})`;
}
