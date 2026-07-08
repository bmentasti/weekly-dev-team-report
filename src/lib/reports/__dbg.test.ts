import { it } from "vitest";
import { scoreWithStandard, DEFAULT_STANDARD, metricValue, METRIC_DEFS } from "./standards";
it("dbg", () => {
  const sparse = { ci: { total: 5, deployFailed: 0 } } as any;
  for (const d of METRIC_DEFS) {
    const v = metricValue(d.key, sparse);
    if (v !== null) console.log("evaluated:", d.key, d.category, v);
  }
  const r = scoreWithStandard(sparse, DEFAULT_STANDARD);
  console.log("score", r.score, "confidence", r.confidence, "level", r.level);
  console.log("dims", JSON.stringify(r.dimensions));
});
