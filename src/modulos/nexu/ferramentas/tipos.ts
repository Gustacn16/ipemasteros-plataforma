import type { z } from "zod";
import type { Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

/** Uma ferramenta que o Nexu pode chamar (Claude tool use). Sempre roda como a pessoa logada. */
export type FerramentaNexu<E extends z.ZodType = z.ZodType> = {
  nome: string;
  descricao: string;
  entrada: E;
  permissao: Permissao;
  /** Texto mostrado na tela enquanto a ferramenta roda ("Consultando tarefas…"). */
  rotulo: string;
  tipo: "consulta" | "proposta";
  executar(ator: UsuarioAtual, entrada: z.infer<E>, ctx: { conversaId: string; toolUseId: string }): Promise<unknown>;
};
