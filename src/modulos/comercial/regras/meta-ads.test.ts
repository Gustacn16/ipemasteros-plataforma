import { describe, expect, it } from "vitest";
import { centavosDoGasto, lerLeads, mensagemErroMeta, periodosImportacao, podeIniciarImportacao } from "./meta-ads";

describe("lerLeads", () => {
  it("conta os três tipos e lista os ignorados, sem contar o agregado 'lead'", () => {
    expect(
      lerLeads([
        { action_type: "onsite_conversion.lead_grouped", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "2" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "5" },
        { action_type: "lead", value: "5" },
        { action_type: "link_click", value: "40" },
        { action_type: "link_click", value: "1" },
      ]),
    ).toEqual({ leadsFormulario: 3, leadsSite: 2, conversasIniciadas: 5, ignorados: ["lead", "link_click"] });
  });

  it("sem actions, tudo zero", () => {
    expect(lerLeads(undefined)).toEqual({ leadsFormulario: 0, leadsSite: 0, conversasIniciadas: 0, ignorados: [] });
  });
});

describe("centavosDoGasto", () => {
  it("lê o spend da Meta em centavos", () => {
    expect(centavosDoGasto("123.45")).toBe(12345);
    expect(centavosDoGasto("0.1")).toBe(10);
    expect(centavosDoGasto(undefined)).toBe(0);
  });
});

describe("periodosImportacao", () => {
  it("com dados: os últimos 7 dias até ontem", () => {
    expect(periodosImportacao({ temDados: true, hoje: "2026-11-02" })).toEqual([{ desde: "2026-10-26", ate: "2026-11-01" }]);
  });

  it("sem dados: desde 2026-01-01 até ontem, em blocos contíguos de até 30 dias", () => {
    const blocos = periodosImportacao({ temDados: false, hoje: "2026-03-05" });
    expect(blocos[0]?.desde).toBe("2026-01-01");
    expect(blocos.at(-1)?.ate).toBe("2026-03-04");
    for (const [i, b] of blocos.entries()) {
      const dias = (Date.parse(`${b.ate}T00:00:00Z`) - Date.parse(`${b.desde}T00:00:00Z`)) / 86_400_000 + 1;
      expect(dias).toBeLessThanOrEqual(30);
      if (i > 0) {
        const anterior = blocos[i - 1]!;
        expect(Date.parse(`${b.desde}T00:00:00Z`) - Date.parse(`${anterior.ate}T00:00:00Z`)).toBe(86_400_000);
      }
    }
  });
});

describe("mensagemErroMeta", () => {
  it("traduz os erros conhecidos", () => {
    expect(mensagemErroMeta(190, "x")).toBe("A chave de acesso da Meta é inválida ou foi revogada.");
    expect(mensagemErroMeta(10, "x")).toBe("A chave não tem permissão para ler esta conta.");
    expect(mensagemErroMeta(17, "x")).toBe("A Meta limitou as consultas. Tente de novo em alguns minutos.");
    expect(mensagemErroMeta(100, "abc")).toBe("Erro da Meta: abc");
  });
});

describe("podeIniciarImportacao", () => {
  const agora = new Date("2026-11-03T07:00:00Z");
  const ha = (min: number) => ({ iniciadoEm: new Date(agora.getTime() - min * 60_000) });

  it("sem importação em andamento, pode", () => {
    expect(podeIniciarImportacao(null, agora)).toEqual({ pode: true, expirada: false });
  });

  it("em andamento há 10 minutos, não pode; há 40, a antiga expirou", () => {
    expect(podeIniciarImportacao(ha(10), agora)).toEqual({ pode: false, expirada: false });
    expect(podeIniciarImportacao(ha(40), agora)).toEqual({ pode: true, expirada: true });
  });
});
