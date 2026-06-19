import React, { useState } from "react";
import { streamExplain } from "../api.js";

export default function ExplainModal({ turn, models, defaultModel, onClose }) {
  const [model, setModel] = useState(defaultModel);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [running, setRunning] = useState(false);

  async function ask() {
    setRunning(true);
    setAnswer("");
    try {
      await streamExplain(model, turn.events, question, (e) => {
        if (e.type === "text_delta") setAnswer((a) => a + e.text);
        else if (e.type === "error") setAnswer((a) => a + `\n[error] ${e.message}`);
      });
    } catch (e) {
      setAnswer((a) => a + `\n[error] ${e.message || e}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal explain" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Ask the model why it did that</h3>
          <button className="link" onClick={onClose}>✕</button>
        </div>

        <p className="hint">
          The full trace of this turn is sent back to the model so it can explain
          its behavior and suggest how to improve the skill.
        </p>

        <div className="field">
          <label>Explain with</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Your question (optional)</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Why didn't it set mode=words? How should I fix the description?"
          />
        </div>

        <div className="modal-foot">
          <button className="primary" onClick={ask} disabled={running}>
            {running ? "Thinking…" : "Ask"}
          </button>
        </div>

        {answer && <div className="explain-answer">{answer}</div>}
      </div>
    </div>
  );
}
