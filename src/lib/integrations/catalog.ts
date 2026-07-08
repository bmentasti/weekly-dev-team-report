// Client-safe provider catalog. Drives the connect UI (fields + guides) and the
// dashboard listing. No server-only imports here so it can be used in both
// server and client components.

export type ProviderSlug =
  | "jira"
  | "github"
  | "slack"
  | "linear"
  | "gitlab"
  | "bitbucket"
  | "azure-devops"
  | "clickup"
  | "notion"
  | "teams"
  | "airtable"
  | "discord"
  | "openai"
  | "anthropic"
  | "gemini"
  | "copilot";

export type ProviderKind = "ISSUES" | "CODE" | "COMM" | "AI";

/** Matches the Prisma IntegrationType enum names. */
export type IntegrationTypeName =
  | "JIRA"
  | "GITHUB"
  | "SLACK"
  | "LINEAR"
  | "GITLAB"
  | "BITBUCKET"
  | "AZURE_DEVOPS"
  | "CLICKUP"
  | "NOTION"
  | "MS_TEAMS"
  | "AIRTABLE"
  | "DISCORD"
  | "OPENAI"
  | "ANTHROPIC"
  | "GEMINI"
  | "COPILOT";

export interface ProviderField {
  name: string;
  label: string;
  placeholder?: string;
  help?: string;
  secret?: boolean;
  optional?: boolean;
}

export interface GuideStep {
  field: string; // label of the concept
  body: string;
  link?: { label: string; url: string };
}

export interface ProviderCatalogEntry {
  slug: ProviderSlug;
  type: IntegrationTypeName;
  label: string;
  kind: ProviderKind;
  /** Whether the adapter is implemented. Disabled ones show as "próximamente". */
  enabled: boolean;
  priority: number;
  /** Which field holds the secret to encrypt at rest. */
  secretField: string;
  tokenUrl?: string;
  fields: ProviderField[];
  guide: GuideStep[];
  blurb: string;
}

export const PROVIDER_CATALOG: Record<ProviderSlug, ProviderCatalogEntry> = {
  jira: {
    slug: "jira",
    type: "JIRA",
    label: "Jira",
    kind: "ISSUES",
    enabled: true,
    priority: 1,
    secretField: "apiToken",
    tokenUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    blurb: "Sprints, backlog e issues.",
    fields: [
      {
        name: "domain",
        label: "Jira domain",
        placeholder: "empresa.atlassian.net",
        help: "La dirección de tu Jira, sin https://",
      },
      {
        name: "email",
        label: "Email",
        placeholder: "usuario@empresa.com",
        help: "El mismo con el que iniciás sesión en Jira",
      },
      {
        name: "apiToken",
        label: "API Token",
        secret: true,
        help: "Se guarda encriptado",
      },
      {
        name: "projectKey",
        label: "Project Key",
        placeholder: "FOR",
        help: "El prefijo de tus tareas, ej. FOR en FOR-123",
      },
    ],
    guide: [
      {
        field: "Jira domain",
        body: "Es la dirección con la que entrás a Jira, ej. empresa.atlassian.net (copiala de la barra del navegador, sin https://).",
      },
      { field: "Email", body: "El mismo con el que iniciás sesión en Jira." },
      {
        field: "API Token",
        body: 'Creá uno con "Create API token", ponele un nombre y copialo (se muestra una sola vez).',
        link: {
          label: "Crear API token",
          url: "https://id.atlassian.com/manage-profile/security/api-tokens",
        },
      },
      {
        field: "Project Key",
        body: "El prefijo de las tareas, ej. FOR en FOR-123. Lo ves en Project settings → Details.",
      },
    ],
  },

  github: {
    slug: "github",
    type: "GITHUB",
    label: "GitHub",
    kind: "CODE",
    enabled: true,
    priority: 2,
    secretField: "accessToken",
    tokenUrl: "https://github.com/settings/tokens?type=beta",
    blurb: "Pull Requests, reviews y merges.",
    fields: [
      {
        name: "owner",
        label: "Owner",
        placeholder: "acme",
        help: "Usuario u organización dueña del repo",
      },
      { name: "repo", label: "Repositorio", placeholder: "web-app" },
      {
        name: "accessToken",
        label: "Access Token",
        secret: true,
        help: "Se guarda encriptado",
      },
    ],
    guide: [
      {
        field: "Owner y Repo",
        body: "Están en la URL: en github.com/acme/web-app el owner es acme y el repo es web-app.",
      },
      {
        field: "Access Token",
        body: "Creá un fine-grained token con acceso de solo lectura a Pull requests, Contents y Checks del repo (o un token clásico con scope repo).",
        link: {
          label: "Crear token en GitHub",
          url: "https://github.com/settings/tokens?type=beta",
        },
      },
    ],
  },

  slack: {
    slug: "slack",
    type: "SLACK",
    label: "Slack",
    kind: "COMM",
    enabled: true,
    priority: 3,
    secretField: "botToken",
    tokenUrl: "https://api.slack.com/apps",
    blurb: "Blockers y actividad diaria.",
    fields: [
      {
        name: "botToken",
        label: "Bot User OAuth Token",
        placeholder: "xoxb-...",
        secret: true,
        help: "Empieza con xoxb-. Se guarda encriptado",
      },
      {
        name: "channelId",
        label: "Channel ID",
        placeholder: "C0123456789",
        help: "El canal del equipo a monitorear",
      },
    ],
    guide: [
      {
        field: "Crear la app",
        body: 'En api.slack.com/apps creá una app ("From scratch") en tu workspace.',
        link: { label: "Slack apps", url: "https://api.slack.com/apps" },
      },
      {
        field: "Permisos (scopes)",
        body: "En OAuth & Permissions agregá los Bot Token Scopes: channels:history, channels:read, groups:history. Instalá la app en el workspace.",
      },
      {
        field: "Bot Token",
        body: "Copiá el Bot User OAuth Token (xoxb-...) desde OAuth & Permissions. Acordate de invitar al bot al canal (/invite @tu-app).",
      },
      {
        field: "Channel ID",
        body: "Abrí el canal en Slack → Ver detalles → abajo aparece el Channel ID (empieza con C).",
      },
    ],
  },

  linear: {
    slug: "linear",
    type: "LINEAR",
    label: "Linear",
    kind: "ISSUES",
    enabled: true,
    priority: 5,
    secretField: "apiKey",
    tokenUrl: "https://linear.app/settings/api",
    blurb: "Issues y ciclos de producto.",
    fields: [
      {
        name: "apiKey",
        label: "API Key",
        placeholder: "lin_api_...",
        secret: true,
        help: "Personal API key. Se guarda encriptada",
      },
      {
        name: "teamKey",
        label: "Team Key",
        placeholder: "ENG",
        optional: true,
        help: "Opcional: filtra por equipo (ej. ENG en ENG-123)",
      },
    ],
    guide: [
      {
        field: "API Key",
        body: "En Linear → Settings → API → Personal API keys → Create key. Copiala (empieza con lin_api_).",
        link: {
          label: "Linear API settings",
          url: "https://linear.app/settings/api",
        },
      },
      {
        field: "Team Key",
        body: "Opcional. Es el prefijo de los issues, ej. ENG en ENG-123. Si lo dejás vacío, trae todos tus issues asignados/creados recientes.",
      },
    ],
  },

  gitlab: {
    slug: "gitlab",
    type: "GITLAB",
    label: "GitLab",
    kind: "CODE",
    enabled: true,
    priority: 6,
    secretField: "accessToken",
    tokenUrl: "https://gitlab.com/-/user_settings/personal_access_tokens",
    blurb: "Merge Requests y reviews.",
    fields: [
      {
        name: "baseUrl",
        label: "GitLab URL",
        placeholder: "https://gitlab.com",
        optional: true,
        help: "Dejá gitlab.com salvo que sea self-hosted",
      },
      {
        name: "projectId",
        label: "Project ID o path",
        placeholder: "grupo/proyecto  o  12345678",
        help: "El path completo del proyecto o su ID numérico",
      },
      {
        name: "accessToken",
        label: "Access Token",
        secret: true,
        help: "Se guarda encriptado",
      },
    ],
    guide: [
      {
        field: "Project ID o path",
        body: "El path es grupo/subgrupo/proyecto (de la URL). El ID numérico aparece en la home del proyecto, bajo el nombre.",
      },
      {
        field: "Access Token",
        body: "En GitLab → Preferences → Access Tokens → Add new token, con scope read_api (o read_repository + read_api). Copialo.",
        link: {
          label: "Crear token en GitLab",
          url: "https://gitlab.com/-/user_settings/personal_access_tokens",
        },
      },
      {
        field: "GitLab URL",
        body: "Solo cambiala si usás una instancia self-hosted (ej. https://gitlab.miempresa.com).",
      },
    ],
  },

  bitbucket: {
    slug: "bitbucket",
    type: "BITBUCKET",
    label: "Bitbucket",
    kind: "CODE",
    enabled: true,
    priority: 8,
    secretField: "appPassword",
    tokenUrl: "https://bitbucket.org/account/settings/app-passwords/",
    blurb: "Pull Requests (común con Atlassian).",
    fields: [
      { name: "workspace", label: "Workspace", placeholder: "mi-empresa" },
      { name: "repoSlug", label: "Repositorio", placeholder: "web-app" },
      { name: "username", label: "Usuario Bitbucket" },
      { name: "appPassword", label: "App Password", secret: true, help: "Se guarda encriptado" },
    ],
    guide: [
      {
        field: "Workspace y Repositorio",
        body: "Están en la URL: bitbucket.org/{workspace}/{repositorio}.",
      },
      {
        field: "App Password",
        body: "Creá una App Password con permiso de lectura en Pull requests y Repositories.",
        link: {
          label: "Crear App Password",
          url: "https://bitbucket.org/account/settings/app-passwords/",
        },
      },
    ],
  },

  "azure-devops": {
    slug: "azure-devops",
    type: "AZURE_DEVOPS",
    label: "Azure DevOps",
    kind: "CODE",
    enabled: true,
    priority: 7,
    secretField: "pat",
    tokenUrl: "https://dev.azure.com",
    blurb: "Pull Requests de Azure Repos.",
    fields: [
      { name: "organization", label: "Organización", placeholder: "mi-org" },
      { name: "project", label: "Proyecto" },
      { name: "repositoryId", label: "Repositorio" },
      { name: "pat", label: "Personal Access Token", secret: true, help: "Se guarda encriptado" },
    ],
    guide: [
      {
        field: "Organización / Proyecto / Repo",
        body: "Están en la URL: dev.azure.com/{organización}/{proyecto}, y el repo dentro de Repos.",
      },
      {
        field: "Personal Access Token",
        body: "En User settings → Personal access tokens, con scope Code (Read).",
        link: { label: "Azure DevOps", url: "https://dev.azure.com" },
      },
    ],
  },

  clickup: {
    slug: "clickup",
    type: "CLICKUP",
    label: "ClickUp",
    kind: "ISSUES",
    enabled: true,
    priority: 9,
    secretField: "apiToken",
    tokenUrl: "https://app.clickup.com/settings/apps",
    blurb: "Tareas de equipos mixtos.",
    fields: [
      { name: "apiToken", label: "API Token", placeholder: "pk_...", secret: true, help: "Se guarda encriptado" },
      { name: "listId", label: "List ID", help: "El ID de la lista a leer" },
    ],
    guide: [
      {
        field: "API Token",
        body: "En ClickUp → Settings → Apps → Generate (Personal API Token, empieza con pk_).",
        link: { label: "ClickUp Apps", url: "https://app.clickup.com/settings/apps" },
      },
      {
        field: "List ID",
        body: "Abrí la lista; el ID está en la URL (…/li/{listId}) o desde ⋯ → Copy link.",
      },
    ],
  },

  notion: {
    slug: "notion",
    type: "NOTION",
    label: "Notion",
    kind: "ISSUES",
    enabled: true,
    priority: 10,
    secretField: "integrationToken",
    tokenUrl: "https://www.notion.so/my-integrations",
    blurb: "Tareas desde una base de Notion.",
    fields: [
      { name: "integrationToken", label: "Integration Token", placeholder: "ntn_...", secret: true, help: "Se guarda encriptado" },
      { name: "databaseId", label: "Database ID" },
    ],
    guide: [
      {
        field: "Integration Token",
        body: "Creá una integración interna en notion.so/my-integrations y copiá el token. Compartí la base con la integración.",
        link: { label: "Notion integrations", url: "https://www.notion.so/my-integrations" },
      },
      {
        field: "Database ID",
        body: "Es el bloque de 32 caracteres en la URL de la base.",
      },
    ],
  },

  teams: {
    slug: "teams",
    type: "MS_TEAMS",
    label: "Microsoft Teams",
    kind: "COMM",
    enabled: true,
    priority: 4,
    secretField: "accessToken",
    tokenUrl: "https://developer.microsoft.com/graph",
    blurb: "Actividad y blockers de un canal de Teams.",
    fields: [
      { name: "teamId", label: "Team ID" },
      { name: "channelId", label: "Channel ID" },
      { name: "accessToken", label: "Access Token (Graph)", secret: true, help: "Token de Microsoft Graph con ChannelMessage.Read" },
    ],
    guide: [
      {
        field: "Access Token",
        body: "Requiere un token de Microsoft Graph con permiso ChannelMessage.Read.All. Team ID y Channel ID salen del enlace del canal.",
        link: { label: "Microsoft Graph", url: "https://developer.microsoft.com/graph" },
      },
    ],
  },

  discord: {
    slug: "discord",
    type: "DISCORD",
    label: "Discord",
    kind: "COMM",
    enabled: true,
    priority: 12,
    secretField: "botToken",
    tokenUrl: "https://discord.com/developers/applications",
    blurb: "Actividad y blockers de un canal de Discord.",
    fields: [
      { name: "channelId", label: "Channel ID", help: "Modo desarrollador → clic derecho al canal → Copiar ID" },
      { name: "botToken", label: "Bot Token", secret: true, help: "Se guarda encriptado" },
    ],
    guide: [
      {
        field: "Bot Token",
        body: "Creá una app y un bot en el portal de desarrolladores, invitá el bot al server con permiso de leer mensajes, y copiá el Bot Token.",
        link: { label: "Discord Developers", url: "https://discord.com/developers/applications" },
      },
      {
        field: "Channel ID",
        body: "Activá el Modo desarrollador en Discord, clic derecho al canal → Copiar ID.",
      },
    ],
  },

  airtable: {
    slug: "airtable",
    type: "AIRTABLE",
    label: "Airtable",
    kind: "ISSUES",
    enabled: true,
    priority: 11,
    secretField: "apiToken",
    tokenUrl: "https://airtable.com/create/tokens",
    blurb: "Tareas desde una tabla de Airtable.",
    fields: [
      {
        name: "apiToken",
        label: "Personal Access Token",
        placeholder: "pat...",
        secret: true,
        help: "Se guarda encriptado",
      },
      {
        name: "baseId",
        label: "Base ID",
        placeholder: "app...",
        help: "Empieza con 'app'",
      },
      {
        name: "tableName",
        label: "Nombre de la tabla",
        placeholder: "Tasks",
      },
      {
        name: "statusField",
        label: "Campo de estado",
        placeholder: "Status",
        optional: true,
        help: "Por defecto: Status",
      },
      {
        name: "assigneeField",
        label: "Campo de responsable",
        placeholder: "Assignee",
        optional: true,
        help: "Por defecto: Assignee",
      },
      {
        name: "pointsField",
        label: "Campo de story points",
        placeholder: "Story Points",
        optional: true,
      },
    ],
    guide: [
      {
        field: "Personal Access Token",
        body: "Creá un token en airtable.com/create/tokens con el scope data.records:read y acceso a tu base.",
        link: {
          label: "Crear token en Airtable",
          url: "https://airtable.com/create/tokens",
        },
      },
      {
        field: "Base ID",
        body: "Empieza con 'app'. Lo encontrás en la URL de tu base o en airtable.com/api (elegí la base y aparece arriba).",
        link: { label: "Airtable API", url: "https://airtable.com/api" },
      },
      {
        field: "Nombre de la tabla",
        body: "El nombre exacto de la tabla a leer (ej. Tasks).",
      },
      {
        field: "Campos (opcional)",
        body: "Si tus columnas se llaman distinto, indicá cuáles son el estado, el responsable y los story points. Si no, usamos Status / Assignee / Story Points.",
      },
    ],
  },

  anthropic: {
    slug: "anthropic",
    type: "ANTHROPIC",
    label: "Claude (Anthropic)",
    kind: "AI",
    enabled: true,
    priority: 13,
    secretField: "apiKey",
    tokenUrl: "https://console.anthropic.com/settings/keys",
    blurb: "Análisis del reporte con Claude.",
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "sk-ant-...", secret: true, help: "Se guarda encriptada" },
      { name: "model", label: "Modelo", placeholder: "claude-3-5-sonnet-latest", optional: true },
    ],
    guide: [
      {
        field: "API Key",
        body: "Creá una key en console.anthropic.com → API Keys.",
        link: { label: "Anthropic Console", url: "https://console.anthropic.com/settings/keys" },
      },
    ],
  },

  openai: {
    slug: "openai",
    type: "OPENAI",
    label: "ChatGPT (OpenAI)",
    kind: "AI",
    enabled: true,
    priority: 14,
    secretField: "apiKey",
    tokenUrl: "https://platform.openai.com/api-keys",
    blurb: "Análisis del reporte con GPT.",
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "sk-...", secret: true, help: "Se guarda encriptada" },
      { name: "model", label: "Modelo", placeholder: "gpt-4o-mini", optional: true },
    ],
    guide: [
      {
        field: "API Key",
        body: "Creá una key en platform.openai.com → API keys.",
        link: { label: "OpenAI API keys", url: "https://platform.openai.com/api-keys" },
      },
    ],
  },

  gemini: {
    slug: "gemini",
    type: "GEMINI",
    label: "Gemini (Google)",
    kind: "AI",
    enabled: true,
    priority: 15,
    secretField: "apiKey",
    tokenUrl: "https://aistudio.google.com/app/apikey",
    blurb: "Análisis del reporte con Gemini.",
    fields: [
      { name: "apiKey", label: "API Key", secret: true, help: "Se guarda encriptada" },
      { name: "model", label: "Modelo", placeholder: "gemini-1.5-flash", optional: true },
    ],
    guide: [
      {
        field: "API Key",
        body: "Generá una key en Google AI Studio.",
        link: { label: "Google AI Studio", url: "https://aistudio.google.com/app/apikey" },
      },
    ],
  },

  copilot: {
    slug: "copilot",
    type: "COPILOT",
    label: "GitHub Copilot / Models",
    kind: "AI",
    enabled: true,
    priority: 16,
    secretField: "apiKey",
    tokenUrl: "https://github.com/settings/tokens",
    blurb: "Análisis del reporte con GitHub Models.",
    fields: [
      { name: "apiKey", label: "GitHub Token", secret: true, help: "PAT con acceso a GitHub Models. Se guarda encriptado" },
      { name: "model", label: "Modelo", placeholder: "gpt-4o-mini", optional: true },
    ],
    guide: [
      {
        field: "GitHub Token",
        body: "Usa GitHub Models (endpoint compatible con OpenAI). Generá un PAT con acceso a Models.",
        link: { label: "GitHub tokens", url: "https://github.com/settings/tokens" },
      },
    ],
  },
};

export const PROVIDER_LIST: ProviderCatalogEntry[] = Object.values(
  PROVIDER_CATALOG,
).sort((a, b) => a.priority - b.priority);

export function getProvider(slug: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG[slug as ProviderSlug];
}

export function getProviderByType(
  type: string,
): ProviderCatalogEntry | undefined {
  return PROVIDER_LIST.find((p) => p.type === type);
}

export const KIND_LABELS: Record<ProviderKind, string> = {
  ISSUES: "Tareas y proyectos",
  CODE: "Código y Pull/Merge Requests",
  COMM: "Comunicación",
  AI: "Inteligencia artificial",
};
