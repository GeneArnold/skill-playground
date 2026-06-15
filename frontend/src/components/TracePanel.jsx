import React from "react";

function Json({ value }) {
  return <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
}

// Collapse consecutive text/thinking deltas into single blocks for readability.
function condense(events) {
  const out = [];
  for (const e of events) {
    const last = out[out.length - 1];
    if ((e.type === "text_delta" || e.type === "thinking_delta") && last && last.type === e.type) {
      last.text += e.text;
    } else if (e.type === "text_delta" || e.type === "thinking_delta") {
      out.push({ type: e.type, text: e.text });
    } else {
      out.push(e);
    }
  }
  return out;
}

function ExecutionDetail({ ex }) {
  if (!ex) return null;
  return (
    <div className="exec-detail">
      <div className="exec-row">
        <span className={"exec-status " + (ex.ok ? "ok" : "bad")}>
          {ex.ok ? "exit 0 ✓" : `failed${ex.exit_code != null ? ` (exit ${ex.exit_code})` : ""}`}
        </span>
        {ex.duration_ms != null && <span className="muted">{ex.duration_ms} ms</span>}
      </div>
      {ex.stdin != null && (
        <div className="exec-block">
          <div className="exec-label">stdin → script (exact args sent)</div>
          <pre className="json">{ex.stdin}</pre>
        </div>
      )}
      {ex.stdout ? (
        <div className="exec-block">
          <div className="exec-label">stdout ← script</div>
          <pre className="json">{ex.stdout}</pre>
        </div>
      ) : null}
      {ex.stderr ? (
        <div className="exec-block">
          <div className="exec-label err">stderr</div>
          <pre className="json err">{ex.stderr}</pre>
        </div>
      ) : null}
      {ex.error && <div className="exec-error">⚠ {ex.error}</div>}
    </div>
  );
}

export default function TracePanel({ turn }) {
  if (!turn) {
    return (
      <div className="trace-panel">
        <h2>Trace</h2>
        <p className="muted">
          Send a message to see the full trace — reasoning, the exact tool calls,
          what was sent to each skill script, and what came back.
        </p>
      </div>
    );
  }

  const events = condense(turn.events);

  return (
    <div className="trace-panel">
      <h2>Trace</h2>
      <div className="trace-meta">
        <span className="badge">{turn.model || "?"}</span>
        {turn.usage && turn.usage.output_tokens != null && (
          <span className="muted">
            {turn.usage.input_tokens}→{turn.usage.output_tokens} tok
          </span>
        )}
        <span className={"badge " + turn.status}>{turn.status}</span>
      </div>

      <ol className="trace-list">
        {events.map((e, i) => {
          switch (e.type) {
            case "system_prompt":
              return (
                <li key={i} className="t-system">
                  <div className="t-kind">system prompt sent to model</div>
                  <details>
                    <summary className="t-summary">
                      view what the model received ({e.text.length} chars)
                    </summary>
                    <pre className="json">{e.text}</pre>
                  </details>
                </li>
              );
            case "skills_available":
              return (
                <li key={i} className="t-tools">
                  <div className="t-kind">
                    skills available — metadata only ({e.skills.length})
                  </div>
                  <div className="t-body">
                    {e.skills.length ? (
                      <ul className="avail-list">
                        {e.skills.map((s) => (
                          <li key={s.name}>
                            <code>{s.name}</code> — {s.description}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "(none — no skills enabled)"
                    )}
                  </div>
                </li>
              );
            case "skill_opened":
              return (
                <li key={i} className="t-opened">
                  <div className="t-kind">
                    📖 opened skill: <b>{e.name}</b>
                  </div>
                  <div className="t-body muted">
                    full instructions ({e.instructions_chars} chars) loaded into
                    context
                  </div>
                </li>
              );
            case "user_message":
              return (
                <li key={i} className="t-user">
                  <div className="t-kind">user</div>
                  <div className="t-body">{e.text}</div>
                </li>
              );
            case "turn_start":
              return (
                <li key={i} className="t-turn">
                  <div className="t-kind">model turn #{e.index + 1}</div>
                </li>
              );
            case "thinking_delta":
              return (
                <li key={i} className="t-think">
                  <div className="t-kind">reasoning</div>
                  <div className="t-body think">{e.text}</div>
                </li>
              );
            case "text_delta":
              return (
                <li key={i} className="t-text">
                  <div className="t-kind">assistant text</div>
                  <div className="t-body">{e.text}</div>
                </li>
              );
            case "tool_call":
              return (
                <li key={i} className="t-call">
                  <div className="t-kind">→ calls skill: <b>{e.name}</b></div>
                  <div className="t-label">arguments the model produced:</div>
                  <Json value={e.input} />
                </li>
              );
            case "tool_execution":
              return (
                <li key={i} className="t-exec">
                  <div className="t-kind">⚙ ran {e.name}</div>
                  <ExecutionDetail ex={e.execution} />
                </li>
              );
            case "tool_result":
              return (
                <li key={i} className="t-result">
                  <div className="t-kind">← result fed back to model</div>
                  <pre className="json">{e.result}</pre>
                </li>
              );
            case "final":
              return (
                <li key={i} className="t-final">
                  <div className="t-kind">final answer</div>
                  <div className="t-body">{e.text}</div>
                </li>
              );
            case "error":
              return (
                <li key={i} className="t-error">
                  <div className="t-kind">error</div>
                  <div className="t-body err">{e.message}</div>
                </li>
              );
            default:
              return null;
          }
        })}
      </ol>
    </div>
  );
}
