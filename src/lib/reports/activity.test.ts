import { describe, it, expect, afterEach } from "vitest";
import {
  inactiveThresholdDays,
  maxIso,
  isPersonActive,
  filterActivePeople,
} from "./activity";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

describe("inactiveThresholdDays", () => {
  const prev = process.env.REPORT_INACTIVE_DAYS;
  afterEach(() => {
    if (prev === undefined) delete process.env.REPORT_INACTIVE_DAYS;
    else process.env.REPORT_INACTIVE_DAYS = prev;
  });

  it("usa 30 por defecto", () => {
    delete process.env.REPORT_INACTIVE_DAYS;
    expect(inactiveThresholdDays()).toBe(30);
  });

  it("respeta un valor válido", () => {
    process.env.REPORT_INACTIVE_DAYS = "45";
    expect(inactiveThresholdDays()).toBe(45);
  });

  it("cae al default con valores inválidos", () => {
    process.env.REPORT_INACTIVE_DAYS = "0";
    expect(inactiveThresholdDays()).toBe(30);
    process.env.REPORT_INACTIVE_DAYS = "abc";
    expect(inactiveThresholdDays()).toBe(30);
  });
});

describe("maxIso", () => {
  it("devuelve el más reciente o el que exista", () => {
    expect(maxIso(daysAgo(10), daysAgo(2))).toBe(daysAgo(2));
    expect(maxIso(daysAgo(2), daysAgo(10))).toBe(daysAgo(2));
    expect(maxIso(null, daysAgo(5))).toBe(daysAgo(5));
    expect(maxIso(daysAgo(5), null)).toBe(daysAgo(5));
    expect(maxIso(null, null)).toBeNull();
  });
});

describe("isPersonActive", () => {
  it("activo dentro de la ventana", () => {
    expect(isPersonActive(daysAgo(5), { now: NOW, days: 30 })).toBe(true);
    expect(isPersonActive(daysAgo(30), { now: NOW, days: 30 })).toBe(true);
  });

  it("inactivo pasada la ventana", () => {
    expect(isPersonActive(daysAgo(31), { now: NOW, days: 30 })).toBe(false);
    expect(isPersonActive(daysAgo(90), { now: NOW, days: 30 })).toBe(false);
  });

  it("sin dato de actividad se trata como activo (no excluye por falta de fecha)", () => {
    expect(isPersonActive(null, { now: NOW, days: 30 })).toBe(true);
    expect(isPersonActive(undefined, { now: NOW, days: 30 })).toBe(true);
  });
});

describe("filterActivePeople", () => {
  it("excluye solo a los inactivos > umbral", () => {
    const people = [
      { name: "activa", lastActivityAt: daysAgo(3) },
      { name: "salió", lastActivityAt: daysAgo(60) },
      { name: "sin-dato", lastActivityAt: null },
    ];
    const out = filterActivePeople(people, { now: NOW, days: 30 });
    expect(out.map((p) => p.name)).toEqual(["activa", "sin-dato"]);
  });
});
