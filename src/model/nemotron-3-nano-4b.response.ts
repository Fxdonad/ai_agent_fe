export const Nemotron3Nano4bConfig = {
  modelName: "nemotron-3-nano-4b",
  structureResponse: {
    type: "json_schema",
    json_schema: {
      name: "agent_action",
      strict: true, // Nemotron 3 hỗ trợ tốt strict mode để ép ra JSON sạch
      schema: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "Lập luận từng bước về hành động tiếp theo",
          },
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
              // Gom nhóm các tham số vào một object phẳng
              command: { type: "string" },
              query: { type: "string" },
              action: {
                type: "string",
                enum: ["read", "write", "delete", "mkdir", "list"],
              },
              path: { type: "string" },
              content: { type: "string" },
              type: { type: "string", enum: ["logs", "process", "network"] },
              lines: { type: "integer", default: 50 },
            },
            additionalProperties: false,
          },
        },
        required: ["thought", "tool", "parameters"],
      },
    },
  },
};
