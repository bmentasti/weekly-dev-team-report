"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";
import { formatDateTime } from "@/lib/utils";

export function ScheduleForm() {
  const { t } = useT();
  const [frequency, setFrequency] = useState<"MANUAL" | "WEEKLY">("MANUAL");
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [recipients, setRecipients] = useState("");
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/report-configs");
      if (!res.ok) return;
      const json = await res.json();
      if (json.config) {
        setFrequency(json.config.frequency);
        setRecipients((json.config.recipients ?? []).join(", "));
        setLastRunAt(json.config.lastRunAt ?? null);
        if (json.config.locale === "en" || json.config.locale === "es")
          setLocale(json.config.locale);
      }
    })();
  }, []);

  function parseRecipients() {
    return recipients.split(",").map((r) => r.trim()).filter(Boolean);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/report-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency, recipients: parseRecipients(), locale }),
    });
    setBusy(false);
    setMsg(res.ok ? t("rep2.schedule.saved") : t("rep2.schedule.saveError"));
  }

  async function runNow() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/report-configs/run", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      json.ok
        ? `${t("rep2.schedule.sentTo")} ${json.sent} ${t("rep2.schedule.recipients")}`
        : json.error ?? t("rep2.schedule.sendError"),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("rep2.schedule.title")}</CardTitle>
        <CardDescription>
          {t("rep2.schedule.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <p className="rounded-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label>{t("rep2.schedule.frequency")}</Label>
            <div className="inline-flex rounded-button border bg-card p-1 text-sm">
              {(["MANUAL", "WEEKLY"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`rounded-button px-3 py-1.5 font-medium ${
                    frequency === f ? "bg-primary text-white" : "text-muted-foreground"
                  }`}
                >
                  {f === "MANUAL" ? t("rep2.schedule.manual") : t("rep2.schedule.weekly")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("rep2.schedule.language")}</Label>
            <div className="inline-flex rounded-button border bg-card p-1 text-sm">
              {(["es", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-button px-3 py-1.5 font-medium ${
                    locale === l ? "bg-primary text-white" : "text-muted-foreground"
                  }`}
                >
                  {l === "es" ? t("rep2.schedule.langEs") : t("rep2.schedule.langEn")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="rcpts">{t("rep2.schedule.recipientsLabel")}</Label>
            <Input
              id="rcpts"
              placeholder={t("rep2.schedule.recipientsPlaceholder")}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy}>
            {t("rep2.schedule.save")}
          </Button>
          <Button variant="outline" onClick={runNow} disabled={busy}>
            {t("rep2.schedule.sendNow")}
          </Button>
          {lastRunAt && (
            <span className="text-xs text-muted-foreground">
              {t("rep2.schedule.lastSend")} {formatDateTime(lastRunAt)}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("rep2.schedule.note")}
        </p>
      </CardContent>
    </Card>
  );
}
