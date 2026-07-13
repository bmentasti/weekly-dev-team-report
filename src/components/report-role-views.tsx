"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { healthBadgeVariant } from "@/lib/reports/health";
import {
  computeAlerts,
  alertsForRole,
  type Alert,
  type AlertRole,
} from "@/lib/reports/alerts";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";
import { useT } from "@/components/i18n-provider";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-input border p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function levelBadge(level: Alert["level"], t: (k: string) => string) {
  if (level === "high") return <Badge variant="destructive">{t("rep.levelHigh")}</Badge>;
  if (level === "medium") return <Badge variant="warning">{t("rep.levelMedium")}</Badge>;
  return <Badge variant="secondary">{t("rep.levelLow")}</Badge>;
}

function AlertList({ alerts, t }: { alerts: Alert[]; t: (k: string) => string }) {
  if (alerts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t("rep.noAlertsForRole")}
      </p>
    );
  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div key={a.id} className="rounded-input border p-3">
          <div className="flex items-center gap-2">
            {levelBadge(a.level, t)}
            <span className="font-medium">{a.title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{a.meaning}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t("rep.impact")}</span>{" "}
            {a.impact}
          </p>
          <p className="mt-1 text-xs">
            <span className="font-medium text-primary">{t("rep.action")}</span> {a.action}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ReportRoleViews({
  metrics,
  healthStatus,
}: {
  metrics: ReportMetrics;
  healthStatus: HealthLevel | null;
}) {
  const { t } = useT();
  const [role, setRole] = useState<AlertRole>("TL");
  const alerts = computeAlerts(metrics, t);
  const roleAlerts = alertsForRole(alerts, role);

  const m = metrics;
  const roles: AlertRole[] = ["TL", "PO", "DIR"];

  // Previsibilidad (para Dirección).
  const velocities = m.trend.map((t) => t.velocityPoints);
  let predictability = "—";
  if (velocities.length >= 2) {
    const cur = velocities[velocities.length - 1];
    const prev = velocities[velocities.length - 2];
    predictability =
      prev === 0
        ? "—"
        : cur >= prev * 0.9
          ? t("rep.predHigh")
          : cur >= prev * 0.7
            ? t("rep.predMedium")
            : t("rep.predLow");
  }
  const highCount = alerts.filter((a) => a.level === "high").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">{t("rep.readingByRole")}</CardTitle>
          <div className="inline-flex rounded-full border bg-card p-1 text-sm">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                  role === r ? "bg-primary text-white" : "text-muted-foreground"
                }`}
              >
                {t(`lib.role.${r}`)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {role === "TL" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t("rep.rvPrOpen")} value={m.codeChanges.open} />
            <Stat label={t("rep.rvWithoutReviewer")} value={m.codeChanges.withoutReviewer} />
            <Stat label={t("rep.rvOpen72h")} value={m.codeChanges.old} />
            <Stat label={t("rep.rvChecksFailing")} value={m.codeChanges.checksFailing} />
            <Stat label={t("rep.rvBlocked")} value={m.workItems.blocked} />
            <Stat label={t("rep.rvBugsOpen")} value={m.quality?.bugsOpen ?? 0} />
            <Stat label={t("rep.rvDefectRate")} value={`${m.quality?.defectRatePct ?? 0}%`} />
            <Stat
              label={t("rep.rvCiFailing")}
              value={m.ci ? `${m.ci.failed}/${m.ci.total}` : "—"}
            />
            <Stat
              label={t("rep.rvCycleTime")}
              value={m.capacity.cycleTimeAvgDays != null ? `${m.capacity.cycleTimeAvgDays}d` : "—"}
            />
          </div>
        )}
        {role === "PO" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label={t("rep.rvProgressSP")} value={`${m.projectProgress.completionByPoints}%`} />
            <Stat label={t("rep.rvDone")} value={`${m.workItems.done}/${m.workItems.total}`} />
            <Stat label={t("rep.rvBlocked")} value={m.workItems.blocked} />
            <Stat label={t("rep.rvCritical")} value={m.workItems.critical} />
            <Stat label={t("rep.rvCarryOver")} value={m.planning.carryOverItems} />
            <Stat label={t("rep.rvScopeCreep")} value={`${m.quality?.scopeCreepPct ?? 0}%`} />
            <Stat label={t("rep.rvReadyQa")} value={m.quality?.readyForQa ?? 0} />
          </div>
        )}
        {role === "DIR" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-input border p-3">
              <Badge variant={healthBadgeVariant(healthStatus)}>
                {healthStatus ? t(`lib.health.${healthStatus}`) : "—"}
              </Badge>
              <div className="mt-1 text-xs text-muted-foreground">{t("rep.rvSemaphore")}</div>
            </div>
            <Stat label={t("rep.rvProgress")} value={`${m.projectProgress.completionByPoints}%`} />
            <Stat label={t("rep.rvVelocity")} value={`${m.capacity.velocityPoints} ${t("rep.pts")}`} />
            <Stat label={t("rep.rvPredictability")} value={predictability} />
            <Stat label={t("rep.rvToEscalate")} value={highCount} />
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">
            {t("rep.alertsForRolePre")} {t(`lib.role.${role}`)}
          </h3>
          <AlertList alerts={roleAlerts} t={t} />
        </div>
      </CardContent>
    </Card>
  );
}
