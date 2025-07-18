/**
 * Heartbeat status CLI command
 */

import type { CLICommand, CLIContext } from "./types.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const command: CLICommand = {
  name: "status",
  description: "Show current heartbeat status",
  options: [
    {
      name: "format",
      alias: "f",
      type: "string",
      description: "Output format (json, table)",
      default: "table",
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      // For now, read the heartbeat status from the file directly
      // In a real implementation, we'd get this from the running module
      const stateDir = process.env.STATEDIR || "./state";
      const statusFile = join(stateDir, "data", "heartbeat.json");

      if (!existsSync(statusFile)) {
        console.log("No heartbeat status found. Is the heartbeat daemon running?");
        return;
      }

      const statusData = JSON.parse(readFileSync(statusFile, "utf-8"));

      if (context.flags.format === "json") {
        console.log(JSON.stringify(statusData, null, 2));
      } else {
        console.log("Heartbeat Status");
        console.log("================");
        console.log(`Status:     ${statusData.status}`);
        console.log(`Timestamp:  ${statusData.timestamp}`);
        console.log(`Uptime:     ${statusData.system?.uptime || "N/A"} seconds`);
        console.log(
          `Memory:     ${statusData.system?.memory?.usedPercent?.toFixed(1) || "N/A"}% used`,
        );
        console.log(`Load Avg:   ${statusData.system?.loadAvg?.join(", ") || "N/A"}`);
      }
    } catch (error) {
      console.error("Error reading heartbeat status:", error);
      process.exit(1);
    }
  },
};

export default command;
