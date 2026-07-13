"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

const LEVELS = ["", "LOW", "MEDIUM", "HIGH"];

type Ctx = Record<string, string>;

function Select({
  label,
  value,
  onChange,
  levelLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  levelLabel: Record<string, string>;
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
            {levelLabel[l]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PersonContextForm({ name }: { name: string }) {
  const { t } = useT();
  const levelLabel: Record<string, string> = {
    "": t("ws.context.levelDash"),
    LOW: t("ws.context.levelLow"),
    MEDIUM: t("ws.context.levelMedium"),
    HIGH: t("ws.context.levelHigh"),
  };
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
    setMsg(res.ok ? t("ws.context.saved") : t("ws.context.saveError"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("ws.context.title")}</CardTitle>
        <CardDescription>
          {t("ws.context.description")}
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
            <Label>{t("ws.context.role")}</Label>
            <Input value={ctx.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder={t("ws.context.rolePlaceholder")} />
          </div>
          <div className="space-y-1">
            <Label>{t("ws.context.seniority")}</Label>
            <Input value={ctx.seniority ?? ""} onChange={(e) => set("seniority", e.target.value)} placeholder={t("ws.context.seniorityPlaceholder")} />
          </div>
          <Select label={t("ws.context.daily")} value={ctx.daily ?? ""} onChange={(v) => set("daily", v)} levelLabel={levelLabel} />
          <Select label={t("ws.context.refinement")} value={ctx.refinement ?? ""} onChange={(v) => set("refinement", v)} levelLabel={levelLabel} />
          <Select label={t("ws.context.retro")} value={ctx.retro ?? ""} onChange={(v) => set("retro", v)} levelLabel={levelLabel} />
          <Select label={t("ws.context.demo")} value={ctx.demo ?? ""} onChange={(v) => set("demo", v)} levelLabel={levelLabel} />
          <Select label={t("ws.context.ownership")} value={ctx.ownership ?? ""} onChange={(v) => set("ownership", v)} levelLabel={levelLabel} />
        </div>
        <div className="space-y-1">
          <Label>{t("ws.context.feedback")}</Label>
          <textarea
            className="w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm"
            rows={2}
            value={ctx.feedback ?? ""}
            onChange={(e) => set("feedback", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("ws.context.notes")}</Label>
          <textarea
            className="w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm"
            rows={2}
            value={ctx.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? t("ws.context.saving") : t("ws.context.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
