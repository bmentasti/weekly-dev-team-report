import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { PlugZap, FileBarChart2, Sparkles } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceForUser } from "@/lib/workspace";
import { getOnboardingState } from "@/lib/onboarding";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

export const metadata = { title: "Empezá con DevMetrics" };

export default async function OnboardingPage() {
  const { t } = getT();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Sin workspace no hay nada que onboardear: primero hay que crearlo
  // (crea también el proyecto "General" por defecto).
  const workspace = await resolveWorkspaceForUser(session.user.id);
  if (!workspace) redirect("/workspace/new");

  const state = await getOnboardingState(
    session.user.id,
    session.user.role ?? null,
  );

  // Si ya completó lo núcleo, no tiene sentido el onboarding.
  if (state.complete) redirect("/dashboard");

  const firstName = (session.user.name ?? "").split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Hero */}
      <div className="rounded-card bg-navy px-6 py-8 text-white sm:px-10">
        <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold">
          {`${t("ws.onboarding.welcome")}${firstName ? `, ${firstName}` : ""}`}
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {t("ws.onboarding.heroTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/70">
          {t("ws.onboarding.heroDesc")}
        </p>
      </div>

      {/* Checklist principal */}
      <OnboardingChecklist state={state} variant="full" />

      {/* Recomendadas por rol */}
      {state.recommended.length > 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2">
              <PlugZap className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">
                {t("ws.onboarding.recommendedTitle")}
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("ws.onboarding.recommendedDesc")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.recommended.map((r) => (
                <Link
                  key={r.slug}
                  href={`/integrations/${r.slug}`}
                  className="flex items-center justify-between rounded-input border p-4 transition-colors hover:border-primary"
                >
                  <span className="font-medium">{r.label}</span>
                  <span className="text-sm font-medium text-primary">
                    {t("ws.onboarding.connect")}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atajo demo */}
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed p-6 text-center">
        <FileBarChart2 className="h-6 w-6 text-primary" />
        <p className="text-sm font-medium">
          {t("ws.onboarding.demoQuestion")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("ws.onboarding.demoDesc")}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/reports">{t("ws.onboarding.seeExample")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard">
              <Sparkles className="mr-1 h-4 w-4" /> {t("ws.onboarding.goDashboard")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
