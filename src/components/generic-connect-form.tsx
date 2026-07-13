"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProviderCatalogEntry } from "@/lib/integrations/catalog";
import { useT } from "@/components/i18n-provider";

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

export function GenericConnectForm({
  entry,
  initialConfig,
  connected,
}: {
  entry: ProviderCatalogEntry;
  initialConfig: Record<string, string>;
  connected: boolean;
}) {
  const router = useRouter();
  const { t } = useT();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const values: Record<string, string> = {};
    for (const field of entry.fields) {
      values[field.name] = String(data.get(field.name) ?? "");
    }
    return values;
  }

  async function handleTest(form: HTMLFormElement) {
    setFeedback(null);
    setTesting(true);
    const res = await fetch(`/api/integrations/${entry.slug}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readForm(form)),
    });
    const data = await res.json().catch(() => ({}));
    setTesting(false);
    if (data.ok) {
      setFeedback({
        type: "success",
        message: `${t("ws.connect.connOkPrefix")}${data.detail ? ` — ${data.detail}` : ""}.`,
      });
    } else {
      setFeedback({
        type: "error",
        message: data.error ?? `${t("ws.connect.cantConnectPrefix")} ${entry.label}.`,
      });
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const res = await fetch(`/api/integrations/${entry.slug}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readForm(e.currentTarget)),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.ok) {
      router.push(`/integrations/${entry.slug}/data`);
      router.refresh();
    } else {
      setFeedback({
        type: "error",
        message: data.error ?? t("ws.connect.saveError"),
      });
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{`${t("ws.connect.titlePrefix")} ${entry.label}`}</CardTitle>
        <CardDescription>
          {`${entry.blurb} ${t("ws.connect.descSuffix")}`}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-4">
          {entry.guide.length > 0 && (
            <details className="group rounded-md border bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer select-none font-medium text-foreground">
                {t("ws.connect.guideSummary")}
              </summary>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-muted-foreground">
                {entry.guide.map((step, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">
                      {step.field}:
                    </span>{" "}
                    {step.body}{" "}
                    {step.link && (
                      <a
                        href={step.link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {step.link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </details>
          )}

          {connected && (
            <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              {`${entry.label} ${t("ws.connect.alreadyConnectedPrefix")} ${t("ws.connect.alreadyConnectedSuffix")}`}
            </p>
          )}
          {feedback && (
            <p
              className={
                feedback.type === "success"
                  ? "rounded-md bg-success-soft px-3 py-2 text-sm text-success"
                  : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              }
            >
              {feedback.message}
            </p>
          )}

          {entry.fields.map((field) => (
            <div className="space-y-2" key={field.name}>
              <Label htmlFor={field.name}>
                {field.label}
                {field.optional && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {t("ws.connect.optional")}
                  </span>
                )}
              </Label>
              <Input
                id={field.name}
                name={field.name}
                type={field.secret ? "password" : "text"}
                placeholder={field.placeholder}
                defaultValue={field.secret ? undefined : initialConfig[field.name]}
                required={!field.optional}
              />
              {field.help && (
                <p className="text-xs text-muted-foreground">{field.help}</p>
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter className="flex justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={testing || saving}
            onClick={(e) => {
              const form = e.currentTarget.closest("form");
              if (form) handleTest(form);
            }}
          >
            {testing ? t("ws.connect.testing") : t("ws.connect.testConnection")}
          </Button>
          <Button type="submit" disabled={saving || testing}>
            {saving ? t("ws.connect.saving") : t("ws.connect.saveIntegration")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
