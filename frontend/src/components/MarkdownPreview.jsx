import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rendered preview of the Instructions (Markdown) tab.
export default function MarkdownPreview({ source }) {
  if (!source || !source.trim()) {
    return <div className="md-preview empty muted">Nothing to preview yet.</div>;
  }
  return (
    <div className="md-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
