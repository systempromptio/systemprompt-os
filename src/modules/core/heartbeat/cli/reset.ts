/**
 * Heartbeat reset CLI command
 */

import type { CLICommand, CLIContext } from "./types.js";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";

export const command: CLICommand = {
  name: "reset",
  description: "Reset heartbeat state",
  options: [
    {
      name: "force",
      alias: "f",
      type: "boolean",
      description: "Force reset without confirmation",
      default: false,
    },
  ],
  async execute(context: CLIContext): Promise<void> {
    try {
      const stateDir = process.env.STATEDIR || "./state";
      const statusFile = join(stateDir, "data", "heartbeat.json");

      if (!existsSync(statusFile)) {
        console.log("No heartbeat state to reset.");
        return;
      }

      if (!context.flags.force) {
        console.log("This will reset the heartbeat state.");
        console.log("Use --force to skip this confirmation.");
        return;
      }

      unlinkSync(statusFile);
      console.log("Heartbeat state has been reset.");
    } catch (error) {
      console.error("Error resetting heartbeat state:", error);
      process.exit(1);
    }
  },
};

export default command;
