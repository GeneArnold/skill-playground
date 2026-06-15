import React, { useEffect, useRef, useState } from "react";

// Inline tool-call cards derived from a turn's events.
function ToolCards({ events }) {
  const order = [];
  const byId = {};
  for (const e of events) {
    if (e.type === "tool_call") {
      const entry = {
        id: e.id,
        name: e.name,
        input: e.input,
        kind: e.name === "open_skill" ? "open" : "script",
        exec: null,
        opened: null,
      };
      byId[e.id] = entry;
      order.push(entry);
    } else if (e.type === "tool_execution" && byId[e.id]) {
      byId[e.id].exec = e.execution;
    } else if (e.type === "skill_opened") {
      const entry = order.filter((x) => x.kind === "open" && !x.opened).pop();
      if (entry) entry.opened = e;
    }
  }
  if (!order.length) return null;
  return (
    <div className="tool-cards">
      {order.map((c, i) => {
        if (c.kind === "open") {
          const which = c.opened ? c.opened.name : (c.input && c.input.name) || "?";
          return (
            <div key={i} className="tool-card open">
              <div className="tool-card-head">
                📖 opened skill: <b>{which}</b>
              </div>
              {c.opened && (
                <div className="tool-card-out">
                  → instructions loaded ({c.opened.instructions_chars} chars)
                </div>
              )}
            </div>
          );
        }
        const out = c.exec && c.exec.ok ? c.exec.parsed_output : c.exec && c.exec.error;
        return (
          <div key={i} className={"tool-card" + (c.exec && !c.exec.ok ? " bad" : "")}>
            <div className="tool-card-head">
              🛠 <b>{c.name}</b>(
              {Object.entries(c.input || {})
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(", ")}
              )
            </div>
            {c.exec && (
              <div className="tool-card-out">
                → {typeof out === "object" ? JSON.stringify(out) : String(out)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPane({ turns, busy, onSend, onExplain }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns]);

  function submit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    onSend(text);
  }

  return (
    <div className="chat-pane">
      <div className="messages" ref={scrollRef}>
        {!turns.length && (
          <div className="empty-chat">
            <h1>Skill Playground</h1>
            <p>
              Chat with a model, toggle skills on the left, and watch the full
              trace on the right. Try: <em>"what is 128 times 47?"</em>
            </p>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id} className="turn">
            <div className="msg user">
              <div className="avatar">you</div>
              <div className="bubble">{t.userText}</div>
            </div>

            <div className="msg assistant">
              <div className="avatar">ai</div>
              <div className="bubble">
                {t.thinkingText && (
                  <details className="thinking">
                    <summary>reasoning</summary>
                    <div className="think">{t.thinkingText}</div>
                  </details>
                )}
                <ToolCards events={t.events} />
                <div className="answer">
                  {t.assistantText || (t.status === "streaming" ? "…" : "")}
                </div>
                {t.error && <div className="error-box">{t.error}</div>}
                {t.status !== "streaming" && (
                  <button className="link tiny explain" onClick={() => onExplain(t)}>
                    💡 Explain why
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder={busy ? "Working…" : "Send a message (Enter to send, Shift+Enter for newline)"}
          rows={2}
          disabled={busy}
        />
        <button type="submit" className="primary" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
