import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirUsuario } from "@/lib/sessao";

export const metadata: Metadata = { title: "Início — IPEMaster OS" };

const MODULOS = [
  { nome: "Tarefas", descricao: "Espaços, listas e quadros no estilo ClickUp.", fase: "F1" },
  { nome: "Acadêmico", descricao: "Turmas, aulas, presença por QR code e avaliações.", fase: "F2" },
  { nome: "Agenda", descricao: "Seu Google Agenda junto com aulas e tarefas.", fase: "F3" },
  { nome: "Conteúdo", descricao: "Calendário editorial e publicação nos canais.", fase: "F4–F5" },
  { nome: "Dashboard", descricao: "Investimento em mídia, vendas e conversões.", fase: "F6" },
];

export default async function PaginaInicio({ searchParams }: PageProps<"/inicio">) {
  const usuario = await exigirUsuario();
  const { erro } = await searchParams;

  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {usuario.nome.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Os módulos abaixo serão liberados ao longo das próximas fases.</p>
      </div>
      {erro === "sem-permissao" && (
        <Alert variant="destructive">
          <AlertDescription>Você não tem permissão para acessar aquela página.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((modulo) => (
          <Card key={modulo.nome}>
            <CardHeader>
              <CardTitle>{modulo.nome}</CardTitle>
              <CardDescription>
                {modulo.descricao} <span className="whitespace-nowrap">· Fase {modulo.fase}</span>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
