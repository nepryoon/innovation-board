// /functions/api/board/turn.js
// GET: demo configuration (allow-listed ideas and their evidence packs, agents, policy, mode).
// POST: run exactly one board turn. The signed run state travels with each request and is
// re-validated before anything happens; there is no server-side session.

import { COMPANY, POLICY, TIERS, AGENTS, IDEAS, SOURCE_TYPES, DIMENSIONS } from "../../../config/board/data.js";
import { TURN_ORDER, MAX_TURNS, verifyState } from "../../../config/board/protocol.js";
import { FORMULA } from "../../../config/board/scoring.js";
import { resolveModel } from "../../../config/board/llm.js";
import { runTurn, startState, sourceScreen } from "../../../config/board/engine.js";
import { splitSentences } from "../../../config/board/guardrails.js";
import { jsonResponse, parseTurnRequest, recordingPath } from "../../../config/board/http.js";

export function publicCatalogue() {
  return {
    company: COMPANY,
    policy: POLICY,
    tiers: TIERS,
    agents: Object.values(AGENTS),
    dimensions: DIMENSIONS,
    sourceTypes: SOURCE_TYPES,
    ideas: Object.values(IDEAS).map((idea) => ({
      id: idea.id,
      title: idea.title,
      tagline: idea.tagline,
      profile: idea.profile,
      pitch: idea.pitch,
      sources: idea.sources.map((source) => {
        const struck = sourceScreen(idea.id).passages.filter((p) => p.source === source.id);
        return { ...source, typeLabel: SOURCE_TYPES[source.type].label, grade: SOURCE_TYPES[source.type].grade,
          segments: splitSentences(source.text).map((text) => ({ text, struck: struck.find((p) => p.text === text)?.struck || null })) };
      }),
      screen: sourceScreen(idea.id).passages,
      assumptions: idea.assumptions,
      workPackages: idea.workPackages
    }))
  };
}

export function onRequestGet(context) {
  const live = Boolean(context.env.DEEPSEEK_API_KEY);
  return jsonResponse({
    ...publicCatalogue(),
    turnOrder: TURN_ORDER,
    maxTurns: MAX_TURNS,
    formula: FORMULA,
    mode: live ? "live" : "recorded",
    model: live ? resolveModel(context.env) : null
  });
}

// Recorded transcripts are static files next to the page, read through the Pages asset binding.
export function recordingLoader(context) {
  return async (ideaId) => {
    const url = new URL(recordingPath(ideaId), context.request.url);
    const res = context.env.ASSETS ? await context.env.ASSETS.fetch(url) : await fetch(url);
    return res.ok ? res.json() : null;
  };
}

export async function onRequestPost(context, deps = {}) {
  const env = context.env || {};
  const input = await parseTurnRequest(context.request);
  if (input.error) return jsonResponse({ error: input.error }, 400);

  let state;
  if (input.start) {
    const mode = input.start.mode || (env.DEEPSEEK_API_KEY ? "live" : "recorded");
    state = startState(input.start.ideaId, mode);
  } else {
    const verified = await verifyState(input.state, env);
    if (!verified.ok) return jsonResponse({ error: verified.error }, 400);
    state = input.state;
  }

  try {
    const result = await runTurn({ state, env, deps: { loadRecording: recordingLoader(context), ...deps } });
    if (result.error) return jsonResponse({ error: result.error }, 500);
    const { output, ...body } = result;
    return jsonResponse(body);
  } catch {
    return jsonResponse({ error: "The board hit an unexpected error." }, 500);
  }
}
