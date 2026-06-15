import React from "react";

export default function ModelPicker({ models, value, onChange }) {
  if (!models.length) {
    return (
      <div className="model-picker empty">
        No models available. Add an API key to <code>backend/.env</code> and
        restart the backend.
      </div>
    );
  }
  return (
    <div className="model-picker">
      <label>Model</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {value && (
        <div className="model-meta">
          {(() => {
            const m = models.find((x) => x.id === value);
            if (!m) return null;
            return (
              <>
                <span className={`badge ${m.tier}`}>{m.tier}</span>
                {m.exposes_thinking && <span className="badge think">thinking</span>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
