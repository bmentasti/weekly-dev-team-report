"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  evaluateAlertRules,
  ruleText,
  type AlertRule,
  type RuleSeverity,
} from "@/lib/reports/alert-rules";
import type { ReportMetrics } from "@/lib/reports/types";
import { useT } from "@/components/i18n-provider";

function sevVariant(s: RuleSeverity): "destructive" | "warning" | "secondary" {
  return s === "high" ? "destructive" : s === "medium" ? "warning" : "secondary";
}

/** Muestra las reglas de alerta personalizadas que se disparan en este reporte. */
export function CustomAlerts({ metrics }: { metrics: ReportMetrics | null }) {
  const { t } = useT();
  const [rules, setRules] = useState<AlertRule[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/alert-rules");
        const data = await res.json();
        setRules(data.rules ?? []);
      } catch {
        setRules([]);
      }
    })();
  }, []);

  const evaluated = useMemo(
    () => evaluateAlertRules(rules, metrics),
    [rules, metrics],
  );
  const triggered = evaluated.filter((e) => e.triggered);

  if (rules.length === 0) return null; // sin reglas => no mostramos nada

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BellRing className="h-5 w-5 text-primary" />
          {t("ws.customAlerts.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {triggered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {`${t("ws.customAlerts.emptyPrefix")} ${rules.length} ${t("ws.customAlerts.emptySuffix")}`}
          </p>
        ) : (
          <div className="space-y-2">
            {triggered.map((e) => (
              <div
                key={e.rule.id}
                className="flex items-center gap-3 rounded-input border p-3"
              >
                <Badge variant={sevVariant(e.rule.severity)}>
                  {t(`lib.severity.${e.rule.severity}`)}
                </Badge>
                <span className="flex-1 text-sm">
                  {ruleText(e.rule, t)}{" "}
                  <span className="text-muted-foreground">
                    ({t("ws.customAlerts.currentValue")} {e.value}
                    {e.unit})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
