import type { HealthLevel } from "./types";

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  HEALTHY: "Saludable",
  MEDIUM_RISK: "Riesgo medio",
  HIGH_RISK: "Riesgo alto",
};

export function healthBadgeVariant(
  h: HealthLevel | null | undefined,
): "success" | "warning" | "destructive" | "secondary" {
  if (h === "HEALTHY") return "success";
  if (h === "MEDIUM_RISK") return "warning";
  if (h === "HIGH_RISK") return "destructive";
  return "secondary";
}
