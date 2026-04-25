import type {
  AddStepOptions,
  AgentDecision,
  AgentMessage,
  AgentRole,
  AssistantEventType,
} from "../types.js";

export class AgentStore {
  private readonly messages: AgentMessage[] = [];
  private actionHistory: string[] = [];
  private readonly MAX_HISTORY = 5;
  private readonly MAX_RETRY_SAME_ACTION = 3;

  constructor(private readonly logActivity: (type: string, data: any) => void) {}

  getMessages(): AgentMessage[] {
    return this.messages;
  }

  resetActionHistory() {
    this.actionHistory = [];
  }

  pushMessage(
    role: AgentRole,
    content: string,
    options: { mergeWithPrevious?: boolean } = {},
  ) {
    const normalized = content?.trim();
    if (!normalized) return;

    const shouldMerge = options.mergeWithPrevious ?? true;
    const lastMessage = this.messages[this.messages.length - 1];
    if (shouldMerge && lastMessage?.role === role) {
      lastMessage.content = `${lastMessage.content}\n\n${normalized}`;
      return;
    }

    this.messages.push({ role, content: normalized });
  }

  pushAssistantEvent(
    type: AssistantEventType,
    payload: Record<string, any>,
    options: { mergeWithPrevious?: boolean } = {},
  ) {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.pushMessage("assistant", JSON.stringify(event), options);
  }

  detectLoop(currentHash: string): boolean {
    this.actionHistory.push(currentHash);
    if (this.actionHistory.length > this.MAX_HISTORY) {
      this.actionHistory.shift();
    }
    return (
      this.actionHistory.filter((h) => h === currentHash).length >=
      this.MAX_RETRY_SAME_ACTION
    );
  }

  pruneContext(aggressive = false) {
    if (this.messages.length > (aggressive ? 10 : 35)) {
      const count = aggressive ? 10 : 2;
      const keepRecentNonSystem = aggressive ? 4 : 12;
      const nonSystemIndices: number[] = [];

      for (let i = 0; i < this.messages.length; i++) {
        if (this.messages[i]?.role !== "system") {
          nonSystemIndices.push(i);
        }
      }

      const protectedIndices = new Set(nonSystemIndices.slice(-keepRecentNonSystem));
      let removed = 0;

      for (let i = 0; i < this.messages.length && removed < count; i++) {
        if (
          this.messages[i]?.role !== "system" &&
          !protectedIndices.has(i)
        ) {
          this.messages.splice(i, 1);
          removed++;
          i--;
        }
      }

      this.logActivity("PRUNE", `Đã xóa ${removed} tin nhắn cũ.`);
    }
  }

  addStep(
    decision: AgentDecision,
    result: string,
    options: AddStepOptions = {},
  ) {
    const MAX_LOG_LENGTH = 4000;
    let optimizedResult = result;
    const includeSystemResult = options.includeSystemResult ?? true;
    const resultRole = options.resultRole ?? "assistant";

    if (result.length > MAX_LOG_LENGTH) {
      optimizedResult =
        result.substring(0, 1500) +
        "\n\n... [HỆ THỐNG: Cắt bớt log để tránh đầy bộ nhớ] ...\n\n" +
        result.substring(result.length - 1500);
    }

    this.pushAssistantEvent(
      "decision",
      {
        thought: decision.thought ?? "",
        tool: decision.tool,
        parameters: decision.parameters ?? {},
      },
      {
        mergeWithPrevious: false,
      },
    );

    if (includeSystemResult) {
      if (resultRole === "assistant") {
        this.pushAssistantEvent(
          "tool_result",
          {
            tool: decision.tool,
            result: optimizedResult,
            truncated: result.length > MAX_LOG_LENGTH,
          },
          {
            mergeWithPrevious: false,
          },
        );
      } else {
        this.pushMessage(resultRole, optimizedResult, {
          mergeWithPrevious: false,
        });
      }
    }

    this.pruneContext(false);
  }

  addWarning(message: string) {
    this.pushAssistantEvent(
      "warning",
      { message },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addError(message: string) {
    this.pushAssistantEvent(
      "error",
      { message },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addTaskState(state: string, detail?: string) {
    this.pushAssistantEvent(
      "task_state",
      { state, detail: detail ?? "" },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addSystemFeedback(message: string) {
    this.pushAssistantEvent(
      "system_feedback",
      { message },
      {
      mergeWithPrevious: false,
      },
    );
  }
}
