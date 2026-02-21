# NEURAX Modular Builder Platform

NEURAX foi reestruturado para o modelo:

`Engine Modular + Templates Base + Orchestrator + IA Assistiva`

A plataforma não usa mais geração total de sistema por prompt único como mecanismo principal.

## Arquitetura do Monorepo

```txt
/apps
  /web
  /sandbox
/templates
  /saas-base
  /marketplace-base
  /dashboard-base
  /crud-base
/modules
  /auth
  /multi-tenant
  /payments
  /booking
  /admin
  /analytics
  /notifications
  /file-upload
/packages
  /orchestrator
  /merge-engine
  /validator
  /ai-router
  /module-registry
  /template-engine
  /preview-engine
```

## Princípios Operacionais

- IA não gera arquitetura inteira do zero.
- IA não substitui template core.
- IA só atua em customização assistiva (sugestão de módulos, refinos e pequenos patches).
- Build real sempre passa por pipeline determinístico do orchestrator.

## Pipeline Obrigatório (Orchestrator)

Implementado em `packages/orchestrator/src/index.ts`:

1. Parse da intenção do usuário
2. Identificação do tipo de sistema
3. Seleção de template base
4. Seleção de módulos
5. Resolução de dependências
6. Aplicação de módulos por merge controlado
7. Validação de imports
8. Validação de dependências
9. Tentativa de build (validação estrutural)
10. Versionamento
11. Execução de preview (opcional)

## Template Base Obrigatório

Implementado em `packages/template-engine/src/index.ts`.

Todos os templates base geram:

- Next.js App Router
- Supabase client
- Auth base
- Layout com sidebar
- Middleware
- Tailwind
- Scripts npm funcionais
- `.env.example` validado

## Module Registry

Implementado em `packages/module-registry/src/index.ts` e manifests em `modules/*/module.json`.

Contrato de módulo:

- `name`
- `requiredModules`
- `dbMigrations`
- `files`
- `routes`
- `sidebarItems`
- `dependencies`
- `create`/`update` patches controlados

## Merge Engine Seguro

Implementado em `packages/merge-engine/src/index.ts`.

Garantias:

- Sem operação de delete
- Sem overwrite de arquivos críticos (`package.json`, `layout`, `middleware`, `.env.example`)
- Criação/update com guardas
- Dedupe de rotas e dependências

## AI Router

Implementado em `packages/ai-router/src/index.ts`.

Roteamento:

- `low` -> Gemini
- `high` -> OpenAI
- `medium` -> provider configurado (fallback automático)
- Retry parcial com fallback entre providers

## Preview Profissional (Sandbox Local)

Implementado em `apps/sandbox/src/server.ts` + `packages/preview-engine/src/index.ts`.

Suporte a:

- isolamento por projeto em diretório temporário
- `npm install` automático
- `npm run dev` automático
- porta dinâmica
- captura de logs (`stdout`/`stderr`)
- timeout automático
- kill automático
- endpoints de status e logs

Endpoints locais:

- `POST /runtime/preview-runner/start`
- `GET /runtime/preview-runner/status/:id`
- `GET /runtime/preview-runner/logs/:id`
- `DELETE /runtime/preview-runner/stop/:id`

## Segurança

Camadas aplicadas no fluxo:

- RLS no Supabase (migrations existentes)
- separação `anon` vs `service role`
- bloqueio por inadimplência em Edge Functions
- CORS padronizado via `supabase/functions/_shared/cors.ts`
- validação de plano de build no `packages/validator`
- proteção de arquivos críticos no merge

## MVP Realista Entregue

Fluxo principal para SaaS base:

- Auth
- Multi-tenant
- Dashboard
- CRUD base
- Preview funcional
- ZIP válido via build pipeline

## Execução Local

```sh
npm install
npm run sandbox
npm run orchestrator:mvp
npm run build
```

## Setup Supabase

### Migrations

```sh
supabase link --project-ref <PROJECT_REF>
supabase db push
```

### Secrets

```sh
supabase secrets set \
  SUPABASE_URL="https://XXXX.supabase.co" \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  GEMINI_API_KEY="..." \
  OPENAI_API_KEY="..." \
  GEMINI_MODEL="gemini-1.5-flash" \
  OPENAI_MODEL="gpt-4o-mini" \
  CORS_ALLOWED_ORIGIN="http://localhost:8081"
```

### Deploy de Functions

```sh
supabase functions deploy parse-system-intent
supabase functions deploy generate-content
supabase functions deploy build-system
supabase functions deploy orchestrate-system
```

### Logs

```sh
supabase functions logs generate-content
supabase functions logs build-system
supabase functions logs orchestrate-system
```

## Checklist de Produção

- [ ] `supabase db push` sem pendências
- [ ] secrets obrigatórios definidos
- [ ] `npm run build` verde
- [ ] sandbox health check: `GET /health`
- [ ] orchestrator retorna `validation.valid=true` para cenários base
- [ ] rotas duplicadas bloqueadas
- [ ] arquivos críticos protegidos no merge
- [ ] preview com timeout e kill automático funcionando
- [ ] logs de build/preview armazenados e auditáveis
- [ ] políticas de billing bloqueando geração indevida
# neurax2026
