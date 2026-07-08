"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = Record<string, string>;

const COLS = [
  "Persona",
  "Categoría",
  "Entrega",
  "Participación",
  "Ownership",
  "Evolución",
  "Riesgo",
];

function riskBadge(v: string) {
  if (v === "Alto") return <Badge variant="destructive">Alto</Badge>;
  if (v === "Medio") return <Badge variant="warning">Medio</Badge>;
  return <Badge variant="secondary">Bajo</Badge>;
}

export function TeamMatrix() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/people/matrix");
      if (res.ok) setRows((await res.json()).rows ?? []);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Matriz individual</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/people/matrix/export">Exportar CSV</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin datos de personas todavía. Generá reportes para poblar la matriz.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {COLS.map((c) => (
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
          La matriz completa (18 columnas: causas, acción, objetivo, indicador,
          fecha de revisión, etc.) está en el CSV.
        </p>
      </CardContent>
    </Card>
  );
}
