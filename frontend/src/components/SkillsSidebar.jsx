import React, { useRef, useEffect } from "react";

// highlight = { folder, phase } | null  -> drives the "lit up" animation.
export default function SkillsSidebar({
  skills,
  enabled,
  onToggle,
  onSetAll,
  highlight,
  onEdit,
  onNew,
  onReload,
}) {
  const selectable = skills.filter((s) => !s.error);
  const enabledCount = selectable.filter((s) => enabled.has(s.name)).length;
  const allOn = selectable.length > 0 && enabledCount === selectable.length;
  const someOn = enabledCount > 0 && !allOn;

  const masterRef = useRef(null);
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = someOn;
  }, [someOn]);

  return (
    <div className="skills-sidebar">
      <div className="sidebar-head">
        <h2>Skills</h2>
        <div className="sidebar-actions">
          <button className="link" onClick={onReload} title="Re-scan skills/ folder">
            ↻
          </button>
          <button className="link" onClick={onNew}>+ New</button>
        </div>
      </div>

      <p className="hint">
        Check a skill to expose it to the model as a tool. It lights up when the
        model calls it.
      </p>

      <label className="select-all">
        <input
          ref={masterRef}
          type="checkbox"
          checked={allOn}
          disabled={!selectable.length}
          onChange={(e) => onSetAll(e.target.checked)}
        />
        <span>
          {allOn ? "Uncheck all" : "Check all"}
          {selectable.length ? ` (${enabledCount}/${selectable.length})` : ""}
        </span>
      </label>

      <div className="skill-list">
        {skills.map((s) => {
          const isActive = highlight && highlight.folder === s.folder;
          return (
            <div
              key={s.folder}
              className={
                "skill-card" +
                (isActive ? ` active phase-${highlight.phase}` : "") +
                (s.error ? " has-error" : "")
              }
            >
              <div className="skill-card-head">
                <label className="skill-toggle">
                  <input
                    type="checkbox"
                    checked={enabled.has(s.name)}
                    disabled={!!s.error}
                    onChange={() => onToggle(s.name)}
                  />
                  <span className="skill-name">{s.name}</span>
                </label>
                <button className="link tiny" onClick={() => onEdit(s)}>
                  edit
                </button>
              </div>

              <div className="skill-desc">{s.description || "(no description)"}</div>

              <div className="skill-script">
                {s.script ? (
                  <span className={isActive && highlight.phase === "running" ? "running" : ""}>
                    ▶ {s.script}
                  </span>
                ) : (
                  <span className="muted">📄 instructions only — no script</span>
                )}
              </div>

              {s.error && <div className="skill-error">⚠ {s.error}</div>}
            </div>
          );
        })}
        {!skills.length && <div className="muted">No skills found in skills/.</div>}
      </div>
    </div>
  );
}
