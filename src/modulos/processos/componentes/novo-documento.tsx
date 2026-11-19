import { CampoSelecao, CampoTexto, FormularioAcao } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { criarDocumentoAcao } from "../acoes/processos";
import { AJUDA_TIPO_DOCUMENTO, ROTULO_TIPO_DOCUMENTO, TIPOS_DOCUMENTO } from "../esquemas/processos";

export function NovoDocumento({ areas, areaId }: { areas: { valor: string; rotulo: string }[]; areaId?: string }) {
  if (areas.length === 0) return null;
  return (
    <Dialogo rotuloBotao="Novo documento" titulo="Novo documento" descricao="Ele nasce como rascunho. O time só vê depois que você publicar.">
      <FormularioAcao acao={criarDocumentoAcao} rotuloBotao="Criar" irPara="/processos/documentos/">
        <CampoTexto rotulo="Título" name="titulo" placeholder="Ex.: Captura de lead" required largo />
        <CampoSelecao rotulo="Área" name="areaId" opcoes={areas} defaultValue={areaId} vazio="Escolha a área" largo />
        <CampoSelecao
          rotulo="Tipo"
          name="tipo"
          opcoes={TIPOS_DOCUMENTO.map((t) => ({ valor: t, rotulo: `${ROTULO_TIPO_DOCUMENTO[t]} — ${AJUDA_TIPO_DOCUMENTO[t]}` }))}
          defaultValue="processo"
          largo
        />
      </FormularioAcao>
    </Dialogo>
  );
}
