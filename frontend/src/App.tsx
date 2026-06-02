import { ArtifactPanel } from "./components/ArtifactPanel";
import { ChatPanel } from "./components/ChatPanel";
import { InterruptOverlay } from "./components/InterruptOverlay";
import { TraceTree } from "./components/TraceTree";
import { useAGUI } from "./hooks/useAGUI";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export default function App() {
  const { state, sendMessage, submitAnswer } = useAGUI(USE_MOCK);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 380px",
      height: "100vh",
      background: "#181825",
      color: "#cdd6f4",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Left: Chat */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #313244", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #313244", fontSize: 15, fontWeight: 600 }}>
          🔍 Deep Analyst
          <span style={{ fontSize: 11, color: "#888", marginLeft: 8, fontWeight: 400 }}>
            {USE_MOCK ? "mock mode" : "live"}
          </span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <ChatPanel state={state} onSend={sendMessage} />
        </div>
      </div>

      {/* Right: Trace */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #313244", fontSize: 13, fontWeight: 600, color: "#888" }}>
          AGENT TRACE
          {state.status !== "idle" && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10,
              background: state.status === "running" ? "#2a1f00" : state.status === "done" ? "#0a2a0a" : state.status === "error" ? "#2a0a0a" : "#1a1a2a",
              color: state.status === "running" ? "#f5a623" : state.status === "done" ? "#a6e3a1" : state.status === "error" ? "#f38ba8" : "#89b4fa",
            }}>
              {state.status}
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <TraceTree agents={state.agents} />
        </div>
        <ArtifactPanel agents={state.agents} />
      </div>

      {/* Interrupt overlay */}
      {state.interrupt && (
        <InterruptOverlay interrupt={state.interrupt} onSubmit={submitAnswer} />
      )}
    </div>
  );
}
