"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { userRoles, userRoleLabels } from "@/lib/validations";
import { useT } from "@/components/i18n-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: String(formData.get("name")),
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      company: String(formData.get("company") || ""),
      role: String(formData.get("role")),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("auth.registerError"));
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });

    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    // Primero el workspace: crea el espacio y un proyecto "General" por
    // defecto. Sin este paso el usuario entra sin workspace y todo lo que lo
    // requiere (crear proyecto, integraciones, reportes) falla con 400.
    router.push("/workspace/new");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t("auth.createAccount")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.registerSubtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && (
          <p className="rounded-input bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.name")}</Label>
          <Input id="name" name="name" placeholder={t("auth.namePlaceholder")} required />
        </div>
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
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">{t("auth.company")}</Label>
          <Input id="company" name="company" placeholder={t("auth.companyPlaceholder")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">{t("auth.role")}</Label>
          <select
            id="role"
            name="role"
            defaultValue="TECH_LEAD"
            className="flex h-11 w-full rounded-input border border-input bg-card px-3.5 py-2 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            {userRoles.map((role) => (
              <option key={role} value={role}>
                {userRoleLabels[role]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? t("auth.creating") : t("auth.signUp")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("auth.goLogin")}
        </Link>
      </p>
    </div>
  );
}
