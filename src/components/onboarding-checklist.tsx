"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OnboardingState } from "@/lib/onboarding";
import { useT } from "@/components/i18n-provider";

interface Step {
  key: string;
  title: string;
  desc: string;
  done: boolean;
  href: string;
  cta: string;
}

function buildSteps(s: OnboardingState, t: (key: string) => string): Step[] {
  return [
    {
      key: "project",
      title: t("ws.checklist.step1Title"),
      desc: t("ws.checklist.step1Desc"),
      done: s.hasProject,
      href: "/projects",
      cta: t("ws.checklist.step1Cta"),
    },
    {
      key: "connect",
      title: t("ws.checklist.step2Title"),
      desc:
        s.recommended.length > 0
          ? `${t("ws.checklist.step2DescRecommendedPrefix")} ${s.recommended
              .map((r) => r.label)
              .join(` ${t("ws.checklist.step2DescOr")} `)}${t("ws.checklist.step2DescRecommendedSuffix")}`
          : t("ws.checklist.step2DescDefault"),
      done: s.connectedCount > 0,
      href: s.recommended[0]
        ? `/integrations/${s.recommended[0].slug}`
        : "/integrations",
      cta: t("ws.checklist.step2Cta"),
    },
    {
      key: "report",
      title: t("ws.checklist.step3Title"),
      desc: t("ws.checklist.step3Desc"),
      done: s.reportsCount > 0,
      href: "/reports",
      cta: t("ws.checklist.step3Cta"),
    },
    {
      key: "team",
      title: t("ws.checklist.step4Title"),
      desc: t("ws.checklist.step4Desc"),
      done: s.membersCount > 1,
      href: "/teams",
      cta: t("ws.checklist.step4Cta"),
    },
    {
      key: "standards",
      title: t("ws.checklist.step5Title"),
      desc: t("ws.checklist.step5Desc"),
      done: false,
      href: "/reports/standards",
      cta: t("ws.checklist.step5Cta"),
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
  const { t } = useT();
  const [dismissed, setDismissed] = useState(false);
  const steps = buildSteps(state, t);
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
                  ? t("ws.checklist.compactTitle")
                  : t("ws.checklist.fullTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {`${doneCount} ${t("ws.checklist.progressPrefix")} ${steps.length} ${t("ws.checklist.progressSuffix")}`}
              </p>
            </div>
          </div>
          {variant === "compact" && (
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("ws.checklist.hide")}
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
                  isNext && "border-primary bg-card",
                  step.done && "opacity-70",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
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
