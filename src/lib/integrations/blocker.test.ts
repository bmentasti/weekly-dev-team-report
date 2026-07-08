import { describe, it, expect } from "vitest";
import { BLOCKER_PATTERN, stripHtml } from "./blocker";

describe("BLOCKER_PATTERN", () => {
  it("detecta variantes de blocker", () => {
    for (const s of [
      "esto es un blocker",
      "I am blocked",
      "quedó trabado",
      "waiting on infra",
      "esperando a QA",
      "no puedo avanzar",
    ]) {
      expect(BLOCKER_PATTERN.test(s)).toBe(true);
    }
  });
  it("no detecta texto normal", () => {
    expect(BLOCKER_PATTERN.test("todo va bien, sin novedades")).toBe(false);
  });
});

describe("stripHtml", () => {
  it("quita tags, entidades y colapsa espacios", () => {
    expect(stripHtml("<p>Hola&nbsp;&nbsp; <b>mundo</b></p>")).toBe("Hola mundo");
  });
  it("string vacío", () => {
    expect(stripHtml("   ")).toBe("");
  });
});
