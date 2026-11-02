// Ponto de entrada do worker_thread que interpreta o iCal (ver ical-em-worker.ts).
// O webpack empacota este arquivo como chunk próprio a partir de
// `new Worker(new URL("./ical-worker.ts", import.meta.url))`.
import { parentPort } from "node:worker_threads";
import { processarPedido } from "./ical-interpretar";

parentPort?.once("message", (pedido: unknown) => {
  parentPort?.postMessage(processarPedido(pedido));
});
