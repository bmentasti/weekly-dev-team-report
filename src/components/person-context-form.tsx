"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LEVELS = ["", "LOW", "MEDIUM", "HIGH"];
const LEVEL_LABEL: Record<string, string> = { "": "—", LOW: "Baja", MEDIUM: "Media", HIGH: "Alta" };

type Ctx = Record<string, string>;

function Select({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        className="flex h-10 w-full rounded-input border border-input bg-card px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PersonContextForm({ name }: { name: string }) {
  const [ctx, setCtx] = useState<Ctx>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/people/${encodeURIComponent(name)}/context`);
      if (res.ok) {
        const j = await res.json();
        if (j.context) setCtx(j.context);
      }
    })();
  }, [name]);

  const set = (k: string, v: string) => setCtx((c) => ({ ...c, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/people/${encodeURIComponent(name)}/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    });
    setBusy(false);
    setMsg(res.ok ? "Contexto guardado." : "No se pudo guardar.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Contexto (cualitativo)</CardTitle>
        <CardDescription>
          Lo que las APIs no ven: seniority, participación en ceremonias, ownership
          y feedback. Enriquece el análisis y la matriz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <p className="rounded-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {msg}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Rol</Label>
            <Input value={ctx.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Backend / Frontend / QA..." />
          </div>
          <div className="space-y-1">
            <Label>Seniority</Label>
            <Input value={ctx.seniority ?? ""} onChange={(e) => set("seniority", e.target.value)} placeholder="Junior / Semi / Senior / Lead" />
          </div>
          <Select label="Participación en daily" value={ctx.daily ?? ""} onChange={(v) => set("daily", v)} />
          <Select label="Refinamientos" value={ctx.refinement ?? ""} onChange={(v) => set("refinement", v)} />
          <Select label="Retrospectivas" value={ctx.retro ?? ""} onChange={(v) => set("retro", v)} />
          <Select label="Demos" value={ctx.demo ?? ""} onChange={(v) => set("demo", v)} />
          <Select label="Ownership" value={ctx.ownership ?? ""} onChange={(v) => set("ownership", v)} />
        </div>
        <div className="space-y-1">
          <Label>Feedback (TL / PO / pares)</Label>
          <textarea
            className="w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm"
            rows={2}
            value={ctx.feedback ?? ""}
            onChange={(e) => set("feedback", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Notas / observaciones</Label>
          <textarea
            className="w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm"
            rows={2}
            value={ctx.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Guardando..." : "Guardar contexto"}
        </Button>
      </CardContent>
    </Card>
  );
}
