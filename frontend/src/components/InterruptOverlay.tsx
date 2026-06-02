import { useState, type FormEvent } from "react";
import type { Interrupt } from "../store/types";

interface InterruptOverlayProps {
  interrupt: Interrupt;
  onSubmit: (answer: string) => void;
}

export function InterruptOverlay({ interrupt, onSubmit }: InterruptOverlayProps) {
  const [answer, setAnswer] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    onSubmit(answer.trim());
    setAnswer("");
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "#1e1e2e", borderRadius: 10, padding: 24, maxWidth: 480, width: "90%",
        border: "1px solid #45475a", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 12, color: "#f5a623", marginBottom: 8 }}>🤖 Agent needs input</div>
        <p style={{ color: "#cdd6f4", fontSize: 15, marginBottom: 16, lineHeight: 1.5 }}>
          {interrupt.message}
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            autoFocus
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer…"
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid #45475a",
              background: "#313244", color: "#cdd6f4", fontSize: 14, outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!answer.trim()}
            style={{
              padding: "8px 0", borderRadius: 6, border: "none",
              background: answer.trim() ? "#a6e3a1" : "#45475a",
              color: "#1e1e2e", fontWeight: 600, cursor: answer.trim() ? "pointer" : "not-allowed",
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
