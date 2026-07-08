import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "./encryption";

beforeAll(() => {
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("encryption (AES-256-GCM)", () => {
  it("roundtrip: decrypt(encrypt(x)) === x", () => {
    const secret = "jira-token-super-secreto";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produce ciphertext distinto cada vez (IV aleatorio)", () => {
    const a = encrypt("mismo-valor");
    const b = encrypt("mismo-valor");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("detecta manipulación (auth tag inválido)", () => {
    const payload = encrypt("dato");
    const [iv, , data] = payload.split(":");
    const tampered = [iv, Buffer.from("x".repeat(16)).toString("base64"), data].join(":");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("rechaza formato inválido", () => {
    expect(() => decrypt("no-es-valido")).toThrow();
  });

  it("rechaza auth tag con longitud inválida", () => {
    const payload = encrypt("dato");
    const [iv, , data] = payload.split(":");
    // tag de 8 bytes (debería ser 16) => Invalid auth tag length
    const badTag = Buffer.alloc(8).toString("base64");
    expect(() => decrypt([iv, badTag, data].join(":"))).toThrow(/auth tag length/i);
  });

  it("falla si ENCRYPTION_KEY no está seteada", () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY is not set/i);
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });

  it("falla si ENCRYPTION_KEY no mide 32 bytes", () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "abcd"; // 2 bytes
    try {
      expect(() => encrypt("x")).toThrow(/32 bytes/i);
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});
