"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { translate, type Dict } from "@/lib/i18n/dictionaries";

interface I18nContextValue {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "es",
  t: (k) => k,
});

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dict;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: (key: string) => translate(dict, key) }),
    [locale, dict],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  return useContext(I18nContext);
}
