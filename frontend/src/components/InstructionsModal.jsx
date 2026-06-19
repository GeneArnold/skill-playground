import React, { useEffect, useState } from "react";
import { getInstructions, saveInstructions } from "../api.js";
import CodeEditor from "./CodeEditor.jsx";

// View/edit the base system prompt ("Instructions").
export default function InstructionsModal({ onClose, onSaved }) {
  const [text, setText] = useState("");
  const [def, setDef] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getInstructions().then((d) => {
      setText(d.instructions);
      setDef(d.default);
      setIsCustom(d.is_custom);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveInstructions(text);
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal instructions large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>📝 Instructions (base system prompt)</h3>
          <button className="link" onClick={onClose}>✕</button>
        </div>

        <p className="editor-caption">
          This text sits at the top of <strong>every</strong> chat's system
          prompt — the model's standing orders. The live prompt is this text{" "}
          <em>plus</em> an auto-generated list of available skills (name +
          description), which you can see in the <strong>Trace</strong> panel.
        </p>
        <p className="doc-note" style={{ marginBottom: 12 }}>
          Heads up: the progressive-disclosure mechanic relies on these
          instructions telling the model to call <code>open_skill</code>. If you
          remove that guidance, the model may stop opening skills — use{" "}
          <strong>Reset to default</strong> to recover.
        </p>

        <div className="editor-fill instructions-fill">
          {!loading && (
            <CodeEditor value={text} onChange={setText} language="markdown" height="100%" />
          )}
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="modal-foot">
          <button
            className="secondary"
            onClick={() => setText(def)}
            disabled={text === def}
            title="Load the original default text into the editor"
          >
            Reset to default
          </button>
          <div style={{ flex: 1 }} />
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
