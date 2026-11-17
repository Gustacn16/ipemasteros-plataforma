import { buscarComandos, enviarEventos, responderComando } from "./api.ts";
import { config } from "./config.ts";
import { Conexoes } from "./conexoes.ts";
import { FilaEventos } from "./fila-eventos.ts";
import type { ComandoMotor } from "./tipos.ts";

const INTERVALO_COMANDOS_MS = 3000;
const INTERVALO_SINAL_MS = 60_000;

const fila = new FilaEventos(enviarEventos);
const conexoes = new Conexoes({ pastaSessoes: config.pastaSessoes, aoEvento: (e) => fila.adicionar(e) });

let encerrando = false;
let proximaBusca: ReturnType<typeof setTimeout> | null = null;

function enviarSinal(): void {
  fila.adicionar({ tipo: "sinal", conectados: conexoes.conectados() });
}

async function executar(comando: ComandoMotor): Promise<void> {
  try {
    if (comando.tipo === "conectar") await conexoes.conectar(comando.numeroId);
    else await conexoes.desconectar(comando.numeroId);
    await responderComando(comando.id, { situacao: "concluido" });
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message : "erro desconhecido";
    console.error(`[comandos] ${comando.tipo} ${comando.numeroId} falhou: ${texto}`);
    await responderComando(comando.id, { situacao: "falhou", erro: texto.slice(0, 255) }).catch(
      () => {},
    );
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
  process.exit(0);
}

console.info("[motor] iniciando");
await conexoes.retomarSalvas();
enviarSinal();
const relogioSinal = setInterval(enviarSinal, INTERVALO_SINAL_MS);
process.on("SIGINT", () => void encerrar("SIGINT"));
process.on("SIGTERM", () => void encerrar("SIGTERM"));
void cicloDeComandos();
