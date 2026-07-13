import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { getProjectPeople } from "@/lib/reports/people-data";
import { buildMatrixRow, matrixToCsv } from "@/lib/reports/matrix";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const explicitId =
    new URL(req.url).searchParams.get("projectId") ?? undefined;
  const project = await resolveActiveProject(session.user.id, explicitId);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const people = await getProjectPeople(project.id);
  const csv = matrixToCsv(people.map(buildMatrixRow));
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="matriz-equipo-${day}.csv"`,
    },
  });
}
