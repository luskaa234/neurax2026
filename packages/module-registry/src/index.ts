export type TemplateKind = "saas-base" | "marketplace-base" | "dashboard-base" | "crud-base";

export interface FilePatch {
  path: string;
  content: string;
}

export interface RouteDefinition {
  path: string;
  file: string;
}

export interface SidebarItem {
  label: string;
  href: string;
  icon?: string;
}

export interface ModuleDefinition {
  name: string;
  requiredModules: string[];
  dbMigrations: string[];
  files: string[];
  routes: RouteDefinition[];
  sidebarItems: SidebarItem[];
  dependencies: string[];
  create: FilePatch[];
  update: FilePatch[];
}

const SIDEBAR_MARKER = "/* neurax:sidebar-items */";

function appPage(title: string, details: string): string {
  return `export default function Page() {\n  return (\n    <main className=\"p-6 space-y-4\">\n      <h1 className=\"text-2xl font-semibold\">${title}</h1>\n      <p className=\"text-sm text-muted-foreground\">${details}</p>\n    </main>\n  );\n}\n`;
}

function sidebarUpdate(items: SidebarItem[]): FilePatch {
  const payload = items
    .map((item) => `  { label: \"${item.label}\", href: \"${item.href}\" },`)
    .join("\n");
  return {
    path: "src/config/sidebar.ts",
    content: `export const sidebarItems = [\n${payload}\n  ${SIDEBAR_MARKER}\n];\n`,
  };
}

const MODULES: Record<string, ModuleDefinition> = {
  auth: {
    name: "auth",
    requiredModules: [],
    dbMigrations: ["create auth users profile and session policies"],
    files: ["src/lib/auth.ts", "src/app/(auth)/login/page.tsx", "src/app/(auth)/signup/page.tsx"],
    routes: [
      { path: "/login", file: "src/app/(auth)/login/page.tsx" },
      { path: "/signup", file: "src/app/(auth)/signup/page.tsx" },
    ],
    sidebarItems: [{ label: "Account", href: "/login" }],
    dependencies: ["@supabase/supabase-js"],
    create: [
      {
        path: "src/lib/auth.ts",
        content:
          "export function requireAuth(userId: string | null): asserts userId is string {\n  if (!userId) throw new Error(\"unauthorized\");\n}\n",
      },
      { path: "src/app/(auth)/login/page.tsx", content: appPage("Login", "Email/password and social providers.") },
      { path: "src/app/(auth)/signup/page.tsx", content: appPage("Sign up", "Create account with tenant invitation support.") },
    ],
    update: [sidebarUpdate([{ label: "Account", href: "/login" }])],
  },
  "multi-tenant": {
    name: "multi-tenant",
    requiredModules: ["auth"],
    dbMigrations: ["create organizations, memberships and tenant isolation policies"],
    files: ["src/lib/tenant.ts", "src/app/(app)/organizations/page.tsx"],
    routes: [{ path: "/organizations", file: "src/app/(app)/organizations/page.tsx" }],
    sidebarItems: [{ label: "Organizations", href: "/organizations" }],
    dependencies: [],
    create: [
      {
        path: "src/lib/tenant.ts",
        content:
          "export interface TenantMembership { userId: string; organizationId: string; role: \"owner\" | \"member\"; }\n",
      },
      { path: "src/app/(app)/organizations/page.tsx", content: appPage("Organizations", "Manage multi-tenant workspaces and membership.") },
    ],
    update: [sidebarUpdate([{ label: "Organizations", href: "/organizations" }])],
  },
  payments: {
    name: "payments",
    requiredModules: ["auth", "multi-tenant"],
    dbMigrations: ["create subscriptions and invoices tables"],
    files: ["src/lib/payments.ts", "src/app/(app)/billing/page.tsx"],
    routes: [{ path: "/billing", file: "src/app/(app)/billing/page.tsx" }],
    sidebarItems: [{ label: "Billing", href: "/billing" }],
    dependencies: ["stripe"],
    create: [
      {
        path: "src/lib/payments.ts",
        content:
          "export interface SubscriptionPlan { code: string; amountCents: number; interval: \"month\" | \"year\"; }\n",
      },
      { path: "src/app/(app)/billing/page.tsx", content: appPage("Billing", "Plans, invoices and payment method management.") },
    ],
    update: [sidebarUpdate([{ label: "Billing", href: "/billing" }])],
  },
  booking: {
    name: "booking",
    requiredModules: ["auth"],
    dbMigrations: ["create booking tables and availability indexes"],
    files: ["src/modules/booking/service.ts", "src/app/(app)/bookings/page.tsx"],
    routes: [{ path: "/bookings", file: "src/app/(app)/bookings/page.tsx" }],
    sidebarItems: [{ label: "Bookings", href: "/bookings" }],
    dependencies: ["date-fns"],
    create: [
      {
        path: "src/modules/booking/service.ts",
        content:
          "export interface Booking { id: string; startsAt: string; endsAt: string; customerName: string; }\n",
      },
      { path: "src/app/(app)/bookings/page.tsx", content: appPage("Bookings", "Calendar and appointment management.") },
    ],
    update: [sidebarUpdate([{ label: "Bookings", href: "/bookings" }])],
  },
  admin: {
    name: "admin",
    requiredModules: ["auth"],
    dbMigrations: ["create role based permissions and audit events"],
    files: ["src/lib/admin.ts", "src/app/(app)/admin/page.tsx"],
    routes: [{ path: "/admin", file: "src/app/(app)/admin/page.tsx" }],
    sidebarItems: [{ label: "Admin", href: "/admin" }],
    dependencies: [],
    create: [
      {
        path: "src/lib/admin.ts",
        content:
          "export function canAccessAdmin(role: string): boolean {\n  return role === \"owner\" || role === \"admin\";\n}\n",
      },
      { path: "src/app/(app)/admin/page.tsx", content: appPage("Admin", "Audit logs, role management and configuration.") },
    ],
    update: [sidebarUpdate([{ label: "Admin", href: "/admin" }])],
  },
  analytics: {
    name: "analytics",
    requiredModules: ["auth"],
    dbMigrations: ["create metrics table and rollup jobs"],
    files: ["src/lib/analytics.ts", "src/app/(app)/analytics/page.tsx"],
    routes: [{ path: "/analytics", file: "src/app/(app)/analytics/page.tsx" }],
    sidebarItems: [{ label: "Analytics", href: "/analytics" }],
    dependencies: ["recharts"],
    create: [
      {
        path: "src/lib/analytics.ts",
        content:
          "export interface MetricPoint { date: string; value: number; }\n",
      },
      { path: "src/app/(app)/analytics/page.tsx", content: appPage("Analytics", "Operational charts and growth KPIs.") },
    ],
    update: [sidebarUpdate([{ label: "Analytics", href: "/analytics" }])],
  },
  notifications: {
    name: "notifications",
    requiredModules: ["auth"],
    dbMigrations: ["create notification templates and delivery logs"],
    files: ["src/lib/notifications.ts", "src/app/(app)/notifications/page.tsx"],
    routes: [{ path: "/notifications", file: "src/app/(app)/notifications/page.tsx" }],
    sidebarItems: [{ label: "Notifications", href: "/notifications" }],
    dependencies: [],
    create: [
      {
        path: "src/lib/notifications.ts",
        content:
          "export interface NotificationEvent { channel: \"email\" | \"in_app\"; message: string; }\n",
      },
      { path: "src/app/(app)/notifications/page.tsx", content: appPage("Notifications", "Templates, channels and delivery status.") },
    ],
    update: [sidebarUpdate([{ label: "Notifications", href: "/notifications" }])],
  },
  "file-upload": {
    name: "file-upload",
    requiredModules: ["auth"],
    dbMigrations: ["create files metadata table and storage policies"],
    files: ["src/lib/uploads.ts", "src/app/(app)/files/page.tsx"],
    routes: [{ path: "/files", file: "src/app/(app)/files/page.tsx" }],
    sidebarItems: [{ label: "Files", href: "/files" }],
    dependencies: [],
    create: [
      {
        path: "src/lib/uploads.ts",
        content:
          "export interface FileRecord { id: string; path: string; bucket: string; }\n",
      },
      { path: "src/app/(app)/files/page.tsx", content: appPage("Files", "Upload center integrated with Supabase Storage.") },
    ],
    update: [sidebarUpdate([{ label: "Files", href: "/files" }])],
  },
};

export function listModules(): ModuleDefinition[] {
  return Object.values(MODULES);
}

export function getModule(name: string): ModuleDefinition {
  const definition = MODULES[name];
  if (!definition) {
    throw new Error(`Unknown module: ${name}`);
  }
  return definition;
}

export function resolveModuleDependencies(initialModules: string[]): ModuleDefinition[] {
  const resolved = new Map<string, ModuleDefinition>();
  const stack = [...initialModules];

  while (stack.length > 0) {
    const next = stack.shift() as string;
    if (resolved.has(next)) continue;
    const definition = getModule(next);
    resolved.set(next, definition);
    for (const dep of definition.requiredModules) {
      if (!resolved.has(dep)) stack.push(dep);
    }
  }

  return [...resolved.values()];
}

export function defaultModulesForTemplate(template: TemplateKind): string[] {
  if (template === "saas-base") return ["auth", "multi-tenant", "admin"];
  if (template === "marketplace-base") return ["auth", "payments", "file-upload", "notifications"];
  if (template === "dashboard-base") return ["auth", "analytics", "admin"];
  return ["auth", "admin"];
}
