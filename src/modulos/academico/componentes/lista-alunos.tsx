"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/componentes/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { ROTULO_SITUACAO_MATRICULA, type SituacaoMatricula } from "../esquemas/academico";
import { nomeBusca } from "../regras/normalizar";

type Aluno = {
  id: string;
  nome: string;
  nomeBusca: string;
  matriculas: { id: string; situacao: SituacaoMatricula; produto: string; turma: string }[];
};

/** Lista de alunos com filtro por nome feito aqui na tela (nome de aluno não vai para a URL). */
export function ListaAlunos({ alunos }: { alunos: Aluno[] }) {
  const [busca, setBusca] = useState("");
  const [soAtivos, setSoAtivos] = useState(false);
  const filtrados = useMemo(() => {
    const termo = nomeBusca(busca);
    return alunos.filter((a) => (!termo || a.nomeBusca.includes(termo)) && (!soAtivos || a.matriculas.some((m) => m.situacao === "ativa")));
  }, [alunos, busca, soAtivos]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar aluno pelo nome"
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soAtivos} onChange={(e) => setSoAtivos(e.target.checked)} />
          Só com matrícula ativa
        </label>
        <span className="text-muted-foreground text-sm">
          {filtrados.length} de {alunos.length}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aluno</TableHead>
            <TableHead>Matrículas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link href={`/academico/alunos/${a.id}`} className="font-medium hover:underline">
                  {a.nome}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {a.matriculas.length === 0 && <span className="text-muted-foreground">—</span>}
                {a.matriculas.map((m) => (
                  <span key={m.id} className="block">
                    {m.produto} · {m.turma} <span className="text-muted-foreground">({ROTULO_SITUACAO_MATRICULA[m.situacao]})</span>
                  </span>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
