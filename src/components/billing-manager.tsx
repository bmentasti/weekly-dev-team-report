"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentModal } from "@/components/payment-modal";
import { useT } from "@/components/i18n-provider";
import {
  PLANS,
  PLAN_ORDER,
  annualTotal,
  limitLabel,
  type PlanTierName,
  type BillingPeriodName,
} from "@/lib/plans";

function featuresFor(
  t: (key: string) => string,
): Record<PlanTierName, string[]> {
  return {
    FREE: [
      t("ws.billing.freeF1"),
      t("ws.billing.freeF2"),
      t("ws.billing.freeF3"),
      t("ws.billing.freeF4"),
    ],
    TEAM: [
      t("ws.billing.teamF1"),
      t("ws.billing.teamF2"),
      t("ws.billing.teamF3"),
      t("ws.billing.teamF4"),
    ],
    PRO: [
      t("ws.billing.proF1"),
      t("ws.billing.proF2"),
      t("ws.billing.proF3"),
      t("ws.billing.proF4"),
    ],
  };
}

export function BillingManager({
  currentPlan,
  currentPeriod,
}: {
  currentPlan: PlanTierName;
  currentPeriod: BillingPeriodName;
}) {
  const router = useRouter();
  const { t } = useT();
  const FEATURES = featuresFor(t);
  const [annual, setAnnual] = useState(currentPeriod === "ANNUAL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<PlanTierName | null>(null);

  async function change(plan: PlanTierName) {
    // Plan pago → abrir el modal de pago. Free (downgrade) → aplicar directo.
    if (PLANS[plan].monthly > 0) {
      setPayFor(plan);
      return;
    }
    setBusy(plan);
    setMsg(null);
    const res = await fetch("/api/billing/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, period: annual ? "ANNUAL" : "MONTHLY" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (json.ok) {
      setMsg(t("ws.billing.planUpdated"));
      router.refresh();
    } else {
      setMsg(json.error ?? t("ws.billing.cantChange"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 text-sm">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium ${!annual ? "bg-primary text-white" : "text-muted-foreground"}`}
          >
            {t("ws.billing.monthly")}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 font-medium ${annual ? "bg-primary text-white" : "text-muted-foreground"}`}
          >
            {t("ws.billing.annual")}
          </button>
        </div>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((tier) => {
          const def = PLANS[tier];
          const isCurrent = tier === currentPlan;
          const total = annualTotal(def.monthly);
          return (
            <Card key={tier} className={isCurrent ? "border-primary" : ""}>
              <CardContent className="flex h-full flex-col py-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{def.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {t("ws.billing.current")}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  {def.monthly === 0 ? (
                    <span className="text-3xl font-bold">$0</span>
                  ) : annual ? (
                    <>
                      <span className="text-3xl font-bold">${total}</span>
                      <span className="text-muted-foreground">{t("ws.billing.perYear")}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${def.monthly}</span>
                      <span className="text-muted-foreground">{t("ws.billing.perMonth")}</span>
                    </>
                  )}
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {FEATURES[tier].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {f}
                    </li>
                  ))}
                  <li className="pt-1 text-xs text-muted-foreground">
                    {t("ws.billing.projectsLabel")} {limitLabel(def.maxProjects, t)} · {t("ws.billing.usersLabel")}{" "}
                    {limitLabel(def.maxMembers, t)}
                  </li>
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || busy !== null}
                  onClick={() => change(tier)}
                >
                  {isCurrent
                    ? t("ws.billing.currentPlan")
                    : busy === tier
                      ? t("ws.billing.changing")
                      : `${t("ws.billing.changeToPrefix")} ${def.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("ws.billing.demoNote")}
      </p>

      {payFor && (
        <PaymentModal
          plan={payFor}
          period={annual ? "ANNUAL" : "MONTHLY"}
          onClose={() => setPayFor(null)}
        />
      )}
    </div>
  );
}
