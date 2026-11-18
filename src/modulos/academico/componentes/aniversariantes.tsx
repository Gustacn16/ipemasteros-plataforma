import { CakeIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { linkWhatsapp, type Aniversario } from "../regras/aniversarios";

const ROTULO_TIPO = { aluno: "Aluno", professor: "Professor" } as const;
const ficha = (a: Aniversario) => `/academico/${a.tipo === "aluno" ? "alunos" : "professores"}/${a.id}`;
const diaMes = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Nome do mês de um dia "aaaa-mm-dd", ex.: "novembro". */
export const nomeDoMes = (dia: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`));

/**
 * Lista de aniversariantes com botão do WhatsApp. Sem ninguém e sem `vazio`, não aparece.
 */
export function CartaoAniversariantes({ titulo, itens, vazio }: { titulo: string; itens: Aniversario[]; vazio?: string }) {
  if (itens.length === 0 && !vazio) return null;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CakeIcon className="size-4" aria-hidden /> {titulo}
          {itens.length > 0 && <span className="text-muted-foreground text-sm font-normal tabular-nums">{itens.length}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vazio}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {itens.map((a) => {
              const whatsapp = linkWhatsapp(a.telefone);
              return (
                <li key={`${a.tipo}-${a.id}`} className={`flex items-center gap-3 px-3 py-2 ${a.hoje ? "bg-primary/5" : ""}`}>
                  <span className="text-muted-foreground w-11 shrink-0 text-sm tabular-nums">{diaMes(a.dia)}</span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <Link href={ficha(a)} className="truncate text-sm font-medium hover:underline">
                      {a.nome}
                    </Link>
                    <span className="flex flex-wrap gap-1">
                      <ChipSituacao tom={a.tipo === "professor" ? "informacao" : "neutro"} tamanho="sm">
                        {ROTULO_TIPO[a.tipo]}
                      </ChipSituacao>
                      {a.hoje && (
                        <ChipSituacao tom="sucesso" icone={CakeIcon} tamanho="sm">
                          Hoje
                        </ChipSituacao>
                      )}
                    </span>
                  </span>
                  {whatsapp && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${a.nome}`}>
                        <MessageCircleIcon /> <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
