"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ScheduleForm() {
  const [frequency, setFrequency] = useState<"MANUAL" | "WEEKLY">("MANUAL");
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
      body: JSON.stringify({ frequency, recipients: parseRecipients() }),
    });
    setBusy(false);
    setMsg(res.ok ? "Programación guardada." : "No se pudo guardar.");
  }

  async function runNow() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/report-configs/run", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(
      json.ok
        ? `Reporte generado y enviado a ${json.sent} destinatario(s).`
        : json.error ?? "No se pudo enviar.",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Envío programado</CardTitle>
        <CardDescription>
          Enviá el reporte semanal automáticamente por email al equipo.
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
            <Label>Frecuencia</Label>
            <div className="inline-flex rounded-button border bg-white p-1 text-sm">
              {(["MANUAL", "WEEKLY"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`rounded-button px-3 py-1.5 font-medium ${
                    frequency === f ? "bg-primary text-white" : "text-muted-foreground"
                  }`}
                >
                  {f === "MANUAL" ? "Manual" : "Semanal"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="rcpts">Destinatarios</Label>
            <Input
              id="rcpts"
              placeholder="emails separados por coma"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={busy}>
            Guardar
          </Button>
          <Button variant="outline" onClick={runNow} disabled={busy}>
            Enviar ahora
          </Button>
          {lastRunAt && (
            <span className="text-xs text-muted-foreground">
              Último envío: {new Date(lastRunAt).toLocaleString()}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          El envío semanal automático lo dispara un scheduler (CRON_SECRET). El
          email requiere configurar Resend. &quot;Enviar ahora&quot; genera y manda al
          instante para probar.
        </p>
      </CardContent>
    </Card>
  );
}
