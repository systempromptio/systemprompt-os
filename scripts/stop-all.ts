#!/usr/bin/env node

/**
 * stop-all.ts - Stop all services gracefully
 */

import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";
import * as dotenv from "dotenv";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Load environment variables from .env file
dotenv.config({ path: path.join(projectRoot, '.env') });

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
};

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

async function stopDocker(): Promise<void> {
  log("Stopping Docker services...", colors.blue);

  return new Promise((resolve) => {
    const docker = spawn("docker", ["compose", "down"], {
      cwd: projectRoot,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: process.env.COMPOSE_PROJECT_NAME || "systemprompt-coding-agent",
      },
    });

    docker.on("close", (code: number | null) => {
      if (code === 0) {
        log("✓ Docker services stopped", colors.green);
      } else {
        log("⚠ Failed to stop Docker services", colors.red);
      }
      resolve();
    });
  });
}

async function stopDaemon(): Promise<void> {
  log("Stopping daemon...", colors.blue);

  // Check in the daemon logs directory
  const pidFile = path.join(projectRoot, "daemon", "logs", "daemon.pid");

  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, "utf-8").trim());
    try {
      // Check if this PID is actually our daemon
      const { stdout } = await execAsync(`ps -p ${pid} -o command=`);
      const command = stdout.trim();

      // Verify it's our daemon by checking if it contains our project path
      if (command && command.includes(`${projectRoot}/daemon/dist/host-bridge-daemon.js`)) {
        process.kill(pid, "SIGTERM");
        log(`✓ Daemon stopped (PID: ${pid})`, colors.green);
        fs.unlinkSync(pidFile);
      } else {
        // PID exists but it's not our daemon
        fs.unlinkSync(pidFile);
        log("⚠ Daemon PID file was stale (removed)", colors.blue);

        // Try to find any daemon process for this installation
        await findAndStopDaemon();
      }
    } catch (e) {
      // Process doesn't exist or we can't check it, remove stale PID file
      fs.unlinkSync(pidFile);
      log("⚠ Daemon was not running (stale PID file removed)", colors.blue);

      // Try to find any daemon process for this installation
      await findAndStopDaemon();
    }
  } else {
    // No PID file, but check if daemon is running anyway
    await findAndStopDaemon();
  }
}

async function findAndStopDaemon(): Promise<void> {
  try {
    // Find any daemon process for this specific installation
    const { stdout } = await execAsync(
      `ps aux | grep "node.*${projectRoot}/daemon/dist/host-bridge-daemon.js" | grep -v grep || true`,
    );

    if (stdout.trim()) {
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const pid = parseInt(parts[1]);
        if (pid) {
          process.kill(pid, "SIGTERM");
          log(`✓ Found and stopped daemon (PID: ${pid})`, colors.green);
        }
      }
    } else {
      log("⚠ No daemon process found for this installation", colors.blue);
    }
  } catch (e) {
    log("⚠ Could not check for daemon processes", colors.blue);
  }
}

async function main(): Promise<void> {
  log("\n==== Stopping All Services ====\n", colors.blue);

  await stopDocker();
  await stopDaemon();

  log("\n✓ All services stopped\n", colors.green);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
