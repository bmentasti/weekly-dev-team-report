"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

interface Plan {
  name: string;
  monthly: number; // USD/mes
  taglineKey: string;
  featureKeys: string[];
  highlighted: boolean;
  ctaKey: string;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    monthly: 0,
    taglineKey: "mc.pricing.free.tagline",
    featureKeys: [
      "mc.pricing.free.f1",
      "mc.pricing.free.f2",
      "mc.pricing.free.f3",
      "mc.pricing.free.f4",
      "mc.pricing.free.f5",
    ],
    highlighted: false,
    ctaKey: "mc.pricing.free.cta",
  },
  {
    name: "Team",
    monthly: 29,
    taglineKey: "mc.pricing.team.tagline",
    featureKeys: [
      "mc.pricing.team.f1",
      "mc.pricing.team.f2",
      "mc.pricing.team.f3",
      "mc.pricing.team.f4",
      "mc.pricing.team.f5",
    ],
    highlighted: true,
    ctaKey: "mc.pricing.team.cta",
  },
  {
    name: "Pro",
    monthly: 79,
    taglineKey: "mc.pricing.pro.tagline",
    featureKeys: [
      "mc.pricing.pro.f1",
      "mc.pricing.pro.f2",
      "mc.pricing.pro.f3",
      "mc.pricing.pro.f4",
      "mc.pricing.pro.f5",
    ],
    highlighted: false,
    ctaKey: "mc.pricing.pro.cta",
  },
];

// Tier organizacional (venta asistida, no self-serve).
const BUSINESS = {
  name: "Business",
  taglineKey: "mc.pricing.business.tagline",
  featureKeys: [
    "mc.pricing.business.f1",
    "mc.pricing.business.f2",
    "mc.pricing.business.f3",
    "mc.pricing.business.f4",
    "mc.pricing.business.f5",
  ],
};

// Filas de comparación: [claveEtiqueta, free, team, pro]. Los valores que son
// claves i18n se traducen en render; los símbolos/números quedan literales.
const COMPARISON: [string, string, string, string][] = [
  ["mc.pricing.cmp.projects", "1", "1", "mc.pricing.cmp.unlimited"],
  ["mc.pricing.cmp.users", "5", "45", "mc.pricing.cmp.unlimited"],
  ["mc.pricing.cmp.reportsPerMonth", "10", "mc.pricing.cmp.unlimited", "mc.pricing.cmp.unlimited"],
  ["mc.pricing.cmp.dataHistory", "mc.pricing.cmp.months3", "mc.pricing.cmp.months12", "mc.pricing.cmp.unlimitedF"],
  ["mc.pricing.cmp.integrations", "mc.pricing.cmp.jiraGithub", "mc.pricing.cmp.tasksCode", "mc.pricing.cmp.allComms"],
  ["mc.pricing.cmp.roleReads", "✓", "✓", "✓"],
  ["mc.pricing.cmp.sprintCompare", "✓", "✓", "✓"],
  ["mc.pricing.cmp.perPersonMatrix", "✓", "✓", "✓"],
  ["mc.pricing.cmp.healthThresholds", "mc.pricing.cmp.recommended", "mc.pricing.cmp.editable", "mc.pricing.cmp.perProjectAi"],
  ["mc.pricing.cmp.ciAlerts", "mc.pricing.cmp.basic", "✓", "mc.pricing.cmp.customRules"],
  ["mc.pricing.cmp.export", "CSV", "CSV + PDF", "CSV + PDF"],
  ["mc.pricing.cmp.emailScheduled", "—", "✓", "✓"],
  ["Slack / Teams / Discord", "—", "—", "✓"],
  ["mc.pricing.cmp.aiAnalysis", "—", "—", "✓"],
  ["mc.pricing.cmp.audit", "—", "mc.pricing.cmp.history", "mc.pricing.cmp.complete"],
];

// Anual = pagás 10 meses (2 gratis), abonados por adelantado.
const ANNUAL_MONTHS = 10;

export function PricingPlans() {
  const { t } = useT();
  const [annual, setAnnual] = useState(false);
  // Traduce solo si el valor es una clave i18n conocida; deja literales
  // (números, símbolos, "CSV", "Slack…") tal cual.
  const tr = (v: string) => (v.startsWith("mc.pricing.") ? t(v) : v);

  return (
    <section id="precios" className="bg-muted/40 py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            {t("mc.pricing.title")}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {t("mc.pricing.subtitle")}
          </p>

          {/* Toggle */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border bg-white p-1 text-sm">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                !annual ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              {t("mc.pricing.monthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                annual ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              {t("mc.pricing.annual")}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  annual ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {t("mc.pricing.twoMonthsFree")}
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
                      {t("mc.pricing.mostPopular")}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(plan.taglineKey)}
                  </p>

                  <div className="mt-4">
                    {isFree ? (
                      <>
                        <span className="text-4xl font-bold">$0</span>
                        <span className="text-muted-foreground"> {t("mc.pricing.forever")}</span>
                      </>
                    ) : annual ? (
                      <>
                        <span className="text-4xl font-bold">${annualTotal}</span>
                        <span className="text-muted-foreground"> {t("mc.pricing.perYear")}</span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("mc.pricing.payMonthlyPrefix")}{" "}
                          <s>${plan.monthly * 12}</s>. {t("mc.pricing.saveMid")} $
                          {plan.monthly * (12 - ANNUAL_MONTHS)} {t("mc.pricing.saveSuffix")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("mc.pricing.equivalentPrefix")}${Math.round(annualTotal / 12)}
                          {t("mc.pricing.equivalentSuffix")}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-bold">${plan.monthly}</span>
                        <span className="text-muted-foreground"> {t("mc.pricing.perMonth")}</span>
                      </>
                    )}
                  </div>

                  <ul className="mt-6 space-y-2 text-sm">
                    {plan.featureKeys.map((featKey) => (
                      <li key={featKey} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        {t(featKey)}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6 w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    <Link href="/register">{t(plan.ctaKey)}</Link>
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
                  {t("mc.pricing.whatIncludes")}
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
                  <td className="py-2 pr-4 text-muted-foreground">{tr(row[0])}</td>
                  {[row[1], row[2], row[3]].map((v, i) => (
                    <td
                      key={i}
                      className={`py-2 pr-4 text-center ${v === "✓" ? "text-emerald-600" : v === "—" ? "text-muted-foreground/50" : ""}`}
                    >
                      {tr(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("mc.pricing.footnote")}
        </p>

        {/* Business (venta asistida) */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-card border bg-navy px-6 py-6 text-white sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{BUSINESS.name}</h3>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {t("mc.pricing.forOrgs")}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/70">{t(BUSINESS.taglineKey)}</p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
              {BUSINESS.featureKeys.map((fKey) => (
                <li key={fKey} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" />
                  {t(fKey)}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0">
            <Link href="/#contacto">{t("mc.pricing.consultUs")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
