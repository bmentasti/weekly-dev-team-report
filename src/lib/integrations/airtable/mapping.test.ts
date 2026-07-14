import { describe, it, expect } from "vitest";
import {
  suggestFieldMapping,
  bestColumnByName,
  parseFieldMap,
  type ColumnDescriptor,
} from "./mapping";

function col(
  name: string,
  type: string,
  samples: string[] = [],
  extra: Partial<ColumnDescriptor> = {},
): ColumnDescriptor {
  return {
    name,
    type,
    samples,
    sampleCount: 10,
    filledCount: samples.length ? 10 : 0,
    multiValue: false,
    linked: false,
    ...extra,
  };
}

describe("suggestFieldMapping", () => {
  const columns = [
    col("Participante", "singleLineText", ["Gonzalo Avalos", "Mariel Gutierrez"]),
    col("Foto", "multipleAttachments", ["img.png"], { multiValue: true }),
    col("Mail corporativo", "email", ["g@acme.com", "m@acme.com"]),
    col("Responsable de la tarea", "multipleRecordLinks", ["recABC"], {
      linked: true,
      linkedTableId: "tblX",
    }),
    col("Estado actual", "singleSelect", ["Doing", "Done"]),
    col("Story Points", "number", ["3", "5", "8"]),
    col("Fecha de finalizacion", "date", ["2026-06-01"]),
    col("Sprint", "singleSelect", ["S1", "S2"]),
  ];
  const s = suggestFieldMapping(columns);
  const byField = new Map(s.map((x) => [x.field, x]));

  it("mapea 'Participante' como nombre del colaborador con alta confianza", () => {
    const hit = byField.get("collaboratorName")!;
    expect(hit.column).toBe("Participante");
    expect(hit.confidence).toBe("alta");
  });

  it("mapea 'Mail corporativo' como email por nombre y contenido", () => {
    const hit = byField.get("email")!;
    expect(hit.column).toBe("Mail corporativo");
    expect(hit.confidence).toBe("alta");
  });

  it("mapea 'Responsable de la tarea' como responsable", () => {
    expect(byField.get("assignee")!.column).toBe("Responsable de la tarea");
  });

  it("mapea 'Estado actual' como estado", () => {
    expect(byField.get("status")!.column).toBe("Estado actual");
  });

  it("no asigna dos campos a la misma columna", () => {
    const used = s.map((x) => x.column).filter(Boolean);
    expect(new Set(used).size).toBe(used.length);
  });

  it("marca como requiere_validacion los campos sin candidata", () => {
    const prio = byField.get("priority")!;
    expect(prio.column).toBeNull();
    expect(prio.confidence).toBe("requiere_validacion");
  });
});

describe("bestColumnByName", () => {
  it("resuelve por sinónimo aunque el nombre no sea el default", () => {
    const names = ["Participante", "Estado actual", "Mail corporativo"];
    expect(bestColumnByName("status", names)).toBe("Estado actual");
    expect(bestColumnByName("collaboratorName", names)).toBe("Participante");
  });

  it("devuelve null cuando no hay match razonable", () => {
    expect(bestColumnByName("priority", ["Foto", "Notas"])).toBeNull();
  });
});

describe("parseFieldMap", () => {
  it("parsea JSON string y objeto, y tolera basura", () => {
    expect(parseFieldMap('{"status":"Estado actual"}')).toEqual({
      status: "Estado actual",
    });
    expect(parseFieldMap({ email: "Mail corporativo" })).toEqual({
      email: "Mail corporativo",
    });
    expect(parseFieldMap("no-json")).toEqual({});
    expect(parseFieldMap(null)).toEqual({});
  });
});
