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

/** `diaAvaliado` é uma data de calendário (meia-noite UTC do dia de São Paulo): formatar em UTC, não em São Paulo. */
function diaMes(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }).format(d);
}

export function VisaoGeral({ panorama }: { panorama: Panorama }) {
  const { numeros, oportunidades, atencao } = panorama;
  const nada = atencao.semRespostaAgora === 0 && !atencao.csAguardando && atencao.desconectados === 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Números</CardTitle>
        </CardHeader>
        <CardContent>
          {numeros.length === 0 ? (
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
                    </span>
                    <span className="text-muted-foreground">{plural(n.conversasSemana, "conversa", "conversas")} na semana</span>
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

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades</CardTitle>
          {oportunidades && <CardDescription>Avaliados em {diaMes(oportunidades.diaAvaliado)}</CardDescription>}
        </CardHeader>
        <CardContent>
          {oportunidades ? (
            <ul className="grid gap-2 text-sm">
              <li>
                <Link href="/whatsapp/leads?temperatura=quente" className={LINK}>
                  {plural(oportunidades.quentes, "lead quente", "leads quentes")}
                </Link>
              </li>
              <li>
                <Link href="/whatsapp/leads?temperatura=morno" className={LINK}>
                  {plural(oportunidades.mornos, "lead morno", "leads mornos")}
                </Link>
              </li>
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Sem avaliações de ontem</p>
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
                  {plural(atencao.semRespostaAgora, "conversa sem resposta agora", "conversas sem resposta agora")}
                </Link>
              </li>
              {atencao.csAguardando !== null && (
                <li>
                  <Link href="/whatsapp/cs" className={LINK}>
                    {plural(atencao.csAguardando, "aluno esperando o 1º contato da CS", "alunos esperando o 1º contato da CS")}
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
