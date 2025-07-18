/**
 * End Task Tool Definition - STUB
 */

export const endTask = {
  name: "endtask",
  description: "End a task",
  inputSchema: {
    type: "object",
    properties: {
      taskid: { type: "string" },
      status: { type: "string" }
    },
    required: ["taskid"]
  }
};

export default endTask;