/**
 * Check Status Tool Definition - STUB
 */

export const checkStatus = {
  name: "checkstatus",
  description: "Check system status",
  inputSchema: {
    type: "object",
    properties: {
      testsessions: { type: "boolean" },
      verbose: { type: "boolean" }
    }
  }
};

export default checkStatus;