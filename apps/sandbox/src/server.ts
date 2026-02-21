import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import type { SandboxInstance } from "./types";

const SANDBOX_TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS || "120000");
const HOST = process.env.SANDBOX_HOST || "127.0.0.1";
const PORT = Number(process.env.SANDBOX_PORT || "4310");
const BASE_PORT = Number(process.env.SANDBOX_BASE_PORT || "5173");
const MAX_LOG_LINES = Number(process.env.SANDBOX_MAX_LOG_LINES || "400");

const instances = new Map<string, SandboxInstance>();
const processes = new Map<string, ReturnType<typeof spawn>>();

function json(data: unknown, status = 200): ResponseInit & { body: string } {
  return {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(data),
  };
}

function pushLog(id: string, line: string): void {
  const instance = instances.get(id);
  if (!instance) return;
  const nextLogs = [...instance.logs, line].slice(-MAX_LOG_LINES);
  instances.set(id, { ...instance, logs: nextLogs });
}

async function createProjectTemp(projectId: string, files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `neurax-${projectId}-`));
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return root;
}

function parsePort(line: string): number | null {
  const match = line.match(/(?:localhost|127\.0\.0\.1):(\d{2,5})/);
  if (!match) return null;
  return Number(match[1]);
}

function attachProcessLogs(id: string, proc: ReturnType<typeof spawn>, phase: "install" | "dev"): void {
  proc.stdout.on("data", (buf) => {
    const text = String(buf);
    pushLog(id, `[${phase}:stdout] ${text.trim()}`);

    if (phase === "dev") {
      const detectedPort = parsePort(text);
      const instance = instances.get(id);
      if (instance) {
        instances.set(id, {
          ...instance,
          status: "running",
          port: detectedPort ?? instance.port,
          pid: proc.pid,
        });
      }
    }
  });

  proc.stderr.on("data", (buf) => {
    pushLog(id, `[${phase}:stderr] ${String(buf).trim()}`);
  });
}

async function startInstance(projectId: string, files: Record<string, string>): Promise<SandboxInstance> {
  const id = randomUUID();
  const path = await createProjectTemp(projectId, files);
  const port = BASE_PORT + instances.size;

  const installProc = spawn("npm", ["install", "--prefer-offline"], { cwd: path, stdio: "pipe", shell: true });
  processes.set(id, installProc);

  const instance: SandboxInstance = {
    id,
    projectId,
    path,
    port,
    status: "installing",
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SANDBOX_TIMEOUT_MS).toISOString(),
    pid: installProc.pid,
    logs: ["sandbox boot sequence started"],
  };

  instances.set(id, instance);
  attachProcessLogs(id, installProc, "install");

  installProc.on("exit", (code) => {
    if (code !== 0) {
      const current = instances.get(id);
      if (current) {
        instances.set(id, {
          ...current,
          status: "error",
          logs: [...current.logs, `install failed with code ${code}`].slice(-MAX_LOG_LINES),
        });
      }
      return;
    }

    const devProc = spawn("npm", ["run", "dev", "--", "--port", String(port), "--host", HOST], {
      cwd: path,
      stdio: "pipe",
      shell: true,
    });

    processes.set(id, devProc);
    attachProcessLogs(id, devProc, "dev");

    devProc.on("exit", (devCode) => {
      const current = instances.get(id);
      if (!current) return;
      instances.set(id, {
        ...current,
        status: current.status === "error" ? "error" : "stopped",
        stoppedAt: new Date().toISOString(),
        logs: [...current.logs, `dev process exited with code ${devCode}`].slice(-MAX_LOG_LINES),
      });
    });
  });

  setTimeout(() => {
    void stopInstance(id, "timeout");
  }, SANDBOX_TIMEOUT_MS).unref();

  return instance;
}

async function stopInstance(id: string, reason: "manual" | "timeout" = "manual"): Promise<void> {
  const proc = processes.get(id);
  if (proc && !proc.killed) proc.kill("SIGKILL");
  processes.delete(id);

  const instance = instances.get(id);
  if (instance) {
    await rm(instance.path, { recursive: true, force: true });
    instances.set(id, {
      ...instance,
      status: instance.status === "error" ? "error" : "stopped",
      stoppedAt: new Date().toISOString(),
      logs: [...instance.logs, `sandbox stopped (${reason})`].slice(-MAX_LOG_LINES),
    });
  }
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    const out = json({ error: "invalid request" }, 400);
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const out = json({ ok: true, instances: instances.size });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    return;
  }

  if (req.method === "POST" && req.url === "/runtime/preview-runner/start") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body) as { projectId: string; files: Record<string, string> };
        if (!parsed.projectId || !parsed.files || Object.keys(parsed.files).length === 0) {
          const out = json({ error: "projectId and files are required" }, 400);
          res.writeHead(out.status, out.headers);
          res.end(out.body);
          return;
        }
        const instance = await startInstance(parsed.projectId, parsed.files || {});
        const out = json({ instance });
        res.writeHead(out.status, out.headers);
        res.end(out.body);
      } catch (error) {
        const out = json({ error: error instanceof Error ? error.message : "invalid payload" }, 500);
        res.writeHead(out.status, out.headers);
        res.end(out.body);
      }
    });
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/runtime/preview-runner/status/")) {
    const id = req.url.split("/").pop() || "";
    const instance = instances.get(id);
    const out = instance ? json({ instance }) : json({ error: "not found" }, 404);
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/runtime/preview-runner/logs/")) {
    const id = req.url.split("/").pop() || "";
    const instance = instances.get(id);
    const out = instance ? json({ logs: instance.logs, status: instance.status }) : json({ error: "not found" }, 404);
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    return;
  }

  if (req.method === "DELETE" && req.url.startsWith("/runtime/preview-runner/stop/")) {
    const id = req.url.split("/").pop() || "";
    await stopInstance(id, "manual");
    const out = json({ ok: true });
    res.writeHead(out.status, out.headers);
    res.end(out.body);
    return;
  }

  const out = json({ error: "not found" }, 404);
  res.writeHead(out.status, out.headers);
  res.end(out.body);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[sandbox] running at http://${HOST}:${PORT}`);
});
