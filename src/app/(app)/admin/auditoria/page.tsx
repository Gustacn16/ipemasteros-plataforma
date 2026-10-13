import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { listarLogs } from "@/modulos/core/servicos/auditoria";

export const metadata: Metadata = { title: "Auditoria — IPEMaster OS" };

const ROTULO_ACAO: Record<string, string> = {
  "auth.login": "Entrou no sistema",
  "auth.logout": "Saiu do sistema",
  "auth.primeiro_acesso": "Primeiro acesso (admin criado)",
  "auth.senha_redefinida": "Redefiniu a senha",
  "usuario.convidado": "Convidou usuário",
  "usuario.convite_revogado": "Revogou convite",
  "usuario.convite_aceito": "Aceitou convite",
  "usuario.papel_alterado": "Alterou papel",
  "usuario.desativado": "Desativou usuário",
  "usuario.reativado": "Reativou usuário",
};

export default async function PaginaAuditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  const ator = await exigirPermissaoPagina("core:ver_auditoria");
  const params = await searchParams;
  const acao = typeof params.acao === "string" && params.acao in ROTULO_ACAO ? params.acao : undefined;
  const pagina = Number(params.pagina) || 1;
  const { logs, total, totalPaginas } = await listarLogs(ator, { acao, pagina });

  const link = (p: number) => `/admin/auditoria?${new URLSearchParams({ ...(acao ? { acao } : {}), pagina: String(p) })}`;

  return (
    <div className="grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground">
          {ator.papel === "admin" ? "Todas as ações registradas." : "Ações registradas feitas por você."} Registros não
          podem ser editados nem apagados.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/admin/auditoria">
        <label className="grid gap-1.5 text-sm">
          Ação
          <select name="acao" defaultValue={acao ?? ""} className="bg-background h-8 rounded-md border px-2">
            <option value="">Todas</option>
            {Object.entries(ROTULO_ACAO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="bg-primary text-primary-foreground h-8 rounded-md px-3 text-sm">
          Filtrar
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
          <CardDescription>{total} no total</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    Nenhum registro.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatarDataHora(log.criadoEm)}</TableCell>
                  <TableCell className="text-sm">{log.usuario?.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm">{ROTULO_ACAO[log.acao] ?? log.acao}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate font-mono text-xs">
                    {log.diff ? JSON.stringify(log.diff) : `${log.entidade}${log.entidadeId ? ` · ${log.entidadeId}` : ""}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{log.ip ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPaginas > 1 && (
            <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
              {pagina > 1 ? <Link href={link(pagina - 1)} className="underline">← Anterior</Link> : <span />}
              <span className="text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas ? <Link href={link(pagina + 1)} className="underline">Próxima →</Link> : <span />}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
