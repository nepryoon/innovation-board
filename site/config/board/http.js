// Request validation and responses for the Innovation Board Function.

import { IDEAS } from "./data.js";
import { MODES } from "./protocol.js";
import { isLocale, DEFAULT_LOCALE } from "./locale.js";

const MAX_BODY_BYTES = 64 * 1024;

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

const onlyKeys = (obj, keys) => Object.keys(obj).every((key) => keys.includes(key));

// Two shapes only: { start: { ideaId, mode, locale } } or { state }. Visitors pick an idea and a
// language from allow-lists; there is no free-text field anywhere, so nothing a visitor types can
// reach the model. The result also names the locale to answer errors in, when one can be read.
export async function parseTurnRequest(request) {
  const result = await parseBody(request);
  const claimed = result.start?.locale ?? result.state?.locale ?? result.locale;
  return { ...result, locale: isLocale(claimed) ? claimed : DEFAULT_LOCALE };
}

async function parseBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: "Request body is too large." };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: "Body must be valid JSON." };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Body must be a JSON object." };
  const locale = body.start?.locale ?? body.state?.locale;
  if (body.start !== undefined) {
    const s = body.start;
    if (!onlyKeys(body, ["start"]) || !s || typeof s !== "object" || !onlyKeys(s, ["ideaId", "mode", "locale"])) return { error: "Only start.ideaId, start.mode and start.locale are accepted.", locale };
    if (typeof s.ideaId !== "string" || !Object.hasOwn(IDEAS, s.ideaId)) return { error: "Unknown ideaId.", locale };
    if (s.mode !== undefined && !MODES.includes(s.mode)) return { error: "Unknown mode.", locale };
    if (s.locale !== undefined && !isLocale(s.locale)) return { error: "Unknown locale." };
    return { start: { ideaId: s.ideaId, mode: s.mode, locale: s.locale ?? DEFAULT_LOCALE } };
  }
  if (!onlyKeys(body, ["state"]) || body.state === undefined) return { error: "Send either start or state.", locale };
  return { state: body.state };
}

// English recordings keep their original names; other locales add a suffix: field-copilot.it.json.
export function recordingPath(ideaId, locale = DEFAULT_LOCALE) {
  return `/demos/innovation-board/recordings/${ideaId}${locale === DEFAULT_LOCALE ? "" : `.${locale}`}.json`;
}
