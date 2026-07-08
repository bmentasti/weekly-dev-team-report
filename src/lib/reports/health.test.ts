import { describe, it, expect } from "vitest";
import { HEALTH_LABEL, healthBadgeVariant } from "./health";

describe("health", () => {
  it("labels", () => {
    expect(HEALTH_LABEL.HEALTHY).toBe("Saludable");
    expect(HEALTH_LABEL.MEDIUM_RISK).toBe("Riesgo medio");
    expect(HEALTH_LABEL.HIGH_RISK).toBe("Riesgo alto");
  });
  it("healthBadgeVariant cubre todos los casos", () => {
    expect(healthBadgeVariant("HEALTHY")).toBe("success");
    expect(healthBadgeVariant("MEDIUM_RISK")).toBe("warning");
    expect(healthBadgeVariant("HIGH_RISK")).toBe("destructive");
    expect(healthBadgeVariant(null)).toBe("secondary");
    expect(healthBadgeVariant(undefined)).toBe("secondary");
  });
});
