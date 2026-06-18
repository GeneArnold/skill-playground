import React, { useEffect, useMemo, useRef, useState } from "react";
import { getModels, getSkills, streamChat } from "./api.js";
import ModelPicker from "./components/ModelPicker.jsx";
import SkillsSidebar from "./components/SkillsSidebar.jsx";
import SkillEditor from "./components/SkillEditor.jsx";
import ChatPane from "./components/ChatPane.jsx";
import TracePanel from "./components/TracePanel.jsx";
import ExplainModal from "./components/ExplainModal.jsx";
import HelpModal from "./components/HelpModal.jsx";
import InstructionsModal from "./components/InstructionsModal.jsx";

let TURN_SEQ = 0;

export default function App() {
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(null);
  const [skills, setSkills] = useState([]);
  const [enabled, setEnabled] = useState(new Set());

  const [turns, setTurns] = useState([]);
  const [selectedTurnId, setSelectedTurnId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(null);
  const abortRef = useRef(null);

  const [editorSkill, setEditorSkill] = useState(undefined); // undefined=closed, null=new
  const [explainTurn, setExplainTurn] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(420);

  function startRightResize(e) {
    e.preventDefault();
    const onMove = (ev) => {
      const w = window.innerWidth - ev.clientX;
      const max = Math.round(window.innerWidth * 0.7);
      setRightWidth(Math.min(Math.max(w, 320), max));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.classList.add("resizing");
  }

  async function loadSkills() {
    const s = await getSkills();
    setSkills(s);
    // Skills start unchecked — the user opts in per chat.
  }

  function setAllSkills(on) {
    setEnabled(on ? new Set(skills.filter((x) => !x.error).map((x) => x.name)) : new Set());
  }

  useEffect(() => {
    getModels().then((m) => {
      setModels(m);
      if (m.length) setModel(m[0].id);
    });
    loadSkills();
  }, []);

  function toggleSkill(name) {
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function updateTurn(id, fn) {
    setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }

  async function send(text) {
    if (!model) return;
    // Build history from completed turns + the new message.
    const history = [];
    for (const t of turns) {
      history.push({ role: "user", content: t.userText });
      if (t.assistantText) history.push({ role: "assistant", content: t.assistantText });
    }
    history.push({ role: "user", content: text });

    const id = ++TURN_SEQ;
    const newTurn = {
      id,
      userText: text,
      events: [],
      assistantText: "",
      thinkingText: "",
      usage: null,
      model,
      status: "streaming",
      error: null,
    };
    setTurns((prev) => [...prev, newTurn]);
    setSelectedTurnId(id);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const enabledNames = [...enabled];
    try {
      await streamChat(model, enabledNames, history, (e) => {
        // Always record the raw event for the trace.
        updateTurn(id, (t) => ({ ...t, events: [...t.events, e] }));

        switch (e.type) {
          case "text_delta":
            updateTurn(id, (t) => ({ ...t, assistantText: t.assistantText + e.text }));
            break;
          case "thinking_delta":
            updateTurn(id, (t) => ({ ...t, thinkingText: t.thinkingText + e.text }));
            break;
          case "skill_opened":
            if (e.skill_folder) setHighlight({ folder: e.skill_folder, phase: "opening" });
            break;
          case "tool_call":
            if (e.skill_folder) setHighlight({ folder: e.skill_folder, phase: "calling" });
            break;
          case "tool_execution":
            if (e.skill_folder) setHighlight({ folder: e.skill_folder, phase: "running" });
            break;
          case "final":
            updateTurn(id, (t) => ({
              ...t,
              assistantText: e.text || t.assistantText,
              usage: e.usage || t.usage,
            }));
            break;
          case "error":
            updateTurn(id, (t) => ({ ...t, error: e.message, status: "error" }));
            break;
          case "done":
            updateTurn(id, (t) => ({
              ...t,
              status: t.status === "error" ? "error" : "done",
            }));
            setHighlight(null);
            break;
          default:
            break;
        }
      }, controller.signal);
    } catch (err) {
      if (err.name === "AbortError") {
        // User clicked Stop — keep whatever streamed so far, mark as stopped.
        updateTurn(id, (t) => ({ ...t, status: "stopped" }));
      } else {
        updateTurn(id, (t) => ({ ...t, error: String(err.message || err), status: "error" }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setHighlight(null);
    }
  }

  function stop() {
    if (abortRef.current) abortRef.current.abort();
  }

  function newChat() {
    setTurns([]);
    setSelectedTurnId(null);
  }

  const selectedTurn = useMemo(
    () => turns.find((t) => t.id === selectedTurnId) || turns[turns.length - 1] || null,
    [turns, selectedTurnId]
  );

  return (
    <div
      className="app"
      style={{
        gridTemplateColumns: `${leftCollapsed ? "40px" : "290px"} 1fr ${
          rightCollapsed ? "40px" : `${rightWidth}px`
        }`,
      }}
    >
      <aside className={"left" + (leftCollapsed ? " collapsed" : "")}>
        {leftCollapsed ? (
          <button
            className="rail-expand"
            onClick={() => setLeftCollapsed(false)}
            title="Expand skills panel"
          >
            <span className="rail-icon">›</span>
            <span className="rail-label">Skills</span>
          </button>
        ) : (
          <>
            <div className="panel-head">
              <button
                className="link collapse-btn"
                onClick={() => setLeftCollapsed(true)}
                title="Collapse panel"
              >
                ‹
              </button>
            </div>
            <ModelPicker models={models} value={model} onChange={setModel} />
            <SkillsSidebar
              skills={skills}
              enabled={enabled}
              onToggle={toggleSkill}
              onSetAll={setAllSkills}
              highlight={highlight}
              onEdit={(s) => setEditorSkill(s)}
              onNew={() => setEditorSkill(null)}
              onReload={loadSkills}
            />
          </>
        )}
      </aside>

      <main className="center">
        <div className="topbar">
          <span className="brand">⚙ Skill Playground</span>
          <div className="topbar-actions">
            <button className="link" onClick={() => setShowInstructions(true)}>📝 Instructions</button>
            <button className="link" onClick={() => setShowHelp(true)}>📖 How it works</button>
            <button className="link" onClick={newChat}>+ New chat</button>
          </div>
        </div>
        <ChatPane
          turns={turns}
          busy={busy}
          onSend={send}
          onStop={stop}
          onExplain={(t) => setExplainTurn(t)}
        />
        {!rightCollapsed && (
          <div
            className="resizer right-resizer"
            onMouseDown={startRightResize}
            title="Drag to resize the trace panel"
          />
        )}
      </main>

      <aside className={"right" + (rightCollapsed ? " collapsed" : "")}>
        {rightCollapsed ? (
          <button
            className="rail-expand"
            onClick={() => setRightCollapsed(false)}
            title="Expand trace panel"
          >
            <span className="rail-icon">‹</span>
            <span className="rail-label">Trace</span>
          </button>
        ) : (
          <>
            <div className="panel-head">
              <button
                className="link collapse-btn"
                onClick={() => setRightCollapsed(true)}
                title="Collapse panel"
              >
                ›
              </button>
            </div>
            <TracePanel turn={selectedTurn} />
          </>
        )}
      </aside>

      {editorSkill !== undefined && (
        <SkillEditor
          skill={editorSkill}
          models={models}
          defaultModel={model}
          onClose={() => setEditorSkill(undefined)}
          onSaved={loadSkills}
        />
      )}

      {explainTurn && (
        <ExplainModal
          turn={explainTurn}
          models={models}
          defaultModel={model}
          onClose={() => setExplainTurn(null)}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {showInstructions && (
        <InstructionsModal onClose={() => setShowInstructions(false)} />
      )}
    </div>
  );
}
