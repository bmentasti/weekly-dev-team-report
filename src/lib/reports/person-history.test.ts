import { describe, it, expect } from "vitest";
import { comparePersonToSelf, type PersonHistoryPoint } from "./person-history";

function pt(p: Partial<PersonHistoryPoint>): PersonHistoryPoint {
  return {
    label: "S",
    tasksDone: 0,
    throughput: 0,
    completedPoints: 0,
    blocked: 0,
    stale: 0,
    tier: "CUMPLE",
    ...p,
  };
}

describe("comparePersonToSelf", () => {
  it("un solo período: no comparable, prioriza el propio historial", () => {
    const r = comparePersonToSelf([pt({ label: "S1", tasksDone: 3 })]);
    expect(r.comparable).toBe(false);
    expect(r.trend).toBe("flat");
  });

  it("mejora: más throughput y menos bloqueos que su período anterior", () => {
    const r = comparePersonToSelf([
      pt({ label: "S1", throughput: 2, blocked: 3, tasksDone: 2 }),
      pt({ label: "S2", throughput: 5, blocked: 0, tasksDone: 5 }),
    ]);
    expect(r.trend).toBe("up");
    const thr = r.deltas.find((d) => d.metric === "throughput")!;
    expect(thr.sentiment).toBe("good");
    const blk = r.deltas.find((d) => d.metric === "blocked")!;
    expect(blk.sentiment).toBe("good"); // bajar bloqueos es bueno
  });

  it("retrocede: más tareas trabadas y menos entregas", () => {
    const r = comparePersonToSelf([
      pt({ label: "S1", throughput: 5, stale: 0, tasksDone: 5 }),
      pt({ label: "S2", throughput: 2, stale: 3, tasksDone: 1 }),
    ]);
    expect(r.trend).toBe("down");
  });

  it("deltaPct es null cuando el período previo era 0", () => {
    const r = comparePersonToSelf([
      pt({ label: "S1", completedPoints: 0 }),
      pt({ label: "S2", completedPoints: 8 }),
    ]);
    const cp = r.deltas.find((d) => d.metric === "completedPoints")!;
    expect(cp.deltaPct).toBeNull();
    expect(cp.deltaAbs).toBe(8);
  });
});
