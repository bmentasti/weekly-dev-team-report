# Budget, Forecast & Profitability — Diseño y diagnóstico

Motor de control financiero y predictivo para proyectos de DevMetrics. Este
documento cubre la auditoría previa (§3), el modelo de datos, las fórmulas y el
plan por fases. La Fase 1 (schema + servicio de cálculo + tests) ya está
implementada; ver "Estado" al final.

---

## 1. Diagnóstico de la aplicación (auditoría previa)

**Stack.** Next.js 14 (App Router) + TypeScript strict, Prisma 5 sobre
PostgreSQL, NextAuth (credenciales, bcrypt), Tailwind + Radix, Recharts, Vitest +
Playwright (e2e). Deploy en Render (`render.yaml`). El schema se aplica con
`prisma db push` (no hay carpeta `migrations/`, sólo SQL puntual en `prisma/sql/`).

**Modelo de datos actual.** `Workspace → Project → {Integration, ProjectMember,
Report, PersonIdentity/Alias, PersonContext}`. Reporting con `Report`,
`ReportConfig`, `HealthStandard(+History)`, `AlertRule`, `AuditLog`,
`Notification`, `ReportDelivery/Note/Share`.

**RBAC.** Dos ejes: rol de acceso (`WorkspaceRole`: OWNER/ADMIN/MEMBER/VIEWER) que
otorga permisos vía `src/lib/permissions.ts` (matriz de `Capability`), y rol
funcional (`UserRole`: TL/PO/EM/CTO…) que sólo personaliza la experiencia. Ya
existe el patrón de capacidad sensible `viewPeople` y vistas compartidas con
nivel `EXECUTIVE` vs `FULL` — el modelo financiero reutiliza este patrón.

**Integraciones.** Amplio catálogo (Jira, GitHub, GitLab, Airtable, Slack, y
planificación: MS Project, Monday, Asana, etc.). Jira normaliza **story points**,
estados, bloqueos y changelog de reasignación (`src/lib/jira`). GitHub aporta
actividad de PRs/commits. Hay un motor de "intelligence" (confianza, cobertura,
correlación, conflictos) y salud de sincronización por integración.

**Qué información financiera ya existe:** avance por story points (Jira),
bloqueos, retrabajo aproximable (bugs/tareas reabiertas), actividad por persona
con identidad canónica. **Qué NO existe:** absolutamente nada de finanzas —
ingreso, presupuesto, costos, tarifas, modalidad contractual, facturación,
fechas contractuales, márgenes. `Project` sólo tiene `name`, `jiraProjectKey`,
`githubRepo*`.

**Dato crítico:** Jira **no** sincroniza worklog/horas hoy (sólo story points).
Por lo tanto el costo laboral **no** puede derivarse de horas reales
automáticas; se deriva de tarifas × asignación (versionadas) y/o carga
manual/CSV. El avance (Earned Value) usa **combinación ponderada**: story points
(automático) + pesos manuales por entregable/milestone.

### Fuentes, calidad, supuestos y riesgos

| Dato | Fuente | Disponibilidad |
|---|---|---|
| Avance físico (SP) | Jira | Automático |
| Avance por milestones/entregables | Manual | A cargar |
| Ingreso contratado / facturación | Manual / CSV | A cargar |
| Presupuesto de costos, contingencia | Manual | A cargar |
| Tarifas y costos laborales | Manual (versionado) | A cargar |
| Horas reales trabajadas | — | No disponible (integrar time-tracking a futuro) |
| Costos externos / licencias / infra | Manual / CSV | A cargar |

**Supuestos.** Moneda por proyecto con FX explícito y versionado; el costo real
laboral se calcula por tarifa vigente en la fecha del trabajo; las penalidades
pueden imputarse a ingreso o a costo según configuración contable.

**Riesgos.** (1) Sin horas reales, el AC laboral depende de la calidad de
asignaciones/tarifas cargadas. (2) Datos financieros manuales → gobernanza y
auditoría imprescindibles. (3) Multi-moneda sin doble contar. **Mitigación:**
toda métrica declara fuente, confianza y supuestos; si falta un insumo se
devuelve "información insuficiente", nunca cero.

---

## 2. Principio central (no asumir)

El motor **no** concluye automáticamente que terminar antes gana más, que
atrasarse siempre pierde, ni que estar dentro de presupuesto implica
rentabilidad. Cada conclusión depende de modalidad, ingreso, costos, avance real
y capacidad, y expone **fórmula + insumos + fuente + confianza** (`Provenance`).

---

## 3. Modelo de datos (Prisma)

Nuevos modelos (ver `prisma/schema.prisma`): `ProjectFinance` (config económica
vigente + modalidad), `FinanceBaseline` (baseline **inmutable** 1:1),
`ForecastVersion` (forecast **versionado**), `BudgetChange` (historial de
cambios con valor anterior/nuevo, aprobación e impacto), `CostEntry`
(`nature`: ACTUAL/COMMITTED/FORECAST/POTENTIAL — nunca se mezclan),
`RevenueEntry` (contratado/facturado/cobrado/reconocido/pendiente/CR/bonus/
penalidad), `LaborRate` (tarifa con **vigencia histórica**, no reescribe el
pasado) y `FinanceMilestone`. Montos en `Decimal(18,4)`.

Modalidades soportadas (`ContractModality`): Fixed Price, Time & Materials,
Managed Capacity, Milestone Based, Retainer e Híbrido.

---

## 4. Servicio de cálculo (`src/lib/finance/`)

Servicio **centralizado, puro y testeable**; las fórmulas **no** viven en los
componentes visuales. Desacoplado de Prisma (opera sobre tipos planos) para ser
unit-testeable sin DB.

- `money.ts` — aritmética **decimal-segura** (redondeo half-up explícito,
  división por cero → `null`, propaga faltantes sin inventar ceros).
- `progress.ts` — Earned Value físico por **combinación ponderada** (SP +
  milestones + manual), renormalizando pesos sobre las fuentes presentes.
- `budget.ts` — presupuesto vigente/disponible, % consumido, burn rate, runway,
  fecha de agotamiento (no se calcula con burn ≤ 0).
- `evm.ts` — PV, EV, AC, CPI, SPI, CV, SV, **EAC (4 modelos)**, ETC, VAC, TCPI
  (BAC y EAC) con recomendación de método según calidad de datos.
- `profitability.ts` — ganancia/margen actual y proyectado, variación vs
  objetivo, punto de equilibrio y headroom.
- `early-completion.ts` — beneficio neto de finalizar antes; capacidad liberada
  **sólo** si está validada; veredicto explicado.
- `delay.ts` — costo incremental de atraso, días absorbibles (break-even),
  ganancia proyectada con atraso.
- `labor.ts` — costo laboral con tarifas versionadas (resuelve la tarifa vigente
  por fecha).
- `status.ts` — estado financiero (Saludable/Atención/En riesgo/Crítico/Sin
  datos) con reglas explicables.

Fórmulas clave: `currentBudget = original + ampliaciones − reducciones`;
`remaining = currentBudget − AC − comprometido`; `CPI = EV/AC`; `SPI = EV/PV`;
`EAC_cost = BAC/CPI`; `EAC_cost_schedule = AC + (BAC−EV)/(CPI×SPI)`;
`VAC = BAC−EAC`; `TCPI = (BAC−EV)/(BAC−AC)`;
`projectedProfit = projectedRevenue − EAC`;
`earlyCompletionNetBenefit = avoidedCost + bonus + capacidadValidada − lostRevenue − transición`;
`breakEvenDelayDays = projectedProfit / costoDiarioIncremental` (sólo si > 0).

---

## 5. Casos de prueba obligatorios (§24)

Los 15 casos están implementados en `src/lib/finance/scenarios.test.ts` y
verificados (53 asserts en verde), incluyendo: FP terminado antes (+20k), T&M
antes (no asume más ganancia), FP atraso rentable, FP con pérdida, atraso
facturable en T&M, scope creep aprobado vs no aprobado, dentro de presupuesto
con margen bajo, presupuesto superado pero rentable, sin datos, cambio de tarifa
(no revalúa el pasado), penalidad (ingreso vs costo equivalente), bono
anticipado, capacidad liberada sin/ con reasignación.

---

## 6. Plan por fases

- **Fase 1 — MVP financiero (HECHA):** schema, servicio de cálculo, EVM, punto de
  equilibrio, estado financiero, tests.
- **Fase 2 — Avance económico (HECHA):** orquestador `engine.ts`, mapper+loader
  Prisma→cálculo (`load.ts`), RBAC financiero, endpoints y dashboard con
  PV/EV/AC, CPI/SPI/EAC/ETC/VAC/TCPI, avance vs consumo y estado. Ver §9-§11.
- **Fase 3 — Rentabilidad temporal (HECHA):** sección `temporal` en el motor
  (costo diario/semanal de atraso, días absorbibles, fecha de margen cero,
  margen a 1/2/4/8 semanas) + simulador interactivo de atraso y finalización
  anticipada (penalidades, bonos, capacidad liberada validada). Sólo `viewMargins`.
- **Fase 4 — Riesgos operativos (HECHA):** módulo `risks.ts` (scope creep
  aprobado vs no, costo y % de retrabajo, bloqueos por naturaleza real/
  comprometido/potencial), integrado al motor (sección `risks`) y al estado
  financiero (flags de scope creep/retrabajo derivados de datos), con card en el
  dashboard. Camino crítico automático desde Jira queda como mejora futura.
- **Fase 5 — Simulación y portafolio (HECHA):** `scenarios.ts` (presets base/
  optimista/probable/pesimista + personalizado, confianza cualitativa),
  `alerts.ts` (alertas accionables con severidad/fórmula/evidencia/acción),
  vista de portafolio ordenable en `/finance`, y exportación CSV
  (`/api/projects/[id]/finance/export`, capacidad `exportFinancials`).

---

## 7. Seguridad y permisos

Capacidades en `permissions.ts` (Fase 2, hechas): `viewFinancials`,
`viewMargins`, `editFinancials`, `approveBudget`, `runScenarios`,
`exportFinancials`. OWNER/ADMIN acceden a todo; MEMBER tiene vista operativa
(`viewFinancials`) **sin** márgenes/tarifas ni edición; VIEWER sin acceso. El
endpoint enmascara márgenes cuando falta `viewMargins`. Todo cambio financiero
se registra en `AuditLog` (`finance.config.update`, `finance.baseline.capture`,
`finance.cost.create`, `finance.revenue.create`).

---

## 8. API y UI (Fase 2)

- `GET /api/projects/[id]/finance` — snapshot calculado (enmascara márgenes según rol).
- `PUT /api/projects/[id]/finance` — upsert de la configuración económica.
- `POST /api/projects/[id]/finance/baseline` — captura la baseline (inmutable; 409 si ya existe).
- `POST /api/projects/[id]/finance/entries` — alta de costo o ingreso.
- Dashboard `/projects/[id]/finance` — KPIs con trazabilidad (fórmula/fuente/
  confianza), gráficos EVM (PV/EV/AC) y avance vs. consumo, y explicación del estado.

---

## 9. Estado y despliegue

Implementado y verificado (Fase 1 + Fase 2): modelos Prisma, `src/lib/finance/*`
(incluye `engine.ts`, `load.ts`, `access.ts`), RBAC, endpoints y dashboard.
`tsc --noEmit` del proyecto completo en verde; 70 aserciones de lógica en verde
(money + 15 casos obligatorios + orquestador + permisos).

**Para aplicar el schema** (en un entorno con acceso a la DB y engines Prisma):

```bash
npm run db:generate   # regenera el client con los nuevos modelos (tipa los delegates financieros)
npm run db:push       # aplica el schema a la base
npm test              # corre la suite completa (Vitest)
```

> Nota: el loader accede a los delegates financieros de Prisma vía un facade
> hasta regenerar el client. En este entorno los tests se verificaron compilando
> con `tsc` y ejecutando en Node por falta de binarios nativos; en CI corren con
> Vitest normal.
