import { AGUIEvent, AppState, initialState } from "./types";

export function reducer(state: AppState, event: AGUIEvent): AppState {
  switch (event.type) {
    case "RUN_STARTED":
      return {
        ...initialState,
        status: "running",
        runId: event.run_id,
        threadId: event.thread_id,
        messages: state.messages, // preserve chat history
      };

    case "STEP_STARTED":
      return {
        ...state,
        agents: [
          ...state.agents,
          {
            stepName: event.step_name,
            status: "running",
            startTime: event.timestamp,
            reasoning: "",
            response: "",
            toolCalls: [],
          },
        ],
      };

    case "STEP_FINISHED":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.stepName === event.step_name
            ? { ...a, status: "done", endTime: event.timestamp }
            : a
        ),
      };

    case "REASONING_MESSAGE_CHUNK":
      return updateLastAgent(state, (a) => ({
        ...a,
        reasoning: a.reasoning + (event.delta ?? ""),
      }));

    case "TEXT_MESSAGE_CHUNK":
      return updateLastAgent(state, (a) => ({
        ...a,
        response: a.response + (event.delta ?? ""),
      }));

    case "TOOL_CALL_START":
      return updateLastAgent(state, (a) => ({
        ...a,
        toolCalls: [
          ...a.toolCalls,
          { tool_call_id: event.tool_call_id, name: event.tool_call_name, args: "" },
        ],
      }));

    case "TOOL_CALL_ARGS":
      return updateLastAgent(state, (a) => ({
        ...a,
        toolCalls: a.toolCalls.map((tc) =>
          tc.tool_call_id === event.tool_call_id
            ? { ...tc, args: tc.args + event.delta }
            : tc
        ),
      }));

    case "TOOL_CALL_END":
      return state; // no-op, tool_call_id already tracked

    case "TOOL_CALL_RESULT":
      return updateLastAgent(state, (a) => ({
        ...a,
        toolCalls: a.toolCalls.map((tc) =>
          tc.tool_call_id === event.tool_call_id
            ? { ...tc, result: event.content }
            : tc
        ),
      }));

    case "RUN_FINISHED": {
      const outcome = event.outcome;
      if (outcome?.type === "interrupt") {
        return {
          ...state,
          status: "interrupted",
          interrupt: outcome.interrupts[0] ?? null,
        };
      }
      const lastAgent = state.agents[state.agents.length - 1];
      const assistantText = lastAgent?.response ?? "";
      return {
        ...state,
        status: "done",
        messages: assistantText
          ? [
              ...state.messages,
              { id: event.run_id, role: "assistant", content: assistantText },
            ]
          : state.messages,
      };
    }

    case "RUN_ERROR":
      return { ...state, status: "error", error: event.message };

    default:
      return state;
  }
}

// Helper: update the last running agent
function updateLastAgent(
  state: AppState,
  updater: (a: (typeof state.agents)[0]) => (typeof state.agents)[0]
): AppState {
  const idx = [...state.agents].reverse().findIndex((a) => a.status === "running");
  if (idx === -1) return state;
  const realIdx = state.agents.length - 1 - idx;
  return {
    ...state,
    agents: state.agents.map((a, i) => (i === realIdx ? updater(a) : a)),
  };
}
