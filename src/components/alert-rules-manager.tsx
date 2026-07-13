"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";
import { useT } from "@/components/i18n-provider";
import { METRIC_DEFS } from "@/lib/reports/standards";
import {
  ruleText,
  type AlertRule,
  type RuleOperator,
  type RuleSeverity,
} from "@/lib/reports/alert-rules";

const OPERATORS: RuleOperator[] = ["gt", "lt", "gte", "lte"];
const SEVERITIES: RuleSeverity[] = ["high", "medium", "low"];

function sevVariant(s: RuleSeverity): "destructive" | "warning" | "secondary" {
  return s === "high" ? "destructive" : s === "medium" ? "warning" : "secondary";
}

export function AlertRulesManager() {
  const { t } = useT();
  const dialogs = useDialogs();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<"FREE" | "TEAM" | "PRO">("FREE");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [persistenceReady, setPersistenceReady] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [metricKey, setMetricKey] = useState(METRIC_DEFS[0].key);
  const [operator, setOperator] = useState<RuleOperator>("gt");
  const [threshold, setThreshold] = useState<number>(0);
  const [severity, setSeverity] = useState<RuleSeverity>("medium");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/alert-rules");
      const data = await res.json();
      setPlan(data.plan);
      setRules(data.rules ?? []);
      setPersistenceReady(data.persistenceReady ?? true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isPro = plan === "PRO";

  async function addRule() {
    setSaving(true);
    try {
      const res = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricKey, operator, threshold, severity }),
      });
      const data = await res.json();
      if (!res.ok) {
        await dialogs.alert({
          title: t("ws.alertRules.cantCreate"),
          description: data.error ?? t("ws.alertRules.tryAgain"),
        });
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id: string) {
    const ok = await dialogs.confirm({
      title: t("ws.alertRules.deleteRule"),
      confirmLabel: t("ws.alertRules.delete"),
      danger: true,
    });
    if (!ok) return;
    setRules((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/alert-rules?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-card bg-muted" />;
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("ws.alertRules.title")}</h2>
          <Badge variant={isPro ? "success" : "secondary"} className="ml-auto">
            {isPro ? "Pro" : "Pro"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ws.alertRules.subtitle")}
        </p>

        {!isPro ? (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-input border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
                <Lock className="h-4 w-4" />
              </span>
              <p className="text-sm text-muted-foreground">
                {t("ws.alertRules.proOnly")}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/settings">{t("ws.alertRules.seePro")}</Link>
            </Button>
          </div>
        ) : (
          <>
            {!persistenceReady && (
              <p className="mt-3 rounded-input border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                {t("ws.alertRules.dbPushPrefix")} <code>npm run db:push</code> {t("ws.alertRules.dbPushSuffix")}
              </p>
            )}

            {/* Form de creación */}
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-input border p-3">
              <label className="text-xs text-muted-foreground">
                {t("ws.alertRules.metric")}
                <select
                  value={metricKey}
                  onChange={(e) => setMetricKey(e.target.value)}
                  className="mt-1 block w-48 rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                >
                  {METRIC_DEFS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("ws.alertRules.condition")}
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value as RuleOperator)}
                  className="mt-1 block w-40 rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {t(`lib.operator.${op}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                {t("ws.alertRules.value")}
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="mt-1 block w-20 rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                {t("ws.alertRules.severity")}
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as RuleSeverity)}
                  className="mt-1 block w-28 rounded-md border bg-card px-2 py-1.5 text-sm text-foreground"
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {t(`lib.severity.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <Button size="sm" onClick={addRule} disabled={saving}>
                <Plus className="mr-1 h-4 w-4" /> {t("ws.alertRules.add")}
              </Button>
            </div>

            {/* Lista de reglas */}
            <div className="mt-4 space-y-2">
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("ws.alertRules.empty")}
                </p>
              ) : (
                rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-input border px-3 py-2"
                  >
                    <Badge variant={sevVariant(r.severity)} className="text-[10px]">
                      {t(`lib.severity.${r.severity}`)}
                    </Badge>
                    <span className="flex-1 text-sm">{`${t("ws.alertRules.alertIf")} ${ruleText(r, t)}`}</span>
                    <button
                      onClick={() => removeRule(r.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t("ws.alertRules.deleteRuleAria")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
