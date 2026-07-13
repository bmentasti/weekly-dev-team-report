import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";

export const ACTIVE_PROJECT_COOKIE = "activeProjectId";

/**
 * Projects the user can access: any project in a workspace they own or belong to,
 * or where they are an explicit project member.
 */
export async function listProjectsForUser(userId: string) {
  return prisma.project.findMany({
    where: {
      OR: [
        { workspace: { ownerId: userId } },
        { workspace: { members: { some: { userId } } } },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Resolves the active project for the user from the cookie (or an explicit id),
 * falling back to their first accessible project. Returns null if none exist.
 */
export async function resolveActiveProject(
  userId: string,
  explicitId?: string,
) {
  const cookieId =
    explicitId ?? cookies().get(ACTIVE_PROJECT_COOKIE)?.value ?? undefined;
  const projects = await listProjectsForUser(userId);
  if (projects.length === 0) return null;
  if (cookieId) {
    const found = projects.find((p) => p.id === cookieId);
    if (found) return found;
  }
  return projects[0];
}

/** Whether the user can access a specific project. */
export async function canAccessProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { workspace: { ownerId: userId } },
        { workspace: { members: { some: { userId } } } },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  return !!project;
}

/**
 * Whether the user can ADMINISTER a project (rename, delete, manage members).
 * A diferencia de `canAccessProject` (que sólo comprueba visibilidad), esto
 * exige la capability `manageProjects` (OWNER/ADMIN del workspace). Evita que
 * un MEMBER/VIEWER pueda renombrar/borrar proyectos o tocar la membresía. (SEC-01)
 */
export async function canManageProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return false;
  const role = await resolveWorkspaceRole(userId, project.workspaceId);
  return can(role, "manageProjects");
}
