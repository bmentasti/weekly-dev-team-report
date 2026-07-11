"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export function ThemeToggle() {
  const { t } = useT();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t("toggle.theme.toLight") : t("toggle.theme.toDark")}
      aria-pressed={dark}
      title={dark ? t("toggle.theme.toLight") : t("toggle.theme.toDark")}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
