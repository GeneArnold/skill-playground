import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";

const LANGS = {
  python: () => python(),
  markdown: () => markdown(),
  yaml: () => yaml(),
};

// A small syntax-highlighting code editor (CodeMirror 6) with line numbers,
// bracket matching, and a dark IDE theme.
export default function CodeEditor({ value, onChange, language = "markdown", height = "300px" }) {
  const lang = (LANGS[language] || LANGS.markdown)();
  return (
    <div className="code-editor" style={{ height }}>
      <CodeMirror
        value={value}
        theme={oneDark}
        extensions={[lang]}
        height="100%"
        style={{ height: "100%" }}
        onChange={(val) => onChange(val)}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
