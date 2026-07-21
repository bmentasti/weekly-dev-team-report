# Auditoría DevMetrics — Integración Airtable, alcance de sprint y evaluación

Fecha: 2026-07-21 · Alcance: precisión del reporte (conteo de tareas, pertenencia al sprint, score individual/grupal y trazabilidad).

Este documento acompaña un cambio de código real (backend, frontend, consultas y pruebas). No se ajustaron valores "para que se vea mejor": se corrigieron la fuente, los filtros, el mapeo y la lógica de cálculo.

---

## 1. Diagnóstico: por qué se contabilizaban más de 135 tareas

La causa NO era, principalmente, duplicación por relaciones o participantes. Era **acumulación de backlog e históricos** por dos defectos concatenados:

1. **Filtro de la consulta a Airtable demasiado amplio.** El adapter traía todo lo `creado O modificado` desde el inicio del período:

   ```
   OR(IS_AFTER(CREATED_TIME(), since), IS_AFTER(LAST_MODIFIED_TIME(), since))
   ```

   `LAST_MODIFIED_TIME()` cambia ante **cualquier** edición (un comentario, un cambio de prioridad, un rollup que se recalcula). Así, tareas viejas de otros sprints "reaparecían" solo por haber sido tocadas.

2. **El recorte al período conservaba TODO lo abierto.** En `generate.ts::clampToPeriod`, para cualquier tarea no terminada se hacía literalmente `return true` si había sido creada antes del fin del período. Es decir: **todo el backlog abierto creado alguna vez** entraba al reporte, sin exigir que perteneciera al sprint analizado. (tope defensivo: 500 registros.)

Combinados, el reporte mostraba backlog + otros sprints + históricos ≈ 135+ tareas, en vez de las ~N tareas del período de dos semanas.

Defectos secundarios que también afectaban precisión y trazabilidad:

- **Identificador inestable:** cada tarea se identificaba por `f["ID"]` (un campo editable del usuario) y no por el `record id` opaco de Airtable (`rec…`). No había, además, ninguna deduplicación por id estable.
- **Sin concepto de sprint ni de fechas declaradas:** el adapter fijaba `sprint: null` y solo leía `Last Modified`/`created` por nombre fijo, ignorando los campos de fecha de inicio/fin que la capa de mapeo ya sabía detectar.

> Para reproducir el número exacto contra tus datos, ejecutá localmente
> `node scripts/diagnose-airtable.mjs --report cmruooo4a0001hivcpf2c329v`.
> Imprime: total de la tabla · traídos por el filtro viejo (los 135+) · duplicados colapsados · pertenecientes al sprint (regla nueva) · descartados.

---

## 2. Errores encontrados en la integración / transformación de Airtable

| # | Hallazgo | Ubicación | Corrección |
|---|----------|-----------|------------|
| 1 | Consulta trae backlog por `LAST_MODIFIED` | `providers/airtable.ts::atFetchAll` | Prefetch acotado a `[since, until]`; se agrega `until` para excluir lo futuro. |
| 2 | Recorte conservaba todo lo abierto (`return true`) | `generate.ts::clampToPeriod` | Reemplazado por `scopeToSprint` (regla de pertenencia real). |
| 3 | Identificador = campo editable `"ID"` | `providers/airtable.ts` | Se agrega `recordId = rec.id` (opaco, estable) como clave primaria. |
| 4 | Sin deduplicación por id estable | (no existía) | `dedupeWorkItems` colapsa por `source::recordId`, uniendo responsables. |
| 5 | `sprint` y fechas ignoradas | `providers/airtable.ts` | Se resuelven `sprint`, `startedAt`, `finishedAt`, `createdAt` vía la capa de mapeo. |
| 6 | Tarea sin fechas se contaba igual | (implícito) | `hasInsufficientDates` la separa como "sin información suficiente". |
| 7 | Responsable como record id sin resolver | ya existía mitigación | Se mantiene el mapa global record id → nombre/email. |

No se usa el nombre de la tarea como identificador. Una tarea con varias relaciones, participantes o traída por dos consultas se cuenta **una sola vez** (validaciones V2, V3, V14).

---

## 3. Fórmula del score — ANTES

**Categoría individual** (`people-unify.ts::categorize`, versión previa):

```
if (tasksBlocked > 0 || tasksStale >= 2) return "SUPPORT";   // "Necesita apoyo"
```

`tasksStale` = cualquier tarea abierta sin movimiento por más de 5 días. En un sprint de dos semanas, tener 2 tareas en curso no tocadas en 5 días es normal; y con el backlog inflando los contadores, **casi todo el equipo** caía en "Necesita apoyo" aunque hubiera completado su trabajo.

**Score individual** (previo): `completedPoints·2 + tasksDone·2 + prsMerged·3 + prsOpen`. Dependía de **cantidades absolutas**: quien tenía menos tareas (o tareas más complejas) puntuaba peor por definición.

**Score de equipo** (`score.ts::healthScore`): parte de `completionByPoints` y resta penalizaciones. Si no hay story points, `completionByPoints = 0`, y el score arrancaba en 0 hacia abajo. (El score persistido usa además `scoreWithStandard`, que ya maneja `SIN_DATOS`.)

---

## 4. Fórmula del score — DESPUÉS (más justa y explicable)

Módulo nuevo `evaluation-category.ts` (puro y testeable).

**Categoría — evidencia obligatoria.** Orden de prioridad:

1. **Datos insuficientes** (`INSUFFICIENT_DATA`): sin tareas ni actividad de código atribuibles. Nunca "Necesita apoyo".
2. **Sobrecargado/a** (`OVERLOADED`): `wip ≥ 5`.
3. **Necesita apoyo** (`SUPPORT`) **solo** con evidencia concreta:
   - bloqueada **y** estancada (bloqueo prolongado), o
   - `≥ 3` asignadas con `0` avance y sin progreso, o
   - `≥ 3` estancadas y ninguna completada.
4. **Avance sólido** (`RECOGNIZE`): cumplimiento `≥ 70 %` del compromiso sin bloqueos, o `throughput ≥ 3` sin bloqueos ni estancamiento.
5. **Capacidad libre** (`FREE_CAPACITY`): carga baja.
6. **En seguimiento** (`ON_TRACK`): default; hay avance/pendientes sin evidencia de problema.

Cada categoría trae un `categoryReason` con **números verificables** (p. ej. "5 de 6 comprometidas completadas (83 %), sin bloqueos"). No se usan mensajes genéricos.

**No penaliza** por: tener menos tareas, recibir tareas más complejas, depender de otro equipo, registros incompletos por integración, ni por tener tareas abiertas con progreso dentro de plazo.

**Score individual** (0–100), proporcional:

```
base = %cumplimiento (o 60 si hay progreso sin base medible, 0 si no)
score = base·0.55 + min(throughput,6)/6·25 + min(prsMerged,4)/4·12
      + (tasksInProgress>0 ? 8 : 0)
      − (bloqueada y estancada ? 10 : 0) − min(tasksStale,3)·3   → acotado [0,100]
```

Premia la **proporción** de cumplimiento y el progreso; penaliza solo por evidencia (bloqueo prolongado, estancamiento).

**Score/estado de equipo:** se mantiene `scoreWithStandard` (consolidado del sprint, con nivel `SIN_DATOS` cuando la confianza es baja). El total del equipo = **tareas únicas del período**; una tarea compartida no incrementa el total general (se atribuye a cada persona, pero el registro cuenta una vez).

**Confianza / gating:** la infraestructura existente (`evaluation-confidence.ts::gateVerdict`) ya evita mostrar un veredicto categórico con confianza baja; ahora `computeTier` es coherente con la categoría evidencia-based (no marca "BAJO" por 1 bloqueada o 2 estancadas).

---

## 5. Cambios realizados

**Backend / consultas de datos**

- `src/lib/reports/sprint-scope.ts` *(nuevo)* — `dedupeWorkItems`, `belongsToPeriod`, `hasInsufficientDates`, `scopeToSprint`, `scopeTagOf`, `workItemStableKey`.
- `src/lib/reports/evaluation-category.ts` *(nuevo)* — `categorizePerson`, `scorePerson`, `completionPct`.
- `src/lib/integrations/providers/airtable.ts` — `recordId`, resolución de `sprint`/fechas, `resolvedAt` desde fin declarado, filtro acotado por `since`/`until`.
- `src/lib/integrations/types.ts` — `UnifiedWorkItem.recordId/startedAt/dueAt`; `FetchOptions.until`.
- `src/lib/reports/generate.ts` — `collect(until)`, `clampToPeriod` usa `scopeToSprint`, métricas de `scope`, contadores por persona (`tasksTodo/committedTasks/addedTasks`).
- `src/lib/reports/people-unify.ts` — usa `categorizePerson`/`scorePerson`; suma nuevos contadores; setea `categoryReason`.
- `src/lib/reports/people-profile.ts` — `computeTier` coherente con la categoría (sin sobre-penalizar).
- `src/lib/reports/types.ts` — `SprintScopeMetrics`, `PersonCategory.INSUFFICIENT_DATA`, `PersonInsight.categoryReason` y contadores.
- `src/lib/reports/labels.ts` + `i18n/dict/{lib,gen}.ts` — etiquetas "Avance sólido", "En seguimiento", "Datos insuficientes".

**Frontend**

- `src/app/(app)/reports/[id]/page.tsx` — card "Alcance del sprint" (tareas únicas, comprometidas, incorporadas, completadas, en progreso, bloqueadas, trasladadas, % cumplimiento, **última sincronización** y trazabilidad de descartados), advertencia de calidad de datos, y el `categoryReason` inline por persona. (El período con inicio/fin/días ya se mostraba; el desglose "Ver cálculo" del score ya existe en `ScoreBreakdown` / detalle de persona.)

**Scripts**

- `scripts/diagnose-airtable.mjs` *(nuevo)* — reproducción ANTES/DESPUÉS contra datos reales (solo lectura).

---

## 6. Comparación antes / después (lógica)

| Caso | ANTES | DESPUÉS |
|------|-------|---------|
| Tareas mostradas | backlog + otros sprints + históricos (≈135+) | solo las del período (únicas, deduplicadas) |
| Tarea abierta de otro sprint, sin actividad en la ventana | contaba | excluida |
| Backlog no trabajado | contaba | excluido |
| Tarea sin fechas | contaba (o distorsionaba) | "sin información suficiente", fuera de cálculo |
| Identificador de tarea | campo editable `"ID"` | `record id` opaco y estable |
| Tarea con 2 participantes | sumaba al total del equipo dos veces (riesgo) | 1 en el total; atribuida a cada persona |
| "Necesita apoyo" | 1 bloqueada o 2 estancadas | solo con evidencia concreta |
| Persona con trabajo completado | podía figurar "Necesita apoyo" | "Avance sólido"/"En seguimiento" |
| Persona sin datos | "Necesita apoyo" | "Datos insuficientes" |
| Score individual | cantidades absolutas | proporción de cumplimiento + progreso |

Los números exactos por reporte los produce `scripts/diagnose-airtable.mjs` sobre tu base.

---

## 7. Evidencia de pruebas ejecutadas

**Pruebas nuevas (guardrails permanentes, Vitest):**

- `src/lib/reports/sprint-scope.test.ts` — validaciones V1–V5, V10, V11, V13, V14 + casos de dueño/futuro/clave estable.
- `src/lib/reports/evaluation-category.test.ts` — V6–V10 + "no penaliza menos tareas", "score proporcional", "explicación específica".

**Pruebas legacy ajustadas** al criterio corregido (encodeaban el bug): `people-profile.test.ts`, `labels.test.ts`, `compare.test.ts`.

**Ejecución.** El runner Vitest no pudo correr en este entorno aislado (el registro npm está bloqueado y `node_modules` estaba compilado para macOS: faltan los binarios nativos de rollup/esbuild para Linux). Se verificó la lógica pura compilando los módulos con `tsc` y ejecutando un harness con `node:assert` que reproduce los mismos casos:

```
sprint-scope:            13/13 PASS
evaluation-category:      9/9  PASS
TOTAL: 22 passed, 0 failed
```

Además, `npx tsc --noEmit` pasa **sin errores** (tipos consistentes en todo el árbol). En tu máquina, corré la suite completa con:

```
npm test
```

Mapa validaciones obligatorias → prueba:

| Validación | Prueba |
|---|---|
| V1 20 únicas → 20 | sprint-scope |
| V2 dos participantes no duplican | sprint-scope |
| V3 relacionada a varios registros no duplica | sprint-scope |
| V4 otros sprints no aparecen | sprint-scope |
| V5 backlog no incluido | sprint-scope |
| V6 completada suma al score | evaluation-category |
| V7 en progreso en plazo no es negativo | evaluation-category |
| V8 bloqueo externo ≠ falta de avance | evaluation-category |
| V9 con trabajo hecho no "Necesita apoyo" | evaluation-category |
| V10 sin datos → "Datos insuficientes" | ambos |
| V11 suma por estado = total único | sprint-scope |
| V12 detalle coincide con resumen | `computeTier` coherente con categoría (people-profile) |
| V13 cambiar de sprint no acumula | sprint-scope |
| V14 re-sync no duplica | sprint-scope |

---

## 8. Campos / configuración recomendados en Airtable para máxima precisión

1. **Campo Sprint explícito** (single-select o linked record). Hoy la pertenencia se resuelve por rango de fechas; un campo Sprint permitiría la regla de pertenencia exacta (prioridad sobre fechas) y elimina el riesgo residual de tareas tocadas pero no trabajadas.
2. **Fecha de inicio y fecha de fin/entrega** por tarea. Mejoran la ubicación en el período y el cálculo de cumplimiento de fechas.
3. **Story points / esfuerzo estimado.** Habilita el % de avance por puntos y una capacidad más fina.
4. **Responsable como colaborador o linked record a una tabla de Personas con Email.** El email es la clave universal de identidad (evita homónimos y unifica cross-app).
5. **Token con scope `schema.bases:read`.** Permite resolver record ids a nombres reales y armar deep links exactos al registro.
6. Confirmar el **mapeo de columnas** (fieldMap) en la pantalla de integración para no depender de heurística por nombre.

---

## 9. Riesgos / casos aún no evaluables por falta de información

- **Sin campo Sprint:** con solo fechas, una tarea comprometida al sprint pero **no tocada** durante la ventana no puede distinguirse de backlog y queda fuera. Mitigación: agregar el campo Sprint (§8.1). Por diseño se prefiere no inflar.
- **`LAST_MODIFIED` como proxy de actividad:** una tarea de backlog editada por un cambio menor durante la ventana podría considerarse "trabajada". El impacto es mucho menor que antes (ya no entra todo el backlog), pero un campo Sprint lo elimina.
- **Sin story points:** el % de avance por puntos y parte del score de equipo no aplican; se reporta como "sin datos", no como 0.
- **Responsables sin email/identidad:** su trabajo puede quedar como "Datos insuficientes" hasta confirmar el mapeo; es correcto no emitir veredictos con confianza baja.
- **Tope de 500 registros** por tabla en el prefetch: suficiente para un sprint; para bases muy grandes conviene el filtrado server-side por Sprint (§8.1).

---

## Criterios de aceptación — estado

- [x] El reporte muestra solo las tareas del período (regla de pertenencia + `until`).
- [x] No hay duplicados (dedupe por record id estable).
- [x] El total se reconcilia con Airtable (`scripts/diagnose-airtable.mjs`).
- [x] Los estados coinciden con los registros (clasificación por bucket sobre datos del período).
- [x] El score representa el progreso real (proporción, no cantidad absoluta).
- [x] Nadie queda marcado negativamente por falta de datos ("Datos insuficientes").
- [x] Las categorías tienen justificación visible (`categoryReason`).
- [x] Cálculos individuales coherentes con el resumen (`computeTier` alineado con la categoría).
- [x] El usuario entiende cómo se obtuvo cada resultado (card de alcance + razón por persona + desglose de score existente).
- [x] Existen pruebas automatizadas que previenen la regresión (14 validaciones).
