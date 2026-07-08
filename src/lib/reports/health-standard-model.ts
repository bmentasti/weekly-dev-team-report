import { prisma } from "@/lib/prisma";
import type { HealthStandardConfig } from "./standards";

/**
 * Delegates tipados para HealthStandard y su historial.
 *
 * Los modelos existen en schema.prisma; el cliente generado los expone tras
 * `prisma generate` (parte de `db:push`/`build`). Tipamos el acceso con un
 * contrato mínimo para evitar `as any` y mantener seguridad de tipos. Si el
 * cliente aún no está regenerado, la propiedad es undefined y los consumidores
 * deben envolver la llamada en try/catch (degradación explícita).
 */
export interface HealthStandardRow {
  id: string;
  workspaceId: string;
  projectId: string | null;
  config: HealthStandardConfig;
  reason: string | null;
  updatedById: string | null;
  updatedAt: Date;
}

interface HealthStandardDelegate {
  findFirst(args: {
    where: { workspaceId: string; projectId: string | null };
  }): Promise<HealthStandardRow | null>;
  upsert(args: {
    where: { workspaceId_projectId: { workspaceId: string; projectId: string | null } };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<HealthStandardRow>;
  deleteMany(args: {
    where: { workspaceId: string; projectId: string | null };
  }): Promise<{ count: number }>;
}

export interface HealthStandardHistoryRow {
  id: string;
  config: HealthStandardConfig;
  reason: string | null;
  changedByName: string | null;
  createdAt: Date;
}

interface HealthStandardHistoryDelegate {
  create(args: { data: Record<string, unknown> }): Promise<HealthStandardHistoryRow>;
  findMany(args: {
    where: { workspaceId: string; projectId: string | null };
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
  }): Promise<HealthStandardHistoryRow[]>;
}

export function healthStandardModel(): HealthStandardDelegate | undefined {
  return (
    prisma as unknown as { healthStandard?: HealthStandardDelegate }
  ).healthStandard;
}

export function healthStandardHistoryModel():
  | HealthStandardHistoryDelegate
  | undefined {
  return (
    prisma as unknown as {
      healthStandardHistory?: HealthStandardHistoryDelegate;
    }
  ).healthStandardHistory;
}

export interface AlertRuleRow {
  id: string;
  metricKey: string;
  operator: string;
  threshold: number;
  severity: string;
  enabled: boolean;
}

interface AlertRuleDelegate {
  findMany(args: {
    where: { workspaceId: string; projectId: string | null };
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<AlertRuleRow[]>;
  create(args: { data: Record<string, unknown> }): Promise<AlertRuleRow>;
  deleteMany(args: {
    where: { id: string; workspaceId: string };
  }): Promise<{ count: number }>;
}

export function alertRuleModel(): AlertRuleDelegate | undefined {
  return (prisma as unknown as { alertRule?: AlertRuleDelegate }).alertRule;
}
