import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject, canManageProject } from "@/lib/project";
import { canAccessPeople } from "@/lib/reports/people-access";
import { makeResolver, resolvePerson } from "@/lib/reports/identity";
import { suggestMerges, autoMergeGroups } from "@/lib/reports/identity-suggest";
import {
  getIdentityConfig,
  listIdentities,
  mergeIdentities,
  deleteIdentity,
  confirmAlias,
  unlinkAlias,
} from "@/lib/reports/identity-store";
import { logAudit } from "@/lib/audit";
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
  const resolved: { p: { name: string }; id: string; name: string }[] = [];
  for (const r of reports) {
    const m = r.metrics as ReportMetrics | null;
    for (const p of m?.people ?? []) {
      const { id, name } = resolvePerson(resolve, p);
      resolved.push({ p, id: id || p.name, name: name || p.name });
    }
  }
  const distinct = new Map<string, string>();
  for (const r of resolved) if (!distinct.has(r.id)) distinct.set(r.id, r.name);
  const { groupId, displayName } = autoMergeGroups(
    Array.from(distinct, ([id, name]) => ({ id, name })),
  );

  const seen = new Map<string, { id: string; name: string; rawHandles: Set<string> }>();
  for (const { p, id, name } of resolved) {
    const key = groupId.get(id) ?? id;
    const e = seen.get(key) ?? {
      id: key,
      name: displayName.get(id) ?? name,
      rawHandles: new Set<string>(),
    };
    e.rawHandles.add(p.name);
    seen.set(key, e);
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
  const suggestions = suggestMerges(people.map((p) => ({ id: p.id, name: p.name })));
  return NextResponse.json({
    people,
    suggestions,
    identities: identities.map((i) => ({
      id: i.id,
      key: i.key,
      displayName: i.displayName,
      aliases: (i.aliases ?? []).map((a) => ({
        id: a.id,
        source: a.source,
        handle: a.handle,
        externalUserId: a.externalUserId ?? null,
        username: a.username ?? null,
        email: a.email ?? null,
        matchMethod: a.matchMethod ?? "manual",
        confidence: a.confidence ?? 1,
        // Filas viejas sin `verified` se consideran confirmadas.
        verified: a.verified === false ? false : true,
        verifiedAt: a.verifiedAt ?? null,
        createdByName: a.createdByName ?? null,
        reason: a.reason ?? null,
      })),
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
    reason?: string;
  };
  const primaryId = body.primaryId?.trim();
  const displayName = body.displayName?.trim() || primaryId;
  const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds : [];
  const reason = body.reason?.trim() || null;
  if (!primaryId || !displayName)
    return NextResponse.json({ error: "Falta la persona principal." }, { status: 400 });

  const actor = { id: session.user.id, name: session.user.name ?? session.user.email ?? null };
  const identity = await mergeIdentities({
    projectId: project.id,
    primaryId,
    displayName,
    mergeIds,
    matchMethod: "manual",
    verified: true,
    actor,
    reason,
  });
  // Auditoría de la vinculación manual (usuario, fecha, antes/después, motivo).
  await logAudit({
    workspaceId: project.workspaceId,
    actorId: actor.id,
    actorName: actor.name,
    action: "identity.merge",
    target: primaryId,
    meta: { projectId: project.id, displayName, mergeIds, reason },
  });
  return NextResponse.json({ ok: true, identity: { id: identity.id, key: identity.key } });
}

/**
 * Acciones sobre un alias puntual del panel de mapeo:
 *   { action: "confirm", aliasId }  → confirma una sugerencia pendiente.
 *   { action: "unlink",  aliasId }  → desvincula una identidad externa.
 */
export async function PATCH(req: Request) {
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
    action?: "confirm" | "unlink";
    aliasId?: string;
  };
  const aliasId = body.aliasId?.trim();
  if (!aliasId || (body.action !== "confirm" && body.action !== "unlink"))
    return NextResponse.json({ error: "Acción o alias inválido." }, { status: 400 });

  const actor = { id: session.user.id, name: session.user.name ?? session.user.email ?? null };
  const result =
    body.action === "confirm"
      ? await confirmAlias(project.id, aliasId, actor)
      : await unlinkAlias(project.id, aliasId);
  if (!result) return NextResponse.json({ error: "Alias no encontrado." }, { status: 404 });

  await logAudit({
    workspaceId: project.workspaceId,
    actorId: actor.id,
    actorName: actor.name,
    action: body.action === "confirm" ? "identity.confirm" : "identity.unlink",
    target: aliasId,
    meta: { projectId: project.id, source: result.source, handle: result.handle },
  });
  return NextResponse.json({ ok: true });
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
  if (ok) {
    await logAudit({
      workspaceId: project.workspaceId,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? null,
      action: "identity.unmerge",
      target: id,
      meta: { projectId: project.id },
    });
  }
  return NextResponse.json({ ok });
}
