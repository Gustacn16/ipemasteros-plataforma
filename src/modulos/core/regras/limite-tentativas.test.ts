import { describe, expect, it } from "vitest";
import {
  chaveBetterAuthNormalizada,
  chaveLimite,
  criarLimitador,
  type RegistroLimite,
  type RepositorioLimite,
} from "./limite-tentativas";
import { mensagemMuitasTentativas, segundosDoCabecalho } from "./mensagem-limite";

/** Repositório em memória que imita o do Prisma (condições atômicas por linha). */
function repositorioFalso() {
  const linhas = new Map<string, RegistroLimite>();
  let limpezas = 0;
  const repo: RepositorioLimite = {
    async incrementarSeAtivo(chave, desde) {
      const linha = linhas.get(chave);
      if (!linha || linha.inicio <= desde) return null;
      linha.contagem += 1;
      return { ...linha };
    },
    async reiniciarSeVencido(chave, desde, agora) {
      const linha = linhas.get(chave);
      if (!linha || linha.inicio > desde) return false;
      linhas.set(chave, { contagem: 1, inicio: agora });
      return true;
    },
    async criar(chave, agora) {
      if (linhas.has(chave)) return false;
      linhas.set(chave, { contagem: 1, inicio: agora });
      return true;
    },
    async limparVencidos() {
      limpezas += 1;
    },
    async apagar(chave) {
      linhas.delete(chave);
    },
  };
  return { repo, linhas, limpezas: () => limpezas };
}

const QUINZE_MIN = { janelaSeg: 15 * 60, max: 5 };

describe("criarLimitador", () => {
  it("deixa passar até o máximo e bloqueia a partir daí", async () => {
    const { repo } = repositorioFalso();
    let agora = new Date("2026-11-12T10:00:00Z");
    const limitador = criarLimitador(repo, () => agora);
    for (let i = 0; i < 5; i++) {
      expect((await limitador.consumir("k", QUINZE_MIN)).permitido).toBe(true);
    }
    agora = new Date("2026-11-12T10:05:00Z");
    const bloqueio = await limitador.consumir("k", QUINZE_MIN);
    expect(bloqueio.permitido).toBe(false);
    // A janela começou às 10:00, então libera às 10:15: faltam 600 s.
    expect(bloqueio.esperarSeg).toBe(600);
  });

  it("libera de novo quando a janela vence", async () => {
    const { repo, linhas } = repositorioFalso();
    let agora = new Date("2026-11-12T10:00:00Z");
    const limitador = criarLimitador(repo, () => agora);
    for (let i = 0; i < 6; i++) await limitador.consumir("k", QUINZE_MIN);
    agora = new Date("2026-11-12T10:15:00Z");
    expect((await limitador.consumir("k", QUINZE_MIN)).permitido).toBe(true);
    expect(linhas.get("k")).toEqual({ contagem: 1, inicio: agora });
  });

  it("conta cada chave separadamente", async () => {
    const { repo } = repositorioFalso();
    const limitador = criarLimitador(repo, () => new Date("2026-11-12T10:00:00Z"));
    const regra = { janelaSeg: 60, max: 1 };
    expect((await limitador.consumir("a", regra)).permitido).toBe(true);
    expect((await limitador.consumir("a", regra)).permitido).toBe(false);
    expect((await limitador.consumir("b", regra)).permitido).toBe(true);
  });

  it("limpa as linhas vencidas quando reinicia uma janela", async () => {
    const { repo, limpezas } = repositorioFalso();
    let agora = new Date("2026-11-12T10:00:00Z");
    const limitador = criarLimitador(repo, () => agora);
    await limitador.consumir("k", QUINZE_MIN);
    expect(limpezas()).toBe(0);
    agora = new Date("2026-11-12T11:00:00Z");
    await limitador.consumir("k", QUINZE_MIN);
    expect(limpezas()).toBe(1);
  });

  it("tenta de novo quando outra requisição cria a linha ao mesmo tempo", async () => {
    const { repo, linhas } = repositorioFalso();
    const agora = new Date("2026-11-12T10:00:00Z");
    const criarOriginal = repo.criar;
    repo.criar = async (chave, quando) => {
      // Simula a outra requisição criando a linha um instante antes.
      linhas.set(chave, { contagem: 1, inicio: quando });
      repo.criar = criarOriginal;
      return false;
    };
    const limitador = criarLimitador(repo, () => agora);
    expect(await limitador.consumir("k", QUINZE_MIN)).toEqual({ permitido: true, esperarSeg: 0 });
    expect(linhas.get("k")?.contagem).toBe(2);
  });

  it("bloqueia (falha fechada) se não conseguir gravar depois de várias tentativas", async () => {
    const { repo } = repositorioFalso();
    repo.criar = async () => false;
    const limitador = criarLimitador(repo, () => new Date("2026-11-12T10:00:00Z"));
    expect(await limitador.consumir("k", QUINZE_MIN)).toEqual({ permitido: false, esperarSeg: 900 });
  });
});

describe("zerar", () => {
  it("apaga o contador, liberando a chave na hora", async () => {
    const { repo } = repositorioFalso();
    const limitador = criarLimitador(repo, () => new Date("2026-11-12T10:00:00Z"));
    const regra = { janelaSeg: 60, max: 1 };
    await limitador.consumir("k", regra);
    expect((await limitador.consumir("k", regra)).permitido).toBe(false);
    await limitador.zerar("k");
    expect((await limitador.consumir("k", regra)).permitido).toBe(true);
  });
});

describe("chaveBetterAuthNormalizada", () => {
  it("mantém os endereços conhecidos", () => {
    expect(chaveBetterAuthNormalizada("1.2.3.4|/sign-in/email")).toBe("1.2.3.4|/sign-in/email");
    expect(chaveBetterAuthNormalizada("1.2.3.4|/get-session")).toBe("1.2.3.4|/get-session");
  });
  it("junta os links de redefinição de senha num balde só", () => {
    expect(chaveBetterAuthNormalizada("1.2.3.4|/reset-password/abc123")).toBe("1.2.3.4|/reset-password/*");
  });
  it("junta endereços desconhecidos num balde só (não cria uma linha por endereço inventado)", () => {
    expect(chaveBetterAuthNormalizada("1.2.3.4|/x1")).toBe("1.2.3.4|outros");
    expect(chaveBetterAuthNormalizada("1.2.3.4|/x2/y")).toBe("1.2.3.4|outros");
  });
  it("funciona com IPv6 e com o balde sem IP", () => {
    expect(chaveBetterAuthNormalizada("2001:0db8:0000:0000:0000:0000:0000:0000|/x")).toBe(
      "2001:0db8:0000:0000:0000:0000:0000:0000|outros",
    );
    expect(chaveBetterAuthNormalizada("no-trusted-ip|/sign-in/email")).toBe("no-trusted-ip|/sign-in/email");
  });
});

describe("chaveLimite", () => {
  it("gera um hash de 64 caracteres, sem guardar IP nem e-mail", () => {
    const chave = chaveLimite("login", "203.0.113.7", "ana@exemplo.com");
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
    expect(chave).not.toContain("ana");
  });
  it("não confunde partes diferentes que juntas formam o mesmo texto", () => {
    expect(chaveLimite("login", "a|b", "c")).not.toBe(chaveLimite("login", "a", "b|c"));
  });
  it("trata o e-mail sem diferenciar maiúsculas e espaços", () => {
    expect(chaveLimite("login", "1.1.1.1", " Ana@Exemplo.com ")).toBe(
      chaveLimite("login", "1.1.1.1", "ana@exemplo.com"),
    );
  });
});

describe("mensagemMuitasTentativas", () => {
  it("arredonda para cima em minutos", () => {
    expect(mensagemMuitasTentativas(600)).toBe("Muitas tentativas. Tente de novo em 10 minutos.");
    expect(mensagemMuitasTentativas(61)).toBe("Muitas tentativas. Tente de novo em 2 minutos.");
  });
  it("usa o singular para 1 minuto ou menos", () => {
    expect(mensagemMuitasTentativas(60)).toBe("Muitas tentativas. Tente de novo em 1 minuto.");
    expect(mensagemMuitasTentativas(5)).toBe("Muitas tentativas. Tente de novo em 1 minuto.");
  });
  it("sem tempo conhecido, pede para aguardar alguns minutos", () => {
    expect(mensagemMuitasTentativas(null)).toBe("Muitas tentativas. Tente de novo em alguns minutos.");
  });
});

describe("segundosDoCabecalho", () => {
  it("lê o X-Retry-After", () => {
    expect(segundosDoCabecalho("120")).toBe(120);
  });
  it("ignora valores ausentes ou inválidos", () => {
    expect(segundosDoCabecalho(null)).toBeNull();
    expect(segundosDoCabecalho("abc")).toBeNull();
    expect(segundosDoCabecalho("-3")).toBeNull();
  });
});
