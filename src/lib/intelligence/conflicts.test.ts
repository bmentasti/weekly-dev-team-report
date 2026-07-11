import { describe, it, expect } from "vitest";
import {
  detectWorkConflicts,
  detectOperationalConflicts,
} from "./conflicts";
import type { WorkGroup } from "./correlation";

function group(partial: Partial<WorkGroup> & { key: string }): WorkGroup {
  return { signals: [], confidence: 90, evidence: ["ticket_key"], ...partial };
}

describe("detectWorkConflicts", () => {
  it("tarea cerrada sin PR", () => {
    const g = group({
      key: "DEV-1",
      signals: [{ kind: "work_item", source: "jira", externalId: "DEV-1", title: "t", url: "u", bucket: "DONE" }],
    });
    const conflicts = detectWorkConflicts([g]);
    expect(conflicts.map((c) => c.type)).toContain("done_without_code");
    expect(conflicts[0].prioritySource).toBe("jira");
  });

  it("PR mergeado con tarea abierta", () => {
    const g = group({
      key: "DEV-2",
      signals: [
        { kind: "work_item", source: "jira", externalId: "DEV-2", title: "t", url: "u", bucket: "IN_PROGRESS" },
        { kind: "code_change", source: "github", externalId: "5", title: "DEV-2", url: "u", codeState: "MERGED" },
      ],
    });
    expect(detectWorkConflicts([g]).map((c) => c.type)).toContain("merged_task_open");
  });

  it("tarea hecha con checks fallando → severidad alta", () => {
    const g = group({
      key: "DEV-3",
      signals: [
        { kind: "work_item", source: "jira", externalId: "DEV-3", title: "t", url: "u", bucket: "DONE" },
        { kind: "code_change", source: "github", externalId: "6", title: "DEV-3", url: "u", codeState: "MERGED", checksFailing: true },
      ],
    });
    const c = detectWorkConflicts([g]).find((x) => x.type === "done_with_failing_checks");
    expect(c).toBeDefined();
    expect(c!.severity).toBe("high");
  });

  it("tarea sana con PR mergeado y sin checks fallando → sin conflicto", () => {
    const g = group({
      key: "DEV-4",
      signals: [
        { kind: "work_item", source: "jira", externalId: "DEV-4", title: "t", url: "u", bucket: "DONE" },
        { kind: "code_change", source: "github", externalId: "7", title: "DEV-4", url: "u", codeState: "MERGED", checksFailing: false },
      ],
    });
    expect(detectWorkConflicts([g])).toHaveLength(0);
  });
});

describe("detectOperationalConflicts", () => {
  const src = ["jira", "github", "sentry"];

  it("pipeline ok + deploy fallido", () => {
    const c = detectOperationalConflicts({ entity: "P1", sourcesPresent: src, pipelineSuccess: true, deploymentFailed: true });
    expect(c.map((x) => x.type)).toContain("pipeline_ok_deploy_failed");
  });

  it("release con errores críticos → critical", () => {
    const c = detectOperationalConflicts({ entity: "R1", sourcesPresent: src, releaseDone: true, prodCriticalErrors: 4 });
    const rel = c.find((x) => x.type === "release_with_critical_errors");
    expect(rel?.severity).toBe("critical");
    expect(rel?.prioritySource).toBe("sentry");
  });

  it("capacidad declarada 80 vs real 120 → sobrecarga", () => {
    const c = detectOperationalConflicts({ entity: "team", sourcesPresent: src, capacityDeclaredPct: 80, capacityActualPct: 120 });
    expect(c.map((x) => x.type)).toContain("capacity_overload");
  });

  it("sin contradicciones → vacío", () => {
    const c = detectOperationalConflicts({ entity: "P2", sourcesPresent: src, pipelineSuccess: true, deploymentFailed: false });
    expect(c).toHaveLength(0);
  });
});
