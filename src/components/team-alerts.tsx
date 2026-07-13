"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

interface PersonAlert {
  name: string;
  sprints: number;
  severity: "media" | "alta";
  escalate: boolean;
  evidence: string;
  conversation: string;
  nextAction: string;
  reviewInDays: number;
}

export function TeamAlerts() {
  const { t } = useT();
  const [alerts, setAlerts] = useState<PersonAlert[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/people/alerts");
      if (res.ok) setAlerts((await res.json()).alerts ?? []);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("ws.alerts.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t("ws.alerts.disclaimer")}
        </p>
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("ws.alerts.empty")}
          </p>
        )}
        {alerts.map((a) => (
          <div key={a.name} className="rounded-input border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={a.severity === "alta" ? "destructive" : "warning"}>
                {`${t("ws.alerts.severityPrefix")} ${a.severity}`}
              </Badge>
              <Link
                href={`/people/${encodeURIComponent(a.name)}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {a.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {`· ${a.sprints} ${t("ws.alerts.sprintsInARow")} · ${a.evidence}`}
              </span>
            </div>
            <p className="mt-1 text-xs">
              <span className="font-medium text-primary">{t("ws.alerts.conversation")}</span>{" "}
              {a.conversation}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t("ws.alerts.nextAction")}</span>{" "}
              {`${a.nextAction} · ${t("ws.alerts.reviewInPrefix")} ${a.reviewInDays} ${t("ws.alerts.reviewInSuffix")}`}
              {a.escalate ? ` ${t("ws.alerts.evaluateEscalate")}` : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
