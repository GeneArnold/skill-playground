import React, { useEffect, useState } from "react";

// Merge consecutive text/thinking deltas so a step is one coherent chunk.
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

const approxTokens = (chars) => Math.max(1, Math.round(chars / 4));
const fmtTokens = (t) => (t >= 1000 ? `${(t / 1000).toFixed(1)}k` : `${t}`);

// Turn the raw event stream into narrated steps, tracking what enters the
// model's context and a running (rough) context-size estimate.
function buildSteps(events) {
  const ev = condense(events);
  const steps = [];
  let chars = 0;

  for (const e of ev) {
    switch (e.type) {
      case "system_prompt":
        chars += (e.text || "").length;
        steps.push({
          icon: "📋",
          title: "Standing orders loaded",
          explanation:
            "The system prompt is set: your editable Instructions plus a menu of available skills — names and one-line descriptions only, not their full instructions yet.",
          added: [`system prompt (${(e.text || "").length} chars)`],
          detail: { type: "text", label: "system prompt", value: e.text },
          tokens: approxTokens(chars),
          grew: true,
        });
        break;
      case "skills_available": {
        const names = (e.skills || []).map((s) => s.name).join(", ") || "none";
        steps.push({
          icon: "🧰",
          title: `Skill menu visible (${(e.skills || []).length})`,
          explanation: `The model sees these skills as options: ${names}. Only each name + description — enough to decide WHETHER to use one, not HOW. (Already part of the system prompt above, so no extra context.)`,
          added: [],
          detail: null,
          tokens: approxTokens(chars),
          grew: false,
        });
        break;
      }
      case "user_message":
        chars += (e.text || "").length;
        steps.push({
          icon: "💬",
          title: "Your message",
          explanation: "Your prompt is added to the conversation.",
          added: ["your message"],
          detail: { type: "text", label: "your message", value: e.text },
          tokens: approxTokens(chars),
          grew: true,
        });
        break;
      case "thinking_delta":
        chars += (e.text || "").length;
        steps.push({
          icon: "💭",
          title: "Model reasoning",
          explanation: "The model reasons privately before deciding what to do.",
          added: [],
          detail: { type: "text", label: "reasoning", value: e.text },
          tokens: approxTokens(chars),
          grew: false,
        });
        break;
      case "tool_call":
        if (e.name === "open_skill") {
          const which = (e.input && e.input.name) || "?";
          steps.push({
            icon: "📖",
            title: `Model opens skill: ${which}`,
            explanation: `The model judged the “${which}” skill relevant and asked to open it. This is progressive disclosure — it pulls in instructions only now that it needs them.`,
            added: [],
            detail: { type: "json", label: "open_skill request", value: e.input },
            tokens: approxTokens(chars),
            grew: false,
          });
        } else {
          steps.push({
            icon: "🛠",
            title: `Model calls: ${e.name}`,
            explanation: `The model calls the “${e.name}” tool, producing these exact arguments. Watch whether they're right!`,
            added: [],
            detail: { type: "json", label: "arguments", value: e.input },
            tokens: approxTokens(chars),
            grew: false,
          });
        }
        break;
      case "skill_opened":
        chars += e.instructions_chars || 0;
        steps.push({
          icon: "✅",
          title: `Skill loaded: ${e.name}`,
          explanation: `The full instructions for “${e.name}” (${e.instructions_chars} chars) were just loaded into the context, and its tool is now callable. THIS is the moment the skill's body enters the model's working memory.`,
          added: [
            `${e.name} full instructions (${e.instructions_chars} chars)`,
            `${e.name} tool now callable`,
          ],
          detail: null,
          tokens: approxTokens(chars),
          grew: true,
        });
        break;
      case "tool_execution":
        steps.push({
          icon: "⚙",
          title: "Script runs",
          explanation:
            "The playground runs the skill's Python script. These exact arguments went in on stdin; this came back on stdout.",
          added: [],
          detail: { type: "exec", value: e.execution },
          tokens: approxTokens(chars),
          grew: false,
        });
        break;
      case "tool_result":
        chars += (e.result || "").length;
        steps.push({
          icon: "↩",
          title: "Result added to context",
          explanation:
            e.name === "open_skill"
              ? "The skill's instructions are handed back to the model as the tool result."
              : "The script's output is added to the context so the model can use it in its answer.",
          added: ["tool result"],
          detail: { type: "text", label: "result", value: e.result },
          tokens: approxTokens(chars),
          grew: true,
        });
        break;
      case "final":
        chars += (e.text || "").length;
        steps.push({
          icon: "🏁",
          title: "Final answer",
          explanation:
            "With everything now in context — your message, any skill instructions, any tool results — the model writes its answer.",
          added: ["final answer"],
          detail: { type: "text", label: "answer", value: e.text },
          tokens: approxTokens(chars),
          grew: true,
        });
        break;
      case "error":
        steps.push({
          icon: "⚠",
          title: "Error",
          explanation: e.message,
          added: [],
          detail: null,
          tokens: approxTokens(chars),
          grew: false,
        });
        break;
      default:
        break;
    }
  }
  return steps;
}

function Detail({ detail }) {
  if (!detail) return null;
  if (detail.type === "json") {
    return (
      <div className="walk-detail">
        <div className="walk-detail-label">{detail.label}</div>
        <pre className="json">{JSON.stringify(detail.value, null, 2)}</pre>
      </div>
    );
  }
  if (detail.type === "exec") {
    const ex = detail.value || {};
    return (
      <div className="walk-detail">
        {ex.stdin != null && (
          <>
            <div className="walk-detail-label">stdin → script</div>
            <pre className="json">{ex.stdin}</pre>
          </>
        )}
        {ex.stdout ? (
          <>
            <div className="walk-detail-label">stdout ← script</div>
            <pre className="json">{ex.stdout}</pre>
          </>
        ) : null}
        {ex.stderr ? (
          <>
            <div className="walk-detail-label err">stderr</div>
            <pre className="json err">{ex.stderr}</pre>
          </>
        ) : null}
      </div>
    );
  }
  return (
    <div className="walk-detail">
      <div className="walk-detail-label">{detail.label}</div>
      <pre className="json">{detail.value}</pre>
    </div>
  );
}

export default function Walkthrough({ turn, onExit }) {
  const steps = buildSteps(turn.events);
  const [i, setI] = useState(0);

  // Reset to the first step whenever the turn changes.
  useEffect(() => setI(0), [turn.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  if (!steps.length) {
    return (
      <div className="walk">
        <div className="walk-head">
          <span>Walkthrough</span>
          <button className="link" onClick={onExit}>✕ full trace</button>
        </div>
        <p className="muted">No steps to walk through yet.</p>
      </div>
    );
  }

  const clamped = Math.min(i, steps.length - 1);
  const s = steps[clamped];

  return (
    <div className="walk">
      <div className="walk-head">
        <span>Step {clamped + 1} of {steps.length}</span>
        <button className="link" onClick={onExit}>✕ full trace</button>
      </div>

      <div className="walk-progress">
        {steps.map((st, idx) => (
          <button
            key={idx}
            className={"walk-dot" + (idx === clamped ? " active" : idx < clamped ? " done" : "")}
            title={`${idx + 1}. ${st.title}`}
            onClick={() => setI(idx)}
          />
        ))}
      </div>

      <div className="walk-nav">
        <button className="secondary" disabled={clamped === 0} onClick={() => setI(clamped - 1)}>
          ‹ Back
        </button>
        <button
          className="primary"
          disabled={clamped === steps.length - 1}
          onClick={() => setI(clamped + 1)}
        >
          Next ›
        </button>
      </div>

      <div className="walk-card">
        <div className="walk-title">{s.icon} {s.title}</div>
        <p className="walk-explain">{s.explanation}</p>

        {s.added.length > 0 && (
          <div className="walk-added">
            <div className="walk-added-h">What entered the context</div>
            <ul>{s.added.map((a, k) => <li key={k}>+ {a}</li>)}</ul>
          </div>
        )}

        <Detail detail={s.detail} />

        <div className="walk-tokens">
          Context size: ~{fmtTokens(s.tokens)} tokens {s.grew && <span className="up">↑</span>}
        </div>
      </div>
    </div>
  );
}
