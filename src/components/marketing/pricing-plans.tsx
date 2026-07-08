"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Plan {
  name: string;
  monthly: number; // USD/mes
  tagline: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    monthly: 0,
    tagline: "Para probar el valor con datos reales.",
    features: [
      "1 proyecto · hasta 5 usuarios",
      "Jira + GitHub (en vivo)",
      "Reporte + lecturas por rol",
      "Comparación de sprints",
      "Export a CSV",
    ],
    highlighted: false,
    cta: "Empezar gratis",
  },
  {
    name: "Team",
    monthly: 29,
    tagline: "Precio plano. Todo tu equipo incluido.",
    features: [
      "Hasta 45 usuarios (plano)",
      "Todas las integraciones de tareas y código",
      "Reportes ilimitados + histórico 12 meses",
      "Alertas, desempeño por persona y matriz",
      "Envío por email + programado · export PDF/CSV",
    ],
    highlighted: true,
    cta: "Empezar",
  },
  {
    name: "Pro",
    monthly: 79,
    tagline: "Varias squads, comunicación e IA.",
    features: [
      "Multi-proyecto · usuarios ilimitados",
      "Comunicación: Slack, Teams, Discord",
      "Análisis con IA + preguntá al reporte",
      "Umbrales por proyecto, reglas de alerta y auditoría",
      "Histórico ilimitado · soporte prioritario",
    ],
    highlighted: false,
    cta: "Empezar",
  },
];

// Tier organizacional (venta asistida, no self-serve).
const BUSINESS = {
  name: "Business",
  tagline: "Para organizaciones con varios equipos.",
  features: [
    "Todo lo de Pro",
    "SSO/SAML + múltiples workspaces",
    "Permisos granulares y audit log",
    "Retención extendida y SLA",
    "Soporte dedicado + factura/PO",
  ],
};

const COMPARISON: [string, string, string, string][] = [
  ["Proyectos", "1", "1", "Ilimitados"],
  ["Usuarios", "5", "45", "Ilimitados"],
  ["Reportes por mes", "10", "Ilimitados", "Ilimitados"],
  ["Histórico de datos", "3 meses", "12 meses", "Ilimitado"],
  ["Integraciones", "Jira + GitHub", "Tareas y código", "Todas + comunicación"],
  ["Lecturas por rol (TL/PO/Dir)", "✓", "✓", "✓"],
  ["Comparación de sprints", "✓", "✓", "✓"],
  ["Desempeño por persona + matriz", "✓", "✓", "✓"],
  ["Umbrales de salud", "recomendados", "editables", "por proyecto + IA"],
  ["Alertas y salud de CI", "básico", "✓", "reglas custom"],
  ["Export", "CSV", "CSV + PDF", "CSV + PDF"],
  ["Envío por email / programado", "—", "✓", "✓"],
  ["Slack / Teams / Discord", "—", "—", "✓"],
  ["Análisis con IA", "—", "—", "✓"],
  ["Auditoría y versionado", "—", "historial", "completo"],
];

// Anual = pagás 10 meses (2 gratis), abonados por adelantado.
const ANNUAL_MONTHS = 10;

export function PricingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="precios" className="bg-muted/40 py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Precio plano. Usuarios incluidos.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Mientras otras herramientas cobran por asiento, en DevMetrics sumás a
            tu equipo sin costo por persona.
          </p>

          {/* Toggle */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border bg-white p-1 text-sm">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                !annual ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                annual ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              Anual
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  annual ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                2 meses gratis
              </span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const annualTotal = plan.monthly * ANNUAL_MONTHS;
            const isFree = plan.monthly === 0;
            return (
              <Card
                key={plan.name}
                className={plan.highlighted ? "border-primary shadow-card" : ""}
              >
                <CardContent className="flex h-full flex-col py-6">
                  {plan.highlighted && (
                    <span className="mb-3 inline-block w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      Más popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.tagline}
                  </p>

                  <div className="mt-4">
                    {isFree ? (
                      <>
                        <span className="text-4xl font-bold">$0</span>
                        <span className="text-muted-foreground"> para siempre</span>
                      </>
                    ) : annual ? (
                      <>
                        <span className="text-4xl font-bold">${annualTotal}</span>
                        <span className="text-muted-foreground"> /año</span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pagando por mes, 12 meses te saldrían{" "}
                          <s>${plan.monthly * 12}</s>. Ahorrás $
                          {plan.monthly * (12 - ANNUAL_MONTHS)} (2 meses).
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Equivale a ~${Math.round(annualTotal / 12)}/mes · se
                          abona por adelantado.
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">${plan.monthly}</span>
                        <span className="text-muted-foreground"> /mes</span>
                      </>
                    )}
                  </div>

                  <ul className="mt-6 space-y-2 text-sm">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6 w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparación por plan */}
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium text-muted-foreground">
                  Qué incluye
                </th>
                <th className="py-2 pr-4 text-center font-semibold">Free</th>
                <th className="py-2 pr-4 text-center font-semibold text-primary">
                  Team
                </th>
                <th className="py-2 pr-4 text-center font-semibold">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row[0]} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-muted-foreground">{row[0]}</td>
                  {[row[1], row[2], row[3]].map((v, i) => (
                    <td
                      key={i}
                      className={`py-2 pr-4 text-center ${v === "✓" ? "text-emerald-600" : v === "—" ? "text-muted-foreground/50" : ""}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Un equipo de 10 en un plan por asiento a US$20/usuario paga ~US$200/mes.
          En DevMetrics, Team cuesta US$29/mes fijo (o ~US$24/mes en el plan
          anual) — todo el equipo incluido, sin costo por asiento.
        </p>

        {/* Business (venta asistida) */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card border bg-navy px-6 py-6 text-white sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{BUSINESS.name}</h3>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                Para organizaciones
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">{BUSINESS.tagline}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
              {BUSINESS.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0">
            <Link href="/#contacto">Consultanos</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
