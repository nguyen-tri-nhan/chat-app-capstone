import { FormEvent, useEffect, useRef, useState } from "react";
import type { AgentNode, AppState } from "../store/types";

function LiveStatus({ agents, status }: { agents: AgentNode[]; status: AppState["status"] }) {
  if (status === "idle" || status === "done" || status === "error") return null;
  const running = agents.filter((a) => a.status === "running");
  const last = running[running.length - 1];
  if (!last) return null;
  const lastTool = last.toolCalls[last.toolCalls.length - 1];
  const label = lastTool
    ? `${last.stepName} — ${lastTool.name}…`
    : `${last.stepName} — thinking…`;
  return (
    <div style={{ fontSize: 12, color: "#f5a623", padding: "4px 12px", borderTop: "1px solid #313244" }}>
      ⟳ {label}
    </div>
  );
}

interface ChatPanelProps {
  state: AppState;
  onSend: (text: string) => void;
}

export function ChatPanel({ state, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = state.status === "running" || state.status === "interrupted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    onSend(text);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {state.messages.length === 0 && (
          <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
            Ask a research question to get started.
          </div>
        )}
        {state.messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              background: msg.role === "user" ? "#313244" : "#1e1e2e",
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 14,
              color: "#cdd6f4",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </div>
        ))}
        {state.status === "error" && (
          <div style={{ color: "#f38ba8", fontSize: 13, padding: "6px 12px", background: "#2a0a0a", borderRadius: 6 }}>
            ✗ {state.error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <LiveStatus agents={state.agents} status={state.status} />

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid #313244" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "Running…" : "Research a topic…"}
          disabled={busy}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #45475a",
            background: "#1e1e2e", color: "#cdd6f4", fontSize: 14, outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: busy ? "#45475a" : "#89b4fa", color: "#1e1e2e",
            fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontSize: 14,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
