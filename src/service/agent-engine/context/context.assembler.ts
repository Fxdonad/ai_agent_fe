import { PromptManager } from "../../prompt.manager.js";
import type { AgentMessage, TaskSnapshot } from "../types.js";

interface BuildMessagesInput {
  conversation: AgentMessage[];
  taskSnapshot: TaskSnapshot;
}

interface IntentResolution {
  intent: string;
  activeTools: string[];
  includeCodingStandards: boolean;
  includeSelfCorrection: boolean;
  conversationLimit: number;
}

export class ContextAssembler {
  buildMessages(input: BuildMessagesInput): AgentMessage[] {
    const latestUserMessage = input.taskSnapshot.latestUserMessage || this.getLatestUserMessage(input.conversation);
    const resolution = this.resolveIntent(latestUserMessage, input.taskSnapshot);

    const nextSnapshot: TaskSnapshot = {
      ...input.taskSnapshot,
      latestUserMessage,
      activeIntent: resolution.intent,
      activeTools: resolution.activeTools,
    };

    const systemMessages = PromptManager.buildRequestContext({
      intent: resolution.intent,
      activeTools: resolution.activeTools,
      includeCodingStandards: resolution.includeCodingStandards,
      includeSelfCorrection: resolution.includeSelfCorrection,
      taskSnapshot: nextSnapshot,
    });

    return [
      ...systemMessages,
      ...input.conversation.slice(-resolution.conversationLimit),
    ];
  }

  private resolveIntent(latestUserMessage: string, taskSnapshot: TaskSnapshot): IntentResolution {
    const combinedText = [
      taskSnapshot.currentGoal,
      latestUserMessage,
      taskSnapshot.lastTool,
      taskSnapshot.lastOutcome,
      taskSnapshot.pendingStep,
      ...taskSnapshot.modelFeedback,
      ...taskSnapshot.recentDecisions,
      ...taskSnapshot.recentActionDetails,
    ]
      .join(" ")
      .toLowerCase();

    const activeTools = new Set<string>(["prompt_mgr"]);

    let intent = "general";
    let includeCodingStandards = false;
    let includeSelfCorrection = false;
    let conversationLimit = 16;

    if (this.matches(combinedText, ["lỗi", "error", "bug", "debug", "log", "trace", "timeout"])) {
      intent = "debug";
      includeSelfCorrection = true;
      conversationLimit = 12;
      activeTools.add("debug");
      activeTools.add("search_grep");
      activeTools.add("browser");
    }

    if (
      this.matches(combinedText, [
        "sửa",
        "fix",
        "implement",
        "thêm",
        "refactor",
        "code",
        "file",
        "typescript",
        "build",
        "test",
      ])
    ) {
      intent = intent === "debug" ? "debug_coding" : "coding";
      includeCodingStandards = true;
      includeSelfCorrection = true;
      activeTools.add("file_op");
      activeTools.add("search_grep");
      activeTools.add("structure");
      activeTools.add("terminal");
    }

    if (this.matches(combinedText, ["shell", "terminal", "npm", "pnpm", "yarn", "command", "run"])) {
      if (intent === "general") {
        intent = "execution";
      }
      includeSelfCorrection = true;
      activeTools.add("terminal");
    }

    if (this.matches(combinedText, ["xác nhận", "confirm", "đồng ý", "approve", "secret", "token", "api key"])) {
      activeTools.add("human");
    }

    if (intent === "general") {
      conversationLimit = 20;
    }

    activeTools.add("task_mgmt");

    return {
      intent,
      activeTools: [...activeTools],
      includeCodingStandards,
      includeSelfCorrection,
      conversationLimit,
    };
  }

  private getLatestUserMessage(messages: AgentMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "user") {
        return messages[i].content;
      }
    }
    return "";
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }
}
