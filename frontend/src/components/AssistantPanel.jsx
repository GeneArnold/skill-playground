import React, { useEffect, useState } from "react";
import { streamAssist } from "../api.js";
import MarkdownPreview from "./MarkdownPreview.jsx";

const STORAGE_KEY = "copilot_model";

// Pull the last fenced ```python and ```yaml blocks out of the response so we
// can offer one-click "Apply" of the full file.
function extractBlocks(text) {
  const re = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const blocks = { python: null, yaml: null };
  let m;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] || "").toLowerCase();
    const code = m[2].replace(/\s+$/, "");
    if (lang === "python" || lang === "py") blocks.python = code;
    else if (lang === "yaml" || lang === "yml") blocks.yaml = code;
  }
  return blocks;
}

const QUICK = [
  { label: "Write it for me", text: "Write the script described by the frontmatter." },
  { label: "Explain my script", text: "Explain what the current script does, line by line." },
  { label: "Fix my script", text: "Something's wrong — find and fix the bug in my script." },
];

export default function AssistantPanel({
  frontmatter,
  script,
  models,
  defaultModel,
  onApplyScript,
  onApplyFrontmatter,
}) {
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && models.some((m) => m.id === saved)) return saved;
    return defaultModel || (models[0] && models[0].id);
  });
  const [instruction, setInstruction] = useState("");
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (model) localStorage.setItem(STORAGE_KEY, model);
  }, [model]);

  const chatM = models.find((m) => m.id === defaultModel);
  const copM = models.find((m) => m.id === model);
  const localSwap = chatM && copM && chatM.local && copM.local && chatM.id !== copM.id;

  if (!models.length) {
    return (
      <div className="assistant-pane">
        <p className="editor-caption">
          The assistant needs a model. Add an API key (or run Ollama) and reopen
          this editor.
        </p>
      </div>
    );
  }

  async function ask(text) {
    const q = (text ?? instruction).trim();
    if (text) setInstruction(text);
    setRunning(true);
    setAnswer("");
    try {
      await streamAssist(model, q, frontmatter, script, (e) => {
        if (e.type === "text_delta") setAnswer((a) => a + e.text);
        else if (e.type === "error") setAnswer((a) => a + `\n\n[error] ${e.message}`);
      });
    } catch (e) {
      setAnswer((a) => a + `\n\n[error] ${e.message || e}`);
    } finally {
      setRunning(false);
    }
  }

  const blocks = extractBlocks(answer);

  return (
    <div className="assistant-pane">
      {/* fixed request area — never shrinks */}
      <div className="assistant-form">
        <p className="editor-caption">
          Tell the copilot what the script should do (or paste an error). It
          writes the Python for you — review it below, then click{" "}
          <strong>Use as Script</strong> to load it into the Script tab.
        </p>

        <div className="form-row">
          <span className="field-label">Copilot model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {model === defaultModel && <span className="tag-same">same as chat</span>}
        </div>

        {localSwap && (
          <div className="lowmem-warn">
            ⚠ The copilot ({copM.label}) is a different local model than your chat
            model ({chatM.label}). On a low-memory machine, Ollama may unload one
            and reload the other each time you switch — which is slow. Using the
            same local model for both (or a cloud model for the copilot) avoids it.
          </div>
        )}

        <span className="field-label">Your request</span>
        <textarea
          className="assistant-input"
          rows={3}
          value={instruction}
          placeholder="e.g. Take a list of words and return the longest one — or paste an error message"
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
          }}
          disabled={running}
        />

        <div className="assistant-actions">
          <button className="primary" onClick={() => ask()} disabled={running}>
            {running ? "Thinking…" : "Ask the copilot"}
          </button>
          <span className="muted tiny-hint">⌘/Ctrl+Enter to send</span>
          <span className="quick-sep">or try:</span>
          {QUICK.map((q) => (
            <button key={q.label} className="chip" disabled={running} onClick={() => ask(q.text)}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* scrolling response area */}
      {(running || answer) && (
        <div className="assistant-answer">
          <div className="answer-head">Copilot response</div>
          <MarkdownPreview source={answer || "Thinking…"} />
        </div>
      )}

      {/* clear apply bar, pinned at the bottom of the tab */}
      {!running && (blocks.python || blocks.yaml) && (
        <div className="apply-bar">
          <span className="apply-label">Looks good?</span>
          {blocks.yaml && (
            <button className="secondary" onClick={() => onApplyFrontmatter(blocks.yaml)}>
              Use as Frontmatter
            </button>
          )}
          {blocks.python && (
            <button className="primary" onClick={() => onApplyScript(blocks.python)}>
              ✓ Use as Script
            </button>
          )}
        </div>
      )}
    </div>
  );
}
