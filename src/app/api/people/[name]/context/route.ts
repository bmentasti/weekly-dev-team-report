import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";

const FIELDS = [
  "role",
  "seniority",
  "daily",
  "refinement",
  "retro",
  "demo",
  "ownership",
  "feedback",
  "notes",
] as const;

export async function GET(
  _request: Request,
  { params }: { params: { name: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveActiveProject(session.user.id);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project) return NextResponse.json({ context: null });

  const name = decodeURIComponent(params.name);
  const context = await prisma.personContext.findUnique({
    where: { projectId_name: { projectId: project.id, name } },
  });
  return NextResponse.json({ context });
}

export async function POST(
  request: Request,
  { params }: { params: { name: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveActiveProject(session.user.id);
  if (project && !(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );
  if (!project)
    return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });

  const name = decodeURIComponent(params.name);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = body[f];
    if (typeof v === "string") data[f] = v.trim();
  }

  await prisma.personContext.upsert({
    where: { projectId_name: { projectId: project.id, name } },
    update: data,
    create: { projectId: project.id, name, ...data },
  });
  return NextResponse.json({ ok: true });
}
