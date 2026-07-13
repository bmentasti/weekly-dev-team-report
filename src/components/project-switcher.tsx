"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useDialogs } from "@/components/ui/dialog-provider";
import { useT } from "@/components/i18n-provider";

interface Project {
  id: string;
  name: string;
}

export function ProjectSwitcher() {
  const router = useRouter();
  const { t } = useT();
  const { confirm, prompt, alert, upgrade } = useDialogs();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) return;
    const json = await res.json();
    setProjects(json.projects ?? []);
    setActiveId(json.activeId ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function selectProject(id: string) {
    setActiveId(id);
    setOpen(false);
    await fetch("/api/projects/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    router.refresh();
  }

  async function createProject() {
    setOpen(false);
    const name = await prompt({
      title: t("ws.switcher.newProject"),
      label: t("ws.switcher.projectName"),
      placeholder: "Web App",
      confirmLabel: t("ws.switcher.create"),
    });
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.status === 403) {
      await upgrade({ feature: t("ws.switcher.moreThanOneProject"), suggestedPlan: "Pro" });
      return;
    }
    if (!res.ok) return;
    const json = await res.json();
    await load();
    if (json.project?.id) await selectProject(json.project.id);
  }

  async function renameProject() {
    if (!activeId || !active) return;
    setOpen(false);
    const name = await prompt({
      title: t("ws.switcher.renameProject"),
      defaultValue: active.name,
      confirmLabel: t("ws.switcher.save"),
    });
    if (!name || name === active.name) return;
    const res = await fetch(`/api/projects/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    await load();
    router.refresh();
  }

  async function deleteProject() {
    if (!activeId || !active) return;
    setOpen(false);
    const ok = await confirm({
      title: `${t("ws.switcher.deletePrefix")} "${active.name}"`,
      description: t("ws.switcher.deleteDesc"),
      confirmLabel: t("ws.switcher.delete"),
      danger: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/projects/${activeId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: t("ws.switcher.cantDelete"), description: j.error });
      return;
    }
    const remaining = projects.filter((p) => p.id !== activeId);
    if (remaining[0]) {
      await selectProject(remaining[0].id);
    } else {
      await load();
      router.refresh();
    }
  }

  const active = projects.find((p) => p.id === activeId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-button border px-3 py-1.5 text-sm hover:bg-muted"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {(active?.name ?? "P").charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate font-medium">
          {active?.name ?? t("ws.switcher.projectFallback")}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-60 rounded-card border bg-background p-1 shadow-card">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ws.switcher.projects")}
          </p>
          <div className="max-h-64 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => selectProject(p.id)}
                className="flex w-full items-center justify-between rounded-button px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="truncate">{p.name}</span>
                {p.id === activeId && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-1 border-t pt-1">
            <button
              onClick={createProject}
              className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-left text-sm text-primary hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              {t("ws.switcher.newProject")}
            </button>
            {active && (
              <button
                onClick={renameProject}
                className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                {`${t("ws.switcher.renamePrefix")} «${active.name}»`}
              </button>
            )}
            {active && projects.length > 1 && (
              <button
                onClick={deleteProject}
                className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              >
                <Trash2 className="h-4 w-4" />
                {`${t("ws.switcher.deletePrefix")} «${active.name}»`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
