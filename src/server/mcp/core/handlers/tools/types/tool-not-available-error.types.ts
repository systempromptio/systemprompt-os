/**
 * Tool not available error.
 * Custom error class for unavailable tool scenarios.
 * @file Tool not available error class definition.
 * @module handlers/tools/types/tool-not-available-error
 */
export class ToolNotAvailableError extends Error {
  /**
   * Creates a tool not available error.
   * @param tool - Name of the tool that is not available.
   */
  constructor(tool: string) {
    super(`Tool not available: ${tool}`);
    this.name = "ToolNotAvailableError";
  }
}
