/**
 * Clean State Tool Definition - STUB
 */

export const cleanState = {
  name: "cleanstate",
  description: "Clean up old state",
  inputSchema: {
    type: "object",
    properties: {
      keeprecent: { type: "boolean" },
      dryrun: { type: "boolean" }
    }
  }
};

export default cleanState;