import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listProjectsForUser } from "@/lib/project";
import { canFinance } from "@/lib/finance/access";
import { loadFinancialSnapshot } from "@/lib/finance/load";
import { generateAlerts, topAlert } from "@/lib/finance";
import { getLocale } from "@/lib/i18n/server";
import { Card, CardContent } from "@/components/ui/card";
import { financeLabels } from "../projects/[id]/finance/i18n";
import { PortfolioTable, type PortfolioRow } from "./PortfolioTable";

export const dynamic = "force-dynamic";

export default async function FinancePortfolioPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const L = financeLabels(getLocale());

  const projects = await listProjectsForUser(userId);
  const rows: PortfolioRow[] = [];

  for (const p of projects) {
    if (!(await canFinance(userId, p.id, "viewFinancials"))) continue;
    const result = await loadFinancialSnapshot(p.id);
    if (!result) continue;
    const s = result.snapshot;
    const canMargins = await canFinance(userId, p.id, "viewMargins");
    const alerts = generateAlerts(s, { hasMargins: canMargins });
    const alert = topAlert(alerts);
    rows.push({
      id: p.id,
      name: p.name,
      currency: s.currency,
      modality: s.modality,
      status: s.status.status,
      projectedProfit: s.profitability.projectedProfit.value,
      projectedMarginPct: s.profitability.projectedMarginPct.value,
      cpi: s.evm.cpi.value,
      spi: s.evm.spi.value,
      eac: s.evm.eac.value,
      remainingBudget: s.budget.remainingBudget.value,
      runwayDays: s.budget.runwayDays.value,
      topRisk: alert?.explanation ?? null,
      canViewMargins: canMargins,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{L.portfolioTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{L.portfolioSubtitle}</p>
      </div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {L.noPortfolio}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <PortfolioTable rows={rows} labels={L} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
