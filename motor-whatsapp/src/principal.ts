import { buscarComandos, enviarEventos, responderComando } from "./api.ts";
import { config } from "./config.ts";
import { Conexoes } from "./conexoes.ts";
import { FilaEventos } from "./fila-eventos.ts";
import { adquirirTrava } from "./trava.ts";
import type { ComandoMotor } from "./tipos.ts";

const INTERVALO_COMANDOS_MS = 3000;
const INTERVALO_SINAL_MS = 60_000;

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
    if (comando.tipo === "conectar") await conexoes.conectar(comando.numeroId);
    else await conexoes.desconectar(comando.numeroId);
    resultado = { situacao: "concluido" };
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "erro desconhecido";
    console.error(`[comandos] ${comando.tipo} ${comando.numeroId} falhou: ${texto}`);
    resultado = { situacao: "falhou", erro: texto.slice(0, 255) };
  }
  // Falha ao responder não muda o resultado: o sistema devolve o comando à fila em 2 min,
  // e conectar/desconectar podem ser repetidos sem efeito colateral.
  try {
    await responderComando(comando.id, resultado);
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "erro desconhecido";
    console.warn(`[comandos] não consegui responder o comando de ${comando.numeroId}: ${texto}`);
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
    console.warn(`[comandos] falha ao buscar: ${erro instanceof Error ? erro.message : "erro"}`);
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
  console.error(`[motor] erro sem tratamento ignorado (${erro instanceof Error ? erro.message : typeof erro})`);
});

console.info("[motor] iniciando");
await conexoes.retomarSalvas();
enviarSinal();
const relogioSinal = setInterval(enviarSinal, INTERVALO_SINAL_MS);
process.on("SIGINT", () => void encerrar("SIGINT"));
process.on("SIGTERM", () => void encerrar("SIGTERM"));
void cicloDeComandos();
