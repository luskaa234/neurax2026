export interface PreviewStartInput {
  projectId: string;
  files: Record<string, string>;
}

export interface PreviewStartResult {
  instanceId: string;
  status: string;
  url?: string;
}

const RUNNER_URL = import.meta.env.VITE_PREVIEW_RUNNER_URL || "http://127.0.0.1:4310";

export async function startPreviewSandbox(input: PreviewStartInput): Promise<PreviewStartResult> {
  const response = await fetch(`${RUNNER_URL}/runtime/preview-runner/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "failed_to_start_preview");
  }

  const data = (await response.json()) as { instance: { id: string; status: string; port?: number } };

  return {
    instanceId: data.instance.id,
    status: data.instance.status,
    url: data.instance.port ? `http://127.0.0.1:${data.instance.port}` : undefined,
  };
}

export async function stopPreviewSandbox(instanceId: string): Promise<void> {
  const response = await fetch(`${RUNNER_URL}/runtime/preview-runner/stop/${instanceId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "failed_to_stop_preview");
  }
}
