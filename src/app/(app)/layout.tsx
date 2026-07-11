import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { effectivePlan, trialDaysLeft } from "@/lib/plans";
import { AppShell } from "@/components/app-shell";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n/server";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const workspace = await resolveWorkspaceForUser(session.user.id);
  const accessRole = workspace
    ? await resolveWorkspaceRole(session.user.id, workspace.id)
    : null;

  const locale = getLocale();

  return (
    <I18nProvider locale={locale} dict={DICTIONARIES[locale]}>
      <AppShell
        userName={session.user.name}
        workspaceName={workspace?.name}
        plan={effectivePlan(workspace)}
        trialDaysLeft={trialDaysLeft(workspace)}
        role={accessRole}
      >
        {children}
      </AppShell>
    </I18nProvider>
  );
}
