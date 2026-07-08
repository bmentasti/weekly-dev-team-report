import { describe, it, expect } from "vitest";
import { buildMatrixRow, matrixToCsv, MATRIX_COLUMNS, type PersonInput, type MatrixRow } from "./matrix";
import type { PersonInsight } from "./types";

function person(over: Partial<PersonInsight> = {}): PersonInsight {
  return {
    name: "Ana", tasksDone: 4, tasksInProgress: 1, tasksBlocked: 1, tasksStale: 1,
    prsOpen: 1, prsMerged: 3, committedPoints: 8, completedPoints: 6, wip: 2,
    throughput: 3, cycleTimeAvgDays: 2, category: "ON_TRACK", score: 70, rank: 1, nextStep: "-",
    ...over,
  };
}

const input: PersonInput = {
  name: "Ana",
  latest: person(),
  tiers: ["BAJO", "BAJO"],
  trend: "up",
  context: { role: "Dev", seniority: "Ssr", daily: "HIGH", refinement: "MEDIUM", retro: "HIGH", demo: "LOW", ownership: "MEDIUM", feedback: "positivo, con comas" },
};

describe("buildMatrixRow", () => {
  it("arma la fila con todas las columnas", () => {
    const row = buildMatrixRow(input);
    for (const c of MATRIX_COLUMNS) expect(row[c] !== undefined).toBe(true);
    expect(row.Persona).toBe("Ana");
    expect(row.Rol).toBe("Dev");
    expect(row.Evolución).toBe("Mejora");
    // 2 sprints en BAJO => riesgo medio
    expect(row.Riesgo).toBe("Medio");
    expect(row.Evidencia).toContain("bloqueada");
  });
  it("sin latest ni contexto usa guiones", () => {
    const row = buildMatrixRow({ name: "Z", latest: null, tiers: [], trend: "flat", context: null });
    expect(row.Entrega).toBe("—");
    expect(row.Rol).toBe("—");
    expect(row.Evolución).toBe("Estable");
    expect(row.Riesgo).toBe("Bajo");
    // ceremonyAvg con contexto null => "—"
    expect(row.Participación).toBe("—");
  });
  it("trend down => 'Baja' y 3+ sprints BAJO => riesgo 'Alto'", () => {
    const row = buildMatrixRow({
      ...input,
      trend: "down",
      tiers: ["BAJO", "BAJO", "BAJO"],
    });
    expect(row.Evolución).toBe("Baja");
    expect(row.Riesgo).toBe("Alto");
  });
  it("contexto sin ceremonias => Participación '—' (vals vacío)", () => {
    const row = buildMatrixRow({ ...input, context: { role: "Dev" } });
    expect(row.Participación).toBe("—");
  });
  it("ceremonyAvg alta (todas HIGH) y baja (todas LOW)", () => {
    const alta = buildMatrixRow({
      ...input,
      context: { ...input.context!, daily: "HIGH", refinement: "HIGH", retro: "HIGH", demo: "HIGH" },
    });
    expect(alta.Participación).toBe("Alta");
    const baja = buildMatrixRow({
      ...input,
      context: { ...input.context!, daily: "LOW", refinement: "LOW", retro: "LOW", demo: "LOW" },
    });
    expect(baja.Participación).toBe("Baja");
  });
});

describe("matrixToCsv", () => {
  it("incluye header, BOM y escapa comas", () => {
    const csv = matrixToCsv([buildMatrixRow(input)]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(MATRIX_COLUMNS.join(","));
    // el feedback con coma queda entre comillas
    expect(csv).toContain('"positivo, con comas"');
  });
  it("columna faltante en la fila => celda vacía (fallback ?? '')", () => {
    const partial = { Persona: "Solo" } as unknown as MatrixRow;
    const csv = matrixToCsv([partial]);
    const dataLine = csv.split("\n")[1];
    expect(dataLine.startsWith("Solo,")).toBe(true);
    // el resto de columnas quedan vacías
    expect(dataLine).toBe("Solo" + ",".repeat(MATRIX_COLUMNS.length - 1));
  });
});
