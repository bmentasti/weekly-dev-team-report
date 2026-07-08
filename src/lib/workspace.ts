import { prisma } from "@/lib/prisma";
import type { AccessRole } from "@/lib/permissions";

/**
 * Returns the workspace a user can act on. For the MVP a user works within a
 * single workspace, so we resolve the given id (checking membership) or fall
 * back to their most recent workspace.
 */
export async function resolveWorkspaceForUser(
  userId: string,
  workspaceId?: string,
) {
  if (workspaceId) {
    return prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });
  }

  return prisma.workspace.findFirst({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Rol de acceso del usuario en un workspace. El owner siempre es OWNER;
 * el resto surge de WorkspaceMember. null si no pertenece.
 */
export async function resolveWorkspaceRole(
  userId: string,
  workspaceId: string,
): Promise<AccessRole | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });
  if (!ws) return null;
  if (ws.ownerId === userId) return "OWNER";
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
    select: { role: true },
  });
  return (member?.role as AccessRole) ?? null;
}
