export interface SystemBuilderFields {
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

interface ProjectContext {
  description?: string;
  [key: string]: unknown;
}

export function buildSystemPrompt(
  fields: SystemBuilderFields,
  context?: ProjectContext | null
): string {
  const contextBlock = context?.description
    ? `\n\nCONTEXTO DO PROJETO:\n${context.description}`
    : "";

  const stackLine = fields.stack_preferida
    ? `Stack preferida: ${fields.stack_preferida}`
    : "Stack: a definir conforme melhor prática";

  const obsLine = fields.observacoes_extras
    ? `\n\nOBSERVAÇÕES ADICIONAIS DO USUÁRIO:\n${fields.observacoes_extras}`
    : "";

  return `Você é um arquiteto de software sênior e engenheiro de sistemas. Sua tarefa é gerar um PROMPT MESTRE DE DESENVOLVIMENTO DE SISTEMA completo, técnico e estruturado.

NÃO gere código. Gere uma ESPECIFICAÇÃO TÉCNICA completa em formato de prompt mestre que será usada em ferramentas de desenvolvimento por IA (builders de projeto).

DADOS DO SISTEMA SOLICITADO:
- Tipo: ${fields.tipo_de_sistema}
- Objetivo: ${fields.objetivo}
- Público-alvo: ${fields.publico_alvo}
- Módulos necessários: ${fields.modulos_necessarios}
- Tipos de usuários: ${fields.tipo_de_usuarios}
- Autenticação: ${fields.precisa_auth}
- Pagamento integrado: ${fields.precisa_pagamento}
- Multiusuário: ${fields.multiusuario}
- ${stackLine}
- Nível de produção: ${fields.nivel_producao}${contextBlock}${obsLine}

REQUISITO DE IA:
- Se houver recursos de IA no sistema, utilize a OpenAI API (Chat Completions) com integração server-side e variável OPENAI_API_KEY. Não expor chave no client.

FORMATO OBRIGATÓRIO DE SAÍDA — O prompt mestre DEVE conter TODOS os blocos abaixo, detalhados e técnicos:

1. **IDENTIDADE DO PRODUTO** — Nome, propósito, posicionamento
2. **OBJETIVO** — O que o sistema resolve, valor entregue
3. **PÚBLICO** — Perfis de usuário, personas, necessidades
4. **STACK OBRIGATÓRIA** — Tecnologias, frameworks, linguagens, banco de dados
5. **ARQUITETURA** — Padrão arquitetural, separação de responsabilidades, camadas
6. **BANCO DE DADOS** — Tabelas, relacionamentos, índices, constraints, RLS
7. **MÓDULOS** — Lista completa de módulos funcionais com descrição
8. **PÁGINAS** — Todas as telas/rotas com descrição de funcionalidade
9. **APIs** — Endpoints, métodos, payloads, respostas
10. **AUTENTICAÇÃO** — Fluxo de auth, providers, sessões, tokens
11. **SEGURANÇA** — RLS, validações, sanitização, CORS, rate limiting
12. **PERMISSÕES** — Roles, níveis de acesso, matriz de permissões
13. **QUOTAS/PLANOS** — Se SaaS: planos, limites, billing, upgrade flow
14. **LANDING PAGE** — Se comercial: seções, CTA, SEO, responsividade
15. **DASHBOARD** — Métricas, gráficos, KPIs, filtros
16. **REGRAS DE NEGÓCIO** — Lógica de domínio, workflows, estados
17. **VALIDAÇÕES** — Client-side e server-side, schemas, error handling
18. **LOGS** — Logging, auditoria, monitoramento
19. **DEPLOY** — CI/CD, ambiente, variáveis, infraestrutura
20. **QUALIDADE DE CÓDIGO** — Padrões, linting, testes, tipagem
21. **REQUISITOS DE PRODUÇÃO** — Performance, escalabilidade, backup, uptime

REGRAS:
- Seja extremamente detalhado e técnico
- NÃO use linguagem de marketing ou copywriting
- NÃO simplifique a arquitetura
- NÃO gere código — gere especificação
- Use estilo de engenharia de software profissional
- O resultado deve ser um prompt pronto para colar em um builder de IA`;
}

export function isSystemBuilderCategory(category: string): boolean {
  return category === "system_builder";
}

const SYSTEM_BUILDER_REQUIRED_FIELDS = [
  "tipo_de_sistema",
  "objetivo",
  "publico_alvo",
  "modulos_necessarios",
  "tipo_de_usuarios",
  "precisa_auth",
  "precisa_pagamento",
  "multiusuario",
  "nivel_producao",
];

export function validateSystemBuilderFields(
  fields: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing = SYSTEM_BUILDER_REQUIRED_FIELDS.filter(
    (f) => !fields[f] || fields[f].trim() === ""
  );
  return { valid: missing.length === 0, missing };
}
