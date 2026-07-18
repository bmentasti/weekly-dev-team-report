import { describe, it, expect } from "vitest";
import { unifyPeople } from "./people-unify";
import { makeResolver } from "./identity";
import type { PersonInsight, PersonTimelinePoint } from "./types";

function person(
  id: string,
  name: string,
  timeline: PersonTimelinePoint[],
): PersonInsight {
  return {
    id,
    name,
    tasksDone: 0,
    tasksInProgress: 0,
    tasksBlocked: 0,
    tasksStale: 0,
    prsOpen: 0,
    prsMerged: 0,
    committedPoints: 0,
    completedPoints: 0,
    wip: 0,
    throughput: 0,
    cycleTimeAvgDays: null,
    category: "ON_TRACK",
    score: 0,
    rank: 0,
    nextStep: "",
    lastActivityAt: null,
    timeline,
  };
}

describe("unifyPeople timeline merge", () => {
  it("suma los timelines por corte cuando dos identidades se fusionan", () => {
    // "p2" es alias de "p1": deben unificarse en una sola persona.
    const resolve = makeResolver({
      identities: [{ key: "p1", displayName: "Ana" }],
      aliases: [
        {
          source: "*",
          handle: "p2",
          canonicalId: "p1",
          displayName: "Ana",
          verified: true,
        },
      ],
    });
    const a = person("p1", "Ana", [
      { label: "d1", done: 1, merged: 0, blocked: 1, velocityPoints: 2 },
      { label: "d2", done: 0, merged: 1, blocked: 0, velocityPoints: 0 },
    ]);
    const b = person("p2", "Ana", [
      { label: "d1", done: 2, merged: 1, blocked: 0, velocityPoints: 3 },
      { label: "d2", done: 1, merged: 0, blocked: 0, velocityPoints: 1 },
    ]);

    const out = unifyPeople([a, b], resolve, () => "");
    expect(out).toHaveLength(1);
    const tl = out[0].timeline!;
    expect(tl).toHaveLength(2);
    expect(tl[0]).toMatchObject({ label: "d1", done: 3, merged: 1, blocked: 1, velocityPoints: 5 });
    expect(tl[1]).toMatchObject({ label: "d2", done: 1, merged: 1, blocked: 0, velocityPoints: 1 });
  });

  it("conserva el timeline cuando no hay fusión", () => {
    const resolve = makeResolver({ identities: [], aliases: [] });
    const a = person("solo", "Solo", [
      { label: "d1", done: 3, merged: 2, blocked: 0, velocityPoints: 5 },
    ]);
    const out = unifyPeople([a], resolve, () => "");
    expect(out[0].timeline).toHaveLength(1);
    expect(out[0].timeline![0].done).toBe(3);
  });
});
