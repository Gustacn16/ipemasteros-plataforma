import { describe, expect, it } from "vitest";
import { formatarWhatsapp, idadeEm, normalizarWhatsapp, tipoDaImagem } from "./perfil";

describe("tipoDaImagem", () => {
  it("reconhece JPEG, PNG e WebP pelos bytes", () => {
    expect(tipoDaImagem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(tipoDaImagem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(tipoDaImagem(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("recusa outros arquivos", () => {
    expect(tipoDaImagem(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(tipoDaImagem(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(tipoDaImagem(new Uint8Array([]))).toBeNull();
  });
});

describe("whatsapp", () => {
  it("normaliza para DDD + número", () => {
    expect(normalizarWhatsapp("+55 (61) 99999-0000")).toBe("61999990000");
    expect(normalizarWhatsapp("61 3333-4444")).toBe("6133334444");
    expect(normalizarWhatsapp("(55) 99999-0000")).toBe("55999990000");
  });
  it("formata para exibir", () => {
    expect(formatarWhatsapp("61999990000")).toBe("(61) 99999-0000");
    expect(formatarWhatsapp("6133334444")).toBe("(61) 3333-4444");
  });
});

describe("idadeEm", () => {
  it("conta anos completos", () => {
    expect(idadeEm("2000-11-03", "2026-11-02")).toBe(25);
    expect(idadeEm("2000-11-02", "2026-11-02")).toBe(26);
    expect(idadeEm("2000-02-29", "2026-03-01")).toBe(26);
  });
});
