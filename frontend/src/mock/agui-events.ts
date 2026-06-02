import type { AGUIEvent } from "../store/types";

// Pre-recorded AG-UI event sequence simulating a full Deep Analyst run.
// Used for frontend development without a real backend.

const T = (offset: number) => Date.now() + offset;

export const mockEvents: AGUIEvent[] = [
  // ── Run starts ──────────────────────────────────────────────────────────────
  { type: "RUN_STARTED", run_id: "run-1", thread_id: "thread-1", timestamp: T(0) },

  // ── lead_analyst thinks and asks user ───────────────────────────────────────
  { type: "STEP_STARTED", step_name: "lead_analyst", timestamp: T(100) },
  { type: "REASONING_MESSAGE_CHUNK", message_id: "r-1", delta: "Breaking down the research topic into subtopics...", timestamp: T(200) },

  // ── Interrupt: ask_user ─────────────────────────────────────────────────────
  {
    type: "RUN_FINISHED",
    run_id: "run-1",
    thread_id: "thread-1",
    outcome: {
      type: "interrupt",
      interrupts: [{
        id: "int-1",
        message: "What angle matters most — technical benchmarks, developer adoption, or enterprise readiness?",
      }],
    },
    timestamp: T(400),
  },

  // ── Run 2: user answered, researchers spawn in parallel ─────────────────────
  { type: "RUN_STARTED", run_id: "run-2", thread_id: "thread-1", timestamp: T(600) },
  { type: "STEP_STARTED", step_name: "lead_analyst", timestamp: T(700) },
  { type: "REASONING_MESSAGE_CHUNK", message_id: "r-2", delta: "Dispatching 3 researchers in parallel...", timestamp: T(800) },

  // web_researcher_1
  { type: "STEP_STARTED", step_name: "web_researcher_1", timestamp: T(900) },
  { type: "TOOL_CALL_START", tool_call_id: "tc-1", tool_call_name: "google_search", timestamp: T(950) },
  { type: "TOOL_CALL_ARGS", tool_call_id: "tc-1", delta: '{"query":"AI agent frameworks landscape 2024"}', timestamp: T(970) },
  { type: "TOOL_CALL_END", tool_call_id: "tc-1", timestamp: T(1100) },
  { type: "TOOL_CALL_RESULT", message_id: "m-1", tool_call_id: "tc-1", content: "LangGraph, CrewAI, AutoGen lead the market...", timestamp: T(1150) },

  // web_researcher_2 (parallel)
  { type: "STEP_STARTED", step_name: "web_researcher_2", timestamp: T(910) },
  { type: "TOOL_CALL_START", tool_call_id: "tc-2", tool_call_name: "google_search", timestamp: T(960) },
  { type: "TOOL_CALL_ARGS", tool_call_id: "tc-2", delta: '{"query":"Anthropic developer adoption metrics 2024"}', timestamp: T(980) },
  { type: "TOOL_CALL_END", tool_call_id: "tc-2", timestamp: T(1200) },
  { type: "TOOL_CALL_RESULT", message_id: "m-2", tool_call_id: "tc-2", content: "Anthropic API users grew 3x YoY...", timestamp: T(1250) },

  // web_researcher_3 (parallel)
  { type: "STEP_STARTED", step_name: "web_researcher_3", timestamp: T(920) },
  { type: "TOOL_CALL_START", tool_call_id: "tc-3", tool_call_name: "google_search", timestamp: T(965) },
  { type: "TOOL_CALL_ARGS", tool_call_id: "tc-3", delta: '{"query":"enterprise AI agent deployments 2024"}', timestamp: T(990) },
  { type: "TOOL_CALL_END", tool_call_id: "tc-3", timestamp: T(1300) },
  { type: "TOOL_CALL_RESULT", message_id: "m-3", tool_call_id: "tc-3", content: "Fortune 500 enterprise deployments up 40%...", timestamp: T(1350) },

  // researchers finish
  { type: "STEP_FINISHED", step_name: "web_researcher_1", timestamp: T(1400) },
  { type: "STEP_FINISHED", step_name: "web_researcher_2", timestamp: T(1420) },
  { type: "STEP_FINISHED", step_name: "web_researcher_3", timestamp: T(1440) },

  // ── data_analyst ────────────────────────────────────────────────────────────
  { type: "STEP_STARTED", step_name: "data_analyst", timestamp: T(1500) },
  { type: "REASONING_MESSAGE_CHUNK", message_id: "r-3", delta: "Extracting key metrics from research notes...", timestamp: T(1600) },
  { type: "STEP_FINISHED", step_name: "data_analyst", timestamp: T(1800) },

  // ── report_writer ───────────────────────────────────────────────────────────
  { type: "STEP_STARTED", step_name: "report_writer", timestamp: T(1900) },
  { type: "TEXT_MESSAGE_CHUNK", message_id: "msg-final", role: "assistant", delta: "# Research Brief: AI Agent Frameworks\n\n", timestamp: T(2000) },
  { type: "TEXT_MESSAGE_CHUNK", message_id: "msg-final", delta: "## Executive Summary\nAnthropic's developer adoption grew 3x YoY...", timestamp: T(2100) },
  { type: "STEP_FINISHED", step_name: "report_writer", timestamp: T(2300) },

  // lead_analyst wraps up
  { type: "STEP_FINISHED", step_name: "lead_analyst", timestamp: T(2400) },

  // ── Run finishes ────────────────────────────────────────────────────────────
  { type: "RUN_FINISHED", run_id: "run-2", thread_id: "thread-1", outcome: { type: "success" }, timestamp: T(2500) },
];

// Replay mock events with realistic delays
export async function* replayMockEvents(events: AGUIEvent[] = mockEvents, delayMs = 150) {
  for (const event of events) {
    await new Promise((r) => setTimeout(r, delayMs));
    yield event;
  }
}
