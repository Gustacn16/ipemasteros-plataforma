"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirAtivoProdutoAcao, editarProdutoAcao, excluirProdutoAcao } from "../acoes/produtos";
import { ROTULO_TIPO_PRODUTO, TIPOS_PRODUTO } from "../esquemas/produto";
import type { ProdutoDetalhe } from "../servicos/produtos";
import { estiloCampo, estiloSelect } from "./exibicao";

/** "150.00" → "150,00" para o campo de texto. */
export const valorCampo = (v: string) => v.replace(".", ",");

function AreaTexto({ rotulo, name, valor, linhas = 4 }: { rotulo: string; name: string; valor: string | null; linhas?: number }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`p-${name}`}>{rotulo}</Label>
      <textarea id={`p-${name}`} name={name} rows={linhas} defaultValue={valor ?? ""} className={estiloCampo} />
    </div>
  );
}

export function FormularioProduto({ produto }: { produto: ProdutoDetalhe }) {
  const router = useRouter();
  const [estado, executar, pendente] = useActionState(editarProdutoAcao, {
    ok: false,
  });
  useEffect(() => {
    if (estado.ok) {
      avisar(estado);
      router.refresh();
    }
  }, [estado, router]);
  const e = estado.erros;

  return (
    <form action={executar} className="grid gap-4">
      <input type="hidden" name="id" value={produto.id} />
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dados gerais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo rotulo="Nome" name="nome" defaultValue={produto.nome} erros={e?.nome} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-tipo">Tipo</Label>
            <select id="p-tipo" name="tipo" defaultValue={produto.tipo} className={estiloSelect}>
              {TIPOS_PRODUTO.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_PRODUTO[t]}
                </option>
              ))}
            </select>
          </div>
          <Campo
            rotulo="Área"
            name="area"
            defaultValue={produto.area ?? ""}
            placeholder="Ex.: Transplante Capilar & Tricologia"
            erros={e?.area}
          />
          <Campo rotulo="SKU" name="sku" defaultValue={produto.sku ?? ""} erros={e?.sku} />
          <Campo
            rotulo="Duração (meses)"
            name="duracaoMeses"
            type="number"
            min={0}
            defaultValue={produto.duracaoMeses ?? ""}
            erros={e?.duracaoMeses}
          />
          <Campo
            rotulo="Responsável pedagógico"
            name="responsavelPedagogico"
            defaultValue={produto.responsavelPedagogico ?? ""}
            erros={e?.responsavelPedagogico}
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="recorrente" defaultChecked={produto.recorrente} /> Recorrente
          </label>
          <div className="sm:col-span-2">
            <AreaTexto rotulo="Corpo docente" name="corpoDocente" valor={produto.corpoDocente} linhas={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Carga horária (horas)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Campo
            rotulo="Teórica presencial"
            name="cargaTeoricaPresencial"
            type="number"
            min={0}
            defaultValue={produto.cargaTeoricaPresencial ?? ""}
            erros={e?.cargaTeoricaPresencial}
          />
          <Campo
            rotulo="Teórica síncrona"
            name="cargaTeoricaSincrona"
            type="number"
            min={0}
            defaultValue={produto.cargaTeoricaSincrona ?? ""}
            erros={e?.cargaTeoricaSincrona}
          />
          <Campo
            rotulo="Teórica assíncrona"
            name="cargaTeoricaAssincrona"
            type="number"
            min={0}
            defaultValue={produto.cargaTeoricaAssincrona ?? ""}
            erros={e?.cargaTeoricaAssincrona}
          />
          <Campo
            rotulo="Prática"
            name="cargaPratica"
            type="number"
            min={0}
            defaultValue={produto.cargaPratica ?? ""}
            erros={e?.cargaPratica}
          />
          <Campo rotulo="Extra" name="cargaExtra" type="number" min={0} defaultValue={produto.cargaExtra ?? ""} erros={e?.cargaExtra} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comissão do vendedor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p-comissaoTipo">Calculada em</Label>
            <select id="p-comissaoTipo" name="comissaoTipo" defaultValue={produto.comissaoTipo} className={estiloSelect}>
              <option value="valor">Valor fixo (R$)</option>
              <option value="percentual">Percentual do valor (%)</option>
            </select>
          </div>
          <Campo
            rotulo="Base"
            name="comissaoBase"
            inputMode="decimal"
            defaultValue={valorCampo(produto.comissaoBase)}
            erros={e?.comissaoBase}
          />
          <Campo
            rotulo="Bônus"
            name="comissaoBonus"
            inputMode="decimal"
            defaultValue={valorCampo(produto.comissaoBonus)}
            erros={e?.comissaoBonus}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Textos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <AreaTexto rotulo="Descrição" name="descricao" valor={produto.descricao} />
          <AreaTexto rotulo="Ementa" name="ementa" valor={produto.ementa} linhas={10} />
          <AreaTexto rotulo="Observações" name="observacoes" valor={produto.observacoes} linhas={3} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar produto"}
        </Button>
      </div>
    </form>
  );
}

/** Ativar/desativar e excluir (só sem vendas e metas). */
export function AcoesProduto({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            if (avisar(await definirAtivoProdutoAcao(id, !ativo))) router.refresh();
          })
        }
      >
        {ativo ? "Desativar" : "Ativar"}
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={pendente}
        onClick={() => {
          if (!confirm("Excluir este produto? Ele some do catálogo.")) return;
          iniciar(async () => {
            if (avisar(await excluirProdutoAcao(id))) router.push("/comercial/produtos");
          });
        }}
      >
        Excluir
      </Button>
    </div>
  );
}
