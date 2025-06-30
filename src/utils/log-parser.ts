import type { TaskLogEntry } from "../types/task.js";

interface ToolUsage {
  toolName: string;
  input?: any;
  output?: any;
  fileName?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

export class LogParser {
  /**
   * Parse agent output and extract structured information
   */
  static parseAgentOutput(output: string, source: 'claude' | 'gemini'): TaskLogEntry[] {
    const entries: TaskLogEntry[] = [];
    const lines = output.split('\n');
    
    let currentToolUsage: ToolUsage | null = null;
    let inToolBlock = false;

    for (const line of lines) {
      // Detect Claude tool usage patterns
      if (source === 'claude') {
        // Tool invocation start
        if (line.includes('<function_calls>') || line.includes('I\'ll use the')) {
          inToolBlock = true;
          currentToolUsage = { toolName: '', startTime: new Date().toISOString() };
          continue;
        }

        // Tool name extraction
        if (inToolBlock && line.includes('<invoke name="')) {
          const match = line.match(/name="([^"]+)"/);
          if (match && currentToolUsage) {
            currentToolUsage.toolName = match[1];
          }
        }

        // File path extraction
        if (inToolBlock && (line.includes('file_path') || line.includes('path'))) {
          const match = line.match(/"([^"]+\.[^"]+)"/);
          if (match && currentToolUsage) {
            currentToolUsage.fileName = match[1];
          }
        }

        // Tool invocation end
        if (line.includes('</function_calls>')) {
          inToolBlock = false;
          if (currentToolUsage?.toolName) {
            entries.push({
              timestamp: currentToolUsage.startTime || new Date().toISOString(),
              level: 'info',
              type: 'tool',
              message: `Using tool: ${currentToolUsage.toolName}${currentToolUsage.fileName ? ` on ${currentToolUsage.fileName}` : ''}`,
              metadata: currentToolUsage
            });
          }
          currentToolUsage = null;
        }
      }
      
      // Detect Gemini patterns (placeholder for now)
      if (source === 'gemini') {
        // TODO: Add Gemini-specific parsing patterns
      }
      
      // Generic output detection
      if (!inToolBlock && line.trim()) {
        entries.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          type: 'output',
          message: line
        });
      }
    }
    
    return entries;
  }
}