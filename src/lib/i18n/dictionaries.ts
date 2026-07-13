// i18n — diccionarios ES/EN. Claves con namespace por área.
// Para migrar una pantalla: agregá sus claves acá (o en el módulo de dict/ de
// tu área) y usá t("clave") en el JSX.
import type { Locale } from "./config";
import * as reports from "./dict/reports";
import * as reports2 from "./dict/reports2";
import * as workspace from "./dict/workspace";
import * as misc from "./dict/misc";
import * as lib from "./dict/lib";
import * as faq from "./dict/faq";
import * as gen from "./dict/gen";
import * as exp from "./dict/exp";

export type Dict = Record<string, string>;

const es: Dict = {
  // Navegación
  "nav.overview": "Overview",
  "nav.projects": "Proyectos",
  "nav.reports": "Reportes",
  "nav.intelligence": "Inteligencia",
  "nav.integrations": "Integraciones",
  "nav.teams": "Equipos",
  "nav.settings": "Ajustes",
  "nav.help": "Ayuda",
  "shell.logout": "Salir",
  "toggle.theme.toDark": "Activar modo oscuro",
  "toggle.theme.toLight": "Activar modo claro",
  "toggle.lang": "Cambiar idioma",
  // Dashboard
  "dash.subtitle": "Overview del proyecto — integraciones, equipo y reportes.",
  "dash.coverage": "Cobertura",
  "dash.dimsWithData": "Dimensiones con datos",
  "dash.activeIntegrations": "Integraciones activas",
  "dash.viewIntelligence": "Ver inteligencia completa",
  // Inteligencia
  "intel.title": "Inteligencia",
  "intel.subtitle":
    "Cobertura, salud y recomendaciones. Cada conclusión se calcula solo con las fuentes realmente conectadas; lo que falta se marca y se recomienda qué integrar.",
  "intel.emptyTitle": "Todavía no hay integraciones conectadas",
  "intel.emptyDesc":
    "Conectá tus herramientas en Integraciones para empezar a construir cobertura. Con cada fuente, más dimensiones se habilitan.",
  "intel.tab.overview": "Overview",
  "intel.tab.coverage": "Cobertura",
  "intel.tab.recommendations": "Recomendaciones",
  "intel.tab.conflicts": "Conflictos",
  "intel.healthMapTitle": "Mapa de salud del proyecto",
  "intel.sectionsTitle": "Estado de las secciones del informe",
  "intel.sectionsSubtitle":
    "El informe se adapta a lo conectado: las secciones sin datos no generan conclusiones.",
  "intel.recsEmptyTitle": "Sin recomendaciones por ahora",
  "intel.recsEmptyDesc":
    "Conectá más herramientas para recibir recomendaciones accionables.",
  "intel.conflictsEmptyTitle": "No hay contradicciones detectadas",
  "intel.conflictsEmptyDesc":
    "La detección de conflictos cruza tareas, código, deploys e incidentes. Requiere ingesta de datos correlacionados o más fuentes conectadas.",
  "intel.coverageGlobal": "Cobertura de datos global",
  "intel.dimensions": "dimensiones",
  "intel.integrations": "integraciones",
  // Auth
  "auth.welcome": "Bienvenido/a",
  "auth.loginSubtitle": "Iniciá sesión en tu cuenta de DevMetrics para continuar",
  "auth.badCredentials": "Email o contraseña incorrectos.",
  "auth.workEmail": "Email de trabajo",
  "auth.emailPlaceholder": "vos@empresa.com",
  "auth.password": "Contraseña",
  "auth.forgotPassword": "¿Olvidaste tu contraseña?",
  "auth.forgot.title": "Recuperar contraseña",
  "auth.forgot.subtitle": "Ingresá tu email y te enviamos un enlace para restablecerla",
  "auth.forgot.submit": "Enviar enlace",
  "auth.forgot.sending": "Enviando...",
  "auth.forgot.done": "Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.",
  "auth.backToLogin": "Volver a iniciar sesión",
  "auth.reset.title": "Nueva contraseña",
  "auth.reset.subtitle": "Elegí una contraseña nueva para tu cuenta",
  "auth.reset.newPassword": "Nueva contraseña (mínimo 8 caracteres)",
  "auth.reset.submit": "Guardar contraseña",
  "auth.reset.saving": "Guardando...",
  "auth.reset.success": "Contraseña actualizada. Ya podés iniciar sesión.",
  "auth.reset.missingToken": "Falta el token: abrí el enlace que te llegó por email.",
  "auth.reset.error": "No se pudo restablecer la contraseña.",
  "auth.loggingIn": "Ingresando...",
  "auth.login": "Iniciar sesión",
  "auth.noAccount": "¿No tenés cuenta?",
  "auth.register": "Registrate",
  "auth.createAccount": "Creá tu cuenta",
  "auth.registerSubtitle": "Empezá a generar reportes de tu equipo en minutos",
  "auth.name": "Nombre y apellido",
  "auth.namePlaceholder": "Ana García",
  "auth.company": "Empresa",
  "auth.companyPlaceholder": "Tu empresa",
  "auth.role": "Rol",
  "auth.creating": "Creando cuenta...",
  "auth.signUp": "Crear cuenta",
  "auth.haveAccount": "¿Ya tenés cuenta?",
  "auth.goLogin": "Iniciá sesión",
  "auth.registerError": "No se pudo crear la cuenta.",
  "auth.brandTitle": "Convertí los datos de ingeniería en decisiones",
  "auth.brandDesc":
    "Reportes en tiempo real de Jira, GitHub y más para entregar con confianza y sin armar nada a mano.",
  "auth.security": "Seguridad enterprise",
  "auth.securityDesc": "Tus datos están encriptados y nunca se comparten.",
  // Landing (marketing)
  "m.nav.product": "Producto",
  "m.nav.reports": "Reportes",
  "m.nav.team": "Para tu equipo",
  "m.nav.integrations": "Integraciones",
  "m.nav.pricing": "Precios",
  "m.nav.help": "Ayuda",
  "m.nav.goDashboard": "Ir al dashboard",
  "m.nav.login": "Iniciar sesión",
  "m.nav.tryFree": "Probar gratis",
  "m.hero.badge": "Engineering Intelligence",
  "m.hero.titlePrefix": "Reportes claros para",
  "m.hero.desc":
    "Conectá Jira, GitHub, Slack y +10 herramientas, y obtené reportes ejecutivos sobre sprints, delivery, calidad, riesgos y equipo. Sin armar planillas, sin perder contexto.",
  "m.cta.howItWorks": "Ver cómo funciona",
  "m.hero.freeLine": "Gratis para siempre · Sin tarjeta · Usuarios ilimitados",
  "m.social.worksWith": "Pensado para equipos que ya trabajan con",
  "m.problem.kicker": "El problema",
  "m.problem.title": "Tus herramientas tienen los datos. Vos necesitás la historia.",
  "m.problem.desc":
    "Jira muestra tareas, GitHub muestra PRs, Slack tiene la conversación — pero nadie los junta. El estado del proyecto termina armándose a mano, tarde y sin claridad.",
  "m.solution.kicker": "La solución",
  "m.solution.title": "Conectá, generá y decidí — en tres pasos",
  "m.solution.desc":
    "DevMetrics no reemplaza a Jira, GitHub ni Slack. Los conecta y transforma sus datos en información lista para actuar.",
  "m.step": "Paso",
  "m.integ.title": "Tus herramientas siguen igual. La claridad aparece en un solo lugar.",
  "m.integ.desc":
    "DevMetrics toma datos de tus fuentes y los convierte en reportes listos para TLs, POs y Dirección.",
  "m.reports.kicker": "Reportes",
  "m.reports.title": "Un reporte para cada pregunta que te hacen",
  "m.reports.desc":
    "De sprint, comparativos, de riesgo, ejecutivos, de calidad técnica o de performance. Claros, compartibles y exportables.",
  "m.reports.illustrative":
    "Vistas ilustrativas del producto. Datos de ejemplo. Pasá el mouse para pausar.",
  "m.roles.title": "Un producto, una lectura para cada rol",
  "m.roles.desc": "La misma data, leída según lo que cada quien necesita resolver.",
  "m.metrics.title": "No solo números: interpretación y acciones",
  "m.metrics.desc":
    "DevMetrics analiza decenas de métricas y te dice qué significan y qué hacer, no solo las grafica.",
  "m.alerts.title": "Seguro por diseño, bajo tu control",
  "m.trust.title": "Seguro por diseño, bajo tu control",
  "m.trust.desc":
    "Tus datos, tus reglas. DevMetrics lee lo mínimo necesario y nunca decide por vos.",
  "m.tryfree.title": "Probá gratis y generá tu primer reporte en minutos",
  "m.tryfree.desc":
    "Sin planillas. Sin reportes manuales. Sin perder contexto. Conectá una herramienta y empezá a ver claridad desde el primer sprint.",
  "m.tryfree.cta": "Generar mi primer reporte",
  "m.tryfree.free": "Gratis para siempre · Sin tarjeta · Jira + GitHub en vivo",
  "m.help.kicker": "Centro de Ayuda",
  "m.help.desc":
    "Reunimos las preguntas más frecuentes sobre qué es, integraciones, reportes, métricas, seguridad y planes. Buscá por tema o filtrá por tu rol.",
  "m.help.cta": "Ir al Centro de Ayuda",
  "m.help.notFound": "¿No encontrás lo que buscás?",
  "m.help.writeUs": "Escribinos",
  "m.contact.title": "Hablemos",
  "m.contact.desc":
    "¿Querés una demo o tenés dudas sobre si DevMetrics encaja con tu equipo? Escribinos y te respondemos.",
  "m.close.desc":
    "Herramientas conectadas, reportes en un click y una lectura para cada rol. Menos tiempo armando informes, más tiempo decidiendo.",
  "m.close.cta1": "Empezar gratis",
  "m.close.cta2": "Hablar con nosotros",
  "m.footer.tagline": "Engineering intelligence para líderes de producto y tecnología.",
  "m.footer.copyright": "Tus datos están encriptados y nunca se comparten.",
  "m.stats.l1": "métricas analizadas por reporte",
  "m.stats.l2": "integraciones en vivo + IA",
  "m.stats.l3": "del dato disperso al informe listo",
  "m.al.badge": "Alertas inteligentes",
  "m.al.title": "Detectá riesgos antes de que sea tarde",
  "m.al.desc":
    "DevMetrics levanta señales tempranas y te dice a quién le toca y qué hacer. Cada alerta llega con severidad, rol responsable y acción recomendada.",
  "m.al.cta": "Ver reporte de riesgo",
  "m.al.required": "Requiere acción",
  "m.al.count": "5 alertas",
  "m.al.action": "Acción:",
  "m.cmp.title": "Compará dos sprints en segundos",
  "m.cmp.desc":
    "Dejá de comparar sprints a mano. Detectá qué mejoró, qué empeoró, qué se mantuvo y qué riesgos se repiten.",
  "m.cmp.metric": "Métrica",
  "m.cmp.var": "Var.",
  "m.cmp.conclusionLabel": "Conclusión:",
  "m.cmp.conclusion":
    "el equipo mejoró velocity y calidad, pero el tiempo de review subió 50%. Sugerencia: sumar reviewers y achicar PRs.",
  "m.oc.title": "Del dato disperso al reporte listo, en un click",
  "m.oc.desc":
    "Elegí proyecto, período y tipo de reporte. Hacé click y recibí un informe listo para revisar, compartir o exportar.",
  "m.uc.title": "Listo para cada momento del equipo",
  "m.uc.desc": "El reporte correcto para la conversación que tenés que tener.",
  "m.uc.generates": "Genera:",
  "m.footer.product": "Producto",
  "m.footer.plans": "Planes",
  "m.footer.resources": "Recursos",
  "m.footer.company": "Empresa",
  // Mockups ilustrativos
  "m.mock.weeklyReport": "Reporte semanal — Frontend",
  "m.mock.mediumRisk": "Riesgo medio",
  "m.mock.done": "Finalizadas",
  "m.mock.prMerged": "PR merg.",
  "m.mock.blocked": "Bloqueadas",
  "m.mock.prOpen": "PR abiertos",
  "m.mock.velocity6": "Velocity (últimos 6 sprints)",
  "m.mock.generate": "Generar reporte",
  "m.mock.healthScore": "Score de salud",
  "m.mock.riskDetected": "Riesgo detectado",
  "m.mock.riskDetail": "3 PRs abiertos hace +72h sin reviewer.",
  "m.mock.reportGenerated": "Reporte generado — Sprint 24",
  "m.mock.ready": "Listo",
  "m.mock.progress": "Avance",
  "m.mock.health": "Salud",
  "m.mock.viewReport": "Ver reporte",
  "m.mock.compareSprints": "Comparar sprints",
  "m.mock.exportPdf": "Exportar PDF",
};

const en: Dict = {
  // Navigation
  "nav.overview": "Overview",
  "nav.projects": "Projects",
  "nav.reports": "Reports",
  "nav.intelligence": "Intelligence",
  "nav.integrations": "Integrations",
  "nav.teams": "Teams",
  "nav.settings": "Settings",
  "nav.help": "Help",
  "shell.logout": "Log out",
  "toggle.theme.toDark": "Switch to dark mode",
  "toggle.theme.toLight": "Switch to light mode",
  "toggle.lang": "Change language",
  // Dashboard
  "dash.subtitle": "Project overview — integrations, team and reports.",
  "dash.coverage": "Coverage",
  "dash.dimsWithData": "Dimensions with data",
  "dash.activeIntegrations": "Active integrations",
  "dash.viewIntelligence": "View full intelligence",
  // Intelligence
  "intel.title": "Intelligence",
  "intel.subtitle":
    "Coverage, health and recommendations. Every conclusion is computed only from the sources actually connected; what's missing is flagged with a suggestion of what to connect.",
  "intel.emptyTitle": "No integrations connected yet",
  "intel.emptyDesc":
    "Connect your tools in Integrations to start building coverage. Each source unlocks more dimensions.",
  "intel.tab.overview": "Overview",
  "intel.tab.coverage": "Coverage",
  "intel.tab.recommendations": "Recommendations",
  "intel.tab.conflicts": "Conflicts",
  "intel.healthMapTitle": "Project health map",
  "intel.sectionsTitle": "Report section status",
  "intel.sectionsSubtitle":
    "The report adapts to what's connected: sections without data don't produce conclusions.",
  "intel.recsEmptyTitle": "No recommendations right now",
  "intel.recsEmptyDesc": "Connect more tools to receive actionable recommendations.",
  "intel.conflictsEmptyTitle": "No contradictions detected",
  "intel.conflictsEmptyDesc":
    "Conflict detection cross-references tasks, code, deploys and incidents. It needs correlated data ingestion or more connected sources.",
  "intel.coverageGlobal": "Global data coverage",
  "intel.dimensions": "dimensions",
  "intel.integrations": "integrations",
  // Auth
  "auth.welcome": "Welcome",
  "auth.loginSubtitle": "Sign in to your DevMetrics account to continue",
  "auth.badCredentials": "Incorrect email or password.",
  "auth.workEmail": "Work email",
  "auth.emailPlaceholder": "you@company.com",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot your password?",
  "auth.forgot.title": "Recover password",
  "auth.forgot.subtitle": "Enter your email and we'll send you a reset link",
  "auth.forgot.submit": "Send link",
  "auth.forgot.sending": "Sending...",
  "auth.forgot.done": "If that email is registered, you'll receive a link to reset your password.",
  "auth.backToLogin": "Back to sign in",
  "auth.reset.title": "New password",
  "auth.reset.subtitle": "Choose a new password for your account",
  "auth.reset.newPassword": "New password (at least 8 characters)",
  "auth.reset.submit": "Save password",
  "auth.reset.saving": "Saving...",
  "auth.reset.success": "Password updated. You can sign in now.",
  "auth.reset.missingToken": "Missing token: open the link from your email.",
  "auth.reset.error": "Could not reset the password.",
  "auth.loggingIn": "Signing in...",
  "auth.login": "Sign in",
  "auth.noAccount": "Don't have an account?",
  "auth.register": "Sign up",
  "auth.createAccount": "Create your account",
  "auth.registerSubtitle": "Start generating your team's reports in minutes",
  "auth.name": "Full name",
  "auth.namePlaceholder": "Ana García",
  "auth.company": "Company",
  "auth.companyPlaceholder": "Your company",
  "auth.role": "Role",
  "auth.creating": "Creating account...",
  "auth.signUp": "Create account",
  "auth.haveAccount": "Already have an account?",
  "auth.goLogin": "Sign in",
  "auth.registerError": "Could not create the account.",
  "auth.brandTitle": "Turn engineering data into decisions",
  "auth.brandDesc":
    "Real-time reports from Jira, GitHub and more to deliver with confidence and no manual work.",
  "auth.security": "Enterprise security",
  "auth.securityDesc": "Your data is encrypted and never shared.",
  // Landing (marketing)
  "m.nav.product": "Product",
  "m.nav.reports": "Reports",
  "m.nav.team": "For your team",
  "m.nav.integrations": "Integrations",
  "m.nav.pricing": "Pricing",
  "m.nav.help": "Help",
  "m.nav.goDashboard": "Go to dashboard",
  "m.nav.login": "Sign in",
  "m.nav.tryFree": "Try for free",
  "m.hero.badge": "Engineering Intelligence",
  "m.hero.titlePrefix": "Clear reports for",
  "m.hero.desc":
    "Connect Jira, GitHub, Slack and 10+ tools, and get executive reports on sprints, delivery, quality, risks and team. No spreadsheets, no lost context.",
  "m.cta.howItWorks": "See how it works",
  "m.hero.freeLine": "Free forever · No card · Unlimited users",
  "m.social.worksWith": "Built for teams already working with",
  "m.problem.kicker": "The problem",
  "m.problem.title": "Your tools have the data. You need the story.",
  "m.problem.desc":
    "Jira shows tasks, GitHub shows PRs, Slack has the conversation — but nobody brings them together. Project status ends up assembled by hand, late and unclear.",
  "m.solution.kicker": "The solution",
  "m.solution.title": "Connect, generate and decide — in three steps",
  "m.solution.desc":
    "DevMetrics doesn't replace Jira, GitHub or Slack. It connects them and turns their data into information ready to act on.",
  "m.step": "Step",
  "m.integ.title": "Your tools stay the same. Clarity shows up in one place.",
  "m.integ.desc":
    "DevMetrics pulls data from your sources and turns it into reports ready for TLs, POs and leadership.",
  "m.reports.kicker": "Reports",
  "m.reports.title": "A report for every question you're asked",
  "m.reports.desc":
    "Sprint, comparative, risk, executive, technical quality or performance reports. Clear, shareable and exportable.",
  "m.reports.illustrative":
    "Illustrative product views. Sample data. Hover to pause.",
  "m.roles.title": "One product, a view for every role",
  "m.roles.desc": "The same data, read according to what each person needs to solve.",
  "m.metrics.title": "Not just numbers: interpretation and actions",
  "m.metrics.desc":
    "DevMetrics analyzes dozens of metrics and tells you what they mean and what to do — not just charts them.",
  "m.alerts.title": "Secure by design, under your control",
  "m.trust.title": "Secure by design, under your control",
  "m.trust.desc":
    "Your data, your rules. DevMetrics reads only the minimum needed and never decides for you.",
  "m.tryfree.title": "Try it free and generate your first report in minutes",
  "m.tryfree.desc":
    "No spreadsheets. No manual reports. No lost context. Connect one tool and start seeing clarity from the first sprint.",
  "m.tryfree.cta": "Generate my first report",
  "m.tryfree.free": "Free forever · No card · Jira + GitHub live",
  "m.help.kicker": "Help Center",
  "m.help.desc":
    "We gathered the most frequent questions about what it is, integrations, reports, metrics, security and plans. Search by topic or filter by your role.",
  "m.help.cta": "Go to the Help Center",
  "m.help.notFound": "Can't find what you're looking for?",
  "m.help.writeUs": "Write to us",
  "m.contact.title": "Let's talk",
  "m.contact.desc":
    "Want a demo or have questions about whether DevMetrics fits your team? Write to us and we'll reply.",
  "m.close.desc":
    "Connected tools, one-click reports and a view for every role. Less time building reports, more time deciding.",
  "m.close.cta1": "Start free",
  "m.close.cta2": "Talk to us",
  "m.footer.tagline": "Engineering intelligence for product and technology leaders.",
  "m.footer.copyright": "Your data is encrypted and never shared.",
  "m.stats.l1": "metrics analyzed per report",
  "m.stats.l2": "live integrations + AI",
  "m.stats.l3": "from scattered data to a finished report",
  "m.al.badge": "Smart alerts",
  "m.al.title": "Spot risks before it's too late",
  "m.al.desc":
    "DevMetrics raises early signals and tells you who's responsible and what to do. Each alert comes with severity, owner role and recommended action.",
  "m.al.cta": "View risk report",
  "m.al.required": "Action required",
  "m.al.count": "5 alerts",
  "m.al.action": "Action:",
  "m.cmp.title": "Compare two sprints in seconds",
  "m.cmp.desc":
    "Stop comparing sprints by hand. Detect what improved, what worsened, what held and which risks repeat.",
  "m.cmp.metric": "Metric",
  "m.cmp.var": "Var.",
  "m.cmp.conclusionLabel": "Conclusion:",
  "m.cmp.conclusion":
    "the team improved velocity and quality, but review time rose 50%. Suggestion: add reviewers and shrink PRs.",
  "m.oc.title": "From scattered data to a finished report, in one click",
  "m.oc.desc":
    "Pick project, period and report type. Click and get a report ready to review, share or export.",
  "m.uc.title": "Ready for every team moment",
  "m.uc.desc": "The right report for the conversation you need to have.",
  "m.uc.generates": "Generates:",
  "m.footer.product": "Product",
  "m.footer.plans": "Plans",
  "m.footer.resources": "Resources",
  "m.footer.company": "Company",
  // Illustrative mockups
  "m.mock.weeklyReport": "Weekly report — Frontend",
  "m.mock.mediumRisk": "Medium risk",
  "m.mock.done": "Done",
  "m.mock.prMerged": "PRs merged",
  "m.mock.blocked": "Blocked",
  "m.mock.prOpen": "Open PRs",
  "m.mock.velocity6": "Velocity (last 6 sprints)",
  "m.mock.generate": "Generate report",
  "m.mock.healthScore": "Health score",
  "m.mock.riskDetected": "Risk detected",
  "m.mock.riskDetail": "3 PRs open for +72h with no reviewer.",
  "m.mock.reportGenerated": "Report generated — Sprint 24",
  "m.mock.ready": "Ready",
  "m.mock.progress": "Progress",
  "m.mock.health": "Health",
  "m.mock.viewReport": "View report",
  "m.mock.compareSprints": "Compare sprints",
  "m.mock.exportPdf": "Export PDF",
};

// Merge de los diccionarios base con los namespaces por área (dict/*).
const esAll: Dict = {
  ...es,
  ...reports.es,
  ...reports2.es,
  ...workspace.es,
  ...misc.es,
  ...lib.es,
  ...faq.es,
  ...gen.es,
  ...exp.es,
};
const enAll: Dict = {
  ...en,
  ...reports.en,
  ...reports2.en,
  ...workspace.en,
  ...misc.en,
  ...lib.en,
  ...faq.en,
  ...gen.en,
  ...exp.en,
};

export const DICTIONARIES: Record<Locale, Dict> = { es: esAll, en: enAll };

export function translate(dict: Dict, key: string): string {
  return dict[key] ?? key;
}

/** Función de traducción con interpolación de tokens {x}. */
export type TFunc = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * Devuelve una función t(key, params) para un locale dado. Sirve para
 * server-side sin request (ej. generación de reportes por cron). Interpola
 * `{token}` con los params provistos.
 */
export function makeT(locale: Locale): TFunc {
  const dict = DICTIONARIES[locale];
  return (key, params) => {
    let s = translate(dict, key);
    if (params)
      for (const [k, v] of Object.entries(params))
        s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
