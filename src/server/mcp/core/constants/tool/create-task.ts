/**
 * Create Task Tool Definition - STUB
 */

export const createTask = {
  name: "createtask",
  description: "Create a new task",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      tool: { type: "string" },
      instructions: { type: "string" }
    },
    required: ["title"]
  }
};

export default createTask;