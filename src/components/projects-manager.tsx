"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plug, Users, FileBarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useDialogs } from "@/components/ui/dialog-provider";

export interface ProjectItem {
  id: string;
  name: string;
  integrations: number;
  members: number;
  reports: number;
  active: boolean;
}

export function ProjectsManager({ initial }: { initial: ProjectItem[] }) {
  const router = useRouter();
  const { confirm, prompt, alert, upgrade } = useDialogs();
  const [busy, setBusy] = useState(false);

  async function select(id: string) {
    setBusy(true);
    const res = await fetch("/api/projects/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: "No se pudo cambiar de proyecto", description: j.error });
      return;
    }
    router.refresh();
  }

  async function create() {
    const name = await prompt({
      title: "Nuevo proyecto",
      label: "Nombre del proyecto",
      placeholder: "Web App",
      confirmLabel: "Crear",
    });
    if (!name) return;
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 403) {
      await upgrade({ feature: "Tener más de un proyecto", suggestedPlan: "Pro" });
      return;
    }
    if (!res.ok) {
      await alert({
        title: "No se pudo crear el proyecto",
        description:
          json.error ??
          "Ocurrió un error inesperado. Revisá que tengas un workspace y volvé a intentar.",
      });
      return;
    }
    if (res.ok && json.project?.id) {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: json.project.id }),
      });
    }
    router.refresh();
  }

  async function rename(p: ProjectItem) {
    const name = await prompt({
      title: "Renombrar proyecto",
      defaultValue: p.name,
      confirmLabel: "Guardar",
    });
    if (!name || name === p.name) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: "No se pudo renombrar", description: j.error });
      return;
    }
    router.refresh();
  }

  async function remove(p: ProjectItem) {
    const ok = await confirm({
      title: `Eliminar "${p.name}"`,
      description: "Se borran sus integraciones y reportes. No se puede deshacer.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: "No se pudo eliminar", description: j.error });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {initial.map((p) => (
        <Card key={p.id} className={p.active ? "border-primary" : ""}>
          <CardContent className="flex h-full flex-col gap-4 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-input bg-primary/10 text-sm font-bold text-primary">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-semibold">{p.name}</span>
              </div>
              {p.active && <Badge variant="success">Activo</Badge>}
            </div>

            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Plug className="h-3.5 w-3.5" /> {p.integrations}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {p.members}
              </span>
              <span className="flex items-center gap-1">
                <FileBarChart2 className="h-3.5 w-3.5" /> {p.reports}
              </span>
            </div>

            <div className="mt-auto flex flex-wrap gap-2">
              {p.active ? (
                <Button size="sm" variant="outline" disabled>
                  En uso
                </Button>
              ) : (
                <Button size="sm" disabled={busy} onClick={() => select(p.id)}>
                  Trabajar acá
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => rename(p)}
              >
                Renombrar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || initial.length <= 1}
                onClick={() => remove(p)}
                className="text-muted-foreground hover:text-destructive"
              >
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* New project card */}
      <button
        onClick={create}
        disabled={busy}
        className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-card border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary"
      >
        <span className="text-2xl leading-none">+</span>
        Nuevo proyecto
      </button>
    </div>
  );
}
