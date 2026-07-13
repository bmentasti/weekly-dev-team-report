"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

function ResetForm() {
  const { t } = useT();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? t("auth.reset.error"));
      else setDone(true);
    } catch {
      setError(t("auth.reset.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("auth.reset.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
      </div>

      {done ? (
        <div className="space-y-5">
          <p className="rounded-input bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            {t("auth.reset.success")}
          </p>
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {!token && (
            <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t("auth.reset.missingToken")}
            </p>
          )}
          {error && (
            <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={loading || !token}
          >
            {loading ? t("auth.reset.saving") : t("auth.reset.submit")}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requiere un boundary de Suspense en Next 14.
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
