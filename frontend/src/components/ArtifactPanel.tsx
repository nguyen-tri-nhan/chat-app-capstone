import { useState } from "react";
import type { Artifact } from "../store/types";

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileIcon(path: string): string {
  if (path.endsWith(".md"))   return "📄";
  if (path.endsWith(".json")) return "📋";
  if (path.endsWith(".txt"))  return "📝";
  return "📁";
}

interface ArtifactPanelProps {
  artifacts: Artifact[];
}

export function ArtifactPanel({ artifacts }: ArtifactPanelProps) {
  const [preview, setPreview] = useState<Artifact | null>(null);

  if (artifacts.length === 0) return null;

  return (
    <>
      <div style={{ borderTop: "1px solid #313244", padding: "10px 12px" }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          📁 Artifacts ({artifacts.length})
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {artifacts.map((a) => (
            <div
              key={a.path}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 8px", borderRadius: 4, background: "#1e1e2e",
                fontSize: 12,
              }}
            >
              <span>{fileIcon(a.path)}</span>
              <span style={{ flex: 1, color: "#cdd6f4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.path}
              </span>
              <span style={{ fontSize: 10, color: "#888" }}>[{a.agentName}]</span>

              {/* Preview */}
              <button
                onClick={() => setPreview(preview?.path === a.path ? null : a)}
                style={{
                  padding: "1px 8px", borderRadius: 4, border: "none",
                  background: "#313244", color: "#89b4fa", cursor: "pointer", fontSize: 11,
                }}
              >
                {preview?.path === a.path ? "close" : "view"}
              </button>

              {/* Download */}
              <button
                onClick={() => downloadBlob(a.content, a.path.split("/").pop() ?? a.path)}
                style={{
                  padding: "1px 8px", borderRadius: 4, border: "none",
                  background: "#313244", color: "#a6e3a1", cursor: "pointer", fontSize: 11,
                }}
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Inline preview */}
      {preview && (
        <div style={{
          margin: "0 12px 12px", borderRadius: 6, background: "#181825",
          border: "1px solid #45475a", overflow: "hidden",
        }}>
          <div style={{
            padding: "6px 10px", background: "#1e1e2e", borderBottom: "1px solid #313244",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: "#cdd6f4" }}>{preview.path}</span>
            <button
              onClick={() => downloadBlob(preview.content, preview.path.split("/").pop() ?? preview.path)}
              style={{ padding: "2px 10px", borderRadius: 4, border: "none", background: "#a6e3a1", color: "#1e1e2e", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
            >
              Download
            </button>
          </div>
          <pre style={{
            margin: 0, padding: 12, fontSize: 11, color: "#a6adc8",
            overflowX: "auto", overflowY: "auto", maxHeight: 300,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {preview.content}
          </pre>
        </div>
      )}
    </>
  );
}
