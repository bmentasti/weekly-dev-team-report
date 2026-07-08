"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <CardTitle className="text-lg">Desempeño sostenido a seguir</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-input bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Solo aparece cuando la señal se repite en 2+ sprints. Es para acompañar
          y revisar, no un veredicto: primero entender el contexto en un 1:1.
        </p>
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin señales sostenidas. 🎉
          </p>
        )}
        {alerts.map((a) => (
          <div key={a.name} className="rounded-input border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={a.severity === "alta" ? "destructive" : "warning"}>
                Severidad {a.severity}
              </Badge>
              <Link
                href={`/people/${encodeURIComponent(a.name)}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {a.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                · {a.sprints} sprints seguidos · {a.evidence}
              </span>
            </div>
            <p className="mt-1 text-xs">
              <span className="font-medium text-primary">Conversación:</span>{" "}
              {a.conversation}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Próxima acción:</span>{" "}
              {a.nextAction} · revisar en {a.reviewInDays} días
              {a.escalate ? " · evaluar escalar" : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
