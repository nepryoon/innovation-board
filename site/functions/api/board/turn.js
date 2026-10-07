// /functions/api/board/turn.js
// GET: demo configuration (allow-listed ideas and their evidence packs, agents, policy, mode), in the
// locale asked for with ?locale=en or ?locale=it (English by default).
// POST: run exactly one board turn. The signed run state travels with each request and is
// re-validated before anything happens; there is no server-side session.

import { TURN_ORDER, MAX_TURNS, verifyState } from "../../../config/board/protocol.js";
import { FORMULAS } from "../../../config/board/scoring.js";
import { resolveModel } from "../../../config/board/llm.js";
import { runTurn, startState, sourceScreen } from "../../../config/board/engine.js";
import { splitSentences } from "../../../config/board/guardrails.js";
import { localeData, isLocale, DEFAULT_LOCALE } from "../../../config/board/locale.js";
import { messages, localiseError } from "../../../config/board/messages.js";
import { jsonResponse, parseTurnRequest, recordingPath } from "../../../config/board/http.js";

export function publicCatalogue(locale = DEFAULT_LOCALE) {
  const { COMPANY, POLICY, TIERS, AGENTS, IDEAS, SOURCE_TYPES, DIMENSIONS } = localeData(locale);
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
        const struck = sourceScreen(idea.id, locale).passages.filter((p) => p.source === source.id);
        return { ...source, typeLabel: SOURCE_TYPES[source.type].label, grade: SOURCE_TYPES[source.type].grade,
          segments: splitSentences(source.text).map((text) => ({ text, struck: struck.find((p) => p.text === text)?.struck || null })) };
      }),
      screen: sourceScreen(idea.id, locale).passages,
      assumptions: idea.assumptions,
      workPackages: idea.workPackages
    }))
  };
}

export function onRequestGet(context) {
  const asked = context.request ? new URL(context.request.url).searchParams.get("locale") : null;
  if (asked !== null && !isLocale(asked)) return jsonResponse({ error: "Unknown locale." }, 400);
  const locale = asked ?? DEFAULT_LOCALE;
  const live = Boolean(context.env.DEEPSEEK_API_KEY);
  return jsonResponse({
    ...publicCatalogue(locale),
    locale,
    turnOrder: TURN_ORDER,
    maxTurns: MAX_TURNS,
    formula: FORMULAS[locale],
    mode: live ? "live" : "recorded",
    model: live ? resolveModel(context.env) : null
  });
}

// Recorded transcripts are static files next to the page, read through the Pages asset binding.
export function recordingLoader(context) {
  return async (ideaId, locale) => {
    const url = new URL(recordingPath(ideaId, locale), context.request.url);
    const res = context.env.ASSETS ? await context.env.ASSETS.fetch(url) : await fetch(url);
    return res.ok ? res.json() : null;
  };
}

export async function onRequestPost(context, deps = {}) {
  const env = context.env || {};
  const input = await parseTurnRequest(context.request);
  if (input.error) return jsonResponse({ error: localiseError(input.error, input.locale) }, 400);

  let state;
  if (input.start) {
    const mode = input.start.mode || (env.DEEPSEEK_API_KEY ? "live" : "recorded");
    state = startState(input.start.ideaId, mode, input.start.locale);
  } else {
    const verified = await verifyState(input.state, env);
    if (!verified.ok) return jsonResponse({ error: localiseError(verified.error, input.locale) }, 400);
    state = input.state;
  }

  try {
    const result = await runTurn({ state, env, deps: { loadRecording: recordingLoader(context), ...deps } });
    if (result.error) return jsonResponse({ error: result.error }, 500);
    const { output, ...body } = result;
    return jsonResponse(body);
  } catch {
    return jsonResponse({ error: messages(state.locale).unexpected() }, 500);
  }
}
