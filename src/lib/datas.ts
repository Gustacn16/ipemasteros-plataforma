// Datas são salvas em UTC e exibidas no fuso de São Paulo.
export const FUSO_PADRAO = "America/Sao_Paulo";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_PADRAO,
  dateStyle: "short",
  timeStyle: "short",
});

export function formatarDataHora(data: Date): string {
  return formatoDataHora.format(data);
}
