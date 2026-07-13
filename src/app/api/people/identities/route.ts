import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject, canManageProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { makeResolver } from "@/lib/reports/identity";
import {
  getIdentityConfig,
  listIdentities,
  mergeIdentities,
  deleteIdentity,
} from "@/lib/reports/identity-store";
import type { ReportMetrics } from "@/lib/reports/types";

async function resolveProject(req: Request, userId: string) {
  const explicitId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  return resolveActiveProject(userId, explicitId);
}

/** Personas canónicas detectadas en los últimos reportes (id + nombre). */
async function canonicalPeople(projectId: string) {
  const [reports, config] = await Promise.all([
    prisma.report.findMany({
      where: { projectId },
      orderBy: { periodEnd: "asc" },
      take: 6,
      select: { metrics: true },
    }),
    getIdentityConfig(projectId),
  ]);
  const resolve = makeResolver(config);
  const seen = new Map<string, { id: string; name: string; rawHandles: Set<string> }>();
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const { id, name } = resolve({ source: null, handle: p.id ?? p.name });
      const key = id || p.name;
      const e = seen.get(key) ?? { id: key, name: name || p.name, rawHandles: new Set<string>() };
      e.rawHandles.add(p.name);
      seen.set(key, e);
    }
  }
  return Array.from(seen.values())
    .map((e) => ({ id: e.id, name: e.name, rawHandles: Array.from(e.rawHandles) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveProject(req, session.user.id);
  if (!project) return NextResponse.json({ people: [], identities: [] });
  if (!(await canAccessPeople(session.user.id, project.workspaceId)))
    return NextResponse.json(
      { error: "Sin permiso para ver datos por persona." },
      { status: 403 },
    );

  const [people, identities] = await Promise.all([
    canonicalPeople(project.id),
    listIdentities(project.id),
  ]);
  return NextResponse.json({
    people,
    identities: identities.map((i) => ({
      id: i.id,
      key: i.key,
      displayName: i.displayName,
      aliases: (i.aliases ?? []).map((a) => ({ source: a.source, handle: a.handle })),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveProject(req, session.user.id);
  if (!project) return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });
  if (!(await canManageProject(session.user.id, project.id)))
    return NextResponse.json(
      { error: "Necesitás rol de administración del proyecto." },
      { status: 403 },
    );

  const body = (await req.json().catch(() => ({}))) as {
    primaryId?: string;
    displayName?: string;
    mergeIds?: string[];
  };
  const primaryId = body.primaryId?.trim();
  const displayName = body.displayName?.trim() || primaryId;
  const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds : [];
  if (!primaryId || !displayName)
    return NextResponse.json({ error: "Falta la persona principal." }, { status: 400 });

  const identity = await mergeIdentities({
    projectId: project.id,
    primaryId,
    displayName,
    mergeIds,
  });
  return NextResponse.json({ ok: true, identity: { id: identity.id, key: identity.key } });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const project = await resolveProject(req, session.user.id);
  if (!project) return NextResponse.json({ error: "No tenés un proyecto." }, { status: 400 });
  if (!(await canManageProject(session.user.id, project.id)))
    return NextResponse.json(
      { error: "Necesitás rol de administración del proyecto." },
      { status: 403 },
    );

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id de la identidad." }, { status: 400 });
  const ok = await deleteIdentity(project.id, id);
  return NextResponse.json({ ok });
}
