import type {
  AddStepOptions,
  AgentDecision,
  AgentMessage,
  AgentRole,
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

    if (result.length > MAX_LOG_LENGTH) {
      optimizedResult =
        result.substring(0, 1500) +
        "\n\n... [HỆ THỐNG: Cắt bớt log để tránh đầy bộ nhớ] ...\n\n" +
        result.substring(result.length - 1500);
    }

    this.pushMessage("agent", JSON.stringify(decision), {
      mergeWithPrevious: false,
    });

    if (includeSystemResult) {
      this.pushMessage("user", `Kết quả hệ thống: ${optimizedResult}`, {
        mergeWithPrevious: false,
      });
    }

    this.pruneContext(false);
  }
}
