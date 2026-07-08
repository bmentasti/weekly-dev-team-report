import "server-only";
import { resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";

/**
 * ¿El usuario puede ver datos/analítica por persona en este workspace?
 * Los datos por persona son sensibles: solo roles con la capability viewPeople.
 */
export async function canAccessPeople(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const role = await resolveWorkspaceRole(userId, workspaceId);
  return can(role, "viewPeople");
}
