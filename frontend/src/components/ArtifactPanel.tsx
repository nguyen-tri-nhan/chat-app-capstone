import { useState } from "react";
import type { AgentNode } from "../store/types";

// Derive artifacts from tool call results that look like file writes
function getArtifacts(agents: AgentNode[]) {
  const artifacts: { name: string; agentName: string; content: string }[] = [];
  for (const agent of agents) {
    for (const tc of agent.toolCalls) {
      if ((tc.name === "write_file" || tc.name === "create_file") && tc.result) {
        try {
          const parsed = JSON.parse(tc.args);
          artifacts.push({ name: parsed.path ?? tc.name, agentName: agent.stepName, content: tc.result });
        } catch {
          artifacts.push({ name: tc.name, agentName: agent.stepName, content: tc.result });
        }
      }
    }
  }
  return artifacts;
}

interface ArtifactPanelProps {
  agents: AgentNode[];
}

export function ArtifactPanel({ agents }: ArtifactPanelProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const artifacts = getArtifacts(agents);

  if (artifacts.length === 0) return null;

  return (
    <div style={{ borderTop: "1px solid #313244", padding: 12 }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>📁 Artifacts ({artifacts.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {artifacts.map((a, i) => (
          <div key={i}>
            <div
              onClick={() => setSelected(selected === i ? null : i)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "4px 8px", borderRadius: 4, background: "#1e1e2e", cursor: "pointer",
                fontSize: 12, color: "#cdd6f4",
              }}
            >
              <span>📄 {a.name}</span>
              <span style={{ color: "#888", fontSize: 11 }}>[{a.agentName}]</span>
            </div>
            {selected === i && (
              <pre style={{
                margin: "4px 0 0 0", padding: 8, background: "#181825", borderRadius: 4,
                fontSize: 11, color: "#a6adc8", overflowX: "auto", maxHeight: 200, overflowY: "auto",
              }}>
                {a.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
