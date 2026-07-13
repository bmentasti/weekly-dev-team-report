import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportAccess, redactReportForAccess } from "@/lib/reports/access";
import { buildReportPdf } from "@/lib/reports/pdf";
import { withUnifiedReportPeople } from "@/lib/reports/people-unify";
import { getLocale } from "@/lib/i18n/server";
import { PLANS, effectivePlan } from "@/lib/plans";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const access = await getReportAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  // Export PDF gateado por plan (Team/Pro; trial cuenta como Pro).
  const workspace = await prisma.workspace.findUnique({
    where: { id: access.workspaceId },
  });
  if (!PLANS[effectivePlan(workspace)].pdfExport)
    return NextResponse.json(
      { error: "El export a PDF está disponible en los planes Team y Pro." },
      { status: 402 },
    );

  const found = await prisma.report.findUnique({ where: { id: params.id } });
  if (!found)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const locale = getLocale();
  // Unifica identidades y luego recorta datos por persona según el acceso. (SEC-07)
  const unified = await withUnifiedReportPeople(found, locale);
  const report = redactReportForAccess(unified, access);
  const pdf = buildReportPdf(report, locale);
  const day = new Date(report.periodEnd).toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-${day}.pdf"`,
    },
  });
}
