import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveActiveProject } from "@/lib/project";
import { getProjectPeople } from "@/lib/reports/people-data";
import { buildMatrixRow } from "@/lib/reports/matrix";
import { canAccessPeople } from "@/lib/reports/people-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveActiveProject(session.user.id);
  if (!project) return NextResponse.json({ rows: [] });
  if (!(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );

  const people = await getProjectPeople(project.id);
  return NextResponse.json({ rows: people.map(buildMatrixRow) });
}
