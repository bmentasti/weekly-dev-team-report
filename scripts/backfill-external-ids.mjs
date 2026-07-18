// Backfill (auditoría §12): completa `externalUserId` en PersonAlias cuando el
// `handle` YA es un id estable del proveedor (GitHub numeric id, Airtable
// "rec…", Jira accountId "5570:..."). Así las identidades dejan de depender del
// email/nombre en cada sync y pasan a resolverse por id estable (matchMethod
// provider_id).
//
// Es CONSERVADOR: solo toca alias cuyo handle es inequívocamente un id estable y
// que hoy NO tienen externalUserId. No inventa asociaciones por nombre.
//
// Uso:
//   node scripts/backfill-external-ids.mjs           (dry-run: solo informa)
//   node scripts/backfill-external-ids.mjs --apply   (escribe los cambios)

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* sin .env: DATABASE_URL debe venir del entorno */
}

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

// Patrones de id ESTABLE por proveedor.
const AIRTABLE_REC = /^rec[a-z0-9]{14,}$/i;
const GITHUB_NUMERIC = /^[0-9]{3,}$/; // ids numéricos de GitHub
const JIRA_ACCOUNT = /^[0-9a-f]{2,}:[0-9a-f-]{16,}$/i; // accountId de Jira

function looksStable(handle) {
  const h = (handle ?? "").trim();
  return AIRTABLE_REC.test(h) || GITHUB_NUMERIC.test(h) || JIRA_ACCOUNT.test(h);
}

async function main() {
  let candidates;
  try {
    candidates = await prisma.personAlias.findMany({
      where: { externalUserId: null },
      select: { id: true, source: true, handle: true, matchMethod: true },
    });
  } catch (err) {
    console.error(
      "No se pudo leer PersonAlias. ¿Corriste `prisma generate && prisma db push`?\n",
      err.message,
    );
    process.exit(1);
  }

  const toFix = candidates.filter((a) => looksStable(a.handle));
  console.log(
    `Alias sin externalUserId: ${candidates.length}. Con handle = id estable: ${toFix.length}.`,
  );
  for (const a of toFix) {
    console.log(`  ${a.source}:${a.handle}  (matchMethod actual: ${a.matchMethod ?? "—"})`);
  }

  if (!APPLY) {
    console.log("\nDry-run. Volvé a correr con --apply para escribir los cambios.");
    return;
  }

  let updated = 0;
  for (const a of toFix) {
    try {
      await prisma.personAlias.update({
        where: { id: a.id },
        data: {
          externalUserId: a.handle.trim(),
          // Solo promovemos a provider_id si no era una vinculación manual/email
          // explícita (no pisamos la intención del admin).
          matchMethod:
            a.matchMethod === "manual" || a.matchMethod === "email_exact" || a.matchMethod === "email_alias"
              ? a.matchMethod
              : "provider_id",
        },
      });
      updated++;
    } catch (err) {
      console.error(`  falló ${a.id}: ${err.message}`);
    }
  }
  console.log(`\nListo. Alias actualizados: ${updated}/${toFix.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
