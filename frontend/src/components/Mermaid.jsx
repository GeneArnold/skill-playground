import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
});

let SEQ = 0;

// Renders a mermaid diagram from a chart definition string.
export default function Mermaid({ chart }) {
  const [svg, setSvg] = useState("");
  const idRef = useRef(`mmd-${++SEQ}`);

  useEffect(() => {
    let active = true;
    mermaid
      .render(idRef.current, chart)
      .then(({ svg }) => active && setSvg(svg))
      .catch((e) => active && setSvg(`<pre class="json err">${String(e)}</pre>`));
    return () => {
      active = false;
    };
  }, [chart]);

  return (
    <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
