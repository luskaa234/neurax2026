import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import { randomUUID, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const HOST = process.env.PREVIEW_RUNNER_HOST || "127.0.0.1";
const PORT = Number(process.env.PREVIEW_RUNNER_PORT || 4310);
const STARTUP_TIMEOUT_MS = Number(process.env.PREVIEW_RUNNER_STARTUP_TIMEOUT_MS || 120_000);
const DISABLE_NETWORK = process.env.PREVIEW_RUNNER_DISABLE_NETWORK === "1";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase env vars for preview runner.");
  console.error("Required: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sessions = new Map();

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function appendLog(session, channel, message) {
  const line = `[${new Date().toISOString()}] [${channel}] ${message}`;
  session.logs.push(line);
  if (session.logs.length > 4000) {
    session.logs.splice(0, session.logs.length - 4000);
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sanitizeFilePath(filePath) {
  const normalized = path.posix.normalize(filePath).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Could not allocate port"));
        return;
      }
      const selectedPort = addr.port;
      server.close((err) => (err ? reject(err) : resolve(selectedPort)));
    });
  });
}

async function waitForHttpReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status < 500) return;
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Runner did not become ready within timeout.");
}

function killProcessTree(child) {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    child.kill("SIGKILL");
    return;
  }

  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}

async function stopSession(session, reason = "stopped") {
  if (session.state === "stopped") return;

  if (session.installProcess) {
    killProcessTree(session.installProcess);
    session.installProcess = null;
  }

  if (session.devProcess) {
    killProcessTree(session.devProcess);
    session.devProcess = null;
  }

  session.state = "stopped";
  session.updatedAt = new Date().toISOString();
  appendLog(session, "system", `Session stopped (${reason}).`);

  if (session.tempDir) {
    try {
      await fs.rm(session.tempDir, { recursive: true, force: true });
    } catch (error) {
      appendLog(session, "system", `Cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function getUserFromToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authorizationHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Error("Unauthorized");
  }
  return data.user;
}

async function loadBuildFilesForUser(buildId, userId) {
  const { data: build, error: buildError } = await supabaseAdmin
    .from("builds")
    .select("id, user_id")
    .eq("id", buildId)
    .single();

  if (buildError || !build) {
    throw new Error("Build not found");
  }
  if (build.user_id !== userId) {
    throw new Error("Forbidden");
  }

  const { data: files, error: filesError } = await supabaseAdmin
    .from("build_files")
    .select("path, content_text")
    .eq("build_id", buildId)
    .order("path");

  if (filesError) {
    throw new Error(filesError.message);
  }

  return files || [];
}

function getSessionSnapshot(session) {
  return {
    id: session.id,
    buildId: session.buildId,
    state: session.state,
    status: session.status,
    url: session.url,
    port: session.port,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastError: session.lastError,
    projectHash: session.projectHash,
  };
}

async function mountProjectFiles(tempDir, files) {
  const projectHash = createHash("sha256");

  for (const file of files) {
    const safePath = sanitizeFilePath(file.path);
    const targetPath = path.join(tempDir, safePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content_text || "", "utf8");

    projectHash.update(safePath);
    projectHash.update("\0");
    projectHash.update(file.content_text || "");
    projectHash.update("\0");
  }

  return projectHash.digest("hex");
}

async function runPreviewSession(session) {
  session.status = "installing";
  session.updatedAt = new Date().toISOString();
  appendLog(session, "system", "Preparing temporary project folder.");

  const baseTemp = path.join(os.tmpdir(), "content-weaver-preview-runners", session.id);
  session.tempDir = baseTemp;
  await fs.mkdir(baseTemp, { recursive: true });

  const files = await loadBuildFilesForUser(session.buildId, session.userId);
  if (!files.length) {
    throw new Error("No files found for this build.");
  }

  const projectHash = await mountProjectFiles(baseTemp, files);
  session.projectHash = projectHash;
  appendLog(session, "system", `Mounted ${files.length} files.`);

  const installEnv = {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
    npm_config_prefer_offline: "true",
    npm_config_progress: "false",
    ...(DISABLE_NETWORK ? { npm_config_offline: "true" } : {}),
  };

  session.installProcess = spawn("npm", ["install", "--prefer-offline", "--no-audit", "--fund=false"], {
    cwd: baseTemp,
    env: installEnv,
    detached: true,
  });

  session.installProcess.stdout?.on("data", (chunk) => appendLog(session, "install", chunk.toString().trimEnd()));
  session.installProcess.stderr?.on("data", (chunk) => appendLog(session, "install", chunk.toString().trimEnd()));

  const installExit = await new Promise((resolve, reject) => {
    session.installProcess.on("error", reject);
    session.installProcess.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`npm install exited with code ${code}`));
    });
  });

  if (installExit !== 0) {
    throw new Error("Installation failed.");
  }

  session.installProcess = null;
  session.status = "starting";
  session.updatedAt = new Date().toISOString();

  const selectedPort = await getFreePort();
  session.port = selectedPort;

  const devEnv = {
    ...process.env,
    PORT: String(selectedPort),
    HOST: "127.0.0.1",
    NODE_OPTIONS: "--max-old-space-size=512",
    NEXT_TELEMETRY_DISABLED: "1",
  };

  session.devProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(selectedPort)], {
    cwd: baseTemp,
    env: devEnv,
    detached: true,
  });

  session.devProcess.stdout?.on("data", (chunk) => appendLog(session, "runtime", chunk.toString().trimEnd()));
  session.devProcess.stderr?.on("data", (chunk) => appendLog(session, "runtime", chunk.toString().trimEnd()));

  session.devProcess.on("exit", (code) => {
    if (session.state === "stopped") return;
    session.state = "stopped";
    session.status = "stopped";
    session.updatedAt = new Date().toISOString();
    appendLog(session, "system", `Runtime exited with code ${code}`);
  });

  const url = `http://127.0.0.1:${selectedPort}`;
  await waitForHttpReady(url, STARTUP_TIMEOUT_MS);

  session.url = url;
  session.status = "running";
  session.updatedAt = new Date().toISOString();
  appendLog(session, "system", `Preview ready at ${url}`);
}

async function startSession(buildId, userId) {
  const id = randomUUID();
  const session = {
    id,
    buildId,
    userId,
    state: "active",
    status: "queued",
    url: null,
    port: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    lastError: null,
    projectHash: null,
    tempDir: null,
    installProcess: null,
    devProcess: null,
  };

  sessions.set(id, session);

  appendLog(session, "system", "Runner session created.");

  const timeout = setTimeout(async () => {
    if (session.status === "running" || session.state === "stopped") return;
    session.status = "failed";
    session.lastError = `Startup timeout after ${STARTUP_TIMEOUT_MS}ms`;
    session.updatedAt = new Date().toISOString();
    appendLog(session, "system", session.lastError);
    await stopSession(session, "startup-timeout");
  }, STARTUP_TIMEOUT_MS);

  runPreviewSession(session)
    .catch(async (error) => {
      session.status = "failed";
      session.lastError = error instanceof Error ? error.message : String(error);
      session.updatedAt = new Date().toISOString();
      appendLog(session, "system", `Runner failed: ${session.lastError}`);
      await stopSession(session, "error");
    })
    .finally(() => clearTimeout(timeout));

  return session;
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { error: "Bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, sessions: sessions.size });
      return;
    }

    if (req.method === "POST" && url.pathname === "/runtime/preview-runner/start") {
      const user = await getUserFromToken(req.headers.authorization);
      const body = await readBody(req);
      const buildId = typeof body.buildId === "string" ? body.buildId : "";

      if (!buildId) {
        json(res, 400, { error: "buildId is required" });
        return;
      }

      const existing = Array.from(sessions.values()).find(
        (session) => session.buildId === buildId && session.userId === user.id && session.state !== "stopped",
      );

      if (existing) {
        json(res, 200, { session: getSessionSnapshot(existing), reused: true });
        return;
      }

      const session = await startSession(buildId, user.id);
      json(res, 202, { session: getSessionSnapshot(session), reused: false });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/runtime/preview-runner/") && url.pathname.endsWith("/logs")) {
      const user = await getUserFromToken(req.headers.authorization);
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[2];
      const session = sessions.get(sessionId);

      if (!session) {
        json(res, 404, { error: "Session not found" });
        return;
      }
      if (session.userId !== user.id) {
        json(res, 403, { error: "Forbidden" });
        return;
      }

      json(res, 200, { logs: session.logs });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/runtime/preview-runner/")) {
      const user = await getUserFromToken(req.headers.authorization);
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[2];
      const session = sessions.get(sessionId);

      if (!session) {
        json(res, 404, { error: "Session not found" });
        return;
      }
      if (session.userId !== user.id) {
        json(res, 403, { error: "Forbidden" });
        return;
      }

      json(res, 200, { session: getSessionSnapshot(session) });
      return;
    }

    if (req.method === "POST" && url.pathname.startsWith("/runtime/preview-runner/") && url.pathname.endsWith("/stop")) {
      const user = await getUserFromToken(req.headers.authorization);
      const parts = url.pathname.split("/").filter(Boolean);
      const sessionId = parts[2];
      const session = sessions.get(sessionId);

      if (!session) {
        json(res, 404, { error: "Session not found" });
        return;
      }
      if (session.userId !== user.id) {
        json(res, 403, { error: "Forbidden" });
        return;
      }

      await stopSession(session, "user-request");
      json(res, 200, { session: getSessionSnapshot(session) });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    json(res, status, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`preview-runner listening at http://${HOST}:${PORT}`);
});

const shutdown = async () => {
  for (const session of sessions.values()) {
    await stopSession(session, "shutdown");
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
