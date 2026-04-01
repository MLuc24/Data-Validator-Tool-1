import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const readEnvValue = (filePath, key, fallback) => {
  if (!existsSync(filePath)) return fallback;
  const line = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : fallback;
};

const wireLogs = (name, stream, target) => {
  let buffer = "";

  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        target.write(`[${name}] ${line}\n`);
      }
    }
  });

  stream.on("end", () => {
    if (buffer.length > 0) {
      target.write(`[${name}] ${buffer}\n`);
    }
  });
};

const start = (name, args) => {
  const child =
    process.platform === "win32"
      ? spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `Set-Location '${rootDir}'; pnpm ${args.join(" ")}`,
          ],
          {
            stdio: ["ignore", "pipe", "pipe"],
          },
        )
      : spawn("sh", ["-lc", `cd '${rootDir}' && pnpm ${args.join(" ")}`], {
          stdio: ["ignore", "pipe", "pipe"],
        });

  if (!child.stdout || !child.stderr) {
    throw new Error(`Failed to capture logs for ${name}`);
  }

  wireLogs(name, child.stdout, process.stdout);
  wireLogs(name, child.stderr, process.stderr);
  return child;
};

const apiPort = readEnvValue(
  join(rootDir, "artifacts", "api-server", ".env"),
  "PORT",
  "8080",
);
const uiPort = readEnvValue(
  join(rootDir, "artifacts", "upload-ui", ".env"),
  "PORT",
  "5173",
);

console.log(`Starting API on http://127.0.0.1:${apiPort}`);
console.log(`Starting UI on http://127.0.0.1:${uiPort}`);
console.log("Press Ctrl+C to stop both processes.");

const api = start("api", ["--filter", "@workspace/api-server", "run", "dev"]);
const ui = start("ui", ["--filter", "@workspace/upload-ui", "run", "dev"]);

let shuttingDown = false;

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [api, ui]) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
};

api.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[api] exited with code ${code ?? 0}`);
    shutdown(code ?? 1);
  }
});

ui.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[ui] exited with code ${code ?? 0}`);
    shutdown(code ?? 1);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
