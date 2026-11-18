import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import type { ResumoTela } from "../servicos/conversas";

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="text-sm font-medium">{titulo}</h3>
      {children}
    </section>
  );
}

/** Resumo do dia de um grupo, com o seletor de dia (formulário GET: vale sem JavaScript). */
export function ResumoGrupo({ resumo, dia, ate }: { resumo: ResumoTela | null; dia: string; ate: string }) {
  return (
    <div className="bg-card grid gap-4 rounded-xl border p-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Dia do resumo
          <Input type="date" name="dia" defaultValue={dia} max={ate} required className="w-44" />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Ver dia
        </Button>
      </form>

      {resumo?.situacao === "pendente" ? (
        <p className="text-muted-foreground text-sm">O resumo deste dia ainda está sendo preparado.</p>
      ) : !resumo || resumo.situacao === "falhou" ? (
        <p className="text-muted-foreground text-sm">Sem resumo neste dia.</p>
      ) : (
        <div className="grid gap-4">
          <Bloco titulo="Resumo">
            <p className="text-sm whitespace-pre-wrap">{resumo.resumo}</p>
          </Bloco>
          {resumo.temas.length > 0 && (
            <Bloco titulo="Temas">
              <ul className="flex flex-wrap gap-1.5">
                {resumo.temas.map((t, i) => (
                  <li key={i} className="bg-muted rounded-full px-2.5 py-0.5 text-xs">
                    {t}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
          {resumo.pendencias.length > 0 && (
            <Bloco titulo="Sem resposta">
              <ul className="grid gap-1 text-sm">
                {resumo.pendencias.map((p, i) => (
                  <li key={i}>
                    &ldquo;{p.texto}&rdquo; — {p.autor}, {p.hora}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
          {resumo.destaques.length > 0 && (
            <Bloco titulo="Destaques">
              <ul className="grid list-disc gap-1 pl-5 text-sm">
                {resumo.destaques.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </Bloco>
          )}
          {resumo.participacao.length > 0 && (
            <Bloco titulo="Quem mais falou">
              <ul className="grid gap-1 text-sm">
                {resumo.participacao.map((p, i) => (
                  <li key={i}>
                    {p.autor} — {p.mensagens} {p.mensagens === 1 ? "mensagem" : "mensagens"}
                  </li>
                ))}
              </ul>
            </Bloco>
          )}
        </div>
      )}
    </div>
  );
}
