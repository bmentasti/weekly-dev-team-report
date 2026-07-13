"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

export default function ForgotPasswordPage() {
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email") as string;
    setLoading(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => undefined);
    setLoading(false);
    // Siempre mostramos el mismo mensaje (sin revelar si el email existe).
    setDone(true);
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("auth.forgot.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
      </div>

      {done ? (
        <div className="space-y-5">
          <p className="rounded-input bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            {t("auth.forgot.done")}
          </p>
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.workEmail")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              required
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? t("auth.forgot.sending") : t("auth.forgot.submit")}
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
