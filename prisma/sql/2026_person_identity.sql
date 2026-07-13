-- Identidad canónica de personas (unifica identificadores cross-app).
-- Este proyecto usa `prisma db push` (no hay carpeta migrations/), por lo que
-- la forma recomendada de aplicar el cambio es:
--
--     npx prisma generate
--     npx prisma db push
--
-- Este SQL queda como referencia / para aplicar manualmente si preferís
-- migraciones versionadas.

CREATE TABLE "PersonIdentity" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonAlias" (
    "id"         TEXT NOT NULL,
    "projectId"  TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "source"     TEXT NOT NULL DEFAULT '*',
    "handle"     TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonIdentity_projectId_key_key" ON "PersonIdentity"("projectId", "key");
CREATE INDEX "PersonIdentity_projectId_idx" ON "PersonIdentity"("projectId");

CREATE UNIQUE INDEX "PersonAlias_projectId_source_handle_key" ON "PersonAlias"("projectId", "source", "handle");
CREATE INDEX "PersonAlias_projectId_idx" ON "PersonAlias"("projectId");
CREATE INDEX "PersonAlias_identityId_idx" ON "PersonAlias"("identityId");

ALTER TABLE "PersonIdentity"
    ADD CONSTRAINT "PersonIdentity_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonAlias"
    ADD CONSTRAINT "PersonAlias_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PersonAlias"
    ADD CONSTRAINT "PersonAlias_identityId_fkey"
    FOREIGN KEY ("identityId") REFERENCES "PersonIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
