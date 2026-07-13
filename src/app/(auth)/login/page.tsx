"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError(t("auth.badCredentials"));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("auth.welcome")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.loginSubtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.workEmail")}</Label>
          {/* type=text (no email) para permitir el username del backoffice;
              el formato de email se valida server-side igual que antes. */}
          <Input
            id="email"
            name="email"
            type="text"
            autoComplete="username"
            placeholder={t("auth.emailPlaceholder")}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <span className="text-sm text-primary">{t("auth.forgotPassword")}</span>
          </div>
          <Input id="password" name="password" type="password" required />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? t("auth.loggingIn") : t("auth.login")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </div>
  );
}
