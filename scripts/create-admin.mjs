// Crea (o actualiza) el usuario del backoffice con acceso al panel /admin.
//
// Uso:  node scripts/create-admin.mjs
// Por defecto crea el usuario "brunoAdmin". Podés sobreescribir con env:
//   ADMIN_USERNAME=otro ADMIN_EMAIL=otro@mail ADMIN_PASSWORD=... node scripts/create-admin.mjs
//
// El login del backoffice acepta el username directamente (sin email) en la
// pantalla de login normal. La contraseña se guarda hasheada (bcrypt).
// IMPORTANTE: cambiá la contraseña por defecto en producción.

import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Carga mínima de .env (sin dependencia de dotenv).
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // sin .env: se asume DATABASE_URL ya presente en el entorno
}

const username = process.env.ADMIN_USERNAME ?? "brunoAdmin";
const email = (process.env.ADMIN_EMAIL ?? "brunoadmin@devmetrics.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "Velez2026$";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.user.upsert({
  where: { email },
  update: { name: username, passwordHash, isSuperAdmin: true },
  create: {
    name: username,
    email,
    passwordHash,
    role: "OTHER",
    isSuperAdmin: true,
  },
});

console.log(`Usuario admin listo: ${user.name} (${user.email})`);
console.log(`Login: usá "${username}" (o el email) + la contraseña en /login, y entrá a /admin`);
await prisma.$disconnect();
