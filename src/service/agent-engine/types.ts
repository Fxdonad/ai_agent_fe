export type AgentRole = "system" | "user" | "assistant";

export interface AgentMessage {
  role: AgentRole;
  content: string;
}

export interface AgentDecision {
  thought?: string;
  tool: string;
  parameters?: Record<string, any>;
}

export interface AddStepOptions {
  includeSystemResult?: boolean;
}

export type AssistantEventType =
  | "decision"
  | "tool_result"
  | "warning"
  | "error"
  | "task_state"
  | "system_feedback";
