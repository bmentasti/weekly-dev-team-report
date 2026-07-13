"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

type Role = "TL" | "PO" | "DIR";

const ROLE_LABEL_KEY: Record<Role, string> = {
  TL: "rep.roleTL",
  PO: "rep.rolePO",
  DIR: "rep.roleDIR",
};

const SUGGESTION_KEYS: Record<Role, string[]> = {
  TL: [
    "rep.aiSuggestTLPrs",
    "rep.aiSuggestTLQuality",
    "rep.aiSuggestTLSupport",
  ],
  PO: [
    "rep.aiSuggestPOGoal",
    "rep.aiSuggestPONext",
    "rep.aiSuggestPOValue",
  ],
  DIR: [
    "rep.aiSuggestDIRHealth",
    "rep.aiSuggestDIRRisks",
    "rep.aiSuggestDIRDate",
  ],
};

export function AiAskBox({ reportId }: { reportId: string }) {
  const { t } = useT();
  const [role, setRole] = useState<Role>("TL");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q?: string) {
    const question = (q ?? prompt).trim();
    if (!question) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    const res = await fetch(`/api/reports/${reportId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: question, role }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (json.answer) setAnswer(json.answer);
    else setError(json.error ?? t("rep.couldNotAnswer"));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("rep.askTheReport")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="inline-flex rounded-full border bg-card p-1 text-sm">
          {(["TL", "PO", "DIR"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                role === r ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              {t(ROLE_LABEL_KEY[r])}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTION_KEYS[role].map((key) => {
            const s = t(key);
            return (
              <button
                key={key}
                onClick={() => {
                  setPrompt(s);
                  ask(s);
                }}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            );
          })}
        </div>
        <textarea
          className="w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          rows={3}
          placeholder={t("rep.askPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button onClick={() => ask()} disabled={loading || !prompt.trim()}>
          {loading ? t("rep.thinking") : t("rep.askButton")}
        </Button>

        {error && (
          <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {answer && (
          <div className="rounded-input border bg-muted/40 p-3">
            <p className="whitespace-pre-wrap text-sm">{answer}</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {t("rep.aiOnlyReportData")}
        </p>
      </CardContent>
    </Card>
  );
}
