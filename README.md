# DevMetrics

> Clear engineering reports in one click.
>
> (Nombre interno del repo: weekly-dev-team-report.)

SaaS B2B para TLs, POs y Engineering Managers: conectá Jira y GitHub y generá
un reporte semanal automático de avance del equipo (tareas, PRs, bloqueos,
riesgos y recomendaciones).

Este repositorio es el **scaffold + Sprint 1** del MVP.

## Estado actual (Sprint 1)

Implementado y funcional:

- Registro de usuario (nombre, email, contraseña, empresa, rol).
- Login / logout con sesión (Auth.js / NextAuth, estrategia JWT).
- Creación de workspace (nombre, empresa, equipo, tamaño).
- Dashboard con estado vacío ("Todavía no conectaste ninguna herramienta").
- Protección de rutas privadas vía middleware.
- Contraseñas hasheadas con bcrypt.
- `EncryptionService` (AES-256-GCM) listo para guardar tokens de integraciones.
- **Schema Prisma completo** de todo el MVP (User, Workspace, WorkspaceMember,
  Integration, Project, ReportConfig, Report, ReportDelivery), así los próximos
  sprints se enchufan sin migraciones estructurales grandes.

### Sprint 2 — Jira (implementado)

- Conexión a Jira Cloud (dominio, email, API token, project key), con el token
  guardado **encriptado** (AES-256-GCM).
- Botón "Probar conexión" que valida credenciales y acceso al proyecto antes de
  guardar.
- Traído de issues del proyecto vía JQL desde el servidor.
- Clasificación automática de issues: finalizada / en progreso / bloqueada /
  por hacer, más detección de tareas **críticas** (prioridad High/Highest/
  Critical) y **sin movimiento** (>5 días sin update).
- Tabla de issues + tarjetas de métricas (total, finalizadas, en progreso,
  bloqueadas, sin movimiento, críticas).

Rutas nuevas: `/integrations/jira` (conectar) y `/integrations/jira/issues`.
APIs: `POST /api/integrations/jira/test`, `POST /api/integrations/jira/connect`,
`GET /api/integrations/jira/issues`.

> Para conectar Jira necesitás un API token: creá uno en
> https://id.atlassian.com/manage-profile/security/api-tokens

### Sprint 3 — GitHub (implementado)

- Conexión a un repositorio de GitHub (owner, repo, access token), con el token
  guardado **encriptado**. Usa un Personal Access Token (fine-grained o clásico
  con scope `repo`) — más simple que OAuth para el MVP y consistente con Jira.
- Guía embebida + enlaces oficiales para crear el token y setear permisos de
  solo lectura.
- Botón "Probar conexión" que valida token y acceso al repo antes de guardar.
- Traído de Pull Requests: abiertos + mergeados/cerrados de los últimos 7 días.
- Clasificación automática por reglas del spec: PR **viejo** (>72h abierto), PR
  **sin reviewer**, PR **con checks fallando**, PR **con riesgo**; más métricas
  (abiertos, mergeados, sin reviewer, checks fallando, >72h, edad promedio).
- Tabla de PRs + tarjetas de métricas.

Rutas nuevas: `/integrations/github` (conectar) y
`/integrations/github/pull-requests`. APIs:
`POST /api/integrations/github/test`, `POST /api/integrations/github/connect`,
`GET /api/integrations/github/pull-requests`.

> Para conectar GitHub creá un token en
> https://github.com/settings/tokens?type=beta con lectura de Pull Requests,
> Contents y Checks sobre el repositorio.

### Lote de integraciones — capa unificada (implementado)

Se introdujo una **capa de datos unificada** para poder cruzar información entre
fuentes (estado de un equipo / una persona a través de tareas, PRs y actividad),
en vez de tener integraciones sueltas. Modelos comunes:

- `UnifiedWorkItem` (tareas/issues) ← Jira, Linear, (próximo: Azure DevOps,
  ClickUp, Notion)
- `UnifiedCodeChange` (PRs/MRs) ← GitHub, GitLab, (próximo: Bitbucket, Azure
  Repos)
- `ActivitySignal` (mensajes/blockers) ← Slack, (próximo: Teams)

Cada proveedor es un **adapter** que implementa una interfaz común
(`ProviderAdapter`) y se registra en `src/lib/integrations/registry.ts`. El
catálogo client-safe (`src/lib/integrations/catalog.ts`) describe campos, guías y
links de cada uno y maneja toda la UI. Rutas y UI son **genéricas**:

- API: `POST /api/integrations/[provider]/test`, `.../connect`,
  `GET /api/integrations/[provider]/data`
- UI: `/integrations/[provider]` (conectar) y `/integrations/[provider]/data`

Integraciones activas: **Jira, GitHub, Slack, Linear, GitLab** (todas con guía
embebida + links oficiales y token/API key encriptado).
Próximo lote: **Azure DevOps, Bitbucket, ClickUp, Notion, Microsoft Teams**
(Teams requiere OAuth de Microsoft Graph). Ya aparecen listadas como
"próximamente" en el dashboard.

> ⚠️ Este lote amplió el enum `IntegrationType` en Prisma. Después de traer los
> cambios, corré **`npm run db:push`** para actualizar la base y regenerar el
> cliente Prisma.

### Sprint 4 — Generación de reportes (implementado)

El corazón del producto. Un motor (`src/lib/reports/generate.ts`) junta los datos
de **todas las integraciones conectadas** en el período y produce un reporte
unificado:

- **Métricas cruzadas**: tareas (finalizadas, en progreso, bloqueadas, sin
  movimiento, críticas) y PR/MR (abiertos, mergeados, sin reviewer, viejos,
  checks fallando), sin importar de qué herramienta vengan.
- **Desglose por persona**: tareas y PRs por cada integrante (base para ver el
  estado de una persona).
- **Detección de riesgos** con las reglas del spec (bloqueos, críticas sin
  movimiento, PRs viejos/sin reviewer/con checks rojos, sobrecarga, blockers en
  Slack).
- **Estado de salud** (Saludable / Riesgo medio / Riesgo alto) por scoring.
- **Resumen ejecutivo** y **recomendaciones** generados automáticamente.
- Reporte en **markdown** listo para copiar (y para enviar por email en Sprint 5).

Pantallas: `/reports` (generar con selector de período + historial) y
`/reports/[id]` (preview completa con copiar texto). APIs:
`POST /api/reports/generate`, `GET /api/reports`, `GET /api/reports/:id`.

> ⚠️ Este sprint hizo `projectId` opcional en `Report` y `ReportConfig` (los
> reportes son a nivel workspace). Corré **`npm run db:push`** después de traer
> los cambios.

### Analítica de decisión (implementado)

El reporte pasó de "qué pasó" a "qué significa y qué hacer". Se agregó:

- **Capacidad y velocity**: story points comprometidos vs completados, velocity,
  puntos restantes y cycle time promedio.
- **Avance del proyecto**: % completado por tareas y por story points, con
  distribución de estados (gráfico de dona).
- **Tendencia**: comparación con reportes previos (velocity, finalizadas, PRs,
  bloqueadas) en gráfico de líneas.
- **Insumos para planning**: carry-over, forecast de capacidad y foco recomendado.
- **Señales por persona**: categoría de gestión (Reconocer / Necesita apoyo /
  Sobrecargado / Capacidad libre / En ritmo) **con contexto y próximos pasos**,
  más un **score y ranking** de contribución. Incluye un aviso explícito de que
  son proxies, para evitar decisiones injustas.
- **Gráficos** con Recharts (dona de estados, barras de SP/throughput por
  persona, líneas de tendencia).

> ⚠️ Este lote agregó la dependencia **recharts**. Corré **`npm install`** antes
> de levantar. No hay cambios de base de datos; generá un reporte nuevo para ver
> las secciones (los reportes viejos no tienen las métricas nuevas).

### Colaboración y comparación (implementado)

- **Comparar reportes**: `/reports/compare` — elegís dos reportes y los ves lado
  a lado (deltas coloreados, métricas, gráfico comparativo y acciones de cada
  uno). Presets en `/reports` para generar "Último sprint (14 días)" y "Últimos
  3 meses"; la data demo escala según el período para que la comparación tenga
  sentido.
- **Notas** por reporte: agregar, editar y eliminar (solo el autor edita/borra),
  visibles para todos los que tienen acceso.
- **Compartir**: agregar miembros del workspace (lista) o invitar por email; se
  ve el estado **Visto / Sin ver** de cada persona. Se puede quitar.
- **Notificaciones in-app**: campana en el header con contador; avisa cuando te
  comparten un reporte o cuando alguien deja una nota en uno que compartís.
  (El envío por email queda para el Sprint 5.)

> ⚠️ Este lote agregó modelos (`ReportNote`, `ReportShare`, `Notification`).
> Corré **`npm run db:push`** y luego **`npm run db:seed`** (el seed ahora
> siembra compañeros de equipo para poder probar el compartir).

### Sprint 5 — Exportar y enviar (implementado)

- **Exportar a CSV**: botón "Exportar CSV" en cada reporte descarga un archivo
  (`GET /api/reports/[id]/export`) con métricas, desglose por persona, riesgos y
  recomendaciones, listo para abrir en Excel / Google Sheets (con BOM UTF-8).
- **Enviar por email**: botón "Enviar por email" con destinatarios (prellenados
  con quienes tienen el reporte compartido). Envía un resumen HTML + el CSV
  adjunto vía Resend y registra cada envío en `ReportDelivery`.

> El **CSV funciona sin configurar nada**. Para el **email** definí en tu `.env`
> `RESEND_API_KEY` (https://resend.com/api-keys) y `EMAIL_FROM` (dominio
> verificado en Resend). Sin eso, el botón avisa que falta la configuración.

### Airtable (implementado)

Nueva integración: mapea los registros de una tabla de Airtable a WorkItems
(estado→bucket, responsable, story points, crítico, sin movimiento). Config:
Personal Access Token + Base ID + tabla, con campos mapeables (Status / Assignee
/ Story Points por defecto). Se conecta desde `/integrations` como cualquier otra.

> ⚠️ Agregó `AIRTABLE` al enum `IntegrationType`. Corré **`npm run db:push`**.

### Sprint 6 — Multi-proyecto (implementado)

Un workspace ahora tiene varios **proyectos**, y cada proyecto tiene lo suyo:

- **Integraciones por proyecto**: cada proyecto define su propio repo de GitHub,
  proyecto de Jira, base de Airtable, etc. (permite conectar varios repos de la
  misma org — uno por proyecto). Unicidad ahora es `(projectId, type)`.
- **Reportes por proyecto**: se generan y listan para el proyecto activo; la
  tendencia compara reportes del mismo proyecto.
- **Equipo por proyecto** (`ProjectMember`): asignás qué integrantes siguen cada
  proyecto desde la página Equipos.
- **Selector de proyecto** en la barra superior (cambiar / crear proyecto). El
  proyecto activo se guarda en una cookie.

El seed crea 2 proyectos demo: **Web App** (Jira + GitHub + Slack, equipo Ana/
Bruno/Carla) y **Mobile App** (Linear + GitLab, equipo Diego/Elena).

> ⚠️ Cambios de schema (Integration.projectId, ProjectMember). Corré
> **`npm run db:push`** y luego **`npm run db:seed`**.

### Planes y billing (implementado)

- **Planes** por workspace: Free / Team / Pro (`Workspace.plan`, `billingPeriod`).
- **Límites reales (gates)**: creación de proyectos (Free/Team = 1, Pro =
  ilimitado) e integraciones permitidas (Free solo Jira + GitHub; Team/Pro todas).
- **Página Ajustes** (`/settings`): plan actual, uso vs límites (proyectos,
  usuarios, integraciones), toggle mensual/anual y cambio de plan.
- **Cambio de plan**: `POST /api/billing/change`. En dev se aplica al instante;
  cuando definís `STRIPE_SECRET_KEY` (y los price IDs) se enchufa el checkout real.

> ⚠️ Agregó `PlanTier`, `BillingPeriod` y campos en Workspace. Corré
> **`npm run db:push`** y **`npm run db:seed`**.

### Diferenciación de planes, modales y pagos (implementado)

- **3 usuarios demo** (todos pass `password123`): `test@test.com` (Pro, 2
  proyectos), `team@demo.co` (Team), `free@demo.co` (Free, solo Jira + GitHub).
  Sirven para ver las diferencias de cada plan.
- **Gates server-side** (seguridad): creación de proyectos e integraciones
  permitidas se validan en el backend según el plan, no solo en la UI.
- **Modales con estilo** (`DialogProvider`): confirmaciones, prompts y avisos
  usan modales DevMetrics en vez de los diálogos nativos. Al topar un límite
  aparece un **modal de upgrade** (Free→Team, Team→Pro) que lleva a Ajustes.
- **Pagos**: modal con **Mercado Pago** y **PayPal**. Endpoint
  `POST /api/billing/checkout` crea la preferencia (MP) u orden (PayPal) si hay
  credenciales; sin ellas, aplica el plan en modo demo.

Variables opcionales para cobro real (`.env`): `MP_ACCESS_TOKEN`,
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`.

> Este lote no cambió el schema; alcanza con **`npm run db:seed`** (si ya
> corriste el `db:push` del lote de planes).

### Todas las integraciones activas + gating por tipo (implementado)

Se activaron las que estaban "próximamente" y se sumó Discord. Todas conectan de
verdad (token/credenciales), con guía embebida:

- **Tareas/Código** (Team y Pro): Jira, GitHub, GitLab, Linear, Airtable,
  Bitbucket, Azure DevOps, ClickUp, Notion. (Free: solo Jira + GitHub.)
- **Comunicación** (solo Pro): Slack, Microsoft Teams, Discord.

El gating es por **kind** (`integrationAllowed`): Free = Jira+GitHub; Team =
ISSUES + CODE; Pro = todas, incluidas las de comunicación. Se valida en el
backend (seguridad) y en la UI (botón "Mejorar plan" con modal de upgrade).

> ⚠️ Agregó `DISCORD` al enum. Corré **`npm run db:push`**.

### Análisis con IA (solo Pro, implementado)

Nuevos proveedores de tipo **IA** (kind `AI`, solo Pro): **Claude (Anthropic),
ChatGPT (OpenAI), Gemini (Google) y GitHub Copilot/Models**. Se conectan como
cualquier integración (API key encriptada, con guía). Al **generar un reporte**,
si el plan es Pro y hay un proveedor de IA conectado en el proyecto, el motor le
manda las métricas y guarda un **"Análisis con IA"** (lectura ejecutiva, riesgos
interpretados, recomendaciones y foco) que se muestra en la preview.

- Módulo `src/lib/reports/ai.ts` (Anthropic messages / OpenAI-compatible /
  Gemini generateContent / GitHub Models).
- Gating: kind `AI` solo habilitado en Pro (backend + UI con modal de upgrade).

> ⚠️ Agregó `OPENAI`, `ANTHROPIC`, `GEMINI`, `COPILOT` al enum. Corré
> **`npm run db:push`**. La IA usa tu API key real del proveedor.

### Análisis por rol y métricas de calidad (Etapas 1–2)

- **Lectura por rol** en cada reporte: pestañas **Tech Lead / Product Owner /
  Dirección**, cada una con sus KPIs y alertas curadas.
- **Motor de alertas tempranas** (`src/lib/reports/alerts.ts`): alertas nombradas
  con nivel + significado + impacto + acción, filtradas por rol (WIP alto, PRs
  viejos/sin reviewer, checks rojos, bloqueos, sin movimiento, avance bajo,
  carry-over, caída de velocity, sobrecarga, bugs abiertos, scope creep).
- **Métricas de calidad** (derivadas de los datos existentes): bugs y **defect
  rate**, **scope creep** (tareas agregadas a mitad del período) y **listas para
  QA/demo**. Se ven en las vistas por rol, el análisis automático y el CSV.

Sin cambios de base: generá un reporte nuevo para verlas.

### Salud de CI (Etapa 3)

- **CI/pipelines** desde **GitHub Actions** y **GitLab pipelines** (usa el mismo
  token de la integración): corridas totales, fallidas, tasa de fallo y **deploys
  fallidos**.
- Se ve en la vista de Tech Lead ("CI fallando"), en el análisis automático
  ("Éxito de CI"), en el CSV, y dispara la alerta **"CI/deploys fallando"** (TL/Dir).

> El resto de la Etapa 3 (test coverage, incidentes, deuda técnica, rework)
> requiere integraciones dedicadas (Codecov/SonarQube/PagerDuty) — queda como
> Etapa 3b.

### Proactividad e IA por rol (Etapa 4)

- **Envío programado**: en Reportes, "Envío programado" define frecuencia
  (Manual/Semanal) y destinatarios (`ReportConfig`). "Enviar ahora" genera y
  manda al instante; el semanal lo dispara un scheduler externo vía
  `POST /api/cron/run` (protegido con `CRON_SECRET`) — ideal Vercel Cron/GitHub
  Actions una vez por día.
- **IA por rol**: el asistente "Preguntale al reporte" tiene pestañas Tech Lead /
  Product Owner / Dirección que enfocan la respuesta y traen sugerencias por rol.
- Se extrajo `createReportForProject` (motor reutilizable) y `deliverReportByEmail`
  (entrega + registro) para compartir lógica entre generación manual y cron.

> ⚠️ Agregó `ReportConfig.lastRunAt`. Corré **`npm run db:push`**. Variables:
> `CRON_SECRET` (cron) y las de Resend para el email.

### Perfil por persona y desempeño (Etapa 5.1)

- **Perfil por persona** (`/people/[name]`): evolución entre sprints (throughput,
  SP, bloqueos), métricas del último sprint y tendencia.
- **Clasificación en 3 niveles**: Destacada / Cumple (podría dar más) / Necesita
  apoyo — como punto de partida para conversar, con aviso explícito de que son
  proxies y no un veredicto.
- **Hipótesis de contexto** y **plan de acompañamiento 1:1** (pasos + preguntas)
  por plantilla para todos; y **análisis 1:1 con IA** en Pro (mirada humana, sin
  etiquetas definitivas).
- Los nombres en la tabla por persona del reporte y en Equipos enlazan al perfil.

### Alertas de desempeño sostenido (Etapa 5.2)

- **Señal sostenida por persona**: solo se marca cuando alguien queda en "necesita
  apoyo" en **2+ sprints consecutivos** (severidad media; 3+ → alta con evaluación
  de escalamiento). `GET /api/people/alerts`.
- Se ve en **Equipos** ("Desempeño sostenido a seguir", con conversación y próxima
  acción sugeridas) y como **banner** en el perfil de la persona.
- Mantiene el criterio: acompañar y revisar en ~14 días; escalar solo si no hay
  mejora tras acompañamiento.

### Contexto cualitativo y matriz individual (Etapas 5.3–5.4)

- **Contexto por persona** (`PersonContext`): en el perfil se cargan seniority,
  rol, participación en daily/refinamiento/retro/demo, ownership, feedback y
  notas — lo que las APIs no ven. Enriquece el análisis y la matriz.
- **Matriz individual**: en Equipos, tabla compacta + **Exportar CSV** con las 18
  columnas del framework (categoría, entrega, comunicación, participación,
  autonomía, ownership, feedback, evolución, riesgo, evidencia, causas, acción,
  objetivo, indicador, fecha de revisión). Combina lo cuantitativo (reportes) con
  lo cualitativo (contexto).

> ⚠️ Agregó el modelo `PersonContext`. Corré **`npm run db:push`**.

### Sección Reportes ejecutiva (Etapa 7)

- **Score de salud 0-100** + 5 niveles (Saludable/Estable/Observación/Alto
  riesgo/Crítico) por reporte.
- **KPIs ampliados** + **tabs por rol**, **insights automáticos**, **recomendados
  para revisar** (ponderados por rol), **búsqueda y filtros** (nivel, tendencia,
  con alertas, favoritos).
- **Tabla enriquecida**: score+nivel, tendencia vs anterior, alertas, tipo, tags,
  acciones (Ver, CSV, Favorito, Revisado, Eliminar).
- **Overview cross-proyecto** en el dashboard (salud del último reporte por
  proyecto).
- Schema: `Report.type / pinned / reviewedAt / tags`; `PATCH /api/reports/[id]`.

> ⚠️ Corré **`npm run db:push`** y **`npm run db:seed`**. Pendiente (7.4): tipos
> de reporte generables, crear tareas en Jira/Slack desde el reporte, auditoría.

### Comparación avanzada de sprints (Etapa 6)

`/reports/compare` ahora es un análisis completo A vs B:

- **Métricas con % de variación, dirección e interpretación** (mejoró/empeoró/sin
  cambio) y **tabs por rol** (Todos/TL/PO/Dirección).
- **Clasificación de tendencia** por dimensión (mejora clara/leve, sin cambio,
  deterioro leve/crítico).
- **Alertas de la comparación** (carry-over ↑, velocity ↓, cycle time ↑, PRs
  viejos ↑, bugs ↑, scope creep ↑) con impacto, acción y rol.
- **Evolución por persona S1 vs S2** con 5 categorías (destacada / estable /
  cumple / observación / riesgo) y movimiento.
- **Recomendación de planificación** (capacidad, scope, margen) derivada de ambos
  sprints.
- **Análisis comparativo con IA** (Pro) + prompt libre sobre la comparación.

> Sin cambios de base.
- Sprint 5 — Envío por email e historial.

## Stack

Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui ·
PostgreSQL · Prisma · Auth.js (NextAuth) · Resend (Sprint 5).

## Requisitos

- Node.js 18.18+ (recomendado 20 LTS).
- Una base de datos PostgreSQL (local, Supabase, Railway, Neon, etc.).

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
#   - DATABASE_URL     → tu string de conexión PostgreSQL
#   - NEXTAUTH_SECRET  → openssl rand -base64 32
#   - ENCRYPTION_KEY   → openssl rand -hex 32   (32 bytes / 64 hex chars)

# 3. Crear las tablas en la base de datos
npm run db:push
#   (o bien: npm run db:migrate  para migraciones versionadas)

# 4. Levantar en desarrollo
npm run dev
```

Abrí http://localhost:3000 → te redirige a `/login`. Registrate en `/register`,
creá tu workspace y vas a ver el dashboard con el estado vacío.

## Scripts

| Script                | Descripción                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Servidor de desarrollo                   |
| `npm run build`       | `prisma generate` + build de producción  |
| `npm start`           | Servir el build de producción            |
| `npm run typecheck`   | Chequeo de tipos con `tsc`               |
| `npm run db:push`     | Sincronizar el schema con la DB          |
| `npm run db:migrate`  | Crear/aplicar una migración              |
| `npm run db:studio`   | Prisma Studio (explorar la DB)           |

## Estructura

```
prisma/schema.prisma          Modelo de datos completo del MVP
src/
  app/
    (auth)/login|register      Pantallas públicas de autenticación
    (app)/dashboard            Dashboard (protegido)
    (app)/workspace/new        Crear workspace (protegido)
    api/auth/register          Alta de usuario
    api/auth/[...nextauth]     Handler de NextAuth
    api/workspaces             CRUD básico de workspaces
  components/ui                Componentes base (button, input, card, label)
  lib/
    auth.ts                    Config de NextAuth (credenciales + JWT)
    prisma.ts                  Cliente Prisma (singleton)
    encryption.ts              AES-256-GCM para tokens de integraciones
    validations.ts             Schemas Zod
  middleware.ts                Protección de rutas /dashboard y /workspace
```

## Notas de seguridad

- Los tokens de integraciones (Jira/GitHub/Slack) se guardan **encriptados**
  (`encryptedAccessToken` / `encryptedRefreshToken`) usando `EncryptionService`.
- Nunca se exponen credenciales al frontend: las llamadas a las APIs externas
  se harán siempre desde el servidor.
- Las contraseñas se guardan solo como hash bcrypt (nunca en texto plano).
```

## Base de datos y migraciones (producción)

En desarrollo se puede usar `npm run db:push` (sincroniza el schema sin historial).
Para **producción** usar migraciones versionadas (evita pérdida de datos y permite rollback):

1. Baseline inicial (una vez, con el schema actual):
   `npx prisma migrate dev --name init`
2. Cada cambio de schema genera una migración nueva con `npx prisma migrate dev --name <cambio>`.
3. En el deploy se aplican con:
   `npm run db:migrate:deploy`   # prisma migrate deploy

No usar `db:push` contra una base con datos reales.

## Variables de entorno

`src/lib/env.ts` valida las variables al iniciar. En producción **aborta el arranque**
si faltan `DATABASE_URL`, `NEXTAUTH_SECRET` o `ENCRYPTION_KEY`, o si quedaron los
placeholders del `.env.example`. Generar secretos reales:
`openssl rand -base64 32` (NEXTAUTH_SECRET) y `openssl rand -hex 32` (ENCRYPTION_KEY).

`ALLOW_DEV_PLAN_CHANGE` solo debe usarse en desarrollo: habilita aplicar upgrades de
plan sin pago. En producción los upgrades pagos solo se aplican vía el proveedor de pago.

## Tests

`npm test` (Vitest). Cubre los motores de cálculo: `scoreWithStandard`, umbrales,
pesos, `levelOf` y la encripción AES-256-GCM.
