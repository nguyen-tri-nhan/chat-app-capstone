import { describe, expect, it } from "vitest";
import { reducer } from "../store/reducer";
import { AppState, initialState } from "../store/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyAll(events: Parameters<typeof reducer>[1][]): AppState {
  return events.reduce((s, e) => reducer(s, e), initialState);
}

const RUN_STARTED = {
  type: "RUN_STARTED" as const,
  run_id: "run-1",
  thread_id: "thread-1",
};

// ─── Lifecycle ────────────────────────────────────────────────────────────────

describe("RUN_STARTED", () => {
  it("sets status to running and stores runId/threadId", () => {
    const s = reducer(initialState, RUN_STARTED);
    expect(s.status).toBe("running");
    expect(s.runId).toBe("run-1");
    expect(s.threadId).toBe("thread-1");
  });

  it("clears agents and error from previous run", () => {
    const prev: AppState = {
      ...initialState,
      agents: [{ stepName: "old", status: "done", reasoning: "", response: "", toolCalls: [] }],
      error: "previous error",
    };
    const s = reducer(prev, RUN_STARTED);
    expect(s.agents).toHaveLength(0);
    expect(s.error).toBeNull();
  });

  it("preserves chat message history across runs", () => {
    const prev: AppState = {
      ...initialState,
      messages: [{ id: "1", role: "user", content: "hello" }],
    };
    const s = reducer(prev, RUN_STARTED);
    expect(s.messages).toHaveLength(1);
  });
});

describe("RUN_FINISHED success", () => {
  it("sets status to done", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "lead_analyst" },
      { type: "TEXT_MESSAGE_CHUNK", message_id: "m1", role: "assistant", delta: "Result" },
      { type: "RUN_FINISHED", run_id: "run-1", thread_id: "thread-1", outcome: { type: "success" } },
    ]);
    expect(s.status).toBe("done");
  });

  it("appends assistant message to chat", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "lead_analyst" },
      { type: "TEXT_MESSAGE_CHUNK", message_id: "m1", role: "assistant", delta: "Hello" },
      { type: "TEXT_MESSAGE_CHUNK", message_id: "m1", delta: " world" },
      { type: "RUN_FINISHED", run_id: "run-1", thread_id: "thread-1", outcome: { type: "success" } },
    ]);
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].content).toBe("Hello world");
    expect(s.messages[0].role).toBe("assistant");
  });
});

describe("RUN_FINISHED interrupt", () => {
  it("sets status to interrupted and stores interrupt", () => {
    const s = applyAll([
      RUN_STARTED,
      {
        type: "RUN_FINISHED",
        run_id: "run-1",
        thread_id: "thread-1",
        outcome: {
          type: "interrupt",
          interrupts: [{ id: "int-1", message: "What angle?" }],
        },
      },
    ]);
    expect(s.status).toBe("interrupted");
    expect(s.interrupt?.id).toBe("int-1");
    expect(s.interrupt?.message).toBe("What angle?");
  });
});

describe("RUN_ERROR", () => {
  it("sets status to error with message", () => {
    const s = applyAll([RUN_STARTED, { type: "RUN_ERROR", message: "LLM timeout" }]);
    expect(s.status).toBe("error");
    expect(s.error).toBe("LLM timeout");
  });
});

// ─── Trace Tree ───────────────────────────────────────────────────────────────

describe("STEP_STARTED", () => {
  it("adds a new agent node with status running", () => {
    const s = applyAll([RUN_STARTED, { type: "STEP_STARTED", step_name: "lead_analyst" }]);
    expect(s.agents).toHaveLength(1);
    expect(s.agents[0].stepName).toBe("lead_analyst");
    expect(s.agents[0].status).toBe("running");
  });

  it("3 STEP_STARTED with same run → 3 sibling nodes all running (parallel)", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "web_researcher_1" },
      { type: "STEP_STARTED", step_name: "web_researcher_2" },
      { type: "STEP_STARTED", step_name: "web_researcher_3" },
    ]);
    expect(s.agents).toHaveLength(3);
    expect(s.agents.every((a) => a.status === "running")).toBe(true);
  });
});

describe("STEP_FINISHED", () => {
  it("marks the correct node done without affecting siblings", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "web_researcher_1" },
      { type: "STEP_STARTED", step_name: "web_researcher_2" },
      { type: "STEP_STARTED", step_name: "web_researcher_3" },
      { type: "STEP_FINISHED", step_name: "web_researcher_2" },
    ]);
    expect(s.agents.find((a) => a.stepName === "web_researcher_2")?.status).toBe("done");
    expect(s.agents.find((a) => a.stepName === "web_researcher_1")?.status).toBe("running");
    expect(s.agents.find((a) => a.stepName === "web_researcher_3")?.status).toBe("running");
  });
});

// ─── Events on agents ─────────────────────────────────────────────────────────

describe("REASONING_MESSAGE_CHUNK", () => {
  it("accumulates thinking text on the last running agent", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "lead_analyst" },
      { type: "REASONING_MESSAGE_CHUNK", message_id: "r1", delta: "Thinking " },
      { type: "REASONING_MESSAGE_CHUNK", message_id: "r1", delta: "hard..." },
    ]);
    expect(s.agents[0].reasoning).toBe("Thinking hard...");
  });
});

describe("TEXT_MESSAGE_CHUNK", () => {
  it("accumulates response text on the last running agent", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "report_writer" },
      { type: "TEXT_MESSAGE_CHUNK", message_id: "m1", delta: "# Report\n" },
      { type: "TEXT_MESSAGE_CHUNK", message_id: "m1", delta: "Summary here." },
    ]);
    expect(s.agents[0].response).toBe("# Report\nSummary here.");
  });
});

describe("Tool call lifecycle", () => {
  it("tracks tool call from start → args → end → result", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "web_researcher_1" },
      { type: "TOOL_CALL_START", tool_call_id: "tc-1", tool_call_name: "google_search" },
      { type: "TOOL_CALL_ARGS", tool_call_id: "tc-1", delta: '{"query":' },
      { type: "TOOL_CALL_ARGS", tool_call_id: "tc-1", delta: '"AI 2024"}' },
      { type: "TOOL_CALL_END", tool_call_id: "tc-1" },
      { type: "TOOL_CALL_RESULT", message_id: "m1", tool_call_id: "tc-1", content: "Results..." },
    ]);
    const tc = s.agents[0].toolCalls[0];
    expect(tc.name).toBe("google_search");
    expect(tc.args).toBe('{"query":"AI 2024"}');
    expect(tc.result).toBe("Results...");
  });

  it("does not mix up tool calls from different agents", () => {
    const s = applyAll([
      RUN_STARTED,
      { type: "STEP_STARTED", step_name: "web_researcher_1" },
      { type: "TOOL_CALL_START", tool_call_id: "tc-1", tool_call_name: "google_search" },
      { type: "STEP_FINISHED", step_name: "web_researcher_1" },
      { type: "STEP_STARTED", step_name: "web_researcher_2" },
      { type: "TOOL_CALL_START", tool_call_id: "tc-2", tool_call_name: "google_search" },
    ]);
    expect(s.agents[0].toolCalls).toHaveLength(1);
    expect(s.agents[1].toolCalls).toHaveLength(1);
    expect(s.agents[0].toolCalls[0].tool_call_id).toBe("tc-1");
    expect(s.agents[1].toolCalls[0].tool_call_id).toBe("tc-2");
  });
});
