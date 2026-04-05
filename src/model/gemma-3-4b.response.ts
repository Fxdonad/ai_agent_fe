export const Gemma34bConfig = {
  modelName: "gemma-3-4b",
  structureResponse: {
    type: "json_schema",
    json_schema: {
      name: "tool_call",
      strict: true,
      schema: {
        type: "object",
        properties: {
          thought: { type: "string" },
          tool: {
            type: "string",
            enum: [
              "execute_command",
              "web_search",
              "ask_human",
              "respond_to_user",
              "read_structure",
              "file_operation",
              "debug_service",
              "done",
            ],
          },
          parameters: {
            type: "object",
            properties: {
              // Nhóm 1: Command & Search
              command: { type: "string" },
              query: { type: "string" },

              // Nhóm 2: File System
              action: {
                type: "string",
                enum: ["read", "write", "delete", "mkdir", "list"],
              },
              path: { type: "string" },
              content: { type: "string" },

              // Nhóm 3: Debug (Đã đưa VÀO TRONG parameters)
              type: {
                type: "string",
                enum: ["logs", "process", "network"],
              },
              lines: { type: "integer" },
            },
            // Quan trọng: Không để required ở đây để tránh lỗi chéo giữa các tool
            additionalProperties: false,
          },
        },
        required: ["thought", "tool", "parameters"],
      },
    },
  },
};
