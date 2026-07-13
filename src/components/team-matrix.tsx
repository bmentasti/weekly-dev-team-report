"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

type Row = Record<string, string>;

export function TeamMatrix({ projectId }: { projectId?: string }) {
  const { t } = useT();
  const cols = [
    t("ws.matrix.colPerson"),
    t("ws.matrix.colCategory"),
    t("ws.matrix.colDelivery"),
    t("ws.matrix.colParticipation"),
    t("ws.matrix.colOwnership"),
    t("ws.matrix.colEvolution"),
    t("ws.matrix.colRisk"),
  ];

  function riskBadge(v: string) {
    if (v === "Alto") return <Badge variant="destructive">{t("ws.matrix.riskHigh")}</Badge>;
    if (v === "Medio") return <Badge variant="warning">{t("ws.matrix.riskMedium")}</Badge>;
    return <Badge variant="secondary">{t("ws.matrix.riskLow")}</Badge>;
  }

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    (async () => {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const res = await fetch(`/api/people/matrix${qs}`);
      if (!active) return;
      if (res.ok) setRows((await res.json()).rows ?? []);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{t("ws.matrix.title")}</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/api/people/matrix/export${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`}
            >
              {t("ws.matrix.exportCsv")}
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("ws.matrix.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {cols.map((c) => (
                    <th key={c} className="py-2 pr-4 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.Persona} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.Persona}</td>
                    <td className="py-2 pr-4">{r["Categoría"]}</td>
                    <td className="py-2 pr-4">{r.Entrega}</td>
                    <td className="py-2 pr-4">{r["Participación"]}</td>
                    <td className="py-2 pr-4">{r.Ownership}</td>
                    <td className="py-2 pr-4">{r["Evolución"]}</td>
                    <td className="py-2 pr-4">{riskBadge(r.Riesgo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          {t("ws.matrix.note")}
        </p>
      </CardContent>
    </Card>
  );
}
