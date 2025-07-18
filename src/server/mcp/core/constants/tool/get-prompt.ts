/**
 * Get Prompt Tool Definition - STUB
 */

export const getPrompt = {
  name: "getprompt",
  description: "Get prompt template",
  inputSchema: {
    type: "object",
    properties: {
      templatename: { type: "string" }
    },
    required: ["templatename"]
  }
};

export default getPrompt;