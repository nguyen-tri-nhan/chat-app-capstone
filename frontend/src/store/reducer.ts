import { initialState } from "./types";
import type { AGUIEvent, AppState } from "./types";

export function reducer(state: AppState, event: AGUIEvent): AppState {
  switch (event.type) {
    case "RUN_STARTED":
      return {
        ...initialState,
        status: "running",
        runId: event.run_id,
        threadId: event.thread_id,
        messages: state.messages,
      };

    case "STEP_STARTED":
      return {
        ...state,
        activeStepName: event.step_name,
        agents: [
          ...state.agents,
          {
            stepName: event.step_name,
            parentStepName: null, // filled in by STEP_META
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
        activeStepName: state.agents.find(
          (a) => a.status === "running" && a.stepName !== event.step_name
        )?.stepName ?? null,
        agents: state.agents.map((a) =>
          a.stepName === event.step_name
            ? { ...a, status: "done", endTime: event.timestamp }
            : a
        ),
      };

    case "CUSTOM": {
      const name = event.name;
      const val = event.value ?? {};

      // Set parent info on agent node
      if (name === "STEP_META") {
        const { stepName, parentStepName } = val as { stepName: string; parentStepName: string | null };
        return {
          ...state,
          agents: state.agents.map((a) =>
            a.stepName === stepName ? { ...a, parentStepName: parentStepName ?? null } : a
          ),
        };
      }

      // Update which agent is currently active (for routing)
      if (name === "STEP_ACTIVE") {
        return { ...state, activeStepName: (val as { stepName: string }).stepName };
      }

      // ask_user interrupt — stream stays open
      if (name === "ASK_USER") {
        return {
          ...state,
          status: "interrupted",
          interrupt: { id: crypto.randomUUID(), message: (val as { question: string }).question },
        };
      }

      return state;
    }

    case "REASONING_MESSAGE_CHUNK":
      return updateActiveAgent(state, (a) => ({
        ...a,
        reasoning: a.reasoning + (event.delta ?? ""),
      }));

    case "TEXT_MESSAGE_CHUNK":
      return updateActiveAgent(state, (a) => ({
        ...a,
        response: a.response + (event.delta ?? ""),
      }));

    case "TOOL_CALL_START":
      return updateActiveAgent(state, (a) => ({
        ...a,
        toolCalls: [
          ...a.toolCalls,
          { tool_call_id: event.tool_call_id, name: event.tool_call_name, args: "" },
        ],
      }));

    case "TOOL_CALL_ARGS":
      return updateActiveAgent(state, (a) => ({
        ...a,
        toolCalls: a.toolCalls.map((tc) =>
          tc.tool_call_id === event.tool_call_id
            ? { ...tc, args: tc.args + event.delta }
            : tc
        ),
      }));

    case "TOOL_CALL_END": {
      // If this was a write_file call, extract artifact from accumulated args
      const active = state.activeStepName;
      const agent = active ? state.agents.find((a) => a.stepName === active) : null;
      if (agent) {
        const tc = agent.toolCalls.find((t) => t.tool_call_id === event.tool_call_id);
        if (tc && tc.name === "write_file") {
          try {
            const args = JSON.parse(tc.args);
            if (args.path && args.content) {
              return {
                ...state,
                artifacts: [
                  ...state.artifacts.filter((a) => a.path !== args.path),
                  { path: args.path, content: args.content, agentName: active ?? "" },
                ],
              };
            }
          } catch { /* malformed args — skip */ }
        }
      }
      return state;
    }

    case "TOOL_CALL_RESULT":
      return updateActiveAgent(state, (a) => ({
        ...a,
        toolCalls: a.toolCalls.map((tc) =>
          tc.tool_call_id === event.tool_call_id ? { ...tc, result: event.content } : tc
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
      const lastAgent = [...state.agents].reverse().find((a) => a.response);
      const assistantText = lastAgent?.response ?? "";
      return {
        ...state,
        status: "done",
        activeStepName: null,
        interrupt: null,
        messages: assistantText
          ? [...state.messages, { id: event.run_id, role: "assistant", content: assistantText }]
          : state.messages,
      };
    }

    case "RUN_ERROR":
      return { ...state, status: "error", error: event.message, activeStepName: null };

    default:
      return state;
  }
}

// Route events to the currently active agent (by name, not just "last")
function updateActiveAgent(
  state: AppState,
  updater: (a: (typeof state.agents)[0]) => (typeof state.agents)[0]
): AppState {
  const name = state.activeStepName;
  if (!name) return state;
  return {
    ...state,
    agents: state.agents.map((a) => (a.stepName === name ? updater(a) : a)),
  };
}
