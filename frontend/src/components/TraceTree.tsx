import { useState } from "react";
import { childrenOf } from "../store/types";
import type { AgentNode } from "../store/types";

const STATUS_ICON: Record<AgentNode["status"], string> = {
  queued: "○", running: "⟳", done: "✓", error: "✗",
};
const STATUS_COLOR: Record<AgentNode["status"], string> = {
  queued: "#888", running: "#f5a623", done: "#4caf50", error: "#f44336",
};

function AgentNodeRow({ node, allAgents, depth = 0 }: {
  node: AgentNode;
  allAgents: AgentNode[];
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const color = STATUS_COLOR[node.status];
  const icon  = STATUS_ICON[node.status];
  const isRunning = node.status === "running";
  const children = childrenOf(allAgents, node.stepName);
  const runningChildren = children.filter((c) => c.status === "running");

  return (
    <div style={{ marginLeft: depth * 16 }}>
      {/* Node header */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          padding: "4px 8px", borderRadius: 4, marginBottom: 2,
          background: isRunning ? "#1e2030" : "#1a1a2e",
          borderLeft: `2px solid ${color}`,
        }}
      >
        <span style={{ color, fontSize: 13 }}>{icon}</span>
        <span style={{ fontFamily: "monospace", fontSize: 13, color: "#cdd6f4", flex: 1 }}>
          {node.stepName}
        </span>

        {/* Parallel badge */}
        {runningChildren.length > 1 && (
          <span style={{ fontSize: 10, color: "#f5a623", background: "#2a1f00", padding: "1px 6px", borderRadius: 8 }}>
            ⚡ {runningChildren.length} parallel
          </span>
        )}

        {/* Active tool */}
        {isRunning && node.toolCalls.length > 0 && (
          <span style={{ fontSize: 11, color: "#888" }}>
            🔧 {node.toolCalls[node.toolCalls.length - 1].name}
          </span>
        )}

        {/* Duration */}
        {node.endTime && node.startTime && (
          <span style={{ fontSize: 11, color: "#888" }}>
            {((node.endTime - node.startTime) / 1000).toFixed(1)}s
          </span>
        )}
        <span style={{ color: "#555", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </div>

      {/* Expanded details */}
      {open && (
        <div style={{ marginLeft: depth * 16 + 16, fontSize: 12, color: "#a6adc8", marginBottom: 4 }}>
          {node.reasoning && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: "#89dceb", marginBottom: 2 }}>💭 Thinking</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.8, maxHeight: 120, overflowY: "auto" }}>
                {node.reasoning}
              </pre>
            </div>
          )}
          {node.toolCalls.map((tc) => (
            <div key={tc.tool_call_id} style={{ marginBottom: 4, background: "#181825", borderRadius: 4, padding: "4px 8px" }}>
              <div style={{ color: "#f5c2e7", marginBottom: 2 }}>🔧 {tc.name}</div>
              {tc.args && (
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 11, maxHeight: 80, overflowY: "auto" }}>{tc.args}</pre>
              )}
              {tc.result && (
                <div style={{ marginTop: 4, color: "#a6e3a1" }}>
                  → {tc.result.length > 300 ? tc.result.slice(0, 300) + "…" : tc.result}
                </div>
              )}
            </div>
          ))}
          {node.response && (
            <div>
              <div style={{ color: "#a6e3a1", marginBottom: 2 }}>📄 Response</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.8, maxHeight: 150, overflowY: "auto" }}>
                {node.response.length > 600 ? node.response.slice(0, 600) + "…" : node.response}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Children (nested) */}
      {children.map((child) => (
        <AgentNodeRow key={child.stepName} node={child} allAgents={allAgents} depth={depth + 1} />
      ))}
    </div>
  );
}

export function TraceTree({ agents }: { agents: AgentNode[] }) {
  if (agents.length === 0) return null;

  const roots = childrenOf(agents, null);
  const totalRunning = agents.filter((a) => a.status === "running").length;

  return (
    <div style={{ padding: 12 }}>
      {totalRunning > 1 && (
        <div style={{ fontSize: 11, color: "#f5a623", marginBottom: 8, padding: "2px 10px", background: "#2a1f00", borderRadius: 12, display: "inline-block" }}>
          ⚡ {totalRunning} agents running in parallel
        </div>
      )}
      {roots.map((node) => (
        <AgentNodeRow key={node.stepName} node={node} allAgents={agents} depth={0} />
      ))}
    </div>
  );
}
