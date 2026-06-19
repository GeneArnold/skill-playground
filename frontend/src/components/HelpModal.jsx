import React, { useState } from "react";
import Mermaid from "./Mermaid.jsx";

const CALL_FLOW = `sequenceDiagram
  actor User
  participant Model
  participant Backend as Playground
  participant Script
  User->>Backend: 1. send message
  Backend->>Model: 2. Instructions + skill metadata + open_skill tool
  Note over Model: 3. decides a skill is relevant
  Model->>Backend: 4. open_skill("calculator")
  Backend->>Model: 5. full SKILL.md body + enable calculator tool
  Note over Model: 6. follows instructions, builds args
  Model->>Backend: 7. calculator(a, b, op)
  Backend->>Script: 8. JSON args on stdin
  Script->>Backend: 9. JSON result on stdout
  Backend->>Model: 10. tool result
  Note over Model: 11. writes answer
  Model->>Backend: 12. final answer
  Backend->>User: 13. final answer`;

// In-app instructions. The canonical "how this works" document, reachable from
// the top bar. Kept as structured content so it renders consistently.
const SECTIONS = [
  {
    id: "what",
    title: "What is the Skill Playground?",
    body: (
      <>
        <p>
          A tool for <strong>learning how AI skills work</strong>. You chat with
          a model, switch skills on and off, and watch — step by step — how the
          model decides to use a skill, what it sends to the skill's script, and
          what comes back.
        </p>
        <p>
          Nothing here is hidden. The whole point is to make visible the parts
          that are normally invisible.
        </p>
      </>
    ),
  },
  {
    id: "anatomy",
    title: "Anatomy of a skill",
    body: (
      <>
        <p>
          A skill is a <strong>folder</strong> under <code>skills/</code>. The
          app discovers it automatically. Each folder has two things:
        </p>
        <ol>
          <li>
            <strong>SKILL.md</strong> — what the <em>model</em> reads.
          </li>
          <li>
            <strong>a script</strong> (e.g. <code>calculate.py</code>) — code
            that <em>runs</em> when the skill is called.
          </li>
        </ol>
        <p>
          The <code>SKILL.md</code> file itself has <strong>two zones</strong>,
          separated by lines of three dashes (<code>---</code>), called{" "}
          <em>fences</em>:
        </p>
        <pre className="doc-code">{`---                      ← fence: YAML starts
name: calculator         ┐
description: ...         │  ZONE 1: "frontmatter" (YAML)
script: calculate.py     │  structured config
input_schema: ...        ┘
---                      ← fence: YAML ends

# Calculator skill       ┐  ZONE 2: the body (Markdown)
Use this skill to...     ┘  instructions for the model`}</pre>
        <p>
          When the app loads a skill it splits the file at the fences: the top
          becomes parsed config, the bottom is instructional text.
        </p>
      </>
    ),
  },
  {
    id: "frontmatter",
    title: "Zone 1 — the frontmatter (YAML)",
    body: (
      <>
        <p>
          This is <strong>data the program parses</strong>, written in YAML
          because it's an easy, low-noise way to write nested key/value config.
        </p>
        <table className="doc-table">
          <tbody>
            <tr>
              <td><code>name</code></td>
              <td>The tool name the model calls. Use snake_case.</td>
            </tr>
            <tr>
              <td><code>description</code></td>
              <td>
                The <strong>trigger</strong>. This one sentence is how the model
                decides <em>whether</em> to use the skill. Vague description →
                wrong or missing calls.
              </td>
            </tr>
            <tr>
              <td><code>script</code></td>
              <td>Which file in the folder runs when the skill is called.</td>
            </tr>
            <tr>
              <td><code>input_schema</code></td>
              <td>
                A JSON Schema of the arguments. It becomes the tool's parameters
                and tells the model exactly what to pass.
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "body",
    title: "Zone 2 — the body (Markdown) — where you shape behavior",
    body: (
      <>
        <p>
          This is the <strong>instruction set</strong>. If the{" "}
          <code>description</code> is "<em>when</em> to use the skill," the body
          is "<em>how</em> to use it" — the rules, the steps, the examples.
        </p>
        <p>
          When the model decides a skill is relevant and <em>opens</em> it (see
          the next section), the playground loads this body into the model's
          context. So <strong>this is the part you edit most</strong> when a
          skill isn't behaving the way you want. Tighten the instructions here,
          add an example, state a rule — then re-run and watch the trace change.
        </p>
        <p className="doc-note">
          This is "progressive disclosure": the body is loaded only once a skill
          is actually opened, not up front — so enabling lots of skills doesn't
          bloat the context with instructions the model never needs.
        </p>
      </>
    ),
  },
  {
    id: "how-llm",
    title: "How the model actually uses a skill",
    body: (
      <>
        <p>Here's the full loop, which the Trace panel shows you live:</p>
        <ol>
          <li>
            <strong>Only metadata up front.</strong> The model is told each
            enabled skill's <code>name</code> and <code>description</code> — a
            lightweight "table of contents" — plus one tool called{" "}
            <code>open_skill</code>. No bodies, no script tools yet.
          </li>
          <li>
            <strong>The model opens a skill.</strong> If a skill looks relevant,
            the model calls <code>open_skill(name)</code>. That pulls the skill's
            full instructions (the body) into the conversation and reveals its
            script tool.
          </li>
          <li>
            <strong>The model calls the skill.</strong> Now holding the
            instructions and the tool, it calls the skill — producing a JSON
            object of arguments.
          </li>
          <li>
            <strong>The script runs.</strong> The playground sends those
            arguments as JSON on <code>stdin</code> to the skill's script and
            captures its JSON <code>stdout</code> (plus stderr/exit).
          </li>
          <li>
            <strong>The result goes back</strong> to the model, which then calls
            another tool or writes the final answer.
          </li>
        </ol>
        <p className="doc-note">
          This is why enabling many skills is cheap: only the ones the model
          actually opens load their full instructions. After a skill is opened it
          stays in context for the rest of the conversation — a natural byproduct
          of how the messages accumulate.
        </p>
        <p>
          The script contract is always the same: <strong>JSON in on stdin,
          JSON out on stdout</strong>, exit 0 on success.
        </p>
      </>
    ),
  },
  {
    id: "instructions",
    title: "The Instructions (system prompt)",
    body: (
      <>
        <p>
          Click <strong>📝 Instructions</strong> in the top bar to view and edit
          the <strong>base system prompt</strong> — the model's standing orders
          that sit above everything else in every chat.
        </p>
        <p>The full system prompt the model receives each turn is:</p>
        <pre className="doc-code">{`[ your Instructions text ]
+
## Available skills (metadata only)
- calculator: ...
- pirate_mode: ...`}</pre>
        <p>
          The "Available skills" list is generated automatically from your
          enabled skills (name + description only — progressive disclosure). You
          edit the top part; the skill list is added for you. See the exact
          result any time in the <strong>Trace</strong> panel under "system
          prompt sent to model."
        </p>
        <p className="doc-note">
          A skill's instructions and the system prompt are the same kind of thing
          — natural-language guidance — just at different scopes. The system
          prompt always applies; a skill's body loads only when opened.
        </p>
      </>
    ),
  },
  {
    id: "flow",
    title: "The flow of a call (diagram)",
    body: (
      <>
        <p>
          Here is the exact path of a single message that uses a script skill,
          end to end:
        </p>
        <Mermaid chart={CALL_FLOW} />
        <p className="doc-note">
          For an <strong>instruction-only skill</strong> (no script), steps 7–10
          don't happen: after step 5 loads the skill's body, the model goes
          straight to writing its answer following those instructions — there's
          no tool to call and no Script lane.
        </p>
      </>
    ),
  },
  {
    id: "build",
    title: "Building your first skill",
    body: (
      <>
        <ol>
          <li>Click <strong>+ New</strong> in the Skills sidebar.</li>
          <li>
            Fill in the three boxes: frontmatter (config), instructions
            (Markdown), and the Python script.
          </li>
          <li>Click <strong>Save to disk</strong>.</li>
          <li>Check the skill's box to enable it, then chat to trigger it.</li>
          <li>
            Watch the <strong>Trace</strong> panel: did it call your skill? With
            the right arguments? Did the script succeed?
          </li>
          <li>
            If not, edit the <code>description</code> (to fix <em>when</em>) or
            the body (to fix <em>how</em>), save, and try again.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "compare",
    title: "Learning from weak vs. smart models",
    body: (
      <>
        <p>
          Switch models in the picker and run the same prompt. A smart model
          often infers what you meant; a budget model needs more explicit
          instructions.
        </p>
        <ul>
          <li>Same prompt fails on a small model? Read its trace — what did it get wrong?</li>
          <li>Make the <code>description</code> more specific, or add a rule/example to the body.</li>
          <li>Stuck? Hit <strong>💡 Explain why</strong> on an answer and let a model coach you.</li>
        </ul>
      </>
    ),
  },
];

export default function HelpModal({ onClose }) {
  const [active, setActive] = useState(SECTIONS[0].id);
  const section = SECTIONS.find((s) => s.id === active);

  return (
    <div className="modal-overlay">
      <div className="modal help" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>📖 How skills work</h3>
          <button className="link" onClick={onClose}>✕</button>
        </div>
        <div className="help-body">
          <nav className="help-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={"help-nav-item" + (s.id === active ? " active" : "")}
                onClick={() => setActive(s.id)}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <div className="help-content">
            <h4>{section.title}</h4>
            {section.body}
          </div>
        </div>
      </div>
    </div>
  );
}
