/**
 * E2E de integridad del detalle por participante (auditoría §13).
 *
 * Requisitos para correrlo:
 *   npm i -D @playwright/test && npx playwright install chromium
 *   Variables de entorno:
 *     E2E_BASE_URL   (ej. https://weekly-dev-team-report-3jq6.onrender.com)
 *     E2E_EMAIL / E2E_PASSWORD   (usuario de prueba)
 *     E2E_REPORT_ID  (id de un reporte con varios participantes)
 *   Ejecutar: npx playwright test e2e/person-detail.spec.ts
 *
 * Usa data-testid estables (no textos ni posiciones):
 *   - participant-link  (con data-participant-id) en la tabla del reporte
 *   - person-name       (con data-participant-id) en el detalle
 *   - person-loading    (skeleton mientras carga)
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const REPORT_ID = process.env.E2E_REPORT_ID ?? "";

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL ?? "");
  await page.getByLabel(/contraseña|password/i).fill(process.env.E2E_PASSWORD ?? "");
  await page.getByRole("button", { name: /iniciar sesión|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|reports|projects)/);
});

test("cada participante muestra SU identidad; no se mezclan datos", async ({ page }) => {
  test.skip(!REPORT_ID, "Definí E2E_REPORT_ID");
  await page.goto(`${BASE}/reports/${REPORT_ID}`);

  const links = page.getByTestId("participant-link");
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const link = page.getByTestId("participant-link").nth(i);
    const expectedId = await link.getAttribute("data-participant-id");
    await link.click();

    // El encabezado del detalle debe corresponder al MISMO participantId.
    const header = page.getByTestId("person-name");
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute("data-participant-id", expectedId ?? "");

    // Volver al reporte para el próximo.
    await page.goBack();
    await expect(page.getByTestId("participant-link").first()).toBeVisible();
  }
});

test("clics rápidos entre personas: el detalle final es el de la última selección", async ({
  page,
}) => {
  test.skip(!REPORT_ID, "Definí E2E_REPORT_ID");
  await page.goto(`${BASE}/reports/${REPORT_ID}`);
  const links = page.getByTestId("participant-link");
  if ((await links.count()) < 2) test.skip();

  const first = links.nth(0);
  const second = links.nth(1);
  const secondId = await second.getAttribute("data-participant-id");

  // Navegar a la primera y, sin esperar, a la segunda (condición de carrera).
  await first.click();
  await page.goBack();
  await second.click();

  // El detalle mostrado debe ser el de la SEGUNDA (no restos de la primera).
  const header = page.getByTestId("person-name");
  await expect(header).toHaveAttribute("data-participant-id", secondId ?? "");
});

test("recarga y URL directa mantienen la identidad", async ({ page }) => {
  test.skip(!REPORT_ID, "Definí E2E_REPORT_ID");
  await page.goto(`${BASE}/reports/${REPORT_ID}`);
  const link = page.getByTestId("participant-link").first();
  const id = await link.getAttribute("data-participant-id");
  await link.click();
  await expect(page.getByTestId("person-name")).toHaveAttribute(
    "data-participant-id",
    id ?? "",
  );
  // Recargar dentro del detalle: misma identidad.
  await page.reload();
  await expect(page.getByTestId("person-name")).toHaveAttribute(
    "data-participant-id",
    id ?? "",
  );
});
