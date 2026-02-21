import { supabase } from "@/integrations/supabase/client";

export interface PreviewRunnerSession {
  id: string;
  buildId: string;
  state: "active" | "stopped";
  status: "queued" | "installing" | "starting" | "running" | "failed" | "stopped";
  url: string | null;
  port: number | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  projectHash: string | null;
}

const PREVIEW_RUNNER_BASE_URL = (import.meta.env.VITE_PREVIEW_RUNNER_URL as string | undefined)?.trim() || "http://127.0.0.1:4310";

function getStorageKey(buildId: string) {
  return `preview_runner_session:${buildId}`;
}

export function getStoredSessionId(buildId: string): string | null {
  return localStorage.getItem(getStorageKey(buildId));
}

export function storeSessionId(buildId: string, sessionId: string) {
  localStorage.setItem(getStorageKey(buildId), sessionId);
}

export function clearStoredSessionId(buildId: string) {
  localStorage.removeItem(getStorageKey(buildId));
}

async function getAuthHeader() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sessao invalida para iniciar preview runner.");
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as Record<string, unknown>).error === "string"
        ? (payload as Record<string, string>).error
        : `Erro no preview runner (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function startPreviewRunner(buildId: string): Promise<PreviewRunnerSession> {
  const headers = await getAuthHeader();

  const response = await fetch(`${PREVIEW_RUNNER_BASE_URL}/runtime/preview-runner/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({ buildId }),
  });

  const payload = await parseResponse<{ session: PreviewRunnerSession }>(response);
  return payload.session;
}

export async function getPreviewRunnerSession(sessionId: string): Promise<PreviewRunnerSession> {
  const headers = await getAuthHeader();
  const response = await fetch(`${PREVIEW_RUNNER_BASE_URL}/runtime/preview-runner/${sessionId}`, {
    method: "GET",
    headers,
  });

  const payload = await parseResponse<{ session: PreviewRunnerSession }>(response);
  return payload.session;
}

export async function getPreviewRunnerLogs(sessionId: string): Promise<string[]> {
  const headers = await getAuthHeader();
  const response = await fetch(`${PREVIEW_RUNNER_BASE_URL}/runtime/preview-runner/${sessionId}/logs`, {
    method: "GET",
    headers,
  });

  const payload = await parseResponse<{ logs: string[] }>(response);
  return payload.logs || [];
}

export async function stopPreviewRunner(sessionId: string): Promise<PreviewRunnerSession> {
  const headers = await getAuthHeader();
  const response = await fetch(`${PREVIEW_RUNNER_BASE_URL}/runtime/preview-runner/${sessionId}/stop`, {
    method: "POST",
    headers,
  });

  const payload = await parseResponse<{ session: PreviewRunnerSession }>(response);
  return payload.session;
}
