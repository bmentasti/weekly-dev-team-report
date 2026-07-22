// Aritmética monetaria decimal-segura.
//
// Los números en coma flotante de JS (0.1 + 0.2 !== 0.3) no son aptos para
// dinero. Acá trabajamos escalando a enteros y redondeando de forma EXPLÍCITA
// (half-up, "round half away from zero") a una cantidad fija de decimales.
// Todas las funciones propagan `null` cuando falta un dato: nunca reemplazamos
// datos faltantes por cero (regla del §21 del spec).

/** Escala por defecto para dinero (centavos). */
export const MONEY_DP = 2;
/** Escala por defecto para porcentajes/índices. */
export const RATIO_DP = 4;

export type Num = number | null | undefined;

/** ¿Es un número finito y utilizable? (descarta null, undefined, NaN, ±Infinity) */
export function isNum(v: Num): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Redondeo half-up simétrico (aleja del cero en el .5) a `dp` decimales.
 * Corrige el error de representación usando epsilon relativo antes de redondear.
 */
export function round(value: Num, dp: number = MONEY_DP): number | null {
  if (!isNum(value)) return null;
  if (value === 0) return 0;
  const factor = Math.pow(10, dp);
  const scaled = value * factor;
  // epsilon relativo para evitar que 1.005*100 = 100.49999999999999
  const eps = Math.sign(scaled) * 1e-9 * Math.max(1, Math.abs(scaled));
  const r = Math.round(scaled + eps);
  const out = r / factor;
  return Object.is(out, -0) ? 0 : out;
}

/** Redondeo a dinero (2 decimales). */
export const money = (v: Num): number | null => round(v, MONEY_DP);

/** Suma; devuelve null si algún sumando falta (para no inventar ceros). */
export function add(...vals: Num[]): number | null {
  let acc = 0;
  for (const v of vals) {
    if (!isNum(v)) return null;
    acc += v;
  }
  return round(acc, MONEY_DP);
}

/** Suma tolerante: ignora null/undefined y suma sólo lo presente. */
export function sumPresent(vals: Num[]): number {
  let acc = 0;
  for (const v of vals) if (isNum(v)) acc += v;
  return round(acc, MONEY_DP) ?? 0;
}

/** Resta a - b. Null si falta alguno. */
export function sub(a: Num, b: Num): number | null {
  if (!isNum(a) || !isNum(b)) return null;
  return round(a - b, MONEY_DP);
}

/** Producto. Null si falta alguno. */
export function mul(a: Num, b: Num, dp: number = MONEY_DP): number | null {
  if (!isNum(a) || !isNum(b)) return null;
  return round(a * b, dp);
}

/**
 * División protegida a / b. Devuelve null si falta un dato o si el divisor es 0
 * (nunca lanza ni devuelve Infinity/NaN).
 */
export function div(a: Num, b: Num, dp: number = RATIO_DP): number | null {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  return round(a / b, dp);
}

/**
 * Porcentaje (parte / total) × 100. Null si falta dato o total = 0.
 * dp por defecto 2 (ej: 51.34 %).
 */
export function pct(part: Num, total: Num, dp = 2): number | null {
  if (!isNum(part) || !isNum(total) || total === 0) return null;
  return round((part / total) * 100, dp);
}

/** Valor absoluto seguro. */
export function abs(v: Num): number | null {
  if (!isNum(v)) return null;
  return round(Math.abs(v), MONEY_DP);
}

/** Aplica un tipo de cambio (monto × fxRate). Null si falta alguno. */
export function convert(amount: Num, fxRate: Num): number | null {
  return mul(amount, fxRate, MONEY_DP);
}

/** Formatea para logs/tests: "1234.5" -> "1,234.50" con moneda opcional. */
export function formatMoney(v: Num, currency = "USD"): string {
  if (!isNum(v)) return "Sin datos";
  const r = money(v) ?? 0;
  return `${currency} ${r.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
