// Diagnóstico de precisión de la integración con Airtable (auditoría §"Entregables").
//
// Reproduce, contra los datos REALES, por qué el reporte contabiliza 135+ tareas
// y compara el conteo ANTES (lógica vieja: se conservaba todo el backlog abierto)
// contra DESPUÉS (regla de pertenencia al sprint + deduplicación por record id
// estable). Refleja la lógica de src/lib/reports/sprint-scope.ts.
//
// Uso (se ejecuta LOCALMENTE, donde están el DATABASE_URL y el token):
//   node scripts/diagnose-airtable.mjs                       (últimos 14 días)
//   node scripts/diagnose-airtable.mjs --start 2026-07-06 --end 2026-07-19
//   node scripts/diagnose-airtable.mjs --report <reportId>   (usa su período)
//
// Solo LECTURA: no modifica Airtable ni la base.

import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

// --- carga .env -------------------------------------------------------------
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* sin .env: DATABASE_URL y ENCRYPTION_KEY deben venir del entorno */
}

const prisma = new PrismaClient();
const API = "https://api.airtable.com/v0";

function arg(name, dflt = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

// --- desencriptado AES-256-GCM (idéntico a src/lib/encryption.ts) -----------
function decrypt(payload) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

// --- clasificación de estado (idéntica al adapter) --------------------------
const DONE = /\b(done|closed|complete|completed|shipped|listo|finalizad|terminad)\b/i;
const IN_PROGRESS = /\b(in progress|doing|wip|review|en progreso|en curso|haciendo)\b/i;
const BLOCKED = /\b(blocked|bloquead|on hold|en espera)\b/i;
function bucketFor(s) {
  if (BLOCKED.test(s)) return "BLOCKED";
  if (DONE.test(s)) return "DONE";
  if (IN_PROGRESS.test(s)) return "IN_PROGRESS";
  return "TODO";
}

function toStr(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(toStr).filter(Boolean).join(", ");
  if (typeof v === "object") return v.name ?? v.email ?? "";
  return String(v);
}
const ts = (x) => { const t = new Date(x).getTime(); return Number.isNaN(t) ? null : t; };
const inWin = (t, a, b) => t !== null && t >= a && t <= b;

// Regla de pertenencia (espejo de sprint-scope.ts::belongsToPeriod).
function belongs(item, start, end) {
  const created = ts(item.createdAt);
  const updated = ts(item.updatedAt);
  const resolved = ts(item.resolvedAt);
  if (created !== null && created > end) return false;
  if (item.bucket === "DONE") return inWin(resolved ?? updated, start, end);
  if (inWin(created, start, end)) return true;
  if (inWin(updated, start, end)) return true;
  return false;
}

async function fetchAll(baseId, table, token, formula) {
  const out = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (formula) qs.set("filterByFormula", formula);
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${API}/${baseId}/${encodeURIComponent(table)}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    out.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset && out.length < 2000);
  return out;
}

async function main() {
  // Período
  let start, end;
  const reportId = arg("report");
  if (reportId) {
    const r = await prisma.report.findUnique({ where: { id: reportId } });
    if (!r) throw new Error(`No existe el reporte ${reportId}`);
    start = new Date(r.periodStart).getTime();
    end = new Date(r.periodEnd).getTime();
  } else {
    end = arg("end") ? new Date(arg("end")).getTime() : Date.now();
    start = arg("start") ? new Date(arg("start")).getTime() : end - 14 * 864e5;
  }
  console.log(`Período: ${new Date(start).toISOString()} → ${new Date(end).toISOString()}`);

  // Integración Airtable conectada
  const integ = await prisma.integration.findFirst({
    where: { type: "AIRTABLE", status: "CONNECTED", ...(reportId ? {} : {}) },
  });
  if (!integ) throw new Error("No hay integración Airtable CONNECTED.");
  const cfg = integ.config ?? {};
  const baseId = (cfg.baseId ?? "").trim();
  const table = (cfg.tableName ?? "").trim();
  const token = decrypt(integ.encryptedAccessToken);
  console.log(`Base: ${baseId} · Tabla: ${table}`);

  // Campos: usa fieldMap si existe, si no heurística mínima.
  const fieldMap = typeof cfg.fieldMap === "string" ? JSON.parse(cfg.fieldMap) : (cfg.fieldMap ?? {});
  const statusField = fieldMap.status || cfg.statusField || "Status";
  const finishedField = fieldMap.finishedAt || null;
  const createdField = fieldMap.createdAt || null;

  // 1) TOTAL de la tabla (sin filtro) — contexto.
  const all = await fetchAll(baseId, table, token, "");
  // 2) ANTES: filtro OR(created, lastModified >= start) — la consulta vieja.
  const sinceIso = new Date(start).toISOString();
  const oldFiltered = await fetchAll(
    baseId, table, token,
    `OR(IS_AFTER(CREATED_TIME(), '${sinceIso}'), IS_AFTER(LAST_MODIFIED_TIME(), '${sinceIso}'))`,
  );

  // Normaliza y aplica NUEVA regla de pertenencia + dedupe por record id.
  const findLastModified = (f) => {
    for (const k of Object.keys(f)) if (/last modified|modificad|updated|actualizad/i.test(k)) return toStr(f[k]);
    return "";
  };
  const norm = (rec) => {
    const f = rec.fields ?? {};
    const bucket = bucketFor(toStr(f[statusField]) || "To Do");
    const updated = (bucket === "DONE" && finishedField ? toStr(f[finishedField]) : "") || findLastModified(f) || rec.createdTime;
    return {
      recordId: rec.id,
      bucket,
      createdAt: (createdField ? toStr(f[createdField]) : "") || rec.createdTime,
      updatedAt: updated,
      resolvedAt: bucket === "DONE" ? (finishedField ? toStr(f[finishedField]) : "") || updated : null,
    };
  };
  const byId = new Map();
  for (const rec of oldFiltered) byId.set(rec.id, norm(rec)); // dedupe por record id
  const deduped = [...byId.values()];
  const included = deduped.filter((i) => belongs(i, start, end));
  const excluded = deduped.length - included.length;

  const byBucket = (arr) => ["DONE", "IN_PROGRESS", "BLOCKED", "TODO"].map((b) => `${b}:${arr.filter((i) => i.bucket === b).length}`).join("  ");

  console.log("\n================ COMPARACIÓN ================");
  console.log(`Total de registros en la tabla ...................... ${all.length}`);
  console.log(`ANTES  — traídos por el filtro viejo (OR since) ..... ${oldFiltered.length}`);
  console.log(`         (esto es lo que inflaba el reporte a 135+)`);
  console.log(`Duplicados por record id colapsados ................. ${oldFiltered.length - deduped.length}`);
  console.log(`DESPUÉS — pertenecen al sprint (regla nueva) ........ ${included.length}`);
  console.log(`         descartados por no pertenecer ............. ${excluded}`);
  console.log(`\nDistribución por estado (DESPUÉS): ${byBucket(included)}`);
  console.log("=============================================\n");
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
