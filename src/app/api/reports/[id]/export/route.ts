import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportAccess } from "@/lib/reports/access";
import { buildReportCsv } from "@/lib/reports/csv";

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

  const report = await prisma.report.findUnique({ where: { id: params.id } });
  if (!report)
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const csv = buildReportCsv(report);
  const day = new Date(report.periodEnd).toISOString().slice(0, 10);

  // BOM so Excel opens UTF-8 accents correctly.
  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-${day}.csv"`,
    },
  });
}
