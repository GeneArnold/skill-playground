// Thin API client. Chat/explain stream Server-Sent Events over POST, so we read
// the response body manually (EventSource only supports GET).

export async function getModels() {
  const r = await fetch("/api/models");
  return r.json();
}

export async function getSkills() {
  const r = await fetch("/api/skills");
  return r.json();
}

export async function getInstructions() {
  const r = await fetch("/api/instructions");
  return r.json();
}

export async function saveInstructions(instructions) {
  const r = await fetch("/api/instructions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructions }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "save failed");
  return r.json();
}

export async function saveSkill(folder, skillMd, scriptSource) {
  const r = await fetch(`/api/skills/${folder}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill_md: skillMd, script_source: scriptSource }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "save failed");
  return r.json();
}

export async function createSkill(folder, skillMd, scriptSource) {
  const r = await fetch("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, skill_md: skillMd, script_source: scriptSource }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "create failed");
  return r.json();
}

// Streams a POST SSE endpoint, invoking onEvent(parsedJson) for each event.
// Pass an optional AbortSignal to allow cancelling the request mid-stream.
async function streamSSE(url, body, onEvent, signal) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok || !resp.body) {
    throw new Error(`request failed: ${resp.status}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data) onEvent(JSON.parse(data));
        }
      }
    }
  }
}

export function streamChat(model, enabledSkills, messages, onEvent, signal) {
  return streamSSE("/api/chat", { model, enabled_skills: enabledSkills, messages }, onEvent, signal);
}

export function streamExplain(model, trace, question, onEvent) {
  return streamSSE("/api/explain", { model, trace, question }, onEvent);
}

export function streamAssist(model, instruction, frontmatter, script, onEvent) {
  return streamSSE("/api/assist", { model, instruction, frontmatter, script }, onEvent);
}
