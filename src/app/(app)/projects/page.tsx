import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { ProjectsManager, type ProjectItem } from "@/components/projects-manager";
import { getT } from "@/lib/i18n/server";

export default async function ProjectsPage() {
  const { t } = getT();
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const active = await resolveActiveProject(userId);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { workspace: { ownerId: userId } },
        { workspace: { members: { some: { userId } } } },
        { members: { some: { userId } } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { integrations: true, members: true, reports: true } },
    },
  });

  const items: ProjectItem[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    integrations: p._count.integrations,
    members: p._count.members,
    reports: p._count.reports,
    active: p.id === active?.id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("ws.projects.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ws.projects.subtitle")}
        </p>
      </div>

      <ProjectsManager initial={items} />
    </div>
  );
}
