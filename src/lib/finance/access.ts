// Resolución de capacidades financieras para un proyecto concreto (server-only).
// Combina la pertenencia al proyecto con el rol de acceso en el workspace.

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can, type Capability } from "@/lib/permissions";
import { canAccessProject } from "@/lib/project";
import { effectivePlan, financeEnabled } from "@/lib/plans";

/**
 * ¿Puede el usuario ejercer `cap` sobre las finanzas de este proyecto?
 * Además del rol (RBAC), exige que el PLAN del workspace incluya el módulo:
 * el módulo Budget, Forecast & Profitability es exclusivo de Team y Pro.
 */
export async function canFinance(
  userId: string,
  projectId: string,
  cap: Capability,
): Promise<boolean> {
  if (!(await canAccessProject(userId, projectId))) return false;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      workspaceId: true,
      workspace: { select: { plan: true, trialEndsAt: true } },
    },
  });
  if (!project) return false;
  // Gating por plan (Team/Pro; Pro durante el reverse trial).
  if (!financeEnabled(effectivePlan(project.workspace))) return false;
  const role = await resolveWorkspaceRole(userId, project.workspaceId);
  return can(role, cap);
}
