import { describe, it, expect } from "vitest";
import { assertSafeUrl } from "./http";

describe("assertSafeUrl", () => {
  it("acepta una URL https pública normal y la normaliza", async () => {
    await expect(assertSafeUrl("https://gitlab.com/")).resolves.toBe(
      "https://gitlab.com",
    );
  });

  it("rechaza http:// por defecto", async () => {
    await expect(assertSafeUrl("http://example.com")).rejects.toThrow();
  });

  it("permite http:// si allowInsecure", async () => {
    await expect(
      assertSafeUrl("http://example.com", { allowInsecure: true, blockPrivate: false }),
    ).resolves.toBe("http://example.com");
  });

  it("rechaza esquemas no http(s)", async () => {
    await expect(assertSafeUrl("ftp://example.com")).rejects.toThrow();
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow();
  });

  it("rechaza IPs privadas / loopback / metadata (SSRF)", async () => {
    await expect(assertSafeUrl("https://127.0.0.1")).rejects.toThrow();
    await expect(assertSafeUrl("https://10.0.0.5")).rejects.toThrow();
    await expect(assertSafeUrl("https://192.168.1.1")).rejects.toThrow();
    await expect(assertSafeUrl("https://169.254.169.254")).rejects.toThrow();
    await expect(assertSafeUrl("https://172.16.0.1")).rejects.toThrow();
    await expect(assertSafeUrl("https://localhost")).rejects.toThrow();
  });

  it("rechaza entrada vacía o inválida", async () => {
    await expect(assertSafeUrl("")).rejects.toThrow();
    await expect(assertSafeUrl(null)).rejects.toThrow();
    await expect(assertSafeUrl("no es una url")).rejects.toThrow();
  });
});
