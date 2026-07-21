import { describe, it, expect } from "vitest";
import type { PersonInsight } from "./types";
import { categorizePerson, scorePerson } from "./evaluation-category";

function person(p: Partial<PersonInsight>): PersonInsight {
  return {
    name: p.name ?? "Persona",
    id: p.id,
    tasksDone: p.tasksDone ?? 0,
    tasksInProgress: p.tasksInProgress ?? 0,
    tasksBlocked: p.tasksBlocked ?? 0,
    tasksStale: p.tasksStale ?? 0,
    tasksTodo: p.tasksTodo ?? 0,
    committedTasks: p.committedTasks ?? 0,
    addedTasks: p.addedTasks ?? 0,
    prsOpen: p.prsOpen ?? 0,
    prsMerged: p.prsMerged ?? 0,
    committedPoints: p.committedPoints ?? 0,
    completedPoints: p.completedPoints ?? 0,
    wip: p.wip ?? 0,
    throughput: p.throughput ?? 0,
    cycleTimeAvgDays: null,
    category: "ON_TRACK",
    score: 0,
    rank: 0,
    nextStep: "",
  };
}

describe("evaluation-category — categorías evidencia-based", () => {
  it("V6: una tarea completada impacta positivamente en el score", () => {
    const withDone = person({ tasksDone: 3, committedTasks: 3, throughput: 3 });
    const none = person({ tasksTodo: 3, committedTasks: 3 });
    expect(scorePerson(withDone)).toBeGreaterThan(scorePerson(none));
  });

  it("V7: una tarea en progreso dentro del plazo no es automáticamente negativa", () => {
    const p = person({
      tasksInProgress: 2,
      tasksDone: 1,
      committedTasks: 3,
      tasksStale: 0,
      tasksBlocked: 0,
    });
    expect(categorizePerson(p).category).not.toBe("SUPPORT");
  });

  it("V8: bloqueo por dependencia externa (sin estancamiento) NO es 'necesita apoyo'", () => {
    const blockedNotStale = person({
      tasksDone: 2,
      tasksInProgress: 1,
      tasksBlocked: 1,
      tasksStale: 0,
      committedTasks: 4,
    });
    // Bloqueada pero con avance y sin estancamiento → en seguimiento, no SUPPORT.
    expect(categorizePerson(blockedNotStale).category).not.toBe("SUPPORT");

    const blockedAndStale = person({
      tasksBlocked: 2,
      tasksStale: 2,
      committedTasks: 3,
    });
    // Bloqueo prolongado (bloqueada + estancada) → sí SUPPORT, con evidencia.
    const r = categorizePerson(blockedAndStale);
    expect(r.category).toBe("SUPPORT");
    expect(r.reason).toMatch(/bloquead/i);
  });

  it("V9: una persona con trabajo completado no aparece como 'necesita apoyo' sin causa", () => {
    const p = person({
      tasksDone: 5,
      committedTasks: 6,
      tasksInProgress: 1,
      tasksBlocked: 0,
      tasksStale: 0,
      throughput: 5,
    });
    expect(categorizePerson(p).category).toBe("RECOGNIZE");
  });

  it("V10: una persona sin información suficiente → 'Datos insuficientes' (no 'Necesita apoyo')", () => {
    const empty = person({});
    const r = categorizePerson(empty);
    expect(r.category).toBe("INSUFFICIENT_DATA");
    expect(r.category).not.toBe("SUPPORT");
  });

  it("SUPPORT solo con evidencia: baja finalización sobre trabajo realmente asignado", () => {
    const p = person({ tasksTodo: 4, committedTasks: 4, tasksDone: 0 });
    const r = categorizePerson(p);
    expect(r.category).toBe("SUPPORT");
    expect(r.reason).toMatch(/sin progreso|avance/i);
  });

  it("no penaliza por tener MENOS tareas que otro integrante", () => {
    const few = person({ tasksDone: 1, committedTasks: 1, throughput: 1 });
    // 1 de 1 completada = 100% → no debe caer en SUPPORT.
    expect(categorizePerson(few).category).not.toBe("SUPPORT");
  });

  it("el score es proporcional al cumplimiento, no a la cantidad absoluta", () => {
    // Persona A: 2/2 completadas (100%). Persona B: 4/20 completadas (20%).
    const a = person({ tasksDone: 2, committedTasks: 2, throughput: 2 });
    const b = person({ tasksDone: 4, committedTasks: 20, tasksTodo: 16, throughput: 4 });
    expect(scorePerson(a)).toBeGreaterThan(scorePerson(b));
  });

  it("cada categoría trae una explicación específica (no genérica)", () => {
    const r = categorizePerson(person({ tasksDone: 3, committedTasks: 4, throughput: 3 }));
    expect(r.reason.length).toBeGreaterThan(10);
    expect(r.reason).not.toMatch(/^(bajo rendimiento|necesita apoyo)$/i);
  });
});
