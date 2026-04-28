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

export interface InternalEvent {
  type: AssistantEventType;
  timestamp: string;
  payload: Record<string, any>;
}

export interface TaskSnapshot {
  currentGoal: string;
  latestUserMessage: string;
  lastTool: string;
  lastOutcome: string;
  pendingStep: string;
  blockers: string[];
  recentActions: string[];
  recentActionDetails: string[];
  recentDecisions: string[];
  modelFeedback: string[];
  activeIntent: string;
  activeTools: string[];
}

export interface AddStepOptions {
  includeSystemResult?: boolean;
  resultRole?: AgentRole;
}

export type AssistantEventType =
  | "decision"
  | "tool_result"
  | "warning"
  | "error"
  | "task_state"
  | "system_feedback";
