import { useState } from "react";
import type { AgentNode } from "../store/types";

const STATUS_ICON: Record<AgentNode["status"], string> = {
  queued:  "○",
  running: "⟳",
  done:    "✓",
  error:   "✗",
};

const STATUS_COLOR: Record<AgentNode["status"], string> = {
  queued:  "#888",
  running: "#f5a623",
  done:    "#4caf50",
  error:   "#f44336",
};

interface AgentNodeProps {
  node: AgentNode;
}

function AgentNodeRow({ node }: AgentNodeProps) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[node.status];
  const icon  = STATUS_ICON[node.status];
  const isRunning = node.status === "running";

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 6px", borderRadius: 4, background: "#1e1e2e" }}
      >
        <span style={{ color, fontSize: 13, animation: isRunning ? "spin 1s linear infinite" : undefined }}>
          {icon}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#cdd6f4" }}>{node.stepName}</span>
        {isRunning && node.toolCalls.length > 0 && (
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
            🔧 {node.toolCalls[node.toolCalls.length - 1].name}
          </span>
        )}
        {node.endTime && node.startTime && (
          <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
            {((node.endTime - node.startTime) / 1000).toFixed(1)}s
          </span>
        )}
        <span style={{ color: "#888", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{ marginLeft: 24, marginTop: 4, fontSize: 12, color: "#a6adc8" }}>
          {node.reasoning && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: "#89dceb", marginBottom: 2 }}>💭 Thinking</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.8 }}>{node.reasoning}</pre>
            </div>
          )}
          {node.toolCalls.map((tc) => (
            <div key={tc.tool_call_id} style={{ marginBottom: 6, background: "#181825", borderRadius: 4, padding: "4px 8px" }}>
              <div style={{ color: "#f5c2e7", marginBottom: 2 }}>🔧 {tc.name}</div>
              {tc.args && <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 11 }}>{tc.args}</pre>}
              {tc.result && (
                <div style={{ marginTop: 4, color: "#a6e3a1" }}>
                  <span style={{ color: "#888" }}>→ </span>
                  {tc.result.length > 200 ? tc.result.slice(0, 200) + "…" : tc.result}
                </div>
              )}
            </div>
          ))}
          {node.response && (
            <div>
              <div style={{ color: "#a6e3a1", marginBottom: 2 }}>📄 Response</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.8 }}>
                {node.response.length > 500 ? node.response.slice(0, 500) + "…" : node.response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TraceTreeProps {
  agents: AgentNode[];
}

export function TraceTree({ agents }: TraceTreeProps) {
  if (agents.length === 0) return null;

  const runningCount = agents.filter((a) => a.status === "running").length;

  return (
    <div style={{ padding: 12 }}>
      {runningCount > 1 && (
        <div style={{ fontSize: 11, color: "#f5a623", marginBottom: 8, padding: "2px 8px", background: "#2a1f00", borderRadius: 12, display: "inline-block" }}>
          ⚡ {runningCount} agents running in parallel
        </div>
      )}
      {agents.map((node) => (
        <AgentNodeRow key={`${node.stepName}-${node.startTime}`} node={node} />
      ))}
    </div>
  );
}
