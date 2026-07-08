# DevMetrics

> Reportes de ingeniería claros, en un clic.

DevMetrics es un SaaS B2B que conecta **Jira** y **GitHub** y genera automáticamente un **reporte semanal** del avance del equipo: tareas, Pull Requests, bloqueos, riesgos y recomendaciones. Elimina el trabajo manual de armar el status semanal y les da a TLs, POs y Engineering Managers una foto objetiva y accionable del equipo.

> Nombre interno del repositorio: `weekly-dev-team-report`.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Características principales](#características-principales)
- [Demo o preview](#demo-o-preview)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Uso del proyecto](#uso-del-proyecto)
- [Testing](#testing)
- [Calidad de código](#calidad-de-código)
- [Git workflow](#git-workflow)
- [Pull Requests](#pull-requests)
- [Deploy](#deploy)
- [Roadmap](#roadmap)
- [Contribución](#contribución)
- [Troubleshooting](#troubleshooting)
- [Seguridad](#seguridad)
- [Licencia](#licencia)
- [Autor o equipo](#autor-o-equipo)
- [Agradecimientos y referencias](#agradecimientos-y-referencias)
- [Checklist de README](#checklist-de-readme)

---

## Descripción general

Armar el reporte semanal de un equipo de desarrollo es tedioso y subjetivo: hay que revisar el board de Jira, mirar los PRs de GitHub, cruzar quién está bloqueado y traducir todo a un resumen para stakeholders. DevMetrics automatiza ese flujo.

- **Qué problema resuelve:** reemplaza el armado manual del status semanal por un reporte generado a partir de datos reales de Jira y GitHub.
- **Para quién está pensado:** Tech Leads, Product Owners, Engineering Managers y Delivery Managers que necesitan visibilidad recurrente del equipo.
- **Qué valor aporta:** métricas objetivas (avance de tareas, throughput de PRs, tareas críticas o sin movimiento, PRs viejos o sin reviewer), detección temprana de riesgos y bloqueos, y comparación semana a semana — todo en un panel único y exportable.

Estado actual: **MVP en desarrollo activo** (scaffold + Sprints 1–3 implementados: auth, workspaces, integración Jira, integración GitHub, motor de reportes, planes/billing y envíos programados).

---

## Características principales

**Implementado**

- Registro, login/logout y sesión con NextAuth (estrategia JWT); contraseñas hasheadas con bcrypt.
- Multi-tenant por **workspace** con roles (owner / admin / member) y protección de rutas privadas vía middleware.
- Conexión a **Jira Cloud** (dominio, email, API token, project key) con token guardado **encriptado** (AES-256-GCM) y botón "Probar conexión".
- Conexión a **GitHub** (owner, repo, PAT) con token encriptado; traído y clasificación de Pull Requests (viejos >72h, sin reviewer, checks fallando, en riesgo).
- Clasificación automática de issues de Jira (finalizada / en progreso / bloqueada / por hacer, críticas y sin movimiento).
- **Motor de reportes semanales** con métricas, health status, estándares configurables, alertas y comparación entre reportes.
- Notas por reporte, compartir reportes, exportación (CSV / PDF) y envío por email (Resend).
- Vistas por persona y matriz de equipo; dashboard con estado vacío guiado (onboarding).
- Planes **Free / Team / Pro** con límites por plan y flujo de billing.
- Envíos programados vía endpoint de cron protegido (`POST /api/cron/run`).

**Futuro** (ver [Roadmap](#roadmap))

- Integraciones adicionales del catálogo (GitLab, Bitbucket, Azure DevOps, Linear, ClickUp, Notion, Slack, Teams, etc.).
- Resumen y recomendaciones asistidas por IA sobre el reporte.

---

## Demo o preview

`Demo próximamente.`

- Demo online: `[COMPLETAR]`
- Capturas / video: `[COMPLETAR]`

Para probar en local con datos de ejemplo, ver [Uso del proyecto](#uso-del-proyecto) (incluye seed de usuarios y proyectos demo).

---

## Tecnologías utilizadas

### Frontend

| Tecnología | Uso |
|---|---|
| Next.js 14 (App Router) | Framework fullstack, rendering en servidor y routing por carpetas. |
| React 18 + TypeScript | UI tipada y componible. |
| Tailwind CSS | Estilos utility-first; `tailwind-merge` + `cva` + `clsx` para variantes. |
| Radix UI (`react-slot`, `react-label`) | Primitivas accesibles de UI. |
| lucide-react | Set de íconos. |
| Recharts | Gráficos de métricas en el dashboard y reportes. |

### Backend

| Tecnología | Uso |
|---|---|
| Next.js Route Handlers (`src/app/api`) | API interna (~39 endpoints). |
| NextAuth (Auth.js) v4 | Autenticación con estrategia JWT. |
| Zod | Validación de inputs y payloads. |
| bcryptjs | Hash de contraseñas. |
| AES-256-GCM (`EncryptionService`) | Cifrado en reposo de los tokens de integraciones. |

### Base de datos

| Tecnología | Uso |
|---|---|
| PostgreSQL | Persistencia principal. |
| Prisma ORM 5 | Schema, migraciones y cliente tipado. |

### Testing

| Tecnología | Uso |
|---|---|
| Vitest | Tests unitarios de la capa de lógica pura. |
| @vitest/coverage-v8 | Cobertura con umbrales (statements/functions/lines 100%, branches 95%). |

### DevOps / Deploy

| Tecnología | Uso |
|---|---|
| GitHub Actions | CI: typecheck, lint, tests con coverage y build. |
| Vercel *(sugerido)* | Deploy recomendado para Next.js. `[COMPLETAR: confirmar plataforma]` |

### Integraciones externas

| Servicio | Uso |
|---|---|
| Jira Cloud (REST) | Fuente de issues del equipo. |
| GitHub (REST) | Fuente de Pull Requests. |
| Resend | Envío de reportes por email. |

---

## Arquitectura del proyecto

Aplicación **fullstack con Next.js App Router**. La UI y las páginas viven en `src/app`, la API en `src/app/api`, y toda la **lógica de dominio** está aislada en `src/lib` (testeable sin framework). Las páginas usan **route groups**: `(auth)` para login/registro y `(app)` para el producto autenticado.

```text
weekly-dev-team-report/
├── prisma/
│   ├── schema.prisma          # Modelos: User, Workspace, Integration, Report, etc.
│   └── seed.mjs               # Datos demo (usuarios, proyectos, integraciones)
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login y registro (layout público)
│   │   ├── (app)/             # Producto autenticado (dashboard, reports, projects…)
│   │   ├── api/               # Route handlers (auth, integrations, reports, billing, cron…)
│   │   ├── layout.tsx         # Layout raíz
│   │   └── globals.css
│   ├── components/            # UI reutilizable (ui/, charts/, marketing/)
│   ├── lib/                   # Lógica de dominio y servicios
│   │   ├── github/            # Cliente y clasificación de PRs
│   │   ├── jira/              # Cliente y clasificación de issues
│   │   ├── integrations/      # Registry, catálogo y providers
│   │   ├── reports/           # Score, estándares, comparación, matriz, health
│   │   ├── auth.ts            # Config de NextAuth
│   │   ├── encryption.ts      # AES-256-GCM para tokens
│   │   ├── prisma.ts          # Cliente Prisma singleton
│   │   └── permissions.ts     # Autorización por rol/plan
│   └── types/
├── .github/workflows/ci.yml   # Pipeline de CI
├── next.config.mjs
├── vitest.config.ts
└── package.json
```

Responsabilidades clave:

- **`src/app/(app)`** — pantallas del producto; server components que consumen `src/lib` y la API.
- **`src/app/api`** — endpoints REST internos; validan con Zod y aplican permisos.
- **`src/lib`** — corazón de negocio (reportes, integraciones, permisos, cifrado). Sin dependencias de React → testeable en aislamiento.
- **`prisma`** — modelo de datos único para todo el MVP, pensado para no requerir migraciones estructurales grandes por sprint.

---

## Requisitos previos

| Herramienta | Versión recomendada |
|---|---|
| Node.js | 20 LTS (CI corre en Node 20) |
| npm | 10+ (el proyecto usa `package-lock.json`) |
| PostgreSQL | 14+ en local o instancia gestionada |

Servicios / credenciales externas (según features que quieras usar):

- **PostgreSQL** accesible vía `DATABASE_URL`.
- **Jira Cloud** API token para conectar Jira (crear en `https://id.atlassian.com/manage-profile/security/api-tokens`).
- **GitHub** Personal Access Token (fine-grained o clásico con scope `repo` / lectura de PRs).
- **Resend** API key + dominio verificado, solo si vas a enviar reportes por email.

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/bmentasti/weekly-dev-team-report.git
cd weekly-dev-team-report

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# editá .env con tus valores (ver tabla más abajo)

# 4. Preparar la base de datos
npm run db:generate      # genera el cliente Prisma
npm run db:push          # crea el schema en la base
npm run db:seed          # (opcional) carga datos demo

# 5. Levantar en desarrollo
npm run dev
```

La app queda disponible en `http://localhost:3000`.

---

## Variables de entorno

Definidas en `.env` (partí de `.env.example`). **No commitees valores reales.**

| Variable | Descripción | Ejemplo | Obligatoria |
|---|---|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. | `postgresql://user:password@localhost:5432/weekly_dev_report?schema=public` | Sí |
| `NEXTAUTH_SECRET` | Secreto para firmar sesiones JWT. Generar con `openssl rand -base64 32`. | `k3y...==` | Sí |
| `NEXTAUTH_URL` | URL base de la app. | `http://localhost:3000` | Sí |
| `ENCRYPTION_KEY` | Clave AES-256-GCM (32 bytes / 64 hex) para cifrar tokens de integraciones. `openssl rand -hex 32`. | `a1b2...` (64 hex) | Sí |
| `RESEND_API_KEY` | API key de Resend para enviar reportes por email. | `re_...` | No (solo email) |
| `EMAIL_FROM` | Remitente; debe ser un dominio verificado en Resend. | `reportes@tudominio.com` | No (solo email) |
| `CRON_SECRET` | Secreto que protege `POST /api/cron/run` (envíos programados). | `un-secreto-largo` | No |
| `MP_ACCESS_TOKEN` | Token de Mercado Pago para checkout real. | `APP_USR-...` | No |
| `PAYPAL_CLIENT_ID` | Client ID de PayPal para checkout real. | `Ax...` | No |
| `PAYPAL_CLIENT_SECRET` | Client secret de PayPal. | `EL...` | No |
| `PAYPAL_ENV` | Entorno de PayPal. | `sandbox` \| `live` | No |
| `ALLOW_DEV_PLAN_CHANGE` | Solo desarrollo: permite cambiar de plan sin pago real. **Nunca en producción.** | `true` | No |

---

## Scripts disponibles

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `npm run dev` | Levanta el servidor de desarrollo (Next.js) en `:3000`. |
| `build` | `npm run build` | Genera el cliente Prisma y compila la app para producción. |
| `start` | `npm run start` | Sirve el build de producción. |
| `lint` | `npm run lint` | Ejecuta ESLint (config de Next.js). |
| `typecheck` | `npm run typecheck` | Verifica tipos con `tsc --noEmit`. |
| `test` | `npm run test` | Corre los tests unitarios (Vitest). |
| `test:watch` | `npm run test:watch` | Tests en modo watch. |
| `test:coverage` | `npm run test:coverage` | Tests + reporte de cobertura. |
| `db:generate` | `npm run db:generate` | Genera el cliente Prisma. |
| `db:push` | `npm run db:push` | Sincroniza el schema con la base (sin migraciones). |
| `db:migrate` | `npm run db:migrate` | Crea/aplica migraciones en desarrollo. |
| `db:migrate:deploy` | `npm run db:migrate:deploy` | Aplica migraciones en entornos gestionados. |
| `db:seed` | `npm run db:seed` | Carga datos demo. |
| `db:studio` | `npm run db:studio` | Abre Prisma Studio. |

> Nota: aún no hay script `format` (Prettier) ni hooks de pre-commit configurados. Ver [Roadmap](#roadmap).

---

## Uso del proyecto

Flujo principal end-to-end:

1. Abrí `http://localhost:3000` → te redirige a `/login`.
2. Registrate en `/register` (nombre, email, contraseña, empresa, rol) y creá tu **workspace**.
3. En `/integrations` conectá **Jira** y/o **GitHub**:
   - Jira: dominio, email, API token y project key → "Probar conexión" → guardar.
   - GitHub: owner, repo y PAT → "Probar conexión" → guardar.
4. Generá un reporte desde `/reports`; revisá métricas, tareas críticas, PRs en riesgo y comparación semanal.
5. Compartí, exportá (CSV/PDF) o enviá por email el reporte.

Con `npm run db:seed` se cargan **usuarios demo** (contraseña `password123`) y proyectos de ejemplo para explorar la app sin conectar herramientas reales.

Ejemplos de endpoints de la API interna:

```http
POST /api/integrations/jira/test        # valida credenciales de Jira
POST /api/integrations/jira/connect     # guarda la integración (token cifrado)
GET  /api/integrations/github/data      # trae PRs clasificados
POST /api/reports/generate              # genera un reporte
POST /api/cron/run                      # dispara envíos programados (requiere CRON_SECRET)
```

```jsonc
// POST /api/integrations/jira/test — request
{ "domain": "acme.atlassian.net", "email": "me@acme.com", "apiToken": "***", "projectKey": "ENG" }

// respuesta (ok)
{ "ok": true, "project": { "key": "ENG", "name": "Engineering" } }
```

---

## Testing

El proyecto usa **Vitest** para tests unitarios sobre la **capa de lógica pura** (`src/lib`), donde vive el negocio: cálculo de score, estándares, comparación de reportes, matriz de equipo, health, permisos, planes, validaciones y cifrado.

```bash
npm run test            # corre todos los tests
npm run test:watch      # modo watch
npm run test:coverage   # tests + cobertura (HTML en coverage/, texto en consola)
```

Alcance y estrategia:

- **Unitarios:** lógica pura de `src/lib` (sin React/Prisma/next). Es lo que se mide en coverage.
- **Integración / E2E:** UI, páginas RSC y rutas de API se validan por fuera del unit coverage (requieren mockear el framework), para no inflar la métrica con casos poco útiles.
- **Umbrales de cobertura (CI falla si no se cumplen):** statements 100%, functions 100%, lines 100%, branches 95%.

---

## Calidad de código

- **ESLint** (`eslint-config-next`): `npm run lint`.
- **TypeScript** estricto: `npm run typecheck`.
- **Vitest + coverage** con umbrales exigidos en CI.
- **CI (GitHub Actions)** corre en cada push a `main` y en cada PR: `typecheck` → `lint` → `test:coverage` → `build`.

Reglas mínimas para mantener calidad:

- No romper tipos ni lint (CI bloquea el merge).
- Mantener o subir la cobertura; agregá tests para la lógica nueva en `src/lib`.
- Validá todos los inputs de API con Zod.

Antes de abrir un PR, corré localmente:

```bash
npm run typecheck && npm run lint && npm run test:coverage && npm run build
```

> Pendiente de incorporar: Prettier y hooks de pre-commit (Husky + lint-staged).

---

## Git workflow

Estrategia de ramas recomendada:

| Rama | Propósito |
|---|---|
| `main` | Rama estable / integración. CI corre en cada push y PR. |
| `develop` *(opcional)* | Integración previa a `main` si el equipo lo adopta. |
| `feature/*` | Nuevas funcionalidades. |
| `bugfix/*` | Corrección de bugs no urgentes. |
| `hotfix/*` | Correcciones urgentes sobre producción. |

Nomenclatura de ramas: `tipo/descripcion-corta-en-kebab-case`, p. ej. `feature/report-comparison`, `bugfix/jira-token-refresh`.

Commits con **Conventional Commits**:

```text
tipo(scope opcional): descripción breve en imperativo

# ejemplos
feat(reports): agrega comparación semana a semana
fix(integrations): corrige validación de token de Jira
chore(ci): actualiza Node a 20
```

Tipos comunes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`.

Flujo recomendado: creá una rama desde `main` → hacé commits pequeños → abrí un PR → pasá CI y review → merge (squash sugerido).

---

## Pull Requests

Checklist antes de abrir un PR:

- [ ] El código compila (`npm run build`).
- [ ] Los tests pasan (`npm run test`).
- [ ] Sin errores de lint (`npm run lint`) ni de tipos (`npm run typecheck`).
- [ ] Se actualizó la documentación si corresponde.
- [ ] Se agregaron/actualizaron tests para la lógica nueva.
- [ ] Se validó manualmente la funcionalidad.
- [ ] No se commitearon secretos ni archivos `.env`.

---

## Deploy

Ambientes:

| Ambiente | Descripción |
|---|---|
| Local | `npm run dev` en `http://localhost:3000`. |
| Development | `[COMPLETAR: URL/entorno]` |
| Staging | `[COMPLETAR: URL/entorno]` |
| Production | `[COMPLETAR: URL/entorno]` |

Pasos generales de deploy (build de producción):

```bash
npm ci
npm run db:migrate:deploy     # aplica migraciones
npm run build                 # prisma generate + next build
npm run start                 # sirve el build
```

Recomendaciones de deploy:

- Plataforma sugerida: **Vercel** (nativa para Next.js) o un contenedor con Node 20. `[COMPLETAR: confirmar plataforma real]`
- Configurar todas las variables de entorno obligatorias en el proveedor.
- Programar `POST /api/cron/run` (con `CRON_SECRET`) mediante Vercel Cron o GitHub Actions para los envíos semanales.

---

## Roadmap

**Corto plazo**

- Agregar Prettier + Husky + lint-staged.
- Tests de integración/E2E para rutas de API y páginas.

**Mediano plazo**

- Habilitar más providers del catálogo (GitLab, Bitbucket, Azure DevOps, Linear, ClickUp, Notion).
- Notificaciones a Slack / Teams / Discord.

**Largo plazo**

- Resumen y recomendaciones asistidas por IA sobre cada reporte.
- Métricas históricas y tendencias multi-equipo.

---

## Contribución

1. Hacé un fork o pedí acceso al repo.
2. Creá una rama desde `main`: `git checkout -b feature/mi-cambio`.
3. Hacé tus cambios siguiendo el estilo del proyecto (TypeScript tipado, validación con Zod, lógica en `src/lib`).
4. Corré las validaciones: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`.
5. Commiteá con Conventional Commits y abrí un PR completando el [checklist](#pull-requests).

Toda contribución pasa por review y debe pasar CI antes del merge.

---

## Troubleshooting

| Problema | Causa probable | Solución |
|---|---|---|
| `npm install` falla | Versión de Node incompatible / caché corrupta | Usá Node 20 LTS; borrá `node_modules` y `package-lock.json` y reinstalá. |
| `Port 3000 is already in use` | Otro proceso usa el puerto | Cerralo o corré `PORT=3001 npm run dev`. |
| `Environment variable not found: DATABASE_URL` | Falta `.env` o la variable | `cp .env.example .env` y completá los valores. |
| Errores de Prisma / cliente desactualizado | No se generó el cliente | Corré `npm run db:generate`. |
| No conecta a la base | `DATABASE_URL` incorrecta o Postgres apagado | Verificá credenciales, host/puerto y que el servicio esté arriba. |
| Falla la conexión a Jira/GitHub | Token inválido o sin permisos | Regenerá el token con los scopes correctos y usá "Probar conexión". |
| Login falla / sesión inválida | Falta `NEXTAUTH_SECRET` o `NEXTAUTH_URL` | Definí ambas variables y reiniciá el server. |
| Error al descifrar tokens | `ENCRYPTION_KEY` cambiada o mal formada | Debe ser 64 caracteres hex (32 bytes) y estable entre entornos. |

---

## Seguridad

- **Nunca** commitees secretos: `.env` y `.env*.local` están en `.gitignore`. Usá `.env.example` como plantilla.
- Los tokens de integraciones se guardan **cifrados** con AES-256-GCM (`ENCRYPTION_KEY`).
- Usá tokens con el **mínimo privilegio** (p. ej. GitHub PAT de solo lectura de PRs).
- Revisá dependencias vulnerables periódicamente: `npm audit`.
- Rotá `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` y los tokens ante cualquier sospecha de exposición.
- Reportá vulnerabilidades de forma **privada** al equipo (no abras un issue público): `[COMPLETAR: email/canal de seguridad]`.

---

## Licencia

`Licencia pendiente de definir.` `[COMPLETAR]`

---

## Autor o equipo

- **Autor:** Bruno Mentasti
- GitHub: https://github.com/bmentasti
- LinkedIn: `[COMPLETAR]`
- Portfolio / web: `[COMPLETAR]`
- Contacto: `[COMPLETAR]`

---

## Agradecimientos y referencias

- [Next.js](https://nextjs.org/docs) · [Prisma](https://www.prisma.io/docs) · [NextAuth / Auth.js](https://authjs.dev)
- [Jira Cloud REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/) · [GitHub REST API](https://docs.github.com/rest)
- [Vitest](https://vitest.dev) · [Tailwind CSS](https://tailwindcss.com) · [Resend](https://resend.com/docs)

---

## Checklist de README

Revisá antes de subir al repositorio:

- [ ] El **nombre** y la descripción reflejan el proyecto real.
- [ ] La **tabla de contenidos** enlaza correctamente a cada sección.
- [ ] Las **tecnologías** listadas coinciden con `package.json`.
- [ ] Los **requisitos previos** (Node, DB, tokens) están completos.
- [ ] Los pasos de **instalación** funcionan en una máquina limpia.
- [ ] Todas las **variables de entorno** están documentadas y marcadas como obligatorias/opcionales.
- [ ] Los **scripts** coinciden con los de `package.json`.
- [ ] Hay ejemplos reales de **uso** (endpoints/pantallas).
- [ ] Está claro cómo correr **tests** y ver coverage.
- [ ] El **git workflow** y el checklist de **PR** están definidos.
- [ ] La sección de **deploy** tiene los ambientes/plataforma completos.
- [ ] Se completaron los placeholders `[COMPLETAR]` (demo, deploy, licencia, contacto, seguridad).
- [ ] No hay **secretos** ni datos sensibles en el README.
- [ ] Los **links** externos e internos funcionan.
