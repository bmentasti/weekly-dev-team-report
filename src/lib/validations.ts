import { z } from "zod";

export const userRoles = [
  "TECH_LEAD",
  "PRODUCT_OWNER",
  "ENGINEERING_MANAGER",
  "CTO",
  "DEVELOPER_LEAD",
  "DEVELOPER",
  "OTHER",
] as const;

export const userRoleLabels: Record<(typeof userRoles)[number], string> = {
  TECH_LEAD: "Tech Lead",
  PRODUCT_OWNER: "Product Owner",
  ENGINEERING_MANAGER: "Engineering Manager",
  CTO: "CTO",
  DEVELOPER_LEAD: "Developer Lead",
  DEVELOPER: "Developer",
  OTHER: "Otro",
};

export const registerSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  company: z.string().optional(),
  role: z.enum(userRoles).default("OTHER"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "El nombre del workspace es obligatorio"),
  companyName: z.string().optional(),
  teamName: z.string().optional(),
  teamSize: z.coerce.number().int().positive().optional(),
});

export const jiraConnectSchema = z.object({
  domain: z.string().min(3, "El dominio es obligatorio"),
  email: z.string().email("Email inválido"),
  apiToken: z.string().min(1, "El API token es obligatorio"),
  projectKey: z
    .string()
    .min(1, "El project key es obligatorio")
    .regex(/^[A-Za-z][A-Za-z0-9_]+$/, "Project key inválido"),
});

export const githubConnectSchema = z.object({
  owner: z
    .string()
    .min(1, "El owner es obligatorio")
    .regex(/^[A-Za-z0-9._-]+$/, "Owner inválido"),
  repo: z
    .string()
    .min(1, "El repositorio es obligatorio")
    .regex(/^[A-Za-z0-9._-]+$/, "Nombre de repo inválido"),
  accessToken: z.string().min(1, "El access token es obligatorio"),
});

// --- API mutantes (H8) ---
export const planTiers = ["FREE", "TEAM", "PRO"] as const;
export const billingPeriods = ["MONTHLY", "ANNUAL"] as const;

export const planChangeSchema = z.object({
  plan: z.enum(planTiers),
  period: z.enum(billingPeriods).default("MONTHLY"),
});

export const checkoutSchema = z.object({
  plan: z.enum(planTiers),
  period: z.enum(billingPeriods).default("MONTHLY"),
  provider: z.string().optional(),
});

export const reportPatchSchema = z.object({
  pinned: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  tags: z.array(z.string()).max(30).optional(),
});

const metricThresholdSchema = z.object({
  healthy: z.number().finite(),
  risk: z.number().finite(),
});
export const standardConfigSchema = z.object({
  scope: z.enum(["workspace", "project"]).default("workspace"),
  reason: z.string().max(300).optional(),
  config: z
    .object({
      thresholds: z.record(metricThresholdSchema).optional(),
      weights: z.record(z.number().finite()).optional(),
    })
    .optional(),
});

export const memberInviteSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const memberRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

export const reportConfigSchema = z.object({
  frequency: z.enum(["MANUAL", "WEEKLY"]).default("MANUAL"),
  // Cota dura de destinatarios para evitar abuso de envío de emails. (COD-01)
  recipients: z.array(z.string().email()).max(50).default([]),
  // Idioma de los reportes generados/enviados por el cron.
  locale: z.enum(["es", "en"]).default("es"),
});

// Nota / comentario de reporte: texto acotado. (COD-01)
export const reportNoteSchema = z.object({
  body: z.string().trim().min(1, "La nota está vacía.").max(5000),
});

// Prompt de IA acotado para controlar coste/abuso. (COD-01)
export const aiAskSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
});

export const reportShareSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    level: z.enum(["EXECUTIVE", "FULL"]).default("FULL"),
  })
  .refine((v) => v.userId || v.email, {
    message: "Indicá un miembro o un email.",
  });

export const alertRuleSchema = z.object({
  metricKey: z.string().min(1),
  operator: z.enum(["gt", "lt", "gte", "lte"]),
  threshold: z.number().finite(),
  severity: z.enum(["high", "medium", "low"]).default("medium"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JiraConnectInput = z.infer<typeof jiraConnectSchema>;
export type GitHubConnectInput = z.infer<typeof githubConnectSchema>;
