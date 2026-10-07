// Request validation and responses for the Innovation Board Function.

import { IDEAS } from "./data.js";
import { MODES } from "./protocol.js";

const MAX_BODY_BYTES = 64 * 1024;

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

const onlyKeys = (obj, keys) => Object.keys(obj).every((key) => keys.includes(key));

// Two shapes only: { start: { ideaId, mode } } or { state }. Visitors pick an idea from an allow-list;
// there is no free-text field anywhere, so nothing a visitor types can reach the model.
export async function parseTurnRequest(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: "Request body is too large." };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: "Body must be valid JSON." };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be a JSON object." };
  if (body.start !== undefined) {
    const s = body.start;
    if (!onlyKeys(body, ["start"]) || !s || typeof s !== "object" || !onlyKeys(s, ["ideaId", "mode"])) return { error: "Only start.ideaId and start.mode are accepted." };
    if (typeof s.ideaId !== "string" || !Object.hasOwn(IDEAS, s.ideaId)) return { error: "Unknown ideaId." };
    if (s.mode !== undefined && !MODES.includes(s.mode)) return { error: "Unknown mode." };
    return { start: { ideaId: s.ideaId, mode: s.mode } };
  }
  if (!onlyKeys(body, ["state"]) || body.state === undefined) return { error: "Send either start or state." };
  return { state: body.state };
}

export function recordingPath(ideaId) {
  return `/demos/innovation-board/recordings/${ideaId}.json`;
}
