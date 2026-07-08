import "server-only";
import { prisma } from "@/lib/prisma";

interface AuditLogDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: { workspaceId: string };
    orderBy?: Record<string, "asc" | "desc">;
    take?: number;
  }): Promise<
    {
      id: string;
      actorName: string | null;
      action: string;
      target: string | null;
      createdAt: Date;
    }[]
  >;
}

function model(): AuditLogDelegate | undefined {
  return (prisma as unknown as { auditLog?: AuditLogDelegate }).auditLog;
}

/**
 * Registra una acción sensible. Best-effort: si la tabla aún no existe
 * (falta db:push) no rompe el flujo principal.
 */
export async function logAudit(entry: {
  workspaceId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const m = model();
  if (!m) return;
  try {
    await m.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName ?? null,
        action: entry.action,
        target: entry.target ?? null,
        meta: entry.meta ?? undefined,
      },
    });
  } catch {
    // sin tabla / error de log: no interrumpir la acción del usuario
  }
}

export async function listAudit(workspaceId: string, take = 50) {
  const m = model();
  if (!m) return [];
  try {
    return await m.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take,
    });
  } catch {
    return [];
  }
}
