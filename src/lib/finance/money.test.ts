import { describe, it, expect } from "vitest";
import {
  round,
  money,
  add,
  sumPresent,
  sub,
  mul,
  div,
  pct,
  abs,
  convert,
  isNum,
  formatMoney,
} from "./money";

describe("money.round (decimal-safe, half-up simétrico)", () => {
  it("resuelve el clásico 0.1 + 0.2", () => {
    expect(round(0.1 + 0.2)).toBe(0.3);
  });
  it("redondea half-up alejando del cero", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
    expect(round(-1.005, 2)).toBe(-1.01);
  });
  it("normaliza -0 a 0", () => {
    expect(Object.is(round(-0), 0)).toBe(true);
  });
  it("devuelve null ante valores no finitos", () => {
    expect(round(NaN)).toBeNull();
    expect(round(Infinity)).toBeNull();
    expect(round(null)).toBeNull();
    expect(round(undefined)).toBeNull();
  });
});

describe("isNum", () => {
  it("descarta null/undefined/NaN/Infinity", () => {
    expect(isNum(0)).toBe(true);
    expect(isNum(-5.5)).toBe(true);
    expect(isNum(null)).toBe(false);
    expect(isNum(undefined)).toBe(false);
    expect(isNum(NaN)).toBe(false);
    expect(isNum(Infinity)).toBe(false);
  });
});

describe("add / sub / mul (propagan null, no inventan ceros)", () => {
  it("suma valores presentes", () => {
    expect(add(10, 20.5, 0.25)).toBe(30.75);
  });
  it("add devuelve null si falta un sumando", () => {
    expect(add(10, null, 5)).toBeNull();
  });
  it("sumPresent ignora faltantes", () => {
    expect(sumPresent([10, null, 5, undefined, NaN])).toBe(15);
    expect(sumPresent([])).toBe(0);
  });
  it("sub y mul", () => {
    expect(sub(100, 30)).toBe(70);
    expect(sub(100, null)).toBeNull();
    expect(mul(3, 4.5)).toBe(13.5);
    expect(mul(null, 4)).toBeNull();
  });
});

describe("div / pct (división por cero segura)", () => {
  it("divide normalmente", () => {
    expect(div(10, 4)).toBe(2.5);
  });
  it("div por cero devuelve null (no Infinity)", () => {
    expect(div(10, 0)).toBeNull();
    expect(div(0, 0)).toBeNull();
  });
  it("pct calcula porcentaje", () => {
    expect(pct(51, 100)).toBe(51);
    expect(pct(1, 3, 2)).toBe(33.33);
  });
  it("pct con total 0 devuelve null", () => {
    expect(pct(5, 0)).toBeNull();
  });
});

describe("abs / convert / formatMoney", () => {
  it("abs seguro", () => {
    expect(abs(-25)).toBe(25);
    expect(abs(null)).toBeNull();
  });
  it("convert aplica fx", () => {
    expect(convert(100, 1.1)).toBe(110);
    expect(convert(100, null)).toBeNull();
  });
  it("formatMoney muestra 'Sin datos' ante null", () => {
    expect(formatMoney(null)).toBe("Sin datos");
    expect(formatMoney(1234.5, "USD")).toBe("USD 1,234.50");
  });
});
