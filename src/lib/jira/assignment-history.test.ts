import { describe, it, expect } from "vitest";
import { assigneeChanges, assigneeAt, wasReassigned } from "./assignment-history";
import { normalizeIssue } from "./classify";
import type { RawJiraIssue } from "./types";

const changelog = {
  histories: [
    {
      created: "2026-07-05T10:00:00.000Z",
      items: [{ field: "assignee", fromString: "Ana", toString: "Bruno" }],
    },
    {
      created: "2026-07-10T10:00:00.000Z",
      items: [{ field: "assignee", fromString: "Bruno", toString: "Carla" }],
    },
    {
      created: "2026-07-06T10:00:00.000Z",
      items: [{ field: "status", fromString: "To Do", toString: "Done" }],
    },
  ],
};

describe("jira assignment-history (§5)", () => {
  it("extrae solo cambios de assignee, ordenados desc", () => {
    const ch = assigneeChanges(changelog);
    expect(ch).toHaveLength(2);
    expect(ch[0].toString).toBe("Carla"); // el más nuevo primero
  });

  it("assigneeAt deshace los cambios posteriores a la fecha", () => {
    const ch = assigneeChanges(changelog);
    // Al 7 de julio, el responsable era Bruno (cambió a Carla recién el 10).
    const at7 = new Date("2026-07-07T00:00:00.000Z").getTime();
    expect(assigneeAt("Carla", ch, at7)).toBe("Bruno");
    // Antes del primer cambio (4 jul), era Ana.
    const at4 = new Date("2026-07-04T00:00:00.000Z").getTime();
    expect(assigneeAt("Carla", ch, at4)).toBe("Ana");
    // Sin fecha => el actual.
    expect(assigneeAt("Carla", ch, null)).toBe("Carla");
  });

  it("wasReassigned detecta reasignaciones", () => {
    expect(wasReassigned(assigneeChanges(changelog), null)).toBe(true);
    expect(wasReassigned([], null)).toBe(false);
  });

  it("normalizeIssue atribuye la tarea DONE al responsable al resolverse, no al actual", () => {
    const raw: RawJiraIssue = {
      key: "DEV-1",
      fields: {
        summary: "t",
        status: { name: "Done", statusCategory: { key: "done" } },
        assignee: { displayName: "Carla" }, // actual
        resolutiondate: "2026-07-07T12:00:00.000Z", // resuelta el 7
        updated: "2026-07-10T12:00:00.000Z",
        created: "2026-07-01T12:00:00.000Z",
      },
      changelog,
    };
    const n = normalizeIssue(raw, "acme.atlassian.net");
    // Se resolvió el 7 → responsable Bruno (aunque hoy figure Carla).
    expect(n.assigneeAtResolution).toBe("Bruno");
    expect(n.assignee).toBe("Carla"); // el campo crudo conserva el actual
    expect(n.reassigned).toBe(true);
  });
});
