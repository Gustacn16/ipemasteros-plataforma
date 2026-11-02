import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { FiltrosVendas } from "@/modulos/comercial/componentes/filtros-vendas";
import { TabelaVendas } from "@/modulos/comercial/componentes/tabela-vendas";
import { esquemaFiltrosVendas } from "@/modulos/comercial/esquemas/venda";
import { listarCanais } from "@/modulos/comercial/servicos/canais";
import { listarProdutosParaVenda } from "@/modulos/comercial/servicos/produtos";
import { listarVendas, listarVendedores } from "@/modulos/comercial/servicos/vendas";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export const metadata: Metadata = { title: "Vendas — IPEMaster OS" };

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dataDoDia = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`));

export default async function PaginaVendas({ searchParams }: PageProps<"/comercial/vendas">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosVendas.parse({
    periodo: texto(busca.periodo),
    de: texto(busca.de),
    ate: texto(busca.ate),
    produto: texto(busca.produto),
    vendedor: texto(busca.vendedor),
    canal: texto(busca.canal),
  });

  const [{ vendas, total, intervalo, equipe }, produtos, vendedores, canais] = await Promise.all([
    listarVendas(usuario, filtros),
    listarProdutosParaVenda(),
    listarVendedores(),
    listarCanais(),
  ]);
  const canaisAtivos = canais.filter((c) => c.ativo);

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-muted-foreground text-sm">
          Vendas de {dataDoDia(intervalo.primeiroDia)} a {dataDoDia(intervalo.ultimoDia)}
          {equipe ? "" : " (só as suas)"}.
        </p>
        <FiltrosVendas
          periodo={intervalo.periodo}
          primeiroDia={intervalo.primeiroDia}
          ultimoDia={intervalo.ultimoDia}
          produtos={produtos}
          canais={canais}
          vendedores={equipe ? vendedores : null}
        />
      </div>
      {temPermissao(usuario.papel, "comercial:registrar_venda") && (
        <TabelaVendas
          vendas={vendas}
          total={total}
          mostrarVendedor={equipe}
          produtos={produtos}
          vendedores={vendedores}
          canais={canaisAtivos}
          usuario={{ id: usuario.id, nome: usuario.nome }}
          podeEscolherVendedor={temPermissao(usuario.papel, "comercial:gerenciar_vendas")}
          hoje={diaEmSaoPaulo(new Date())}
        />
      )}
    </div>
  );
}
