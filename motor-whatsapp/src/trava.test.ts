import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { adquirirTrava } from "./trava.ts";

let pasta: string;
beforeEach(() => {
  pasta = mkdtempSync(path.join(tmpdir(), "trava-"));
});
afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

describe("adquirirTrava", () => {
  it("cria .motor.pid com o pid e liberar apaga o arquivo", () => {
    const liberar = adquirirTrava(pasta);
    const arquivo = path.join(pasta, ".motor.pid");
    expect(readFileSync(arquivo, "utf8")).toBe(String(process.pid));
    liberar();
    expect(existsSync(arquivo)).toBe(false);
  });

  it("com outro processo vivo na trava, lança 'Outro motor já está rodando (pid N).'", () => {
    writeFileSync(path.join(pasta, ".motor.pid"), String(process.ppid));
    expect(() => adquirirTrava(pasta)).toThrow(`Outro motor já está rodando (pid ${process.ppid}).`);
  });

  it("trava velha de processo morto é substituída", () => {
    writeFileSync(path.join(pasta, ".motor.pid"), "999999");
    const liberar = adquirirTrava(pasta);
    expect(readFileSync(path.join(pasta, ".motor.pid"), "utf8")).toBe(String(process.pid));
    liberar();
  });

  it("cria a pasta se ela não existe", () => {
    const funda = path.join(pasta, "a", "b");
    const liberar = adquirirTrava(funda);
    expect(existsSync(path.join(funda, ".motor.pid"))).toBe(true);
    liberar();
  });

  it("liberar não apaga a trava de outro pid", () => {
    const liberar = adquirirTrava(pasta);
    writeFileSync(path.join(pasta, ".motor.pid"), String(process.ppid));
    liberar();
    expect(existsSync(path.join(pasta, ".motor.pid"))).toBe(true);
  });
});
