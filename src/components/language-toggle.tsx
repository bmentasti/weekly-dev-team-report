"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useT } from "@/components/i18n-provider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

export function LanguageToggle() {
  const { locale, t } = useT();
  const router = useRouter();

  function switchTo(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    // Re-renderiza los Server Components con el nuevo locale.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => switchTo(locale === "es" ? "en" : "es")}
      aria-label={t("toggle.lang")}
      title={t("toggle.lang")}
      className="flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Languages className="h-4 w-4" aria-hidden />
      {locale === "es" ? "EN" : "ES"}
    </button>
  );
}
