import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { formatarNota } from "../regras/avaliacao";
import { ROTULO_TIME } from "../regras/time";
import type { Panorama } from "../servicos/visao-geral";

const LINK = "underline-offset-4 hover:underline";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function corDoEstado(estado: string): string {
  if (estado === "conectado") return "bg-green-500";
  if (estado === "erro" || estado === "motor_sem_resposta") return "bg-red-500";
  return "bg-amber-500";
}

const formatoEnvio = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** `diaAvaliado` é uma data de calendário (meia-noite UTC do dia de São Paulo): formatar em UTC, não em São Paulo. */
function diaMes(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

/** "(há N dias)", "(há N horas)" ou "(há poucos minutos)"; vazio se `desde` é nulo ou está no futuro. */
export function haQuantoTempo(desde: Date | null, agora: Date): string {
  if (!desde) return "";
  const min = Math.floor((agora.getTime() - desde.getTime()) / 60000);
  if (min < 0) return "";
  if (min < 60) return "(há poucos minutos)";
  const horas = Math.floor(min / 60);
  if (horas < 24) return `(há ${plural(horas, "hora", "horas")})`;
  return `(há ${plural(Math.floor(horas / 24), "dia", "dias")})`;
}

export function VisaoGeral({ panorama, agora = new Date() }: { panorama: Panorama; agora?: Date }) {
  const { numeros, oportunidades, atencao, numerosFalhou, avisos } = panorama;
  const nada =
    !numerosFalhou &&
    !avisos?.falhou &&
    !avisos?.rascunhos &&
    !atencao.semRespostaFalhou &&
    atencao.semRespostaAgora === 0 &&
    !atencao.csAguardando &&
    atencao.desconectados === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Números</CardTitle>
        </CardHeader>
        <CardContent>
          {numerosFalhou ? (
            <p className="text-muted-foreground text-sm">Não foi possível carregar os números agora.</p>
          ) : numeros.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum número cadastrado.{" "}
              <Link href="/whatsapp/numeros" className="underline underline-offset-4">
                Ir para Números
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {numeros.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/whatsapp/atendimento?numero=${n.id}`}
                    className="hover:bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-1 px-1 py-3 text-sm"
                  >
                    <span className="min-w-40">
                      <span className="block font-medium">{n.nome}</span>
                      <span className="text-muted-foreground block text-xs">
                        {ROTULO_TIME[n.time]}
                        {n.dono ? ` · ${n.dono}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={`size-2.5 rounded-full ${corDoEstado(n.estado)}`} />
                      {n.rotulo}
                      {n.estado !== "conectado" && n.desde && (
                        <span className="text-muted-foreground">{haQuantoTempo(n.desde, agora)}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {plural(n.conversasSemana, "conversa", "conversas")} na semana
                    </span>
                    <span className={n.semRespostaAgora > 0 ? "font-medium text-red-600" : "text-muted-foreground"}>
                      {n.semRespostaAgora} sem resposta agora
                    </span>
                    <span className="text-muted-foreground">Nota IA: {formatarNota(n.notaDecimos)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {avisos && (
        <Card>
          <CardHeader>
            <CardTitle>Próximos envios</CardTitle>
            <CardDescription>Avisos aprovados para os grupos nos próximos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {avisos.falhou ? (
              <p className="text-muted-foreground text-sm">Não foi possível carregar os avisos agora.</p>
            ) : avisos.proximos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum envio aprovado para os próximos 7 dias.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {avisos.proximos.map((a) => (
                  <li key={a.id}>
                    <Link href="/whatsapp/avisos" className={LINK}>
                      {formatoEnvio.format(a.agendadoPara)} · {a.titulo} → {plural(a.grupos, "grupo", "grupos")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades</CardTitle>
          {oportunidades && "diaAvaliado" in oportunidades && (
            <CardDescription>Avaliados em {diaMes(oportunidades.diaAvaliado)}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {oportunidades === null ? (
            <p className="text-muted-foreground text-sm">Não foi possível carregar as avaliações</p>
          ) : "semAvaliacoes" in oportunidades ? (
            <p className="text-muted-foreground text-sm">Sem avaliações de ontem</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              <li>
                <Link href="/whatsapp/leads?temperatura=quente" className={LINK}>
                  {plural(oportunidades.quentes, "lead quente", "leads quentes")} em aberto
                </Link>
              </li>
              <li>
                <Link href="/whatsapp/leads?temperatura=morno" className={LINK}>
                  {plural(oportunidades.mornos, "lead morno", "leads mornos")} em aberto
                </Link>
              </li>
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pontos de atenção</CardTitle>
        </CardHeader>
        <CardContent>
          {nada ? (
            <p className="text-muted-foreground text-sm">Nada pedindo atenção agora</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              <li>
                <Link href="/whatsapp/atendimento" className={LINK}>
                  {atencao.semRespostaFalhou
                    ? "Não foi possível conferir as conversas sem resposta"
                    : plural(atencao.semRespostaAgora, "conversa sem resposta agora", "conversas sem resposta agora")}
                </Link>
              </li>
              {atencao.csAguardando !== null && (
                <li>
                  <Link href="/whatsapp/cs" className={LINK}>
                    {plural(
                      atencao.csAguardando,
                      "aluno esperando o 1º contato da CS",
                      "alunos esperando o 1º contato da CS",
                    )}
                  </Link>
                </li>
              )}
              {avisos && (avisos.falhou || avisos.rascunhos > 0) && (
                <li>
                  <Link href="/whatsapp/avisos" className={LINK}>
                    {avisos.falhou
                      ? "Não foi possível conferir os avisos esperando aprovação"
                      : plural(avisos.rascunhos, "aviso esperando aprovação", "avisos esperando aprovação")}
                  </Link>
                </li>
              )}
              <li>
                <Link href="/whatsapp/numeros" className={LINK}>
                  {plural(atencao.desconectados, "número desconectado", "números desconectados")}
                </Link>
              </li>
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
