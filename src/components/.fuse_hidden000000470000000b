"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HEALTH_LABEL, healthBadgeVariant } from "@/lib/reports/health";
import {
  computeAlerts,
  alertsForRole,
  ROLE_LABELS,
  type Alert,
  type AlertRole,
} from "@/lib/reports/alerts";
import type { HealthLevel, ReportMetrics } from "@/lib/reports/types";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-input border p-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function levelBadge(level: Alert["level"]) {
  if (level === "high") return <Badge variant="destructive">Alta</Badge>;
  if (level === "medium") return <Badge variant="warning">Media</Badge>;
  return <Badge variant="secondary">Baja</Badge>;
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Sin alertas para este rol. 🎉
      </p>
    );
  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div key={a.id} className="rounded-input border p-3">
          <div className="flex items-center gap-2">
            {levelBadge(a.level)}
            <span className="font-medium">{a.title}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{a.meaning}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Impacto:</span>{" "}
            {a.impact}
          </p>
          <p className="mt-1 text-xs">
            <span className="font-medium text-primary">Acción:</span> {a.action}
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
  const [role, setRole] = useState<AlertRole>("TL");
  const alerts = computeAlerts(metrics);
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
          ? "Alta"
          : cur >= prev * 0.7
            ? "Media"
            : "Baja";
  }
  const highCount = alerts.filter((a) => a.level === "high").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Lectura por rol</CardTitle>
          <div className="inline-flex rounded-full border bg-white p-1 text-sm">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                  role === r ? "bg-primary text-white" : "text-muted-foreground"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {role === "TL" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="PR/MR abiertos" value={m.codeChanges.open} />
            <Stat label="Sin reviewer" value={m.codeChanges.withoutReviewer} />
            <Stat label="Abiertos +72h" value={m.codeChanges.old} />
            <Stat label="Checks fallando" value={m.codeChanges.checksFailing} />
            <Stat label="Bloqueadas" value={m.workItems.blocked} />
            <Stat label="Bugs abiertos" value={m.quality?.bugsOpen ?? 0} />
            <Stat label="Defect rate" value={`${m.quality?.defectRatePct ?? 0}%`} />
            <Stat
              label="CI fallando"
              value={m.ci ? `${m.ci.failed}/${m.ci.total}` : "—"}
            />
            <Stat
              label="Cycle time"
              value={m.capacity.cycleTimeAvgDays != null ? `${m.capacity.cycleTimeAvgDays}d` : "—"}
            />
          </div>
        )}
        {role === "PO" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Avance (SP)" value={`${m.projectProgress.completionByPoints}%`} />
            <Stat label="Finalizadas" value={`${m.workItems.done}/${m.workItems.total}`} />
            <Stat label="Bloqueadas" value={m.workItems.blocked} />
            <Stat label="Críticas" value={m.workItems.critical} />
            <Stat label="Carry-over" value={m.planning.carryOverItems} />
            <Stat label="Scope creep" value={`${m.quality?.scopeCreepPct ?? 0}%`} />
            <Stat label="Listas QA/demo" value={m.quality?.readyForQa ?? 0} />
          </div>
        )}
        {role === "DIR" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-input border p-3">
              <Badge variant={healthBadgeVariant(healthStatus)}>
                {healthStatus ? HEALTH_LABEL[healthStatus] : "—"}
              </Badge>
              <div className="mt-1 text-xs text-muted-foreground">Semáforo</div>
            </div>
            <Stat label="Avance" value={`${m.projectProgress.completionByPoints}%`} />
            <Stat label="Velocity" value={`${m.capacity.velocityPoints} pts`} />
            <Stat label="Previsibilidad" value={predictability} />
            <Stat label="A escalar" value={highCount} />
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Alertas para {ROLE_LABELS[role]}
          </h3>
          <AlertList alerts={roleAlerts} />
        </div>
      </CardContent>
    </Card>
  );
}
