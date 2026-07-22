import {
  getProviderByType,
  type IntegrationTypeName,
  type ProviderKind,
} from "@/lib/integrations/catalog";

export type PlanTierName = "FREE" | "TEAM" | "PRO";
export type BillingPeriodName = "MONTHLY" | "ANNUAL";

export interface PlanDefinition {
  name: string;
  monthly: number; // USD/mes
  /** Max projects; null = unlimited. */
  maxProjects: number | null;
  /** Max workspace members; null = unlimited. */
  maxMembers: number | null;
  /** Reportes generables por mes; null = ilimitado. */
  maxReportsPerMonth: number | null;
  /** Ventana de histórico visible en meses; null = ilimitado. */
  historyMonths: number | null;
  /** Export a PDF habilitado (CSV está en todos los planes). */
  pdfExport: boolean;
  /** Etiqueta corta de integraciones incluidas (para UI). */
  integrationsLabel: string;
  /** Kinds de integración habilitados (además del whitelist de Free). */
  allowedKinds: ProviderKind[];
  multiProject: boolean;
  slackDelivery: boolean;
  /** Módulo Budget, Forecast & Profitability (solo Team y Pro). */
  financials: boolean;
}

// Free solo permite estas, sin importar el kind.
const FREE_WHITELIST: IntegrationTypeName[] = ["JIRA", "GITHUB"];

export const ANNUAL_MONTHS = 10; // pagás 10, 2 gratis

export const PLANS: Record<PlanTierName, PlanDefinition> = {
  FREE: {
    name: "Free",
    monthly: 0,
    maxProjects: 1,
    maxMembers: 5,
    maxReportsPerMonth: 10,
    historyMonths: 3,
    pdfExport: false,
    integrationsLabel: "Jira + GitHub",
    allowedKinds: [],
    multiProject: false,
    slackDelivery: false,
    financials: false,
  },
  TEAM: {
    name: "Team",
    monthly: 29,
    maxProjects: 1,
    maxMembers: 45,
    maxReportsPerMonth: null,
    historyMonths: 12,
    pdfExport: true,
    integrationsLabel: "Tareas, código y planificación",
    allowedKinds: ["ISSUES", "CODE", "PLANNING"],
    multiProject: false,
    slackDelivery: false,
    financials: true,
  },
  PRO: {
    name: "Pro",
    monthly: 79,
    maxProjects: null,
    maxMembers: null,
    maxReportsPerMonth: null,
    historyMonths: null,
    pdfExport: true,
    integrationsLabel: "Todas (+ comunicación, IA y planificación)",
    allowedKinds: ["ISSUES", "CODE", "COMM", "AI", "PLANNING"],
    multiProject: true,
    slackDelivery: true,
    financials: true,
  },
};

export const PLAN_ORDER: PlanTierName[] = ["FREE", "TEAM", "PRO"];

export const TRIAL_DAYS = 14;

type WorkspaceLike =
  | { plan: string; trialEndsAt?: Date | string | null }
  | null
  | undefined;

/** ¿El reverse trial (Pro gratis) está activo? */
export function isTrialActive(ws: WorkspaceLike): boolean {
  if (!ws?.trialEndsAt) return false;
  return new Date(ws.trialEndsAt).getTime() > Date.now();
}

/** Días restantes de trial (0 si no hay). */
export function trialDaysLeft(ws: WorkspaceLike): number {
  if (!isTrialActive(ws) || !ws?.trialEndsAt) return 0;
  const ms = new Date(ws.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Plan EFECTIVO para gating de features: durante el reverse trial se comporta
 * como Pro; si no, es el plan almacenado. Usar en todos los chequeos de
 * features — NO en billing (donde importa el plan real que se paga).
 */
export function effectivePlan(ws: WorkspaceLike): PlanTierName {
  if (isTrialActive(ws)) return "PRO";
  return (ws?.plan ?? "FREE") as PlanTierName;
}

/** ¿El plan incluye el módulo Budget, Forecast & Profitability? (Team y Pro) */
export function financeEnabled(plan: PlanTierName): boolean {
  return PLANS[plan].financials;
}

export function annualTotal(monthly: number): number {
  return monthly * ANNUAL_MONTHS;
}

export function integrationAllowed(
  plan: PlanTierName,
  type: IntegrationTypeName,
): boolean {
  if (FREE_WHITELIST.includes(type)) return true; // Jira/GitHub en todos los planes
  if (plan === "FREE") return false;
  const kind = getProviderByType(type)?.kind;
  if (!kind) return false;
  return PLANS[plan].allowedKinds.includes(kind);
}

/** `t` opcional: si se pasa, "Ilimitado" sale traducido; si no, cae a español. */
export function limitLabel(v: number | null, t?: (key: string) => string): string {
  if (v === null) return t ? t("lib.plan.unlimited") : "Ilimitado";
  return String(v);
}

/** Fecha de corte de histórico para el plan (null = sin límite). */
export function historyCutoff(plan: PlanTierName): Date | null {
  const months = PLANS[plan].historyMonths;
  if (months === null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}
