export type TemplateName = "saas-base" | "marketplace-base" | "dashboard-base" | "crud-base";

export interface TemplateResult {
  name: TemplateName;
  files: Record<string, string>;
  requiredDependencies: string[];
}

interface TemplateMetadata {
  title: string;
  description: string;
  defaultSidebar: Array<{ label: string; href: string }>;
}

const TEMPLATE_META: Record<TemplateName, TemplateMetadata> = {
  "saas-base": {
    title: "SaaS Base",
    description: "SaaS com autenticação, multi-tenant e dashboard",
    defaultSidebar: [{ label: "Dashboard", href: "/app" }],
  },
  "marketplace-base": {
    title: "Marketplace Base",
    description: "Marketplace com catálogo e gestão de pedidos",
    defaultSidebar: [
      { label: "Dashboard", href: "/app" },
      { label: "Catalog", href: "/app/catalog" },
    ],
  },
  "dashboard-base": {
    title: "Dashboard Base",
    description: "Painel operacional com métricas e gestão",
    defaultSidebar: [{ label: "Overview", href: "/app" }],
  },
  "crud-base": {
    title: "CRUD Base",
    description: "Base para CRUD administrativo com autenticação",
    defaultSidebar: [{ label: "Records", href: "/app/records" }],
  },
};

function renderSidebar(items: Array<{ label: string; href: string }>): string {
  const entries = items.map((item) => `  { label: \"${item.label}\", href: \"${item.href}\" },`).join("\n");
  return `export const sidebarItems = [\n${entries}\n  /* neurax:sidebar-items */\n];\n`;
}

function buildBaseFiles(template: TemplateName): Record<string, string> {
  const meta = TEMPLATE_META[template];

  return {
    "package.json": JSON.stringify(
      {
        name: `neurax-${template}`,
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "next lint",
        },
        dependencies: {
          next: "14.2.3",
          react: "18.3.1",
          "react-dom": "18.3.1",
          "@supabase/supabase-js": "^2.95.3",
        },
        devDependencies: {
          typescript: "^5.8.3",
          tailwindcss: "^3.4.17",
          autoprefixer: "^10.4.21",
          postcss: "^8.5.6",
          "@types/node": "^22.16.5",
          "@types/react": "^18.3.23",
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["dom", "dom.iterable", "es2022"],
          strict: true,
          noEmit: true,
          module: "esnext",
          moduleResolution: "bundler",
          jsx: "preserve",
          baseUrl: ".",
          paths: {
            "@/*": ["./src/*"],
          },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
    "next-env.d.ts": "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n",
    "next.config.mjs": "export default { experimental: { typedRoutes: true } };\n",
    "tailwind.config.ts": "import type { Config } from \"tailwindcss\";\n\nexport default {\n  content: [\"./src/**/*.{js,ts,jsx,tsx}\"],\n  theme: { extend: {} },\n  plugins: [],\n} satisfies Config;\n",
    "postcss.config.js": "module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n",
    ".env.example": "NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\n",
    "src/app/globals.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody {\n  font-family: ui-sans-serif, system-ui, sans-serif;\n}\n",
    "src/lib/supabase.ts":
      "import { createClient } from \"@supabase/supabase-js\";\n\nconst url = process.env.NEXT_PUBLIC_SUPABASE_URL || \"\";\nconst anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || \"\";\n\nexport const supabase = createClient(url, anon);\n",
    "src/lib/auth.ts":
      "import { supabase } from \"@/lib/supabase\";\n\nexport async function getSession() {\n  const { data } = await supabase.auth.getSession();\n  return data.session;\n}\n",
    "src/config/sidebar.ts": renderSidebar(meta.defaultSidebar),
    "src/components/Sidebar.tsx":
      "import Link from \"next/link\";\nimport { sidebarItems } from \"@/config/sidebar\";\n\nexport function Sidebar() {\n  return (\n    <aside className=\"w-60 border-r p-4\">\n      <nav className=\"space-y-2\">\n        {sidebarItems.map((item) => (\n          <Link key={item.href} href={item.href} className=\"block text-sm text-gray-700\">\n            {item.label}\n          </Link>\n        ))}\n      </nav>\n    </aside>\n  );\n}\n",
    "src/app/layout.tsx":
      "import \"./globals.css\";\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n",
    "src/app/page.tsx": `import Link from \"next/link\";\n\nexport default function Page() {\n  return (\n    <main className=\"p-8 space-y-4\">\n      <h1 className=\"text-2xl font-semibold\">${meta.title}</h1>\n      <p className=\"text-sm text-gray-600\">${meta.description}</p>\n      <Link href=\"/app\" className=\"text-sm underline\">Open dashboard</Link>\n    </main>\n  );\n}\n`,
    "src/app/(auth)/login/page.tsx":
      "export default function LoginPage() {\n  return <main className=\"p-8\">Login Page</main>;\n}\n",
    "src/app/(app)/layout.tsx":
      "import { Sidebar } from \"@/components/Sidebar\";\n\nexport default function AppLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <div className=\"min-h-screen flex\">\n      <Sidebar />\n      <section className=\"flex-1\">{children}</section>\n    </div>\n  );\n}\n",
    "src/app/(app)/app/page.tsx":
      "export default function DashboardPage() {\n  return <main className=\"p-8\">Dashboard</main>;\n}\n",
    "src/middleware.ts":
      "import type { NextRequest } from \"next/server\";\nimport { NextResponse } from \"next/server\";\n\nexport function middleware(_req: NextRequest) {\n  return NextResponse.next();\n}\n\nexport const config = { matcher: [\"/app/:path*\"] };\n",
    "README.md": `# ${meta.title}\n\nTemplate base obrigatório da plataforma NEURAX.\n`,
  };
}

export function getTemplate(name: TemplateName): TemplateResult {
  return {
    name,
    files: buildBaseFiles(name),
    requiredDependencies: ["next", "react", "react-dom", "@supabase/supabase-js"],
  };
}

export function pickTemplate(modules: string[]): TemplateName {
  const normalized = modules.map((moduleName) => moduleName.toLowerCase());

  if (normalized.includes("payments") || normalized.includes("marketplace")) {
    return "marketplace-base";
  }
  if (normalized.includes("analytics")) {
    return "dashboard-base";
  }
  if (normalized.includes("crud")) {
    return "crud-base";
  }
  return "saas-base";
}
