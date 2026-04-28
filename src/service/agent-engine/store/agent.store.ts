import type {
  AddStepOptions,
  AgentDecision,
  AgentMessage,
  AssistantEventType,
  InternalEvent,
  TaskSnapshot,
} from "../types.js";

export class AgentStore {
  private readonly messages: AgentMessage[] = [];
  private readonly internalEvents: InternalEvent[] = [];
  private actionHistory: string[] = [];
  private readonly MAX_HISTORY = 5;
  private readonly MAX_RETRY_SAME_ACTION = 3;
  private taskSnapshot: TaskSnapshot = {
    currentGoal: "",
    latestUserMessage: "",
    lastTool: "",
    lastOutcome: "",
    pendingStep: "",
    blockers: [],
    recentActions: [],
    recentActionDetails: [],
    recentDecisions: [],
    modelFeedback: [],
    activeIntent: "general",
    activeTools: [],
  };

  constructor(private readonly logActivity: (type: string, data: any) => void) {}

  getMessages(): AgentMessage[] {
    return this.messages;
  }

  getConversationWindow(limit = 8): AgentMessage[] {
    return limit > 0 ? this.messages.slice(-limit) : [];
  }

  getLatestUserMessage(): string {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]?.role === "user") {
        return this.messages[i].content;
      }
    }
    return "";
  }

  getTaskSnapshot(): TaskSnapshot {
    return {
      ...this.taskSnapshot,
      blockers: [...this.taskSnapshot.blockers],
      recentActions: [...this.taskSnapshot.recentActions],
      recentActionDetails: [...this.taskSnapshot.recentActionDetails],
      recentDecisions: [...this.taskSnapshot.recentDecisions],
      modelFeedback: [...this.taskSnapshot.modelFeedback],
      activeTools: [...this.taskSnapshot.activeTools],
    };
  }

  resetActionHistory() {
    this.actionHistory = [];
  }

  setCurrentGoal(goal: string, options: { resetContext?: boolean } = {}) {
    const normalized = goal?.trim();
    if (!normalized) return;
    const shouldReset = options.resetContext ?? true;

    this.taskSnapshot.currentGoal = normalized;
    this.taskSnapshot.latestUserMessage = normalized;
    if (shouldReset) {
      this.taskSnapshot.lastTool = "";
      this.taskSnapshot.lastOutcome = "";
      this.taskSnapshot.pendingStep = "";
      this.taskSnapshot.blockers = [];
      this.taskSnapshot.recentActions = [];
      this.taskSnapshot.recentActionDetails = [];
      this.taskSnapshot.recentDecisions = [];
      this.taskSnapshot.modelFeedback = [];
    }
  }

  updateTaskSnapshot(partial: Partial<TaskSnapshot>) {
    this.taskSnapshot = {
      ...this.taskSnapshot,
      ...partial,
      blockers: partial.blockers ?? this.taskSnapshot.blockers,
      recentActions: partial.recentActions ?? this.taskSnapshot.recentActions,
      recentActionDetails:
        partial.recentActionDetails ?? this.taskSnapshot.recentActionDetails,
      recentDecisions: partial.recentDecisions ?? this.taskSnapshot.recentDecisions,
      modelFeedback: partial.modelFeedback ?? this.taskSnapshot.modelFeedback,
      activeTools: partial.activeTools ?? this.taskSnapshot.activeTools,
    };
  }

  pushMessage(
    role: AgentMessage["role"],
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

    if (role === "user") {
      this.taskSnapshot.latestUserMessage = normalized;
      if (!this.taskSnapshot.currentGoal) {
        this.taskSnapshot.currentGoal = normalized;
      }
    }
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
    this.internalEvents.push(event);
    if (this.internalEvents.length > 40) {
      this.internalEvents.shift();
    }
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
    const maxMessages = aggressive ? 8 : 20;
    if (this.messages.length > maxMessages) {
      const removed = this.messages.length - maxMessages;
      this.messages.splice(0, removed);
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
        tool: decision.tool,
        parameters: decision.parameters ?? {},
      },
      {
        mergeWithPrevious: false,
      },
    );

    this.rememberDecision(decision);
    this.rememberAction(decision.tool, optimizedResult);
    this.taskSnapshot.lastTool = decision.tool;

    if (includeSystemResult) {
      if (resultRole === "assistant") {
        if (decision.tool === "respond_to_user" || decision.tool === "done") {
          this.pushMessage("assistant", optimizedResult, {
            mergeWithPrevious: false,
          });
        } else {
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
        }
      } else {
        this.pushMessage(resultRole, optimizedResult, {
          mergeWithPrevious: false,
        });
      }
    }

    this.taskSnapshot.lastOutcome = this.toCompactSummary(optimizedResult);
    this.taskSnapshot.pendingStep = this.inferPendingStep(decision.tool, optimizedResult);
    this.pruneContext(false);
  }

  addWarning(message: string) {
    this.pushModelFeedback(message);
    this.pushAssistantEvent(
      "warning",
      { message },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addError(message: string) {
    this.pushModelFeedback(message);
    this.pushAssistantEvent(
      "error",
      { message },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addTaskState(state: string, detail?: string) {
    this.updateBlockersFromState(state, detail);
    this.pushAssistantEvent(
      "task_state",
      { state, detail: detail ?? "" },
      {
        mergeWithPrevious: false,
      },
    );
  }

  addSystemFeedback(message: string) {
    this.updateBlockersFromState("system_feedback", message);
    this.pushModelFeedback(message);
    this.pushAssistantEvent(
      "system_feedback",
      { message },
      {
        mergeWithPrevious: false,
      },
    );
  }

  private rememberAction(tool: string, result: string) {
    if (!tool) return;
    this.taskSnapshot.recentActions = [
      ...this.taskSnapshot.recentActions.slice(-1),
      tool,
    ];
    this.taskSnapshot.recentActionDetails = [
      ...this.taskSnapshot.recentActionDetails.slice(-1),
      `${tool}: ${this.toCompactSummary(result) || "no result"}`.slice(0, 220),
    ];
  }

  private rememberDecision(decision: AgentDecision) {
    const summary = [
      `tool=${decision.tool}`,
      decision.parameters ? `params=${JSON.stringify(decision.parameters)}` : "params={}",
    ].join(" ");

    this.taskSnapshot.recentDecisions = [
      ...this.taskSnapshot.recentDecisions.slice(-1),
      summary.slice(0, 220),
    ];
  }

  private toCompactSummary(result: string): string {
    const normalized = result
      .replace(/\[Vị trí:[^\]]+\]\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return normalized.slice(0, 280);
  }

  private updateBlockersFromState(state: string, detail?: string) {
    const normalized = detail?.trim();
    if (!normalized) return;

    const shouldTrack =
      state.includes("error") ||
      state.includes("warning") ||
      state.includes("paused") ||
      state.includes("feedback");

    if (!shouldTrack) return;

    this.taskSnapshot.blockers = [
      ...this.taskSnapshot.blockers.slice(-2),
      normalized.slice(0, 180),
    ];
  }

  private pushModelFeedback(message: string) {
    const normalized = message?.trim();
    if (!normalized) return;

    this.taskSnapshot.modelFeedback = [
      ...this.taskSnapshot.modelFeedback.slice(-1),
      normalized.slice(0, 220),
    ];
  }

  private inferPendingStep(tool: string, result: string): string {
    const summary = this.toCompactSummary(result);

    if (tool === "respond_to_user" || tool === "done") {
      return "Chờ phản hồi tiếp theo từ human.";
    }

    if (!summary) {
      return `Cần đánh giá kết quả của ${tool} và chọn bước tiếp theo.`;
    }

    return `Dựa trên kết quả ${tool}, hãy thực hiện bước hợp lý tiếp theo thay vì lặp lại cùng hành động.`;
  }
}
