"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    // En producción esto iría a un servicio de observabilidad (Sentry, etc.).
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border bg-card p-8 text-center shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">{t("mc.error.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("mc.error.desc")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>{t("mc.error.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">{t("mc.error.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
