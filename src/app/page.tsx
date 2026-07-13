import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  Zap,
  Bell,
  Check,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  TrendingUp,
  AlertTriangle,
  CircleDot,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/marketing/contact-form";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { RoleTabs } from "@/components/marketing/role-tabs";
import { RotatingHeadline } from "@/components/marketing/rotating-headline";
import { LandingScrollReveal } from "@/components/marketing/landing-scroll-reveal";
import { INTEGRATIONS, getLandingData } from "@/lib/marketing/landing-data";
import { FAQ_INDEX } from "@/lib/help/faq";

const POPULAR_FAQ = FAQ_INDEX.filter((it) =>
  it.featured?.includes("nuevos"),
).slice(0, 6);

/* --------------------------- small visual mocks --------------------------- */

const badgeTone: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800",
  info: "bg-blue-100 text-blue-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-700",
};

function MiniBars() {
  const bars = [40, 62, 48, 80, 70, 90];
  return (
    <div className="flex h-14 items-end gap-1.5">
      {bars.map((h, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function DirIcon({ dir }: { dir: "up" | "down" | "flat" }) {
  if (dir === "up")
    return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (dir === "down")
    return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

/* --------------------------------- page ---------------------------------- */

export default async function LandingPage() {
  const { t, locale } = getT();
  const {
    PROBLEMS,
    STEPS,
    REPORT_SHOWCASE,
    METRIC_GROUPS,
    ALERTS,
    COMPARE_ROWS,
    PIPELINE,
    USE_CASES,
    TRUST,
  } = getLandingData(locale);
  const session = await getServerSession(authOptions);

  return (
    <div id="landing-root" className="bg-white text-foreground">
      <LandingScrollReveal />
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo iconClassName="h-8 w-8 text-navy" />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#producto" className="hover:text-foreground">{t("m.nav.product")}</a>
            <a href="#reportes" className="hover:text-foreground">{t("m.nav.reports")}</a>
            <a href="#roles" className="hover:text-foreground">{t("m.nav.team")}</a>
            <a href="#integraciones" className="hover:text-foreground">{t("m.nav.integrations")}</a>
            <a href="#precios" className="hover:text-foreground">{t("m.nav.pricing")}</a>
            <a href="#ayuda" className="hover:text-foreground">{t("m.nav.help")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {session ? (
              <Button asChild>
                <Link href="/dashboard">{t("m.nav.goDashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">{t("m.nav.login")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t("m.nav.tryFree")}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------- Hero ------------------------------- */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute -right-40 top-0 h-[32rem] w-[32rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="container relative grid gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div className="max-w-xl">
            <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold">
              {t("m.hero.badge")}
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("m.hero.titlePrefix")} <RotatingHeadline />
            </h1>
            <p className="mt-5 text-lg text-white/70">{t("m.hero.desc")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12">
                <Link href="/register">{t("m.nav.tryFree")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <a href="#producto">{t("m.cta.howItWorks")}</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/50">{t("m.hero.freeLine")}</p>
          </div>

          {/* Product preview mock (parcial) */}
          <div className="relative">
            <div className="rounded-card bg-white p-5 text-foreground shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">{t("m.mock.weeklyReport")}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {t("m.mock.mediumRisk")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["14", t("m.mock.done")],
                  ["8", t("m.mock.prMerged")],
                  ["3", t("m.mock.blocked")],
                  ["7", t("m.mock.prOpen")],
                  ["2.4d", "Cycle time"],
                  ["11%", "Scope creep"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-input border p-3">
                    <div className="text-xl font-bold">{v}</div>
                    <div className="text-[11px] text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div className="flex-1">
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    {t("m.mock.velocity6")}
                  </p>
                  <MiniBars />
                </div>
                <Button size="sm" className="shrink-0">
                  {t("m.mock.generate")}
                </Button>
              </div>
            </div>

            {/* Floating card: score de salud */}
            <div className="absolute -left-4 -top-5 hidden rounded-card bg-white p-3 shadow-card sm:block">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("m.mock.healthScore")}
              </p>
              <p className="text-2xl font-bold text-navy">78<span className="text-sm font-medium text-muted-foreground">/100</span></p>
            </div>

            {/* Floating card: alerta */}
            <div className="absolute -bottom-6 -right-2 hidden max-w-[15rem] rounded-card bg-white p-3 shadow-card md:block">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold">{t("m.mock.riskDetected")}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("m.mock.riskDetail")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------- Social proof / stats strip ------------------- */}
      <section className="border-b bg-white py-10">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground">
            {t("m.social.worksWith")}
          </p>
          <div className="marquee-mask mt-5 flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
              {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="whitespace-nowrap text-lg font-semibold text-navy/40"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["+40", t("m.stats.l1")],
              ["12", t("m.stats.l2")],
              ["1 click", t("m.stats.l3")],
            ].map(([v, l]) => (
              <div key={l} className="text-center">
                <div className="text-3xl font-bold tracking-tight text-navy">
                  {v}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Problema ---------------------------- */}
      <section className="border-b py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("m.problem.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t("m.problem.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("m.problem.desc")}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p) => (
              <Card key={p.title}>
                <CardContent className="py-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-input bg-red-50 text-red-500">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Solución ---------------------------- */}
      <section id="producto" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("m.solution.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t("m.solution.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("m.solution.desc")}</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-input bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {t("m.step")} {s.n}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-3 text-xs font-medium text-primary">{s.micro}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Integraciones -------------------------- */}
      <section id="integraciones" className="border-y bg-muted/40 py-16">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t("m.integ.title")}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{t("m.integ.desc")}</p>
          </div>

          {/* Data flow: fuentes -> centro */}
          <div className="mt-10 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
            <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
              {INTEGRATIONS.slice(0, 6).map((n) => (
                <span
                  key={n}
                  className="rounded-input border bg-white px-3 py-1.5 text-sm font-semibold text-navy/80 shadow-soft"
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <ArrowRight className="hidden h-5 w-5 lg:block" />
              <span className="flex h-16 w-16 items-center justify-center rounded-card bg-navy text-white shadow-card">
                <Logo showText={false} iconClassName="h-8 w-8" />
              </span>
              <ArrowRight className="hidden h-5 w-5 rotate-180 lg:block" />
            </div>
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {INTEGRATIONS.slice(6).map((n) => (
                <span
                  key={n}
                  className="rounded-input border bg-white px-3 py-1.5 text-sm font-semibold text-navy/80 shadow-soft"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            {t("mc.landing.aiLine")}
          </p>
        </div>
      </section>

      {/* ---------------------------- Reportes ------------------------------ */}
      <section id="reportes" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("m.reports.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t("m.reports.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">{t("m.reports.desc")}</p>
          </div>

          <div className="marquee-mask mt-12 flex overflow-hidden">
            <div className="animate-marquee flex shrink-0 gap-6 pr-6">
              {[...REPORT_SHOWCASE, ...REPORT_SHOWCASE].map((r, i) => (
                <div
                  key={`${r.title}-${i}`}
                  className="relative w-72 shrink-0 overflow-hidden rounded-card border bg-white shadow-card"
                >
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {r.tag}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeTone[r.badge.tone]}`}
                      >
                        {r.badge.label}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold">{r.title}</h3>
                    <div className="mt-3 space-y-1.5">
                      {r.lines.map((l) => (
                        <div
                          key={l}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <CircleDot className="h-3.5 w-3.5 text-primary/60" />
                          {l}
                        </div>
                      ))}
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      {r.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  {/* recorte difuminado inferior para sugerir "hay más" */}
                  <div className="relative h-10">
                    <div className="absolute inset-x-4 top-0 h-16 rounded-t-input border border-b-0 bg-muted/50" />
                    <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white to-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("m.reports.illustrative")}
          </p>
        </div>
      </section>

      {/* ------------------------------ Por rol ----------------------------- */}
      <section id="roles" className="bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.roles.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("m.roles.desc")}</p>
          </div>
          <RoleTabs />
        </div>
      </section>

      {/* --------------------------- Métricas ------------------------------- */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.metrics.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("m.metrics.desc")}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {METRIC_GROUPS.map((g) => (
              <Card key={g.title}>
                <CardContent className="py-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-input bg-primary/10 text-primary">
                      <g.icon className="h-4 w-4" />
                    </span>
                    <h3 className="font-semibold">{g.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                        {it}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------- Alertas inteligentes ----------------------- */}
      <section className="border-y bg-navy py-20 text-white">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Bell className="h-3.5 w-3.5" /> {t("m.al.badge")}
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">{t("m.al.title")}</h2>
            <p className="mt-4 text-white/70">{t("m.al.desc")}</p>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="mt-6 h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <a href="#producto">{t("m.al.cta")}</a>
            </Button>
          </div>

          {/* Panel de alertas */}
          <div className="rounded-card bg-white p-4 text-foreground shadow-card">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">{t("m.al.required")}</span>
              <span className="text-xs text-muted-foreground">{t("m.al.count")}</span>
            </div>
            <div className="space-y-2">
              {ALERTS.map((a) => (
                <div
                  key={a.text}
                  className="flex items-start gap-3 rounded-input border p-3"
                >
                  <span
                    className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeTone[a.tone]}`}
                  >
                    {a.label}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {a.who} · {t("m.al.action")} {a.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- Comparativa de sprints ------------------------ */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.cmp.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("m.cmp.desc")}</p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-card border shadow-card">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center gap-2 border-b bg-muted/50 px-5 py-3 text-xs font-semibold text-muted-foreground">
              <span>{t("m.cmp.metric")}</span>
              <span className="text-center">Sprint 23</span>
              <span className="text-center">Sprint 24</span>
              <span className="text-right">{t("m.cmp.var")}</span>
            </div>
            {COMPARE_ROWS.map((r) => (
              <div
                key={r.label}
                className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center gap-2 border-b px-5 py-3 text-sm last:border-0"
              >
                <span className="font-medium">{r.label}</span>
                <span className="text-center text-muted-foreground">{r.s1}</span>
                <span className="text-center font-semibold">{r.s2}</span>
                <span className="flex items-center justify-end gap-1 font-medium">
                  <DirIcon dir={r.dir} />
                  {r.delta}
                </span>
              </div>
            ))}
            <div className="flex items-start gap-3 bg-primary/5 px-5 py-4">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{t("m.cmp.conclusionLabel")} </span>
                {t("m.cmp.conclusion")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------- Generación en un click ---------------------- */}
      <section className="border-y bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.oc.title")}</h2>
            <p className="mt-4 text-muted-foreground">{t("m.oc.desc")}</p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="flex flex-col items-center gap-4">
              <Button size="lg" className="h-12 px-8">
                <Zap className="mr-2 h-4 w-4" /> {t("m.mock.generate")}
              </Button>
              <div className="flex w-full flex-wrap items-center justify-center gap-2">
                {PIPELINE.map((state, i) => (
                  <div key={state} className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                        i < PIPELINE.length - 1
                          ? "bg-white text-muted-foreground"
                          : "border-primary bg-primary/10 text-primary"
                      }`}
                    >
                      {i < PIPELINE.length - 1 ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {state}
                    </span>
                    {i < PIPELINE.length - 1 && (
                      <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                    )}
                  </div>
                ))}
              </div>

              {/* reporte final */}
              <div className="mt-4 w-full rounded-card border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t("m.mock.reportGenerated")}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {t("m.mock.ready")}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["82%", t("m.mock.progress")],
                    ["36", "Velocity"],
                    ["7", "Bugs"],
                    ["78", t("m.mock.health")],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-input border p-3">
                      <div className="text-lg font-bold">{v}</div>
                      <div className="text-[11px] text-muted-foreground">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t("m.mock.viewReport")}
                  </span>
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t("m.mock.compareSprints")}
                  </span>
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t("m.mock.exportPdf")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------- Casos de uso ------------------------- */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.uc.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("m.uc.desc")}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <Card key={u.ctx}>
                <CardContent className="py-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{u.ctx}</h3>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {u.role}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">
                    <span className="text-muted-foreground">{t("m.uc.generates")} </span>
                    <span className="font-medium">{u.report}</span>
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {u.decision}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Confianza --------------------------- */}
      <section className="border-y bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">{t("m.trust.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("m.trust.desc")}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <Card key={t.title}>
                <CardContent className="py-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-input bg-primary/10 text-primary">
                    <t.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{t.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- Prueba gratis ------------------------- */}
      <section className="relative overflow-hidden bg-navy py-20 text-white">
        <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="container relative text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            {t("m.tryfree.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t("m.tryfree.desc")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12">
              <Link href="/register">{t("m.tryfree.cta")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <a href="#producto">{t("m.cta.howItWorks")}</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/50">{t("m.tryfree.free")}</p>
        </div>
      </section>

      {/* ------------------------------- Precios ---------------------------- */}
      <PricingPlans />

      {/* -------------------------------- Ayuda ----------------------------- */}
      <section id="ayuda" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("m.help.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              {t("m.help.kicker")} · <span className="text-primary">DevMetrics</span>
            </h2>
            <p className="mt-3 text-muted-foreground">{t("m.help.desc")}</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {POPULAR_FAQ.map((item) => (
              <Card key={item.id}>
                <CardContent className="py-5">
                  <h3 className="font-semibold">{t(item.q)}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t(item.a)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Button asChild size="lg" className="h-12">
              <Link href="/ayuda">{t("m.help.cta")}</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("m.help.notFound")}{" "}
              <a href="#contacto" className="font-medium text-primary hover:underline">
                {t("m.help.writeUs")}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------ Contacto ---------------------------- */}
      <section id="contacto" className="bg-muted/40 py-20">
        <div className="container grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("m.contact.title")}</h2>
            <p className="mt-3 text-muted-foreground">{t("m.contact.desc")}</p>
          </div>
          <Card>
            <CardContent className="py-6">
              <ContactForm />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ------------------------- Cierre + Footer -------------------------- */}
      <section className="relative overflow-hidden bg-navy pt-20 text-white">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="container relative">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("mc.landing.closeTitlePrefix")}{" "}
              <span className="text-primary">{t("mc.landing.closeTitleHighlight")}</span>
            </h2>
            <p className="max-w-md text-white/60">{t("m.close.desc")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12">
                <Link href="/register">{t("m.close.cta1")}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <a href="#contacto">{t("m.close.cta2")}</a>
              </Button>
            </div>
          </div>

          {/* Footer links */}
          <footer className="mt-16 border-t border-white/10 py-12">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-1">
                <Logo className="text-white" iconClassName="h-8 w-8" />
                <p className="mt-3 max-w-xs text-sm text-white/50">
                  {t("m.footer.tagline")}
                </p>
              </div>
              {[
                {
                  title: t("m.footer.product"),
                  links: [
                    [t("m.cta.howItWorks"), "#producto"],
                    [t("m.nav.reports"), "#reportes"],
                    [t("m.nav.team"), "#roles"],
                    [t("m.nav.integrations"), "#integraciones"],
                  ],
                },
                {
                  title: t("m.footer.plans"),
                  links: [
                    [t("m.nav.pricing"), "#precios"],
                    [t("m.close.cta1"), "/register"],
                    [t("m.nav.login"), "/login"],
                  ],
                },
                {
                  title: t("m.footer.resources"),
                  links: [
                    [t("m.help.cta"), "/ayuda"],
                    [t("m.nav.help"), "/ayuda"],
                    [t("m.contact.title"), "#contacto"],
                  ],
                },
                {
                  title: t("m.footer.company"),
                  links: [
                    [t("m.trust.title"), "#producto"],
                    [t("m.contact.title"), "#contacto"],
                  ],
                },
              ].map((col) => (
                <div key={col.title}>
                  <h3 className="text-sm font-semibold">{col.title}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-white/50">
                    {col.links.map(([label, href]) => (
                      <li key={label}>
                        {href.startsWith("/") ? (
                          <Link href={href} className="hover:text-white">
                            {label}
                          </Link>
                        ) : (
                          <a href={href} className="hover:text-white">
                            {label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row">
              <span>© {new Date().getFullYear()} DevMetrics</span>
              <span>{t("m.footer.copyright")}</span>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
