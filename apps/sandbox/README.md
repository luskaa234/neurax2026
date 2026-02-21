# NEURAX Sandbox Preview Runner

Runner local isolado para preview de projetos gerados pelo orchestrator.

## Recursos

- diretório temporário isolado por projeto
- instalação automática (`npm install`)
- execução automática (`npm run dev`)
- porta dinâmica
- captura de logs de instalação e runtime
- timeout e kill automático

## Endpoints

- `GET /health`
- `POST /runtime/preview-runner/start`
- `GET /runtime/preview-runner/status/:id`
- `GET /runtime/preview-runner/logs/:id`
- `DELETE /runtime/preview-runner/stop/:id`

## Run

```sh
npm run sandbox
```
