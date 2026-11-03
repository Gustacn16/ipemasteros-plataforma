import { describe, expect, it } from "vitest";
import { segredoValido } from "./cron";

describe("segredoValido", () => {
  it("aceita só o Bearer com o segredo certo", () => {
    expect(segredoValido("Bearer s3gr3d0-longo", "s3gr3d0-longo")).toBe(true);
    expect(segredoValido("Bearer errado-longo", "s3gr3d0-longo")).toBe(false);
    expect(segredoValido("Bearer s3gr3d0", "s3gr3d0-longo")).toBe(false);
    expect(segredoValido("s3gr3d0-longo", "s3gr3d0-longo")).toBe(false);
    expect(segredoValido(null, "s3gr3d0-longo")).toBe(false);
  });

  it("sem segredo configurado, recusa tudo", () => {
    expect(segredoValido("Bearer ", "")).toBe(false);
    expect(segredoValido("Bearer undefined", undefined)).toBe(false);
  });
});
