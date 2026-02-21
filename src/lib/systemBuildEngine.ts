// Engine responsible for generating scaffold + prompt for Build Mode

export interface BuildInput {
  tipo_de_sistema: string;
  objetivo: string;
  publico_alvo: string;
  modulos_necessarios: string;
  tipo_de_usuarios: string;
  precisa_auth: string;
  precisa_pagamento: string;
  multiusuario: string;
  stack_preferida?: string;
  nivel_producao: string;
  observacoes_extras?: string;
}

export interface BuildFile {
  path: string;
  content: string;
}

export interface BuildOutput {
  project_name: string;
  description: string;
  stack: string[];
  files: BuildFile[];
  env_example: string[];
  sql_migrations: string[];
  run_instructions: string[];
}

const REQUIRED_FILES = [
  "package.json",
  "tsconfig.json",
  "tailwind.config.ts",
  "next.config.ts",
  "README.md",
  ".env.example",
  "src/lib/env.ts",
  "src/lib/supabase/client.ts",
  "src/lib/supabase/server.ts",
  "src/lib/supabase/middleware.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
];

export function validateBuildOutput(output: BuildOutput): { valid: boolean; missing: string[] } {
  const filePaths = output.files.map((f) => f.path);
  const missing = REQUIRED_FILES.filter((req) => !filePaths.some((p) => p.endsWith(req) || p === req));
  const emptyFiles = output.files.filter((f) => !f.content || f.content.trim() === "");
  if (emptyFiles.length > 0) {
    missing.push(...emptyFiles.map((f) => `${f.path} (empty)`));
  }
  return { valid: missing.length === 0, missing };
}

export function buildSystemPromptForBuild(input: BuildInput, projectContext?: { description?: string }): string {
  const contextBlock = projectContext?.description
    ? `\nCONTEXTO DO PROJETO: ${projectContext.description}`
    : "";

  return `Você é um engenheiro de software sênior. Gere um PROJETO COMPLETO como JSON estruturado.

REQUISITOS DO SISTEMA:
- Tipo: ${input.tipo_de_sistema}
- Objetivo: ${input.objetivo}
- Público: ${input.publico_alvo}
- Módulos: ${input.modulos_necessarios}
- Usuários: ${input.tipo_de_usuarios}
- Auth: ${input.precisa_auth}
- Pagamento: ${input.precisa_pagamento}
- Multi-usuário: ${input.multiusuario}
- Stack: Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase (Auth + Postgres + RLS)
- Nível: ${input.nivel_producao}${contextBlock}
${input.observacoes_extras ? `\nOBSERVAÇÕES: ${input.observacoes_extras}` : ""}

STACK OBRIGATÓRIA:
- Next.js 14+ App Router (NÃO Pages Router)
- TypeScript strict
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Integração com OpenAI API (Chat Completions) via rota server-side (não expor chave no client)
- Compatível com Vercel deploy

ROBUSTEZ OBRIGATÓRIA (NÍVEL PRODUÇÃO):
- Nunca quebrar build/render quando faltar variável de ambiente
- Implementar src/lib/env.ts com validação centralizada (sem usar "!")
- Implementar src/lib/supabase/client.ts, src/lib/supabase/server.ts e src/lib/supabase/middleware.ts com fallback seguro
- Se NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY estiver ausente:
  - NÃO lançar erro em import/global scope
  - Exibir UI de configuração ("Setup necessário") apenas nos módulos que dependem de Supabase
  - Permitir que páginas públicas e app subam normalmente
  - Middleware deve ignorar checagens de auth e seguir request
- README precisa ter seção "Configuração de Ambiente" com passos explícitos para copiar .env.example e preencher chaves
- Em package.json, usar versões estáveis modernas sem fixar patches antigos de Next.js

RESPONDA EXCLUSIVAMENTE com JSON válido no formato:
{
  "project_name": "nome-do-projeto",
  "description": "Descrição técnica",
  "stack": ["next.js", "typescript", "tailwind", "supabase"],
  "files": [
    {"path": "package.json", "content": "..."},
    {"path": "tsconfig.json", "content": "..."},
    {"path": "tailwind.config.ts", "content": "..."},
    {"path": "next.config.ts", "content": "..."},
    {"path": "README.md", "content": "..."},
    {"path": ".env.example", "content": "..."},
    {"path": "src/app/layout.tsx", "content": "..."},
    {"path": "src/app/page.tsx", "content": "..."},
    {"path": "src/app/api/ai/openai/route.ts", "content": "..."},
    {"path": "src/lib/openai.ts", "content": "..."},
    {"path": "src/lib/env.ts", "content": "..."},
    {"path": "src/lib/supabase/client.ts", "content": "..."},
    {"path": "src/lib/supabase/server.ts", "content": "..."},
    {"path": "src/lib/supabase/middleware.ts", "content": "..."},
    {"path": "src/middleware.ts", "content": "..."},
    {"path": "src/components/system/setup-required.tsx", "content": "..."},
    {"path": "src/components/...", "content": "..."},
    {"path": "src/modules/...", "content": "..."},
    {"path": "src/types/...", "content": "..."}
  ],
  "env_example": ["NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co", "NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY", "OPENAI_API_KEY=YOUR_OPENAI_KEY"],
  "sql_migrations": ["CREATE TABLE ...; ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY ...;"],
  "run_instructions": ["npm install", "cp .env.example .env.local", "Preencher variáveis obrigatórias", "npx supabase db push", "npm run dev"]
}

REGRAS ABSOLUTAS:
- NÃO inclua texto fora do JSON
- NÃO use placeholders vazios — gere código funcional real
- Gere CRUD completo para cada módulo
- Auth funcional com Supabase
- RLS em todas as tabelas
- Dashboard com métricas
- Landing page quando aplicável
- Layout responsivo
- Código tipado e modular
- Pronto para deploy na Vercel
- Incluir integração funcional com OpenAI API (rota server-side + helper)
- Nunca exponha OPENAI_API_KEY no client
- Mínimo 15 arquivos`;
}
