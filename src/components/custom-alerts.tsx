"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  evaluateAlertRules,
  ruleText,
  SEVERITY_LABEL,
  type AlertRule,
  type RuleSeverity,
} from "@/lib/reports/alert-rules";
import type { ReportMetrics } from "@/lib/reports/types";

function sevVariant(s: RuleSeverity): "destructive" | "warning" | "secondary" {
  return s === "high" ? "destructive" : s === "medium" ? "warning" : "secondary";
}

/** Muestra las reglas de alerta personalizadas que se disparan en este reporte. */
export function CustomAlerts({ metrics }: { metrics: ReportMetrics | null }) {
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
          Alertas personalizadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {triggered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna de tus {rules.length} regla(s) se disparó en este reporte. 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {triggered.map((e) => (
              <div
                key={e.rule.id}
                className="flex items-center gap-3 rounded-input border p-3"
              >
                <Badge variant={sevVariant(e.rule.severity)}>
                  {SEVERITY_LABEL[e.rule.severity]}
                </Badge>
                <span className="flex-1 text-sm">
                  {ruleText(e.rule)}{" "}
                  <span className="text-muted-foreground">
                    (valor actual: {e.value}
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
