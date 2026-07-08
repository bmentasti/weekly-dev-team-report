import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveProject } from "@/lib/project";
import { getProvider } from "@/lib/integrations/catalog";
import { GenericConnectForm } from "@/components/generic-connect-form";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { IntegrationType } from "@prisma/client";

export default async function IntegrationConnectPage({
  params,
}: {
  params: { provider: string };
}) {
  const entry = getProvider(params.provider);
  if (!entry) notFound();

  if (!entry.enabled) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{entry.label}</CardTitle>
            <CardDescription>{entry.blurb}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta integración estará disponible próximamente.
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard">Volver al dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = await getServerSession(authOptions);
  const project = await resolveActiveProject(session!.user.id);

  let initialConfig: Record<string, string> = {};
  let connected = false;
  if (project) {
    const integration = await prisma.integration.findUnique({
      where: {
        projectId_type: {
          projectId: project.id,
          type: entry.type as IntegrationType,
        },
      },
    });
    if (integration) {
      initialConfig =
        (integration.config as Record<string, string> | null) ?? {};
      connected = integration.status === "CONNECTED";
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col">
      <BackButton label="Volver a integraciones" />
      <GenericConnectForm
        entry={entry}
        initialConfig={initialConfig}
        connected={connected}
      />
    </div>
  );
}
