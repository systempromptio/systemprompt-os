/**
 * @fileoverview Help command implementation
 * @module cli/commands/help
 */

export class HelpCommand {
  async execute(): Promise<void> {
    console.log(`
systemprompt-os - An operating system for autonomous agents

Usage: systemprompt <command> [options]

Commands:
  status              Check the status of systemprompt-os
  start [options]     Start systemprompt-os server
    -p, --port        Port to run the server on (default: 8080)
    -d, --daemon      Run in daemon mode
  stop                Stop systemprompt-os server
  config [key] [val]  Get or set configuration values
  test [options]      Run tests
    -e, --e2e         Run end-to-end tests
    -w, --watch       Run tests in watch mode
  help                Show this help message

Examples:
  systemprompt status
  systemprompt start --port 3000
  systemprompt start --daemon
  systemprompt config
  systemprompt config memory.provider
  systemprompt config memory.provider redis
  systemprompt test
  systemprompt test --e2e
  systemprompt test --watch

For more information, visit: https://systemprompt.io
    `);
    
    process.exit(0);
  }
}