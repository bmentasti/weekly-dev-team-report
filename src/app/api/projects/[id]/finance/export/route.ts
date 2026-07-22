import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canFinance } from "@/lib/finance/access";
import { loadFinancialSnapshot } from "@/lib/finance/load";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import type { MetricResult } from "@/lib/finance/types";

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta el snapshot financiero como CSV (capacidad exportFinancials). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("No autorizado", { status: 401 });
  if (!(await canFinance(session.user.id, params.id, "exportFinancials")))
    return new Response("Sin permiso para exportar finanzas.", { status: 403 });

  const result = await loadFinancialSnapshot(params.id);
  if (!result) return new Response("Proyecto sin configuración financiera.", { status: 404 });

  const canMargins = await canFinance(session.user.id, params.id, "viewMargins");
  const s = result.snapshot;
  const c = s.currency;

  const rows: [string, MetricResult | { value: number | null; provenance?: MetricResult["provenance"] }][] = [
    ["Presupuesto vigente", s.budget.currentBudget],
    ["Costo real (AC)", s.evm.ac],
    ["Presupuesto restante", s.budget.remainingBudget],
    ["% consumido", s.budget.consumedPct],
    ["BAC", s.evm.bac],
    ["PV", s.evm.pv],
    ["EV", s.evm.ev],
    ["CPI", s.evm.cpi],
    ["SPI", s.evm.spi],
    ["EAC", s.evm.eac],
    ["ETC", s.evm.etc],
    ["VAC", s.evm.vac],
    ["TCPI (BAC)", s.evm.tcpiBac],
    ["Runway (días)", s.budget.runwayDays],
  ];
  if (canMargins) {
    rows.push(
      ["Ingreso proyectado", s.profitability.projectedTotalRevenue],
      ["Ganancia proyectada", s.profitability.projectedProfit],
      ["Margen proyectado %", s.profitability.projectedMarginPct],
      ["Ganancia actual", s.profitability.currentProfit],
      ["Variación de margen", s.profitability.marginVariance],
    );
  }

  const header = ["Métrica", "Valor", "Moneda", "Fórmula", "Fuente", "Confianza"];
  const lines = [header.map(csvCell).join(",")];
  lines.push(["Estado financiero", s.status.status, "", "", s.status.explanation, ""].map(csvCell).join(","));
  for (const [label, m] of rows) {
    const prov = "provenance" in m ? m.provenance : undefined;
    lines.push(
      [label, m.value ?? "", c, prov?.formula ?? "", prov?.source ?? "", prov?.confidence ?? ""]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = lines.join("\n");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { workspaceId: true, name: true },
  });
  if (project) {
    await logAudit({
      workspaceId: project.workspaceId,
      actorId: session.user.id,
      actorName: session.user.name ?? null,
      action: "finance.export",
      target: params.id,
    });
  }

  const filename = `finance-${(project?.name ?? "project").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
