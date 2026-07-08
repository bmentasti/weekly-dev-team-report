import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveWorkspaceForUser, resolveWorkspaceRole } from "@/lib/workspace";
import { effectivePlan, trialDaysLeft } from "@/lib/plans";
import { AppShell } from "@/components/app-shell";

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

  return (
    <AppShell
      userName={session.user.name}
      workspaceName={workspace?.name}
      plan={effectivePlan(workspace)}
      trialDaysLeft={trialDaysLeft(workspace)}
      role={accessRole}
    >
      {children}
    </AppShell>
  );
}
