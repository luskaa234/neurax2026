export interface PreviewPayload {
  projectId: string;
  files: Record<string, string>;
}

export interface PreviewInstance {
  id: string;
  status: "queued" | "installing" | "running" | "error" | "stopped";
  url?: string;
  logs: string[];
}

interface RunnerInstanceResponse {
  instance: {
    id: string;
    port: number;
    status: PreviewInstance["status"];
    logs?: string[];
  };
}

export async function startPreview(payload: PreviewPayload, runnerUrl: string): Promise<PreviewInstance> {
  const response = await fetch(`${runnerUrl}/runtime/preview-runner/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    return { id: "", status: "error", logs: [message] };
  }

  const data = (await response.json()) as RunnerInstanceResponse;
  return {
    id: data.instance.id,
    status: data.instance.status,
    url: `http://127.0.0.1:${data.instance.port}`,
    logs: data.instance.logs || ["preview started"],
  };
}

export async function getPreviewStatus(id: string, runnerUrl: string): Promise<PreviewInstance> {
  const response = await fetch(`${runnerUrl}/runtime/preview-runner/status/${id}`);
  if (!response.ok) {
    const message = await response.text();
    return { id, status: "error", logs: [message] };
  }

  const data = (await response.json()) as RunnerInstanceResponse;
  return {
    id: data.instance.id,
    status: data.instance.status,
    url: `http://127.0.0.1:${data.instance.port}`,
    logs: data.instance.logs || [],
  };
}

export async function getPreviewLogs(id: string, runnerUrl: string): Promise<string[]> {
  const response = await fetch(`${runnerUrl}/runtime/preview-runner/logs/${id}`);
  if (!response.ok) {
    return [await response.text()];
  }
  const data = (await response.json()) as { logs?: string[] };
  return data.logs || [];
}

export async function stopPreview(id: string, runnerUrl: string): Promise<boolean> {
  const response = await fetch(`${runnerUrl}/runtime/preview-runner/stop/${id}`, { method: "DELETE" });
  return response.ok;
}
