import { useCallback, useReducer, useRef } from "react";
import { mockEvents } from "../mock/agui-events";
import { reducer } from "../store/reducer";
import { initialState } from "../store/types";
import type { AGUIEvent, AppState, ChatMessage } from "../store/types";

// Dev: localhost:8000 directly. Production (Docker): Nginx proxies /api/ to backend.
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

interface UseAGUIReturn {
  state: AppState;
  sendMessage: (text: string) => Promise<void>;
  submitAnswer: (answer: string) => void;
}

export function useAGUI(useMock = false): UseAGUIReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const threadIdRef = useRef<string | null>(null);
  const interruptIdRef = useRef<string | null>(null);
  const pendingAnswerRef = useRef<string | null>(null);

  const dispatchEvent = useCallback((event: AGUIEvent) => {
    dispatch(event);
    if (event.type === "RUN_FINISHED" && event.outcome?.type === "interrupt") {
      interruptIdRef.current = event.outcome.interrupts[0]?.id ?? null;
    }
  }, []);

  const streamMock = useCallback(async (_messages: ChatMessage[]) => {
    for (const event of mockEvents) {
      await new Promise((r) => setTimeout(r, 150));
      dispatchEvent(event);

      // Pause on interrupt until answer arrives
      if (event.type === "RUN_FINISHED" && event.outcome?.type === "interrupt") {
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (pendingAnswerRef.current !== null) {
              clearInterval(interval);
              pendingAnswerRef.current = null;
              resolve();
            }
          }, 100);
        });
      }
    }
  }, [dispatchEvent]);

  const streamReal = useCallback(async (messages: ChatMessage[], runId?: string) => {
    const body = {
      threadId: threadIdRef.current ?? "",
      runId: runId ?? crypto.randomUUID(),
      state: null,
      tools: [],
      context: [],
      forwardedProps: {},
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content, // plain string — valid for UserMessage
      })),
    };

    const res = await fetch(`${API_BASE}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6)) as AGUIEvent;
            dispatchEvent(event);
            if (event.type === "RUN_STARTED") {
              threadIdRef.current = event.thread_id;
            }
          } catch { /* skip malformed */ }
        }
      }
    }
  }, [dispatchEvent]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };

    // Show user message immediately before run starts
    dispatch({ type: "USER_MESSAGE", content: text });
    dispatch({ type: "RUN_STARTED", run_id: crypto.randomUUID(), thread_id: threadIdRef.current ?? "" });

    const messages = [userMsg];

    if (useMock) {
      await streamMock(messages);
    } else {
      if (!threadIdRef.current) {
        const res = await fetch(`${API_BASE}/sessions`, { method: "POST" });
        const data = await res.json();
        threadIdRef.current = data.session_id;
      }
      await streamReal([...messages]);
    }
  }, [useMock, streamMock, streamReal]);

  const submitAnswer = useCallback((answer: string) => {
    if (useMock) {
      pendingAnswerRef.current = answer;
      return;
    }
    const sessionId = threadIdRef.current;
    if (!sessionId) return;
    fetch(`${API_BASE}/answer/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    }).catch(console.error);
  }, [useMock]);

  return { state, sendMessage, submitAnswer };
}
