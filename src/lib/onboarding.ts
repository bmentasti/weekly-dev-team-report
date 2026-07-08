import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getProvider, type ProviderSlug } from "@/lib/integrations/catalog";

export interface OnboardingState {
  role: string | null;
  hasProject: boolean;
  projectId: string | null;
  projectName: string | null;
  connectedCount: number;
  reportsCount: number;
  membersCount: number;
  recommended: { slug: ProviderSlug; label: string }[];
  /** true cuando completó los pasos núcleo (proyecto + integración + reporte). */
  complete: boolean;
}

/** Integraciones recomendadas para conectar primero, según el rol. */
export function recommendedFor(role: string | null | undefined): ProviderSlug[] {
  switch (role) {
    case "TECH_LEAD":
    case "DEVELOPER_LEAD":
      return ["github", "jira"];
    case "PRODUCT_OWNER":
      return ["jira", "github"];
    case "ENGINEERING_MANAGER":
    case "CTO":
      return ["jira", "github"];
    default:
      return ["jira", "github"];
  }
}

export async function getOnboardingState(
  userId: string,
  role?: string | null,
): Promise<OnboardingState> {
  const project = await resolveActiveProject(userId);
  const recommended = recommendedFor(role)
    .map((slug) => {
      const p = getProvider(slug);
      return p ? { slug, label: p.label } : null;
    })
    .filter((x): x is { slug: ProviderSlug; label: string } => x !== null);

  if (!project) {
    return {
      role: role ?? null,
      hasProject: false,
      projectId: null,
      projectName: null,
      connectedCount: 0,
      reportsCount: 0,
      membersCount: 0,
      recommended,
      complete: false,
    };
  }

  const [connectedCount, reportsCount, membersCount] = await Promise.all([
    prisma.integration.count({
      where: { projectId: project.id, status: "CONNECTED" },
    }),
    prisma.report.count({ where: { projectId: project.id } }),
    prisma.workspaceMember.count({ where: { workspaceId: project.workspaceId } }),
  ]);

  return {
    role: role ?? null,
    hasProject: true,
    projectId: project.id,
    projectName: project.name,
    connectedCount,
    reportsCount,
    membersCount,
    recommended,
    complete: connectedCount > 0 && reportsCount > 0,
  };
}
