// ─── AG-UI Event Types ────────────────────────────────────────────────────────

export type AGUIEventType =
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "RUN_ERROR"
  | "STEP_STARTED"
  | "STEP_FINISHED"
  | "TEXT_MESSAGE_CHUNK"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "TOOL_CALL_RESULT"
  | "REASONING_MESSAGE_CHUNK"
  | "CUSTOM";

interface BaseEvent {
  type: AGUIEventType;
  timestamp?: number;
}

export interface RunStartedEvent extends BaseEvent {
  type: "RUN_STARTED";
  run_id: string;
  thread_id: string;
}

export interface RunFinishedEvent extends BaseEvent {
  type: "RUN_FINISHED";
  run_id: string;
  thread_id: string;
  outcome?: { type: "success" } | { type: "interrupt"; interrupts: Interrupt[] };
}

export interface RunErrorEvent extends BaseEvent {
  type: "RUN_ERROR";
  message: string;
  code?: string;
}

export interface StepStartedEvent extends BaseEvent {
  type: "STEP_STARTED";
  step_name: string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: "STEP_FINISHED";
  step_name: string;
}

export interface TextMessageChunkEvent extends BaseEvent {
  type: "TEXT_MESSAGE_CHUNK";
  message_id: string;
  role?: string;
  delta?: string;
}

export interface ToolCallStartEvent extends BaseEvent {
  type: "TOOL_CALL_START";
  tool_call_id: string;
  tool_call_name: string;
  parent_message_id?: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: "TOOL_CALL_ARGS";
  tool_call_id: string;
  delta: string;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: "TOOL_CALL_END";
  tool_call_id: string;
}

export interface ToolCallResultEvent extends BaseEvent {
  type: "TOOL_CALL_RESULT";
  message_id: string;
  tool_call_id: string;
  content: string;
}

export interface ReasoningMessageChunkEvent extends BaseEvent {
  type: "REASONING_MESSAGE_CHUNK";
  message_id: string;
  delta?: string;
}

export type AGUIEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageChunkEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | ReasoningMessageChunkEvent
  | CustomEvent;

export interface CustomEvent extends BaseEvent {
  type: "CUSTOM";
  name: string;
  value?: Record<string, unknown>;
}

// ─── Interrupt ────────────────────────────────────────────────────────────────

export interface Interrupt {
  id: string;
  reason?: string;
  message: string;
  response_schema?: Record<string, unknown>;
}

// ─── Trace Tree ───────────────────────────────────────────────────────────────

export type AgentStatus = "queued" | "running" | "done" | "error";

export interface ToolCall {
  tool_call_id: string;
  name: string;
  args: string;
  result?: string;
}

export interface AgentNode {
  stepName: string;
  parentStepName: string | null;  // null = root
  status: AgentStatus;
  startTime?: number;
  endTime?: number;
  reasoning: string;
  response: string;
  toolCalls: ToolCall[];
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppStatus = "idle" | "running" | "interrupted" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Artifact {
  path: string;
  content: string;
  agentName: string;
}

export interface AppState {
  status: AppStatus;
  runId: string | null;
  threadId: string | null;
  agents: AgentNode[];
  activeStepName: string | null;
  messages: ChatMessage[];
  artifacts: Artifact[];
  interrupt: Interrupt | null;
  error: string | null;
}

// Derive nested children from flat list
export function childrenOf(agents: AgentNode[], parentStepName: string | null): AgentNode[] {
  return agents.filter((a) => a.parentStepName === parentStepName);
}

export const initialState: AppState = {
  status: "idle",
  runId: null,
  threadId: null,
  agents: [],
  activeStepName: null,
  messages: [],
  artifacts: [],
  interrupt: null,
  error: null,
};
