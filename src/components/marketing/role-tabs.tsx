"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  GitPullRequest,
  ClipboardList,
  GaugeCircle,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

type RoleKey = "tl" | "po" | "dir";

interface RoleDef {
  key: RoleKey;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
  role: string;
  value: string;
  points: string[];
  cta: string;
  visual: React.ReactNode;
}

/* ------------------------------ mini visuals ------------------------------ */

function TlVisual() {
  const { t } = useT();
  return (
    <div className="rounded-card border bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{t("mc.rt.tl.openPrs")}</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {t("mc.rt.tl.noReviewer")}
        </span>
      </div>
      <div className="space-y-2">
        {[
          ["#482 · refactor auth", "72h", "danger"],
          ["#488 · fix cache", "26h", "warn"],
          ["#490 · api pagination", "8h", "ok"],
        ].map(([t, age, tone]) => (
          <div
            key={t}
            className="flex items-center gap-2 rounded-input border px-3 py-2 text-sm"
          >
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{t}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                tone === "danger"
                  ? "bg-red-100 text-red-700"
                  : tone === "warn"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800",
              )}
            >
              {age}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PoVisual() {
  const { t } = useT();
  return (
    <div className="rounded-card border bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{t("mc.rt.po.functionalProgress")}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
          {t("mc.rt.po.readyDemo")}
        </span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{t("mc.rt.po.committed")}</span>
          <span>82%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[82%] rounded-full bg-primary" />
        </div>
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CircleDot className="h-3.5 w-3.5 text-primary/60" /> {t("mc.rt.po.scopeCreep")}
        </div>
        <div className="flex items-center gap-2">
          <CircleDot className="h-3.5 w-3.5 text-primary/60" /> {t("mc.rt.po.reopened")}
        </div>
      </div>
    </div>
  );
}

function DirVisual() {
  const { t } = useT();
  return (
    <div className="rounded-card border bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{t("mc.rt.dir.portfolioHealth")}</span>
        <span className="text-[11px] text-muted-foreground">{t("mc.rt.dir.projects")}</span>
      </div>
      <div className="space-y-2">
        {[
          [t("mc.rt.dir.checkout"), t("mc.rt.dir.critical"), "bg-red-100 text-red-700", "down"],
          [t("mc.rt.dir.onboarding"), t("mc.rt.dir.observation"), "bg-amber-100 text-amber-800", "down"],
          [t("mc.rt.dir.coreApi"), t("mc.rt.dir.healthy"), "bg-emerald-100 text-emerald-800", "up"],
        ].map(([name, label, tone, dir]) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-input border px-3 py-2 text-sm"
          >
            <span className="flex-1 font-medium">{name}</span>
            {dir === "up" ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            )}
            <span
              className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- component ------------------------------- */

export function RoleTabs() {
  const { t } = useT();
  const [active, setActive] = useState<RoleKey>("tl");

  const ROLES: RoleDef[] = [
    {
      key: "tl",
      tab: t("mc.rt.tl.tab"),
      icon: GitPullRequest,
      role: t("mc.rt.tl.role"),
      value: t("mc.rt.tl.value"),
      points: [
        t("mc.rt.tl.p1"),
        t("mc.rt.tl.p2"),
        t("mc.rt.tl.p3"),
        t("mc.rt.tl.p4"),
      ],
      cta: t("mc.rt.tl.cta"),
      visual: <TlVisual />,
    },
    {
      key: "po",
      tab: t("mc.rt.po.tab"),
      icon: ClipboardList,
      role: t("mc.rt.po.role"),
      value: t("mc.rt.po.value"),
      points: [
        t("mc.rt.po.p1"),
        t("mc.rt.po.p2"),
        t("mc.rt.po.p3"),
        t("mc.rt.po.p4"),
      ],
      cta: t("mc.rt.po.cta"),
      visual: <PoVisual />,
    },
    {
      key: "dir",
      tab: t("mc.rt.dir.tab"),
      icon: GaugeCircle,
      role: t("mc.rt.dir.role"),
      value: t("mc.rt.dir.value"),
      points: [
        t("mc.rt.dir.p1"),
        t("mc.rt.dir.p2"),
        t("mc.rt.dir.p3"),
        t("mc.rt.dir.p4"),
      ],
      cta: t("mc.rt.dir.cta"),
      visual: <DirVisual />,
    },
  ];

  const current = ROLES.find((r) => r.key === active)!;

  return (
    <div className="mt-10">
      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("mc.rt.aria")}
        className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2"
      >
        {ROLES.map((r) => {
          const isActive = r.key === active;
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(r.key)}
              className={cn(
                "flex items-center gap-2 rounded-button border px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-white"
                  : "border-input bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {r.tab}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mx-auto mt-8 max-w-4xl rounded-card border bg-white p-6 shadow-card md:p-8">
        <div
          key={active}
          role="tabpanel"
          className="grid gap-8 duration-300 animate-in fade-in md:grid-cols-2 md:items-center"
        >
          <div className="duration-500 animate-in fade-in slide-in-from-bottom-2">
            <h3 className="text-xl font-semibold">{current.role}</h3>
            <p className="mt-2 text-muted-foreground">{current.value}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {current.points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {p}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6">
              <Link href="/register">{current.cta}</Link>
            </Button>
          </div>
          <div className="duration-500 animate-in fade-in slide-in-from-bottom-3 md:slide-in-from-right-4">
            {current.visual}
          </div>
        </div>
      </div>
    </div>
  );
}
