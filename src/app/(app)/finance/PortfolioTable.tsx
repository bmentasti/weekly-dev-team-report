"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FinancialStatus } from "@/lib/finance/types";
import type { FinanceLabels } from "../projects/[id]/finance/i18n";

export interface PortfolioRow {
  id: string;
  name: string;
  currency: string;
  modality: string;
  status: FinancialStatus;
  projectedProfit: number | null;
  projectedMarginPct: number | null;
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  remainingBudget: number | null;
  runwayDays: number | null;
  topRisk: string | null;
  canViewMargins: boolean;
}

const statusMeta: Record<
  FinancialStatus,
  { key: keyof FinanceLabels; variant: "success" | "warning" | "destructive" | "info" | "secondary" }
> = {
  HEALTHY: { key: "status_HEALTHY", variant: "success" },
  ATTENTION: { key: "status_ATTENTION", variant: "warning" },
  AT_RISK: { key: "status_AT_RISK", variant: "destructive" },
  CRITICAL: { key: "status_CRITICAL", variant: "destructive" },
  INSUFFICIENT_DATA: { key: "status_INSUFFICIENT_DATA", variant: "secondary" },
};

type SortKey = "name" | "projectedMarginPct" | "projectedProfit" | "runwayDays" | "cpi";

export function PortfolioTable({ rows, labels }: { rows: PortfolioRow[]; labels: FinanceLabels }) {
  const L = labels;
  const [sortKey, setSortKey] = useState<SortKey>("projectedMarginPct");
  const [asc, setAsc] = useState(true);

  const money = (v: number | null, c: string) =>
    v == null ? L.noData : `${c} ${Math.round(v).toLocaleString("en-US")}`;
  const pctStr = (v: number | null) => (v == null ? L.noData : `${Math.round(v * 10) / 10}%`);
  const numStr = (v: number | null, dp = 2) =>
    v == null ? L.noData : v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "name") return asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulos al final
    if (bv == null) return -1;
    return asc ? av - bv : bv - av;
  });

  function header(key: SortKey, label: string) {
    return (
      <th
        className="cursor-pointer select-none py-2 pr-3 hover:text-foreground"
        onClick={() => {
          if (sortKey === key) setAsc((v) => !v);
          else {
            setSortKey(key);
            setAsc(true);
          }
        }}
      >
        {label}
        {sortKey === key ? (asc ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {header("name", L.projectCol)}
            <th className="py-2 pr-3">{L.statusCol}</th>
            {header("projectedProfit", L.profitCol)}
            {header("projectedMarginPct", L.marginCol)}
            {header("cpi", "CPI")}
            <th className="py-2 pr-3">SPI</th>
            <th className="py-2 pr-3">{L.eac}</th>
            {header("runwayDays", L.runway)}
            <th className="py-2 pr-3">{L.riskCol}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const sm = statusMeta[r.status];
            return (
              <tr key={r.id} className="border-b align-top">
                <td className="py-2 pr-3 font-medium">
                  {r.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {r.modality.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <Badge variant={sm.variant}>{L[sm.key]}</Badge>
                </td>
                <td
                  className={`py-2 pr-3 tabular-nums ${
                    !r.canViewMargins || r.projectedProfit == null
                      ? ""
                      : r.projectedProfit >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                  }`}
                >
                  {r.canViewMargins ? money(r.projectedProfit, r.currency) : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {r.canViewMargins ? pctStr(r.projectedMarginPct) : "—"}
                </td>
                <td className="py-2 pr-3 tabular-nums">{numStr(r.cpi)}</td>
                <td className="py-2 pr-3 tabular-nums">{numStr(r.spi)}</td>
                <td className="py-2 pr-3 tabular-nums">{money(r.eac, r.currency)}</td>
                <td className="py-2 pr-3 tabular-nums">{numStr(r.runwayDays, 0)}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">{r.topRisk ?? "—"}</td>
                <td className="py-2">
                  <Link href={`/projects/${r.id}/finance`} className="text-xs text-primary underline">
                    {L.openDetail}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
