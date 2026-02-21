export interface SystemIntentParsed {
  system_type: string;
  goal: string;
  target_users: string[];
  modules: string[];
  roles: string[];
  needs_auth: boolean;
  needs_payment: boolean;
  multi_tenant: boolean;
  suggested_stack: string;
  production_level: string;
  admin_panel: boolean;
  preview_required: boolean;
}

export const SYSTEM_INTENT_DEFAULTS: SystemIntentParsed = {
  system_type: "SaaS web",
  goal: "Resolver um fluxo de negocio principal com experiencia simples",
  target_users: ["usuarios finais", "admin"],
  modules: ["autenticacao", "dashboard", "gestao principal"],
  roles: ["admin", "user"],
  needs_auth: true,
  needs_payment: false,
  multi_tenant: false,
  suggested_stack: "Next.js + TypeScript + Tailwind + Supabase",
  production_level: "producao",
  admin_panel: true,
  preview_required: true,
};

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (["true", "sim", "yes", "y"].includes(lower)) return true;
    if (["false", "nao", "não", "no", "n"].includes(lower)) return false;
  }
  return fallback;
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizeSystemIntent(input: unknown): SystemIntentParsed {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  return {
    system_type: normalizeString(source.system_type, SYSTEM_INTENT_DEFAULTS.system_type),
    goal: normalizeString(source.goal, SYSTEM_INTENT_DEFAULTS.goal),
    target_users: normalizeStringArray(source.target_users, SYSTEM_INTENT_DEFAULTS.target_users),
    modules: normalizeStringArray(source.modules, SYSTEM_INTENT_DEFAULTS.modules),
    roles: normalizeStringArray(source.roles, SYSTEM_INTENT_DEFAULTS.roles),
    needs_auth: normalizeBoolean(source.needs_auth, SYSTEM_INTENT_DEFAULTS.needs_auth),
    needs_payment: normalizeBoolean(source.needs_payment, SYSTEM_INTENT_DEFAULTS.needs_payment),
    multi_tenant: normalizeBoolean(source.multi_tenant, SYSTEM_INTENT_DEFAULTS.multi_tenant),
    suggested_stack: normalizeString(source.suggested_stack, SYSTEM_INTENT_DEFAULTS.suggested_stack),
    production_level: normalizeString(source.production_level, SYSTEM_INTENT_DEFAULTS.production_level),
    admin_panel: normalizeBoolean(source.admin_panel, SYSTEM_INTENT_DEFAULTS.admin_panel),
    preview_required: normalizeBoolean(source.preview_required, SYSTEM_INTENT_DEFAULTS.preview_required),
  };
}

export function intentToSystemBuilderFields(intent: SystemIntentParsed, originalDescription?: string): Record<string, string> {
  const notes: string[] = [];
  notes.push(`painel_admin=${intent.admin_panel ? "sim" : "nao"}`);
  notes.push(`preview_requerido=${intent.preview_required ? "sim" : "nao"}`);
  if (originalDescription?.trim()) {
    notes.push(`descricao_original=${originalDescription.trim()}`);
  }

  return {
    tipo_de_sistema: intent.system_type,
    objetivo: intent.goal,
    publico_alvo: intent.target_users.join(", "),
    modulos_necessarios: intent.modules.join(", "),
    tipo_de_usuarios: intent.roles.join(", "),
    precisa_auth: intent.needs_auth ? "sim" : "nao",
    precisa_pagamento: intent.needs_payment ? "sim" : "nao",
    multiusuario: intent.multi_tenant ? "sim" : "nao",
    stack_preferida: intent.suggested_stack,
    nivel_producao: intent.production_level,
    observacoes_extras: notes.join(" | "),
  };
}

export function fallbackParseSystemIntent(description: string): SystemIntentParsed {
  const lower = description.toLowerCase();

  const needsPayment = /(pagamento|stripe|assinatura|checkout|cobranca|cobrança)/.test(lower);
  const needsAuth = !/(sem login|sem autentica)/.test(lower);
  const multiTenant = /(multi.?tenant|multiempresa|multi-empresa|workspace|organizac)/.test(lower);
  const adminPanel = /(admin|painel|dashboard|backoffice)/.test(lower);

  const modules = [
    needsAuth ? "autenticacao" : "acesso publico",
    "dashboard",
    needsPayment ? "pagamentos" : "gestao de dados",
    adminPanel ? "painel admin" : "configuracoes",
  ];

  return {
    ...SYSTEM_INTENT_DEFAULTS,
    system_type: description.trim() || SYSTEM_INTENT_DEFAULTS.system_type,
    goal: description.trim() || SYSTEM_INTENT_DEFAULTS.goal,
    modules,
    roles: adminPanel ? ["admin", "user"] : ["user"],
    needs_auth: needsAuth,
    needs_payment: needsPayment,
    multi_tenant: multiTenant,
    admin_panel: adminPanel,
    preview_required: true,
  };
}
