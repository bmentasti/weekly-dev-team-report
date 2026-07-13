import { prisma } from "@/lib/prisma";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";

export interface ReportAccess {
  reportId: string;
  workspaceId: string;
  isWorkspaceMember: boolean;
  shareId: string | null;
  /** Nivel de vista del acceso (miembros = FULL; shares según su level). */
  level: "EXECUTIVE" | "FULL";
  /** Si puede ver datos por persona en este reporte. */
  canViewPeople: boolean;
}

/**
 * Returns access info if the user can see the report (workspace owner/member or
 * explicitly shared), otherwise null.
 */
export async function getReportAccess(
  userId: string,
  reportId: string,
): Promise<ReportAccess | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      workspaceId: true,
      workspace: {
        select: {
          ownerId: true,
          members: { where: { userId }, select: { id: true } },
        },
      },
      shares: { where: { userId }, select: { id: true, level: true } },
    },
  });
  if (!report) return null;

  const isWorkspaceMember =
    report.workspace.ownerId === userId ||
    report.workspace.members.length > 0;
  const share = report.shares[0] ?? null;

  if (!isWorkspaceMember && !share) return null;

  // Nivel + acceso a datos por persona:
  // - Miembros del workspace: nivel FULL, pero ver personas depende del rol.
  // - Shares: según su level (EXECUTIVE oculta personas).
  let level: "EXECUTIVE" | "FULL" = "FULL";
  let canViewPeople = false;
  if (isWorkspaceMember) {
    const role = await resolveWorkspaceRole(userId, report.workspaceId);
    canViewPeople = can(role, "viewPeople");
  } else if (share) {
    level = share.level === "EXECUTIVE" ? "EXECUTIVE" : "FULL";
    canViewPeople = level === "FULL";
  }

  return {
    reportId: report.id,
    workspaceId: report.workspaceId,
    isWorkspaceMember,
    shareId: share?.id ?? null,
    level,
    canViewPeople,
  };
}

/**
 * Redacta los datos por persona (`metrics.people`) de un reporte cuando el
 * acceso no habilita verlos. Centraliza la lógica que antes vivía suelta en el
 * GET del reporte, para que TODOS los serializadores (JSON, CSV, PDF, email)
 * apliquen el mismo recorte y no se filtren datos sensibles. (SEC-07)
 */
export function redactReportForAccess<T extends { metrics: unknown }>(
  report: T,
  access: Pick<ReportAccess, "canViewPeople">,
): T {
  if (access.canViewPeople || !report.metrics) return report;
  const m = report.metrics as { people?: unknown };
  return {
    ...report,
    metrics: { ...(m as object), people: [] } as T["metrics"],
  };
}

/**
 * Returns the user ids that should be notified about activity on a report:
 * the workspace owner + shared users, excluding the actor.
 */
export async function reportParticipantUserIds(
  reportId: string,
  excludeUserId: string,
): Promise<string[]> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      workspace: { select: { ownerId: true } },
      shares: { select: { userId: true } },
    },
  });
  if (!report) return [];
  const ids = new Set<string>();
  ids.add(report.workspace.ownerId);
  for (const s of report.shares) if (s.userId) ids.add(s.userId);
  ids.delete(excludeUserId);
  return Array.from(ids);
}

export async function notifyUsers(
  userIds: string[],
  type: string,
  message: string,
  reportId?: string,
): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, message, reportId })),
  });
}
