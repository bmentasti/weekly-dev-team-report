"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProvider } from "@/lib/integrations/catalog";
import { BackButton } from "@/components/back-button";
import type {
  ActivitySignal,
  ProviderData,
  UnifiedCodeChange,
  UnifiedWorkItem,
} from "@/lib/integrations/types";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function formatAge(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function WorkItems({ items }: { items: UnifiedWorkItem[] }) {
  const done = items.filter((i) => i.bucket === "DONE").length;
  const inProgress = items.filter((i) => i.bucket === "IN_PROGRESS").length;
  const blocked = items.filter((i) => i.bucket === "BLOCKED").length;
  const stale = items.filter((i) => i.isStale).length;
  const critical = items.filter((i) => i.isCritical).length;

  function bucketBadge(i: UnifiedWorkItem) {
    if (i.bucket === "BLOCKED")
      return <Badge variant="destructive">Bloqueada</Badge>;
    if (i.bucket === "DONE") return <Badge variant="success">Finalizada</Badge>;
    if (i.bucket === "IN_PROGRESS")
      return <Badge variant="info">En progreso</Badge>;
    return <Badge variant="secondary">Por hacer</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total" value={items.length} />
        <Metric label="Finalizadas" value={done} />
        <Metric label="En progreso" value={inProgress} />
        <Metric label="Bloqueadas" value={blocked} />
        <Metric label="Sin movimiento" value={stale} />
        <Metric label="Críticas" value={critical} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{items.length} tareas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">ID</th>
                  <th className="py-2 pr-4 font-medium">Título</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Responsable</th>
                  <th className="py-2 pr-4 font-medium">Prioridad</th>
                  <th className="py-2 pr-4 font-medium">Señales</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.externalId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {i.externalId}
                      </a>
                    </td>
                    <td className="max-w-xs truncate py-2 pr-4" title={i.title}>
                      {i.title}
                    </td>
                    <td className="py-2 pr-4">{bucketBadge(i)}</td>
                    <td className="py-2 pr-4">
                      {i.assignee ?? (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{i.priority ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {i.isCritical && (
                          <Badge variant="destructive">Crítica</Badge>
                        )}
                        {i.isStale && (
                          <Badge variant="warning">Sin movimiento</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No hay tareas para el período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeChanges({ items }: { items: UnifiedCodeChange[] }) {
  const open = items.filter((i) => i.state === "OPEN");
  const merged = items.filter((i) => i.state === "MERGED").length;
  const withoutReviewer = open.filter((i) => !i.hasReviewer).length;
  const failing = open.filter((i) => i.checksState === "failure").length;
  const old = open.filter((i) => i.isOld).length;
  const avgAge =
    open.length > 0
      ? Math.round(open.reduce((s, i) => s + i.ageHours, 0) / open.length)
      : 0;

  function stateBadge(i: UnifiedCodeChange) {
    if (i.state === "MERGED") return <Badge variant="success">Mergeado</Badge>;
    if (i.state === "CLOSED")
      return <Badge variant="secondary">Cerrado sin merge</Badge>;
    return <Badge variant="info">Abierto</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Abiertos" value={open.length} />
        <Metric label="Mergeados" value={merged} />
        <Metric label="Sin reviewer" value={withoutReviewer} />
        <Metric label="Checks fallando" value={failing} />
        <Metric label="Abiertos > 72h" value={old} />
        <Metric label="Edad prom." value={formatAge(avgAge)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {items.length} Pull/Merge Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Título</th>
                  <th className="py-2 pr-4 font-medium">Autor</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Edad</th>
                  <th className="py-2 pr-4 font-medium">Señales</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.externalId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        #{i.externalId}
                      </a>
                    </td>
                    <td className="max-w-xs truncate py-2 pr-4" title={i.title}>
                      {i.title}
                    </td>
                    <td className="py-2 pr-4">{i.author ?? "—"}</td>
                    <td className="py-2 pr-4">{stateBadge(i)}</td>
                    <td className="py-2 pr-4">
                      {i.state === "OPEN" ? formatAge(i.ageHours) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {i.isOld && <Badge variant="warning">Viejo</Badge>}
                        {i.state === "OPEN" && !i.hasReviewer && (
                          <Badge variant="destructive">Sin reviewer</Badge>
                        )}
                        {i.draft && <Badge variant="outline">Draft</Badge>}
                        {i.state === "OPEN" && i.checksState === "failure" && (
                          <Badge variant="destructive">Checks fallando</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No hay Pull/Merge Requests para el período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Activity({ items }: { items: ActivitySignal[] }) {
  const blockers = items.filter((i) => i.isBlocker);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Mensajes" value={items.length} />
        <Metric label="Posibles blockers" value={blockers.length} />
        <Metric
          label="Personas activas"
          value={new Set(items.map((i) => i.author).filter(Boolean)).size}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay mensajes recientes en el canal.
            </p>
          )}
          {items.map((i) => (
            <div
              key={i.externalId}
              className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{i.text || "(sin texto)"}</p>
                <p className="text-xs text-muted-foreground">
                  {i.author ?? "?"}{" "}
                  {i.createdAt
                    ? `· ${new Date(i.createdAt).toLocaleString()}`
                    : ""}
                </p>
              </div>
              {i.isBlocker && <Badge variant="warning">Posible blocker</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntegrationDataPage() {
  const params = useParams<{ provider: string }>();
  const slug = params.provider;
  const entry = getProvider(slug);

  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${slug}/data`);
      const json = (await res.json()) as { data?: ProviderData; error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudieron cargar los datos.");
        setData(null);
      } else {
        setData(json.data ?? {});
      }
    } catch {
      setError("Error de red al cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton label="Volver a integraciones" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {entry?.label ?? slug}
          </h1>
          <p className="text-sm text-muted-foreground">{entry?.blurb}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/integrations/${slug}`}>Editar conexión</Link>
          </Button>
          <Button onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" asChild>
              <Link href={`/integrations/${slug}`}>Revisar conexión</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {data.workItems && <WorkItems items={data.workItems} />}
          {data.codeChanges && <CodeChanges items={data.codeChanges} />}
          {data.activity && <Activity items={data.activity} />}
        </>
      )}
    </div>
  );
}
