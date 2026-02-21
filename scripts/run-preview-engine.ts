import { startPreview } from "../packages/preview-engine/src";

async function main() {
  const runnerUrl = process.env.VITE_PREVIEW_RUNNER_URL || "http://127.0.0.1:4310";
  const preview = await startPreview(
    {
      projectId: "local-preview",
      files: {
        "package.json": JSON.stringify({
          name: "tmp-preview",
          private: true,
          scripts: { dev: "vite" },
          dependencies: { vite: "^5.4.19" },
        }),
        "index.html": "<html><body><h1>Preview</h1></body></html>",
      },
    },
    runnerUrl,
  );

  // eslint-disable-next-line no-console
  console.log(preview);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
