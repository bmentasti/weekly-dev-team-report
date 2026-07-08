// Validación de variables de entorno (H14).
// En producción, aborta el arranque si faltan secretos o si quedaron los
// placeholders del .env.example. En desarrollo solo advierte, para no frenar
// el trabajo local.

const isProd = process.env.NODE_ENV === "production";

const PLACEHOLDERS = [
  "change-me-in-production",
  "0000000000000000000000000000000000000000000000000000000000000000",
];

interface Issue {
  key: string;
  message: string;
}

function collectIssues(): Issue[] {
  const issues: Issue[] = [];
  const {
    DATABASE_URL,
    NEXTAUTH_SECRET,
    ENCRYPTION_KEY,
  } = process.env;

  if (!DATABASE_URL) issues.push({ key: "DATABASE_URL", message: "requerida" });

  if (!NEXTAUTH_SECRET)
    issues.push({ key: "NEXTAUTH_SECRET", message: "requerida" });
  else if (PLACEHOLDERS.includes(NEXTAUTH_SECRET))
    issues.push({
      key: "NEXTAUTH_SECRET",
      message: "usa el placeholder del ejemplo; generá uno real",
    });

  if (!ENCRYPTION_KEY)
    issues.push({ key: "ENCRYPTION_KEY", message: "requerida" });
  else if (PLACEHOLDERS.includes(ENCRYPTION_KEY))
    issues.push({
      key: "ENCRYPTION_KEY",
      message: "usa el placeholder (todo ceros); generá uno real con openssl rand -hex 32",
    });
  else if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY))
    issues.push({
      key: "ENCRYPTION_KEY",
      message: "debe ser 64 caracteres hex (32 bytes)",
    });

  return issues;
}

// Evita correr durante el build de producción de Next (aún sin secrets de runtime).
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuildPhase) {
  const issues = collectIssues();
  if (issues.length > 0) {
    const msg = issues.map((i) => `  - ${i.key}: ${i.message}`).join("\n");
    if (isProd) {
      throw new Error(
        `Configuración de entorno inválida (no se puede arrancar):\n${msg}`,
      );
    } else if (typeof window === "undefined") {
      console.warn(`⚠️  Variables de entorno a revisar:\n${msg}`);
    }
  }
}

export {};
