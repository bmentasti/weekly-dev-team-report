// Modelo de permisos por rol de acceso (RBAC). El rol de acceso vive en
// WorkspaceRole (OWNER/ADMIN/MEMBER/VIEWER). El rol funcional (User.role:
// TL/PO/Director/…) personaliza la experiencia pero NO otorga permisos.

export type AccessRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Capability =
  | "viewReports"
  | "generateReports"
  | "shareReports"
  | "editReport" // notas, tags, marcar revisado
  | "viewPeople" // análisis y datos por persona (SENSIBLE)
  | "editStandards" // umbrales del workspace
  | "editProjectStandards" // umbrales por proyecto (además requiere plan Pro)
  | "connectIntegrations"
  | "exportData"
  | "viewAudit"
  | "inviteUsers"
  | "manageRoles"
  | "changePlan"
  | "deleteWorkspace";

const MATRIX: Record<AccessRole, Capability[]> = {
  OWNER: [
    "viewReports",
    "generateReports",
    "shareReports",
    "editReport",
    "viewPeople",
    "editStandards",
    "editProjectStandards",
    "connectIntegrations",
    "exportData",
    "viewAudit",
    "inviteUsers",
    "manageRoles",
    "changePlan",
    "deleteWorkspace",
  ],
  ADMIN: [
    "viewReports",
    "generateReports",
    "shareReports",
    "editReport",
    "viewPeople",
    "editStandards",
    "editProjectStandards",
    "connectIntegrations",
    "exportData",
    "viewAudit",
    "inviteUsers",
    "manageRoles",
    // NO changePlan / deleteWorkspace (solo Owner)
  ],
  MEMBER: [
    "viewReports",
    "generateReports",
    "shareReports",
    "editReport",
    "viewPeople", // acotado a sus proyectos (el scope lo aplica cada endpoint)
    "exportData",
  ],
  VIEWER: [
    "viewReports", // solo lo compartido / de sus proyectos
    // sin datos por persona, sin edición, sin export por defecto
  ],
};

export function can(role: AccessRole | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(cap) ?? false;
}

export const ROLE_LABEL: Record<AccessRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Miembro",
  VIEWER: "Viewer",
};
