import type { Metadata } from "next";
import { Badge } from "@/componentes/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { papeisConvidaveis, PAPEIS, ROTULO_PAPEL, temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { listarConvitesPendentes } from "@/modulos/core/servicos/convites";
import { listarUsuarios } from "@/modulos/core/servicos/usuarios";
import { AcoesUsuario, BotaoRevogarConvite, FormularioConvite } from "./componentes";

export const metadata: Metadata = { title: "Usuários — IPEMaster OS" };

export default async function PaginaUsuarios() {
  const ator = await exigirPermissaoPagina("core:ver_usuarios");
  const [usuarios, convites] = await Promise.all([listarUsuarios(), listarConvitesPendentes()]);
  const podeGerenciar = temPermissao(ator.papel, "core:alterar_papel");
  const podeConvidar = temPermissao(ator.papel, "core:convidar_usuario");
  const convidaveis = papeisConvidaveis(ator.papel);
  const papeisAtribuiveis = PAPEIS.filter((p) => p !== "aluno");

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">Acesso ao sistema é só por convite.</p>
        </div>
        {podeConvidar && <FormularioConvite papeis={[...convidaveis]} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários ({usuarios.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Último acesso</TableHead>
                {podeGerenciar && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.nome}</p>
                    <p className="text-muted-foreground text-sm">{u.email}</p>
                  </TableCell>
                  <TableCell>{ROTULO_PAPEL[u.papel]}</TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "secondary" : "outline"}>{u.ativo ? "Ativo" : "Desativado"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{u.ultimoAcessoEm ? formatarDataHora(u.ultimoAcessoEm) : "—"}</TableCell>
                  {podeGerenciar && (
                    <TableCell className="text-right">
                      {u.id === ator.id ? (
                        <span className="text-muted-foreground text-sm">Você</span>
                      ) : (
                        <AcoesUsuario usuarioId={u.id} papel={u.papel} ativo={u.ativo} papeis={papeisAtribuiveis} />
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {convites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes ({convites.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convidado</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Convidado por</TableHead>
                  {podeConvidar && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {convites.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium">{c.nome}</p>
                      <p className="text-muted-foreground text-sm">{c.email}</p>
                    </TableCell>
                    <TableCell>{ROTULO_PAPEL[c.papel]}</TableCell>
                    <TableCell className="text-sm">{formatarDataHora(c.expiraEm)}</TableCell>
                    <TableCell className="text-sm">{c.convidadoPor.nome}</TableCell>
                    {podeConvidar && (
                      <TableCell className="text-right">
                        {convidaveis.includes(c.papel) && <BotaoRevogarConvite conviteId={c.id} />}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
