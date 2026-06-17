import React, { useMemo, useState } from "react";
import yaml from "js-yaml";
import { saveSkill, createSkill } from "../api.js";
import CodeEditor from "./CodeEditor.jsx";
import MarkdownPreview from "./MarkdownPreview.jsx";
import AssistantPanel from "./AssistantPanel.jsx";

function validateYaml(text) {
  try {
    yaml.load(text);
    return { ok: true };
  } catch (e) {
    const line = e.mark && typeof e.mark.line === "number" ? e.mark.line + 1 : null;
    return { ok: false, message: e.reason || e.message, line };
  }
}

function tidyYaml(text) {
  // Parse then re-dump with consistent 2-space indentation.
  const obj = yaml.load(text);
  return yaml.dump(obj, { indent: 2, lineWidth: 90, noRefs: true }).trimEnd();
}

// A SKILL.md is one file with two zones. We edit them on separate tabs for
// clarity, then re-join them with the --- fences on save.
const NEW_FRONTMATTER = `name: my_skill
description: >-
  Describe clearly WHEN the model should use this skill and what it does. This
  description is how the model decides to call it.
script: run.py
input_schema:
  type: object
  properties:
    value:
      type: string
      description: An input value.
  required: [value]`;

const NEW_BODY = `# My skill

Explain what the skill does and, most importantly, HOW the model should use it:
step-by-step instructions, rules, and examples. This text is loaded into the
model's context when it opens the skill, so it directly shapes behavior.
`;

const NEW_SCRIPT = `#!/usr/bin/env python3
"""JSON in on stdin, JSON out on stdout."""
import json, sys

args = json.loads(sys.stdin.read())
# TODO: do something with args
print(json.dumps({"echo": args}))
`;

const TABS = [
  { id: "frontmatter", label: "Frontmatter", tag: "yaml" },
  { id: "instructions", label: "Instructions", tag: "markdown" },
  { id: "script", label: "Script", tag: "python" },
  { id: "assistant", label: "✨ Assistant", tag: null },
  { id: "help", label: "Help", tag: null },
];

function joinSkillMd(frontmatter, body) {
  return `---\n${frontmatter.trim()}\n---\n\n${body.trim()}\n`;
}

function HelpTab() {
  return (
    <div className="help-content editor-help">
      <h4>Editing a skill</h4>
      <p>
        A skill is one folder. The <code>SKILL.md</code> file has two zones split
        by <code>---</code> fences; you edit them on the first two tabs, and the
        script on the third.
      </p>

      <h4>1 · Frontmatter (YAML)</h4>
      <p>Structured config the program parses:</p>
      <table className="doc-table">
        <tbody>
          <tr><td><code>name</code></td><td>The tool name the model calls (snake_case).</td></tr>
          <tr><td><code>description</code></td><td>The <strong>trigger</strong> — how the model decides <em>when</em> to use the skill.</td></tr>
          <tr><td><code>script</code></td><td>Which file in the folder runs when the skill is called.</td></tr>
          <tr><td><code>input_schema</code></td><td>JSON Schema of the arguments the model must pass.</td></tr>
        </tbody>
      </table>

      <h4>2 · Instructions (Markdown)</h4>
      <p>
        The instruction set, loaded into the model's context when it{" "}
        <em>opens</em> the skill. This is{" "}
        <strong>where you shape behavior</strong> — if the skill misbehaves, edit
        the <code>description</code> (the <em>when</em>) or this body (the{" "}
        <em>how</em>): add rules, steps, and examples.
      </p>

      <h4>3 · Script (Python)</h4>
      <p>
        The code that runs when the model calls the skill. The contract:
      </p>
      <ul>
        <li>Read one JSON object from <strong>stdin</strong> (the model's arguments).</li>
        <li>Print one JSON object to <strong>stdout</strong> (the result fed back).</li>
        <li>Exit <code>0</code> on success; write to <strong>stderr</strong> and exit non-zero on error.</li>
      </ul>

      <p className="doc-note">
        On save, the Frontmatter and Instructions tabs are rejoined into one
        <code> SKILL.md</code> with the <code>---</code> fences, and the script is
        written next to it. Then the skill list reloads.
      </p>
    </div>
  );
}

export default function SkillEditor({ skill, models = [], defaultModel, onClose, onSaved }) {
  const creating = !skill;
  const [tab, setTab] = useState("frontmatter");
  const [folder, setFolder] = useState(creating ? "my-skill" : skill.folder);
  const [frontmatter, setFrontmatter] = useState(
    creating ? NEW_FRONTMATTER : skill.frontmatter || ""
  );
  const [body, setBody] = useState(creating ? NEW_BODY : skill.body || "");
  const [scriptSource, setScriptSource] = useState(
    creating ? NEW_SCRIPT : skill.script_source || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [mdView, setMdView] = useState("split"); // write | split | preview

  const yamlStatus = useMemo(() => validateYaml(frontmatter), [frontmatter]);

  function handleTidyYaml() {
    try {
      setFrontmatter(tidyYaml(frontmatter));
    } catch {
      /* invalid YAML — the status bar already shows the error */
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const skillMd = joinSkillMd(frontmatter, body);
    try {
      const saved = creating
        ? await createSkill(folder, skillMd, scriptSource)
        : await saveSkill(skill.folder, skillMd, scriptSource);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal editor large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{creating ? "New skill" : `Edit: ${skill.name}`}</h3>
          <button className="link" onClick={onClose}>✕</button>
        </div>

        {creating && (
          <div className="field folder-field">
            <label>Folder name</label>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="my-skill"
            />
          </div>
        )}

        <div className="editor-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"editor-tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.tag && <span className="lang-tag">{t.tag}</span>}
            </button>
          ))}
        </div>

        <div className="editor-tabpane">
          {tab === "frontmatter" && (
            <>
              <div className="editor-toolbar">
                <span className="editor-caption inline">
                  Structured config: <code>name</code>, <code>description</code>,{" "}
                  <code>script</code>, <code>input_schema</code>.
                </span>
                <div className="toolbar-right">
                  {yamlStatus.ok ? (
                    <span className="yaml-status ok">✓ Valid YAML</span>
                  ) : (
                    <span className="yaml-status bad">
                      ✗ {yamlStatus.line ? `line ${yamlStatus.line}: ` : ""}
                      {yamlStatus.message}
                    </span>
                  )}
                  <button
                    className="secondary tiny-btn"
                    onClick={handleTidyYaml}
                    disabled={!yamlStatus.ok}
                    title="Re-indent with consistent 2-space formatting"
                  >
                    Tidy
                  </button>
                </div>
              </div>
              <div className="editor-fill">
                <CodeEditor value={frontmatter} onChange={setFrontmatter} language="yaml" height="100%" />
              </div>
            </>
          )}

          {tab === "instructions" && (
            <>
              <div className="editor-toolbar">
                <span className="editor-caption inline">
                  Loaded into context when the model opens this skill —{" "}
                  <strong>this shapes behavior</strong>.
                </span>
                <div className="segmented">
                  {["write", "split", "preview"].map((v) => (
                    <button
                      key={v}
                      className={"seg" + (mdView === v ? " active" : "")}
                      onClick={() => setMdView(v)}
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="editor-fill">
                {mdView === "preview" ? (
                  <div className="md-preview-wrap"><MarkdownPreview source={body} /></div>
                ) : mdView === "split" ? (
                  <div className="md-split">
                    <CodeEditor value={body} onChange={setBody} language="markdown" height="100%" />
                    <div className="md-preview-wrap"><MarkdownPreview source={body} /></div>
                  </div>
                ) : (
                  <CodeEditor value={body} onChange={setBody} language="markdown" height="100%" />
                )}
              </div>
            </>
          )}

          {tab === "script" && (
            <>
              <p className="editor-caption">
                Runs when the skill is called. JSON args in on stdin, JSON result
                out on stdout.
              </p>
              <div className="editor-fill">
                <CodeEditor value={scriptSource} onChange={setScriptSource} language="python" height="100%" />
              </div>
            </>
          )}

          {tab === "assistant" && (
            <AssistantPanel
              frontmatter={frontmatter}
              script={scriptSource}
              models={models}
              defaultModel={defaultModel}
              onApplyScript={(code) => {
                setScriptSource(code);
                setTab("script");
              }}
              onApplyFrontmatter={(yml) => {
                setFrontmatter(yml);
                setTab("frontmatter");
              }}
            />
          )}

          {tab === "help" && <HelpTab />}
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="modal-foot">
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save to disk"}
          </button>
        </div>
      </div>
    </div>
  );
}
