import { buscarComandos, enviarEventos, responderComando } from "./api.ts";
import { config } from "./config.ts";
import { Conexoes } from "./conexoes.ts";
import { FilaEventos } from "./fila-eventos.ts";
import { textoDaFalha } from "./erro-envio.ts";
import { adquirirTrava } from "./trava.ts";
import type { ComandoMotor } from "./tipos.ts";

const INTERVALO_COMANDOS_MS = 3000;
const INTERVALO_SINAL_MS = 60_000;

/** Só o nome do erro vai para o log: a mensagem da Baileys ou da API pode trazer JID ou telefone. */
const nomeDoErro = (erro: unknown): string => (erro instanceof Error ? erro.name : "erro desconhecido");

// Só um motor por pasta de sessões: dois motores na mesma sessão derrubam o WhatsApp.
let liberarTrava: () => void;
try {
  liberarTrava = adquirirTrava(config.pastaSessoes);
} catch (erro) {
  console.error(`[motor] ${erro instanceof Error ? erro.message : "não consegui adquirir a trava"}`);
  process.exit(1);
}

const fila = new FilaEventos(enviarEventos);
const conexoes = new Conexoes({
  pastaSessoes: config.pastaSessoes,
  aoEvento: (e) => fila.adicionar(e),
  nivelLog: config.nivelLogBaileys,
});

let encerrando = false;
let proximaBusca: ReturnType<typeof setTimeout> | null = null;

function enviarSinal(): void {
  fila.adicionar({ tipo: "sinal", conectados: conexoes.conectados() });
}

async function executar(comando: ComandoMotor): Promise<void> {
  let resultado: { situacao: "concluido" } | { situacao: "falhou"; erro: string };
  try {
    switch (comando.tipo) {
      case "conectar":
        await conexoes.conectar(comando.numeroId);
        resultado = { situacao: "concluido" };
        break;
      case "desconectar":
        await conexoes.desconectar(comando.numeroId);
        resultado = { situacao: "concluido" };
        break;
      case "enviar_grupo":
        await conexoes.enviarTexto(comando.numeroId, comando.dados.jid, comando.dados.texto);
        resultado = { situacao: "concluido" };
        break;
      default:
        resultado = { situacao: "falhou", erro: "Comando desconhecido." };
    }
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "erro desconhecido";
    const tipo = String((comando as { tipo: unknown }).tipo);
    console.error(`[comandos] ${tipo} ${comando.numeroId} falhou (${nomeDoErro(erro)})`);
    resultado = { situacao: "falhou", erro: textoDaFalha(tipo, texto, nomeDoErro(erro)) };
  }
  // Falha ao responder não muda o resultado. conectar/desconectar o sistema devolve à fila em 2 min
  // (podem ser repetidos sem efeito colateral); enviar_grupo nunca é reenviado: o site o marca
  // como falhou depois de 2 min sem resposta.
  try {
    await responderComando(comando.id, resultado);
  } catch (erro) {
    console.warn(`[comandos] não consegui responder o comando de ${comando.numeroId} (${nomeDoErro(erro)})`);
  }
}

/** Busca os comandos pendentes e executa um por vez; a próxima busca só começa depois. */
async function cicloDeComandos(): Promise<void> {
  try {
    for (const comando of await buscarComandos()) {
      if (encerrando) break;
      await executar(comando);
    }
  } catch (erro) {
    console.warn(`[comandos] falha ao buscar (${nomeDoErro(erro)})`);
  }
  if (!encerrando) proximaBusca = setTimeout(() => void cicloDeComandos(), INTERVALO_COMANDOS_MS);
}

async function encerrar(sinal: string): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  console.info(`[motor] ${sinal} recebido; enviando eventos pendentes e saindo`);
  if (proximaBusca) clearTimeout(proximaBusca);
  clearInterval(relogioSinal);
  fila.parar();
  await fila.esvaziar();
  liberarTrava();
  process.exit(0);
}

// A Baileys às vezes rejeita uma consulta interna sem ninguém esperar por ela (ex.: "Timed Out" ao
// conferir as pre-keys numa conexão instável). Sem isto o Node encerra o motor; a própria Baileys
// derruba e reabre a conexão, então só registramos o nome do erro e seguimos.
process.on("unhandledRejection", (erro: unknown) => {
  console.error(`[motor] erro sem tratamento ignorado (${erro instanceof Error ? erro.name : typeof erro})`);
});

console.info("[motor] iniciando");
await conexoes.retomarSalvas();
enviarSinal();
const relogioSinal = setInterval(enviarSinal, INTERVALO_SINAL_MS);
process.on("SIGINT", () => void encerrar("SIGINT"));
process.on("SIGTERM", () => void encerrar("SIGTERM"));
void cicloDeComandos();
