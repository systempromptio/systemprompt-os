/**
 * Report Task Tool Definition - STUB
 */

export const reportTask = {
  name: "reporttask",
  description: "Generate task report",
  inputSchema: {
    type: "object",
    properties: {
      taskids: { 
        type: "array",
        items: { type: "string" }
      },
      format: { type: "string" }
    },
    required: ["taskids"]
  }
};

export default reportTask;