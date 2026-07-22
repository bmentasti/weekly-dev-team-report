import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canFinance } from "@/lib/finance/access";
import { logAudit } from "@/lib/audit";

const db = prisma as any;

const costSchema = z.object({
  kind: z.literal("cost"),
  category: z.enum([
    "LABOR", "VENDOR", "LICENSE", "INFRASTRUCTURE", "TRAVEL", "EXTERNAL_SERVICE",
    "INDIRECT", "ADMIN", "REWORK", "BLOCKER", "PENALTY", "UNPLANNED", "OTHER",
  ]),
  nature: z.enum(["ACTUAL", "COMMITTED", "FORECAST", "POTENTIAL"]).default("ACTUAL"),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8).default("USD"),
  incurredOn: z.string().datetime(),
  description: z.string().max(500).optional(),
  billable: z.boolean().optional(),
  personKey: z.string().optional(),
  source: z.string().default("manual"),
});

const revenueSchema = z.object({
  kind: z.literal("revenue"),
  type: z.enum([
    "CONTRACTED", "INVOICED", "COLLECTED", "RECOGNIZED", "PENDING",
    "CHANGE_REQUEST", "BONUS", "PENALTY",
  ]),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8).default("USD"),
  date: z.string().datetime(),
  description: z.string().max(500).optional(),
  milestoneId: z.string().optional(),
  source: z.string().default("manual"),
});

const schema = z.discriminatedUnion("kind", [costSchema, revenueSchema]);

/** Alta de una entrada de costo o ingreso. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await canFinance(session.user.id, params.id, "editFinancials")))
    return NextResponse.json({ error: "Sin permiso para editar finanzas." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { workspaceId: true },
  });
  if (!project)
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const d = parsed.data;
  let id: string;
  if (d.kind === "cost") {
    const c = await db.costEntry.create({
      data: {
        projectId: params.id,
        category: d.category,
        nature: d.nature,
        amount: d.amount,
        currency: d.currency,
        incurredOn: new Date(d.incurredOn),
        description: d.description ?? null,
        billable: d.billable ?? null,
        personKey: d.personKey ?? null,
        source: d.source,
        createdById: session.user.id,
      },
    });
    id = c.id;
  } else {
    const r = await db.revenueEntry.create({
      data: {
        projectId: params.id,
        type: d.type,
        amount: d.amount,
        currency: d.currency,
        date: new Date(d.date),
        description: d.description ?? null,
        milestoneId: d.milestoneId ?? null,
        source: d.source,
        createdById: session.user.id,
      },
    });
    id = r.id;
  }

  await logAudit({
    workspaceId: project.workspaceId,
    actorId: session.user.id,
    actorName: session.user.name ?? null,
    action: d.kind === "cost" ? "finance.cost.create" : "finance.revenue.create",
    target: params.id,
    meta: { amount: d.amount, currency: d.currency },
  });

  return NextResponse.json({ ok: true, id });
}
