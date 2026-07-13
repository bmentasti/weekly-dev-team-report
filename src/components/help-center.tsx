"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import {
  FAQ,
  FAQ_INDEX,
  FAQ_INTRO,
  FEATURED_GROUPS,
  IMPORTANCE_LABEL,
  ROLE_FILTERS,
  SEARCH_EMPTY,
  SEARCH_PLACEHOLDER,
  SEARCH_SUBTEXT,
  type FaqIndexItem,
  type FaqItem,
  type HelpImportance,
  type HelpRole,
} from "@/lib/help/faq";

function importanceVariant(
  imp: HelpImportance,
): "warning" | "info" | "secondary" {
  if (imp === "alta") return "warning";
  if (imp === "media") return "info";
  return "secondary";
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matchesRole(itemRole: HelpRole, filter: HelpRole) {
  // "Todos" muestra todo. Al elegir un rol, filtramos de forma estricta
  // para que el agrupamiento sea claramente visible.
  if (filter === "Todos") return true;
  return itemRole === filter;
}

function QaRow({
  item,
  showCategory,
}: {
  item: FaqItem & { categoryTitle?: string };
  showCategory?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 py-3 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="flex-1">
          <span className="font-medium">{t(item.q)}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {showCategory && item.categoryTitle && (
              <Badge variant="outline" className="text-[10px]">
                {t(item.categoryTitle)}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {item.role}
            </Badge>
            <Badge
              variant={importanceVariant(item.importance)}
              className="text-[10px]"
            >
              {t(IMPORTANCE_LABEL[item.importance])}
            </Badge>
          </span>
        </span>
      </button>
      {open && (
        <p className="pb-4 pl-8 pr-2 text-sm leading-relaxed text-muted-foreground">
          {t(item.a)}
        </p>
      )}
    </div>
  );
}

export function HelpCenter() {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<HelpRole>("Todos");

  const q = normalize(query.trim());
  const searching = q.length >= 2;

  const results: FaqIndexItem[] = useMemo(() => {
    if (!searching) return [];
    return FAQ_INDEX.filter(
      (it) =>
        matchesRole(it.role, role) &&
        (normalize(t(it.q)).includes(q) ||
          normalize(t(it.a)).includes(q) ||
          normalize(t(it.categoryTitle)).includes(q)),
    );
  }, [q, searching, role, t]);

  // Cantidad de preguntas que coinciden con el rol activo (sin búsqueda).
  const roleCount = useMemo(
    () => FAQ_INDEX.filter((it) => matchesRole(it.role, role)).length,
    [role],
  );
  const filtered = role !== "Todos";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="rounded-card bg-navy px-6 py-10 text-white sm:px-10">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <LifeBuoy className="h-4 w-4" />
          {t("mc.hc.badge")}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("mc.hc.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">{t(FAQ_INTRO)}</p>

        <div className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(SEARCH_PLACEHOLDER)}
              className="h-12 w-full rounded-button border border-transparent bg-card pl-12 pr-4 text-sm text-foreground shadow-card outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="mt-2 text-xs text-white/60">{t(SEARCH_SUBTEXT)}</p>
        </div>
      </div>

      {/* Filtro por rol */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("mc.hc.filterByRole")}</span>
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                role === r
                  ? "border-primary bg-primary text-white"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {r === "Todos" ? t("mc.hc.all") : r}
            </button>
          ))}
        </div>
        {!searching && filtered && (
          <p className="text-sm text-muted-foreground">
            {t("mc.hc.showingPrefix")}{" "}
            <span className="font-semibold text-foreground">{roleCount}</span>{" "}
            {t("mc.hc.questionsFor")}{" "}
            <span className="font-semibold text-foreground">{role}</span>.{" "}
            <button
              onClick={() => setRole("Todos")}
              className="font-medium text-primary hover:underline"
            >
              {t("mc.hc.seeAll")}
            </button>
          </p>
        )}
      </div>

      {searching ? (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            {results.length} {t("mc.hc.resultsSuffix")} “{query.trim()}”
          </p>
          {results.length === 0 ? (
            <div className="rounded-card border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">{t(SEARCH_EMPTY)}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/#contacto">{t("mc.hc.supportWrite")}</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-card border bg-card px-5">
              {results.map((it) => (
                <QaRow key={it.id} item={it} showCategory />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Destacadas */}
          <div className="space-y-6">
            {FEATURED_GROUPS.map((group) => {
              const items = FAQ_INDEX.filter(
                (it) =>
                  it.featured?.includes(group.id) &&
                  matchesRole(it.role, role),
              );
              if (items.length === 0) return null;
              return (
                <div
                  key={group.id}
                  className="rounded-card border bg-primary/5 px-5 py-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">{t(group.title)}</h2>
                  </div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t(group.description)}
                  </p>
                  <div>
                    {items.map((it) => (
                      <QaRow key={`${group.id}-${it.id}`} item={it} showCategory />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Categorías */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {filtered
                ? `${t("mc.hc.categoriesFor")} ${role}`
                : t("mc.hc.allCategories")}
            </h2>
            {FAQ.map((cat) => {
              const items = cat.items.filter((it) =>
                matchesRole(it.role, role),
              );
              if (items.length === 0) return null;
              return (
                <CategoryBlock
                  key={`${cat.id}-${role}`}
                  title={t(cat.title)}
                  description={t(cat.description)}
                  count={items.length}
                  items={items}
                  defaultOpen={filtered}
                />
              );
            })}
          </div>
        </>
      )}

      <div className="rounded-card border bg-muted/40 px-6 py-6 text-center">
        <h3 className="font-semibold">{t("mc.hc.notFoundTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("mc.hc.notFoundDesc")}
        </p>
        <Button asChild className="mt-4">
          <Link href="/#contacto">{t("mc.hc.contactSupport")}</Link>
        </Button>
      </div>
    </div>
  );
}

function CategoryBlock({
  title,
  description,
  count,
  items,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  count: number;
  items: FaqItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-card border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="flex-1">
          <span className="font-semibold">{title}</span>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground">{count}</span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t px-5">
          {items.map((it) => (
            <QaRow key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
