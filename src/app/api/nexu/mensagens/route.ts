import { NextResponse } from "next/server";
import { ErroPermissao } from "@/lib/permissoes";
import { exigirPermissao, obterUsuarioAtual } from "@/lib/sessao";
import { esquemaPergunta } from "@/modulos/nexu/esquemas/pergunta";
import { executarPergunta } from "@/modulos/nexu/servicos/executar-pergunta";
import type { EventoNexu } from "@/modulos/nexu/tipos";

export const dynamic = "force-dynamic";

const MENSAGEM_INDISPONIVEL = "O Nexu está indisponível agora, tente de novo em instantes.";

/** Conversa com o Nexu: responde em SSE, um `data: <JSON EventoNexu>` por evento. */
export async function POST(request: Request) {
  if (!(await obterUsuarioAtual())) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  let ator;
  try {
    ator = await exigirPermissao("nexu:usar");
  } catch (e) {
    if (e instanceof ErroPermissao) return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
    throw e;
  }

  const corpo: unknown = await request.json().catch(() => null);
  const dados = esquemaPergunta.safeParse(corpo);
  if (!dados.success) return NextResponse.json({ erro: "Pergunta inválida." }, { status: 400 });

  // request.signal dispara quando a pessoa sai da página ou fecha a aba: corta a chamada à API (o uso já gasto é registrado).
  const geracao = executarPergunta({
    ator,
    conversaId: dados.data.conversaId,
    pergunta: dados.data.pergunta,
    tela: dados.data.tela,
    sinal: request.signal,
  });
  const codificador = new TextEncoder();
  const linha = (evento: EventoNexu) => codificador.encode(`data: ${JSON.stringify(evento)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controle) {
      try {
        const { done, value } = await geracao.next();
        if (done) controle.close();
        else controle.enqueue(linha(value));
      } catch (e) {
        // Só o nome do erro: nunca a mensagem nem a pilha (podem conter dados pessoais).
        console.error("[nexu] falha na conversa:", e instanceof Error ? e.name : "desconhecido");
        controle.enqueue(linha({ tipo: "erro", mensagem: MENSAGEM_INDISPONIVEL }));
        controle.close();
      }
    },
    // Cliente desconectou: fechar o gerador aborta a chamada à API.
    async cancel() {
      await geracao.return(undefined).catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
