import { runOrchestration } from "../packages/orchestrator/src";

async function main() {
  const result = await runOrchestration({
    description: "SaaS de agendamento com login, multi-tenant, dashboard e CRUD",
    userId: "local-dev-user",
    projectId: "local-project",
    preview: false,
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        versionTag: result.versionTag,
        valid: result.validation.valid,
        template: result.architecture.template,
        modules: result.architecture.modules,
        steps: result.steps,
        issues: result.validation.issues.slice(0, 8),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
