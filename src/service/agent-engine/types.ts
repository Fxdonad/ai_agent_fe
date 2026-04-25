export type AgentRole = "system" | "user" | "agent";

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
