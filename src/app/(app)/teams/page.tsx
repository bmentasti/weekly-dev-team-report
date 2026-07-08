import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveActiveProject } from "@/lib/project";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { can } from "@/lib/permissions";
import { ProjectTeam } from "@/components/project-team";
import { TeamAlerts } from "@/components/team-alerts";
import { TeamMatrix } from "@/components/team-matrix";
import { MembersManager } from "@/components/members-manager";
import { Card, CardContent } from "@/components/ui/card";

export default async function TeamsPage() {
  const session = await getServerSession(authOptions);
  const project = await resolveActiveProject(session!.user.id);
  const workspace = await resolveWorkspaceForUser(session!.user.id);
  const role = workspace
    ? await resolveWorkspaceRole(session!.user.id, workspace.id)
    : null;
  const canViewPeople = can(role, "viewPeople");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná los miembros del workspace y sus roles. Los datos por persona
          solo los ven roles con permiso.
        </p>
      </div>

      {/* Gestión de miembros y roles (workspace-level) */}
      <MembersManager />

      {project ? (
        canViewPeople ? (
          <>
            <TeamAlerts />
            <TeamMatrix />
            <ProjectTeam projectId={project.id} />
          </>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              El análisis por persona (matriz, alertas y desempeño) está
              disponible para roles con permiso. Tu rol actual no lo incluye.
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No hay un proyecto activo.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
