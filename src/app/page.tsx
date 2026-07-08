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
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContactForm } from "@/components/marketing/contact-form";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { RoleTabs } from "@/components/marketing/role-tabs";
import { RotatingHeadline } from "@/components/marketing/rotating-headline";
import { LandingScrollReveal } from "@/components/marketing/landing-scroll-reveal";
import {
  PROBLEMS,
  STEPS,
  INTEGRATIONS,
  REPORT_SHOWCASE,
  METRIC_GROUPS,
  ALERTS,
  COMPARE_ROWS,
  PIPELINE,
  USE_CASES,
  TRUST,
} from "@/lib/marketing/landing-data";
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
  const session = await getServerSession(authOptions);

  return (
    <div id="landing-root" className="bg-white text-foreground">
      <LandingScrollReveal />
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo iconClassName="h-8 w-8 text-navy" />
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#producto" className="hover:text-foreground">Producto</a>
            <a href="#reportes" className="hover:text-foreground">Reportes</a>
            <a href="#roles" className="hover:text-foreground">Para tu equipo</a>
            <a href="#integraciones" className="hover:text-foreground">Integraciones</a>
            <a href="#precios" className="hover:text-foreground">Precios</a>
            <a href="#ayuda" className="hover:text-foreground">Ayuda</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">Ir al dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Probar gratis</Link>
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
              Engineering Intelligence
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Reportes claros para <RotatingHeadline />
            </h1>
            <p className="mt-5 text-lg text-white/70">
              Conectá Jira, GitHub, Slack y +10 herramientas, y obtené reportes
              ejecutivos sobre sprints, delivery, calidad, riesgos y equipo. Sin
              armar planillas, sin perder contexto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12">
                <Link href="/register">Probar gratis</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <a href="#producto">Ver cómo funciona</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/50">
              Gratis para siempre · Sin tarjeta · Usuarios ilimitados
            </p>
          </div>

          {/* Product preview mock (parcial) */}
          <div className="relative">
            <div className="rounded-card bg-white p-5 text-foreground shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">Reporte semanal — Frontend</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Riesgo medio
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["14", "Finalizadas"],
                  ["8", "PR merg."],
                  ["3", "Bloqueadas"],
                  ["7", "PR abiertos"],
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
                    Velocity (últimos 6 sprints)
                  </p>
                  <MiniBars />
                </div>
                <Button size="sm" className="shrink-0">
                  Generate report
                </Button>
              </div>
            </div>

            {/* Floating card: score de salud */}
            <div className="absolute -left-4 -top-5 hidden rounded-card bg-white p-3 shadow-card sm:block">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Score de salud
              </p>
              <p className="text-2xl font-bold text-navy">78<span className="text-sm font-medium text-muted-foreground">/100</span></p>
            </div>

            {/* Floating card: alerta */}
            <div className="absolute -bottom-6 -right-2 hidden max-w-[15rem] rounded-card bg-white p-3 shadow-card md:block">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold">Riesgo detectado</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                3 PRs abiertos hace +72h sin reviewer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------- Social proof / stats strip ------------------- */}
      <section className="border-b bg-white py-10">
        <div className="container">
          <p className="text-center text-sm text-muted-foreground">
            Pensado para equipos que ya trabajan con
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
              ["+40", "métricas analizadas por reporte"],
              ["12", "integraciones en vivo + IA"],
              ["1 click", "del dato disperso al informe listo"],
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
              El problema
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Tus herramientas tienen los datos. Vos necesitás la historia.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Jira muestra tareas, GitHub muestra PRs, Slack tiene la conversación —
              pero nadie los junta. El estado del proyecto termina armándose a mano,
              tarde y sin claridad.
            </p>
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
              La solución
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Conectá, generá y decidí — en tres pasos
            </h2>
            <p className="mt-4 text-muted-foreground">
              DevMetrics no reemplaza a Jira, GitHub ni Slack. Los conecta y
              transforma sus datos en información lista para actuar.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-input bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    Paso {s.n}
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
            <h2 className="text-2xl font-bold tracking-tight">
              Tus herramientas siguen igual. La claridad aparece en un solo lugar.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              DevMetrics toma datos de tus fuentes y los convierte en reportes
              listos para TLs, POs y Dirección.
            </p>
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
            + análisis con IA: Claude · ChatGPT · Gemini · GitHub Copilot (plan Pro)
          </p>
        </div>
      </section>

      {/* ---------------------------- Reportes ------------------------------ */}
      <section id="reportes" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Reportes
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Un reporte para cada pregunta que te hacen
            </h2>
            <p className="mt-4 text-muted-foreground">
              De sprint, comparativos, de riesgo, ejecutivos, de calidad técnica o
              de performance. Claros, compartibles y exportables.
            </p>
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
            Vistas ilustrativas del producto. Datos de ejemplo. Pasá el mouse para
            pausar.
          </p>
        </div>
      </section>

      {/* ------------------------------ Por rol ----------------------------- */}
      <section id="roles" className="bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Un producto, una lectura para cada rol
            </h2>
            <p className="mt-3 text-muted-foreground">
              La misma data, leída según lo que cada quien necesita resolver.
            </p>
          </div>
          <RoleTabs />
        </div>
      </section>

      {/* --------------------------- Métricas ------------------------------- */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              No solo números: interpretación y acciones
            </h2>
            <p className="mt-3 text-muted-foreground">
              DevMetrics analiza decenas de métricas y te dice qué significan y qué
              hacer, no solo las grafica.
            </p>
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
              <Bell className="h-3.5 w-3.5" /> Alertas inteligentes
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">
              Detectá riesgos <span className="text-primary">antes de que sea tarde</span>
            </h2>
            <p className="mt-4 text-white/70">
              DevMetrics levanta señales tempranas y te dice a quién le toca y qué
              hacer. Cada alerta llega con severidad, rol responsable y acción
              recomendada.
            </p>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="mt-6 h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <a href="#producto">Ver reporte de riesgo</a>
            </Button>
          </div>

          {/* Panel de alertas */}
          <div className="rounded-card bg-white p-4 text-foreground shadow-card">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold">Action required</span>
              <span className="text-xs text-muted-foreground">5 alertas</span>
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
                      {a.who} · Acción: {a.action}
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
            <h2 className="text-3xl font-bold tracking-tight">
              Compará dos sprints <span className="text-primary">en segundos</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Dejá de comparar sprints a mano. Detectá qué mejoró, qué empeoró, qué
              se mantuvo y qué riesgos se repiten.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-card border shadow-card">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-center gap-2 border-b bg-muted/50 px-5 py-3 text-xs font-semibold text-muted-foreground">
              <span>Métrica</span>
              <span className="text-center">Sprint 23</span>
              <span className="text-center">Sprint 24</span>
              <span className="text-right">Var.</span>
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
                <span className="font-semibold text-foreground">Conclusión: </span>
                el equipo mejoró velocity y calidad, pero el tiempo de review
                subió 50%. Sugerencia: sumar reviewers y achicar PRs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------- Generación en un click ---------------------- */}
      <section className="border-y bg-muted/40 py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Del dato disperso al reporte listo, <span className="text-primary">en un click</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Elegí proyecto, período y tipo de reporte. Hacé click y recibí un
              informe listo para revisar, compartir o exportar.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="flex flex-col items-center gap-4">
              <Button size="lg" className="h-12 px-8">
                <Zap className="mr-2 h-4 w-4" /> Generate report
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
                  <span className="font-semibold">Reporte generado — Sprint 24</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    Listo
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["82%", "Avance"],
                    ["36", "Velocity"],
                    ["7", "Bugs"],
                    ["78", "Salud"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-input border p-3">
                      <div className="text-lg font-bold">{v}</div>
                      <div className="text-[11px] text-muted-foreground">{l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    View report
                  </span>
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Compare sprints
                  </span>
                  <span className="rounded-input bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    Export PDF
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
            <h2 className="text-3xl font-bold tracking-tight">
              Listo para cada momento del equipo
            </h2>
            <p className="mt-3 text-muted-foreground">
              El reporte correcto para la conversación que tenés que tener.
            </p>
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
                    <span className="text-muted-foreground">Genera: </span>
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
            <h2 className="text-3xl font-bold tracking-tight">
              Seguro por diseño, bajo tu control
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tus datos, tus reglas. DevMetrics lee lo mínimo necesario y nunca
              decide por vos.
            </p>
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
            Probá gratis y generá tu primer reporte en minutos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Sin planillas. Sin reportes manuales. Sin perder contexto. Conectá una
            herramienta y empezá a ver claridad desde el primer sprint.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12">
              <Link href="/register">Generar mi primer reporte</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
            >
              <a href="#producto">Ver cómo funciona</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/50">
            Gratis para siempre · Sin tarjeta · Jira + GitHub en vivo
          </p>
        </div>
      </section>

      {/* ------------------------------- Precios ---------------------------- */}
      <PricingPlans />

      {/* -------------------------------- Ayuda ----------------------------- */}
      <section id="ayuda" className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Centro de Ayuda
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              ¿Tenés dudas? Entendé <span className="text-primary">DevMetrics</span> a fondo
            </h2>
            <p className="mt-3 text-muted-foreground">
              Reunimos las preguntas más frecuentes sobre qué es, integraciones,
              reportes, métricas, seguridad y planes. Buscá por tema o filtrá por
              tu rol.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            {POPULAR_FAQ.map((item) => (
              <Card key={item.id}>
                <CardContent className="py-5">
                  <h3 className="font-semibold">{item.q}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            <Button asChild size="lg" className="h-12">
              <Link href="/ayuda">Ir al Centro de Ayuda</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No encontrás lo que buscás?{" "}
              <a href="#contacto" className="font-medium text-primary hover:underline">
                Escribinos
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
            <h2 className="text-3xl font-bold tracking-tight">Hablemos</h2>
            <p className="mt-3 text-muted-foreground">
              ¿Querés una demo o tenés dudas sobre si DevMetrics encaja con tu
              equipo? Escribinos y te respondemos.
            </p>
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
              Sumate a los equipos que ya decidieron con{" "}
              <span className="text-primary">claridad</span>
            </h2>
            <p className="max-w-md text-white/60">
              Herramientas conectadas, reportes en un click y una lectura para cada
              rol. Menos tiempo armando informes, más tiempo decidiendo.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="h-12">
                <Link href="/register">Empezar gratis</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                <a href="#contacto">Hablar con nosotros</a>
              </Button>
            </div>
          </div>

          {/* Footer links */}
          <footer className="mt-16 border-t border-white/10 py-12">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-1">
                <Logo className="text-white" iconClassName="h-8 w-8" />
                <p className="mt-3 max-w-xs text-sm text-white/50">
                  Engineering intelligence para líderes de producto y tecnología.
                </p>
              </div>
              {[
                {
                  title: "Producto",
                  links: [
                    ["Cómo funciona", "#producto"],
                    ["Reportes", "#reportes"],
                    ["Para tu equipo", "#roles"],
                    ["Integraciones", "#integraciones"],
                  ],
                },
                {
                  title: "Planes",
                  links: [
                    ["Precios", "#precios"],
                    ["Empezar gratis", "/register"],
                    ["Iniciar sesión", "/login"],
                  ],
                },
                {
                  title: "Recursos",
                  links: [
                    ["Centro de Ayuda", "/ayuda"],
                    ["Preguntas frecuentes", "/ayuda"],
                    ["Contacto", "#contacto"],
                  ],
                },
                {
                  title: "Empresa",
                  links: [
                    ["Seguridad", "#producto"],
                    ["Contacto", "#contacto"],
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
              <span>Tus datos están encriptados y nunca se comparten.</span>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
