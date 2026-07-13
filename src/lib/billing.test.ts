import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { parsePlanReference, verifyMercadoPagoSignature } from "./billing";

describe("parsePlanReference", () => {
  it("parsea una referencia válida", () => {
    expect(parsePlanReference("ws_123:PRO:ANNUAL")).toEqual({
      workspaceId: "ws_123",
      plan: "PRO",
      period: "ANNUAL",
    });
  });

  it("rechaza plan desconocido", () => {
    expect(parsePlanReference("ws_123:PLATINUM:MONTHLY")).toBeNull();
  });

  it("rechaza period inválido", () => {
    expect(parsePlanReference("ws_123:PRO:DAILY")).toBeNull();
  });

  it("rechaza formato incompleto / vacío", () => {
    expect(parsePlanReference("ws_123:PRO")).toBeNull();
    expect(parsePlanReference("")).toBeNull();
    expect(parsePlanReference(null)).toBeNull();
    expect(parsePlanReference(undefined)).toBeNull();
  });
});

describe("verifyMercadoPagoSignature", () => {
  const secret = "test-secret";
  const dataId = "payment-1";
  const requestId = "req-1";
  const ts = "1700000000";

  function sign(id: string) {
    const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
    return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  }

  it("acepta una firma correcta", () => {
    const v1 = sign(dataId);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(true);
  });

  it("rechaza una firma manipulada", () => {
    const v1 = sign(dataId);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${v1.replace(/.$/, "0")}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
  });

  it("rechaza si el dataId no coincide (replay a otro pago)", () => {
    const v1 = sign(dataId);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId: "otro-pago",
        secret,
      }),
    ).toBe(false);
  });

  it("rechaza header ausente o malformado", () => {
    expect(
      verifyMercadoPagoSignature({ signatureHeader: null, requestId, dataId, secret }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: "garbage", requestId, dataId, secret }),
    ).toBe(false);
  });
});
