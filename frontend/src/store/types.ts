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
  | "REASONING_MESSAGE_CHUNK";

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
  | ReasoningMessageChunkEvent;

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
  stepName: string;             // e.g. "web_researcher_1"
  status: AgentStatus;
  startTime?: number;
  endTime?: number;
  reasoning: string;            // accumulated thinking text
  response: string;             // accumulated text response
  toolCalls: ToolCall[];
}

// ─── App State ────────────────────────────────────────────────────────────────

export type AppStatus = "idle" | "running" | "interrupted" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AppState {
  status: AppStatus;
  runId: string | null;
  threadId: string | null;
  agents: AgentNode[];          // flat list, ordered by appearance
  messages: ChatMessage[];
  interrupt: Interrupt | null;
  error: string | null;
}

export const initialState: AppState = {
  status: "idle",
  runId: null,
  threadId: null,
  agents: [],
  messages: [],
  interrupt: null,
  error: null,
};
