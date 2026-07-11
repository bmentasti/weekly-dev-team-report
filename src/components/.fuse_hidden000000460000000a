"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OnboardingState } from "@/lib/onboarding";

interface Step {
  key: string;
  title: string;
  desc: string;
  done: boolean;
  href: string;
  cta: string;
}

function buildSteps(s: OnboardingState): Step[] {
  return [
    {
      key: "project",
      title: "Creá tu primer proyecto",
      desc: "Un proyecto agrupa las integraciones y reportes de un equipo.",
      done: s.hasProject,
      href: "/projects",
      cta: "Crear proyecto",
    },
    {
      key: "connect",
      title: "Conectá una herramienta",
      desc:
        s.recommended.length > 0
          ? `Recomendado para vos: ${s.recommended.map((r) => r.label).join(" o ")}. Solo lectura.`
          : "Vinculá Jira o GitHub. Solo lectura, tokens encriptados.",
      done: s.connectedCount > 0,
      href: s.recommended[0]
        ? `/integrations/${s.recommended[0].slug}`
        : "/integrations",
      cta: "Conectar",
    },
    {
      key: "report",
      title: "Generá tu primer reporte",
      desc: "Toma ~30 segundos. ¿No tenés acceso aún? Probá con datos de ejemplo.",
      done: s.reportsCount > 0,
      href: "/reports",
      cta: "Generar reporte",
    },
    {
      key: "team",
      title: "Invitá a tu equipo",
      desc: "Compartí reportes y sumá miembros al workspace.",
      done: s.membersCount > 1,
      href: "/teams",
      cta: "Invitar",
    },
    {
      key: "standards",
      title: "Definí tus umbrales de salud",
      desc: "Adaptá qué es saludable, en observación o en riesgo para tu equipo.",
      done: false,
      href: "/reports/standards",
      cta: "Configurar",
    },
  ];
}

export function OnboardingChecklist({
  state,
  variant = "full",
}: {
  state: OnboardingState;
  variant?: "full" | "compact";
}) {
  const [dismissed, setDismissed] = useState(false);
  const steps = buildSteps(state);
  const coreDone = steps.slice(0, 3).filter((s) => s.done).length;
  const coreComplete = coreDone === 3;

  // En el dashboard, si completó lo núcleo o lo cerró, no lo mostramos.
  if (variant === "compact" && (coreComplete || dismissed)) return null;

  const nextIdx = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className={variant === "compact" ? "border-primary/30 bg-primary/5" : ""}>
      <CardContent className="py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">
                {variant === "compact"
                  ? "Terminá de configurar DevMetrics"
                  : "Primeros pasos"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {doneCount} de {steps.length} · a un paso de tu primer reporte
              </p>
            </div>
          </div>
          {variant === "compact" && (
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Ocultar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progreso */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        <ul className="mt-4 space-y-2">
          {steps.map((step, i) => {
            const isNext = i === nextIdx;
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-input border p-3",
                  isNext && "border-primary bg-white",
                  step.done && "opacity-70",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isNext ? "text-primary" : "text-muted-foreground/40",
                    )}
                  />
                )}
                <div className="flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.done && "line-through",
                    )}
                  >
                    {step.title}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  )}
                </div>
                {!step.done && (
                  <Button
                    asChild
                    size="sm"
                    variant={isNext ? "default" : "outline"}
                  >
                    <Link href={step.href}>
                      {step.cta}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
