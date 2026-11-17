import { describe, expect, it } from "vitest";
import { comoInstalar } from "./instalacao";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const IPAD_NOVO =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const base = { modoApp: false, toquesMaximos: 0, temPromptNativo: false };

describe("comoInstalar", () => {
  it("já aberto como app: nada a mostrar", () => {
    expect(comoInstalar({ ...base, userAgent: IPHONE_SAFARI, modoApp: true })).toBe("instalado");
  });

  it("iPhone (Safari ou Chrome): passo a passo do Compartilhar", () => {
    expect(comoInstalar({ ...base, userAgent: IPHONE_SAFARI, toquesMaximos: 5 })).toBe("iphone");
    expect(comoInstalar({ ...base, userAgent: IPHONE_CHROME, toquesMaximos: 5 })).toBe("iphone");
  });

  it("iPad novo se apresenta como Mac, mas tem tela de toque", () => {
    expect(comoInstalar({ ...base, userAgent: IPAD_NOVO, toquesMaximos: 5 })).toBe("iphone");
  });

  it("Mac de verdade (sem toque) não é tratado como iPad", () => {
    expect(comoInstalar({ ...base, userAgent: IPAD_NOVO })).toBe("manual");
  });

  it("navegador que oferece instalação própria (Android, Chrome no computador)", () => {
    expect(comoInstalar({ ...base, userAgent: ANDROID, temPromptNativo: true })).toBe("nativo");
    expect(comoInstalar({ ...base, userAgent: MAC_CHROME, temPromptNativo: true })).toBe("nativo");
  });

  it("sem instalação própria: instruções gerais", () => {
    expect(comoInstalar({ ...base, userAgent: ANDROID })).toBe("manual");
  });
});
