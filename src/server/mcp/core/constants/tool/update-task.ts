/**
 * Update Task Tool Definition - STUB
 */

export const updateTask = {
  name: "updatetask",
  description: "Update an existing task",
  inputSchema: {
    type: "object",
    properties: {
      process: { type: "string" },
      instructions: { type: "string" }
    },
    required: ["process", "instructions"]
  }
};

export default updateTask;