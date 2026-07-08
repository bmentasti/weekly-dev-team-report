"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailReport({ reportId }: { reportId: string }) {
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  // Prefill with the report's shared participants.
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/reports/${reportId}/shares`);
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.shares ?? [])
        .map((s: { email: string | null }) => s.email)
        .filter(Boolean);
      if (list.length) setEmails(list.join(", "));
    })();
  }, [reportId]);

  async function send() {
    setSending(true);
    setFeedback(null);
    const recipients = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    const res = await fetch(`/api/reports/${reportId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (json.ok) {
      setFeedback({
        type: "success",
        message: `Enviado a ${json.sent} destinatario(s). El CSV va adjunto.`,
      });
    } else {
      setFeedback({
        type: "error",
        message: json.error ?? "No se pudo enviar.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Enviar por email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedback && (
          <p
            className={
              feedback.type === "success"
                ? "rounded-input bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {feedback.message}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="emails separados por coma"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
          <Button onClick={send} disabled={sending || !emails.trim()}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Se envía un resumen con las métricas y el CSV adjunto. Requiere
          configurar el servicio de email (RESEND_API_KEY).
        </p>
      </CardContent>
    </Card>
  );
}
