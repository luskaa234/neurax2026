# Preview Runner

Servico local para executar preview real de projetos gerados no Builder.

## Variaveis obrigatorias

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Rodar

```bash
npm run preview-runner
```

Padrao: `http://127.0.0.1:4310`

## Endpoints

- `GET /health`
- `POST /runtime/preview-runner/start`
- `GET /runtime/preview-runner/:sessionId`
- `GET /runtime/preview-runner/:sessionId/logs`
- `POST /runtime/preview-runner/:sessionId/stop`
