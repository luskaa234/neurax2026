export interface SandboxInstance {
  id: string;
  projectId: string;
  path: string;
  port: number;
  startedAt: string;
  expiresAt: string;
  status: "installing" | "running" | "stopped" | "error";
  pid?: number;
  logs: string[];
  stoppedAt?: string;
}

export interface SandboxLimits {
  timeoutMs: number;
  memoryMb: number;
  cpuShares: number;
}
