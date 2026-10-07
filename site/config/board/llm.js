// LLM client and prompts for the Innovation Board: DeepSeek through its OpenAI-compatible chat
// completions API. Prompts are built on the server from allow-listed data and the validated run state;
// no visitor text ever reaches the model.

import { AGENTS, POLICY, dimensionsFor, ASSUMPTION_KEYS } from "./data.js";
import { localeData, ideaFor, money, num, percent } from "./locale.js";

export const DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_MODEL = "deepseek-flash";
const MODEL_PATTERN = /^[A-Za-z0-9._/:-]{1,80}$/;

export const MAX_TOKENS = { opening: 650, review: 450, response: 450, assumptions: 450, case: 220, brief: 450 };

export function resolveModel(env = {}) {
  const override = typeof env.BOARD_LLM_MODEL === "string" ? env.BOARD_LLM_MODEL.trim() : "";
  return MODEL_PATTERN.test(override) ? override : DEFAULT_MODEL;
}

const SHARED_RULES = [
  "Rules checked by code after you answer:",
  "- Every scored claim names one source id and a short exact quote (5 to 25 words) copied verbatim from that source. A quote not found in that source is rejected and does not count.",
  "- Any number with a unit (money, %, market size, customers or users, time) that you write must appear in the evidence pack, the company profile or the figures computed by code. Otherwise the sentence is struck from the record as an unverified figure.",
  "- Scores are integers from 1 (weak) to 5 (strong). Code computes every total, estimate and financial result; you never compute them.",
  "- Plain British English, no markdown. Answer with one JSON object only."
].join("\n");

const INSTRUCTIONS = {
  opening: {
    strategy: "Opening assessment of strategic fit: how well the idea fits the company's priorities, products and capabilities. Make two to four claims with dimension \"fit\".",
    market: "Opening assessment of market pull: trends, customer needs and competition. Report the market size, growth and adoption forecasts the sources give, with their figures, and say how much weight each deserves. Make two to four claims with dimension \"market\".",
    delivery: "Opening assessment of feasibility and delivery risk. Make one or two claims with dimension \"feasibility\" and one or two with dimension \"risk\" (for risk, 5 means low risk). Give optimistic (o), likely (m) and pessimistic (p) effort in whole person-days for every work package listed."
  },
  review: "Audit the claims and the estimate. Challenge optimism, claims a quote does not justify, inconsistencies between agents, reliance on promotional sources, and any unverified figure. Refer to sources by id; do not repeat their figures.",
  response: "Answer the Auditor's challenges to your own claims. Lower or raise a score only where the evidence justifies it, with a short reason. You may add one new claim with an exact quote. If nothing was challenged, confirm your position briefly.",
  responseDelivery: "Answer the Auditor's challenges to your claims and estimate. You may revise claim scores and the o, m, p effort of any work package, with a short reason. If nothing was challenged, confirm briefly.",
  assumptions: "Propose base-case assumptions for the three-year financial model. Each value must lie inside the evidence range given, and cite the source and an exact quote that supports it. Code checks the quote and the range; out-of-range values are clamped and unsupported ones fall back to the cautious end of the range.",
  case: "Explain the financial results computed by code to the board in under 80 words: the base case, the spread between scenarios and the input that moves the result most. Use only the computed figures given.",
  brief: "Close the debate for the human decision-maker in under 100 words: what the evidence supports, where agents still disagree and what would change the board's mind. Suggest a tier. Code applies the investment policy and may override you. The board never decides."
};

const FORMATS = {
  opening: '{"message": "under 90 words", "claims": [{"dimension": "fit", "score": 4, "source": "s1", "quote": "exact words from that source", "reason": "under 25 words"}]}',
  openingDelivery: '{"message": "under 90 words", "claims": [{"dimension": "feasibility", "score": 3, "source": "s9", "quote": "exact words", "reason": "under 25 words"}], "estimates": [{"wp": "w1", "o": 20, "m": 30, "p": 50}]}',
  review: '{"message": "under 90 words", "challenges": [{"target": "c2 or w1", "issue": "unsupported|optimistic|weak|inconsistent|unverified", "note": "under 30 words"}]}',
  response: '{"message": "under 70 words", "revisions": [{"claim": "c2", "score": 3, "reason": "under 25 words"}], "claims": []}',
  responseDelivery: '{"message": "under 70 words", "revisions": [{"claim": "c5", "score": 3, "reason": "under 25 words"}], "estimates": [{"wp": "w2", "o": 25, "m": 40, "p": 70}]}',
  assumptions: '{"message": "under 70 words", "assumptions": [{"key": "price", "value": 1000, "source": "s1", "quote": "exact words", "rationale": "under 20 words"}]}',
  case: '{"message": "under 80 words"}',
  brief: '{"message": "under 100 words", "tier": "invest|pilot|explore|park", "dissent": ["under 30 words"], "mindChangers": ["under 30 words"]}'
};

function instructionFor(turn) {
  if (turn.kind === "opening") return INSTRUCTIONS.opening[turn.agent];
  if (turn.kind === "response" && turn.agent === "delivery") return INSTRUCTIONS.responseDelivery;
  return INSTRUCTIONS[turn.kind];
}

function formatFor(turn) {
  if (turn.agent === "delivery" && turn.kind === "opening") return FORMATS.openingDelivery;
  if (turn.agent === "delivery" && turn.kind === "response") return FORMATS.responseDelivery;
  return FORMATS[turn.kind];
}

// Italian runs keep the English instructions, which the model follows best, and change the language
// rule: every statement is written in Italian and every quote is copied from the Italian sources.
const LANGUAGE_RULE_IT = [
  "- Language: write every text field (message, reason, note, rationale, dissent, mindChangers) in natural, professional Italian, as an Italian manager would write it, concise and impersonal; never a literal translation from English. Keep the English business terms Italians use (ROI, payback, add-on, churn, business case) and write VAN for NPV.",
  "- Quotes are copied verbatim from the Italian evidence pack, in Italian, with the same accents and apostrophes. Never translate, shorten inside or paraphrase a quote.",
  "- Write figures the Italian way: 1.240 (thousands dot), 12,5% (decimal comma), 66.968 € (euro sign after the amount), 26,8 mesi. All money is in euro.",
  "- JSON keys, ids (s1, c2, w1) and enum values (fit, market, invest, pilot, unsupported…) stay in English. No markdown. Answer with one JSON object only."
].join("\n");

export function systemPrompt(turn, locale = "en") {
  const agent = AGENTS[turn.agent];
  const it = locale === "it";
  const rules = it ? SHARED_RULES.split("\n").slice(0, -1).join("\n") + "\n" + LANGUAGE_RULE_IT : SHARED_RULES;
  const who = it ? `${agent.role} (Italian title: ${localeData("it").AGENTS[turn.agent].role})` : agent.role;
  return [
    `You are ${agent.name}, the ${who} on a board of AI agents assessing the commercial potential of a software product idea for ${localeData(locale).COMPANY.name}.`,
    "The board prepares decision support for a human. It never decides. All data is synthetic.",
    rules,
    `Your task (round ${turn.round}): ${instructionFor(turn)}`,
    `JSON format: ${formatFor(turn)}`
  ].join("\n");
}

// The words of the user prompt. English is the original prompt, unchanged.
const WORDS = {
  en: {
    company: (c) => `Company: ${c.name}. ${c.sector}. ${c.size}.`,
    priorities: "Priorities", products: "Products", capacity: "Capacity",
    rates: (rates, c) => `Day rates: ${rates}. Discount rate ${c.discountRate * 100}%. Horizon ${c.horizonYears} years.`,
    idea: "Idea", pack: "Evidence pack (synthetic; cite these ids only):", dimensions: "Your dimensions",
    packages: (list) => `Work packages: ${list}. Rules: whole person-days, o ≤ m ≤ p, p at most six times o.`,
    yourClaims: "Your claims:", claimsSoFar: "Claims so far:", revisedFrom: (n) => ` (revised from ${n})`,
    estimate: "Current estimate (person-days): ",
    challenges: "Challenges to you: ", noChallenges: "No challenges to you.",
    ranges: (list) => `Evidence ranges for the base case: ${list}. Give churn as a percentage number, money in pounds.`,
    rangeItem: (k, label, lo, hi, sources) => `${k} (${label}) ${lo} to ${hi}, see ${sources}`,
    discussion: "Board discussion so far:",
    computedEstimate: (e, m) => `Computed development estimate: ${e.effort.low} to ${e.effort.high} person-days (expected ${e.effort.expected}), ${e.weeks.low} to ${e.weeks.high} weeks for a squad of ${e.teamSize}, cost ${m(e.cost.low)} to ${m(e.cost.high)} (expected ${m(e.cost.expected)}).`,
    scenario: (name, s, m) => `${name}: NPV ${m(s.npv)}, ROI ${s.roiPercent}%, payback ${s.paybackMonths === null ? "not within 3 years" : `${s.paybackMonths} months`}.`,
    scenarioName: (name) => name,
    top: (label, be) => `Input that moves NPV most: ${label}${be === null ? "" : `; base-case NPV is zero at ${be}`}.`,
    perYear: (n) => `${n} a year`,
    metrics: (json) => `Computed metrics (0 to 100): ${json}.`,
    experiment: (x, m) => `Cheapest next experiment chosen by code: ${x.label}, ${m(x.cost)}, ${x.weeks} weeks.`,
    tier: (t) => `Investment policy result computed by code: ${t.label} (${t.rule}).`,
    tiers: (list, p) => `Tiers: ${list}. Policy: invest needs fit ≥ ${p.investNow.strategicFit}, evidence ≥ ${p.investNow.evidenceStrength}, NPV > 0 and payback ≤ ${p.investNow.paybackMonths} months.`,
    now: "Reply with the JSON object now."
  },
  it: {
    company: (c) => `Azienda: ${c.name}. ${c.sector}. ${c.size}.`,
    priorities: "Priorità", products: "Prodotti", capacity: "Capacità",
    rates: (rates, c) => `Tariffe giornaliere: ${rates}. Tasso di sconto ${c.discountRate * 100}%. Orizzonte ${c.horizonYears} anni.`,
    idea: "Idea", pack: "Pacchetto di evidenze (dati sintetici; citare solo questi id):", dimensions: "Le tue dimensioni",
    packages: (list) => `Pacchetti di lavoro: ${list}. Regole: giorni-persona interi, o ≤ m ≤ p, p al massimo sei volte o.`,
    yourClaims: "Le tue affermazioni:", claimsSoFar: "Affermazioni finora:", revisedFrom: (n) => ` (rivisto da ${n})`,
    estimate: "Stima attuale (giorni-persona): ",
    challenges: "Contestazioni rivolte a te: ", noChallenges: "Nessuna contestazione rivolta a te.",
    ranges: (list) => `Intervalli delle evidenze per lo scenario base: ${list}. Nel JSON "value" è un numero semplice (per esempio 1950 o 7): churn in punti percentuali, importi in euro.`,
    rangeItem: (k, label, lo, hi, sources) => `${k} (${label}) da ${lo} a ${hi}, vedi ${sources}`,
    discussion: "Discussione del board finora:",
    computedEstimate: (e, m) => `Stima di sviluppo calcolata dal codice: da ${num(e.effort.low, "it")} a ${num(e.effort.high, "it")} giorni-persona (attesi ${num(e.effort.expected, "it")}), da ${num(e.weeks.low, "it")} a ${num(e.weeks.high, "it")} settimane per un team di ${e.teamSize} persone, costo da ${m(e.cost.low)} a ${m(e.cost.high)} (atteso ${m(e.cost.expected)}).`,
    scenario: (name, s, m) => `${name}: VAN ${m(s.npv)}, ROI ${s.roiPercent}%, payback ${s.paybackMonths === null ? "non raggiunto entro 3 anni" : `${num(s.paybackMonths, "it")} mesi`}.`,
    scenarioName: (name) => ({ pessimistic: "Scenario pessimistico", base: "Scenario base", optimistic: "Scenario ottimistico" })[name],
    top: (label, be) => `Variabile che incide di più sul VAN: ${label}${be === null ? "" : `; il VAN dello scenario base si azzera a ${be}`}.`,
    perYear: (n) => `${num(n, "it")} all'anno`,
    metrics: (json) => `Metriche calcolate dal codice (da 0 a 100): ${json}.`,
    experiment: (x, m) => `Esperimento successivo più economico scelto dal codice: ${x.label}, ${m(x.cost)}, ${x.weeks} settimane.`,
    tier: (t) => `Esito della politica di investimento calcolato dal codice: ${t.label} (${t.rule}).`,
    tiers: (list, p) => `Fasce: ${list}. Politica: invest richiede coerenza strategica ≥ ${p.investNow.strategicFit}, solidità delle evidenze ≥ ${p.investNow.evidenceStrength}, VAN > 0 e payback ≤ ${p.investNow.paybackMonths} mesi.`,
    now: "Rispondi ora con l'oggetto JSON."
  }
};
const wordsFor = (locale) => WORDS[locale] || WORDS.en;

function companyLines(locale) {
  const c = localeData(locale).COMPANY;
  const w = wordsFor(locale);
  const m = (n) => money(n, locale);
  return [
    w.company(c),
    `${w.priorities}: ${c.priorities.join("; ")}.`,
    `${w.products}: ${c.products.join("; ")}.`,
    `${w.capacity}: ${c.capacity}`,
    w.rates(Object.values(c.rateCard).map((r) => `${r.label} ${m(r.rate)}`).join(", "), c)
  ];
}

function claimLine(c, locale) {
  const revised = c.from !== undefined ? wordsFor(locale).revisedFrom(c.from) : "";
  return `${c.id} ${AGENTS[c.agent].name} ${c.dimension}: ${c.score}/5${revised} [${c.status}] ${c.source} "${c.quote.slice(0, 110)}"`;
}

function estimateLines(state) {
  if (!state.estimates) return [];
  const idea = ideaFor(state.ideaId, state.locale);
  return [wordsFor(state.locale).estimate + idea.workPackages.map((w) => `${w.id} ${w.label} o${state.estimates[w.id].o}/m${state.estimates[w.id].m}/p${state.estimates[w.id].p}`).join("; ") + "."];
}

export function computedLines(extra, locale = "en") {
  const w = wordsFor(locale);
  const m = (n) => money(n, locale);
  const lines = [];
  if (extra.estimate) lines.push(w.computedEstimate(extra.estimate, m));
  if (extra.finance) {
    const f = extra.finance;
    for (const [name, s] of Object.entries(f.scenarios)) lines.push(w.scenario(w.scenarioName(name), s, m));
    const t = f.top;
    const be = t.breakEven === null ? null : t.key === "churn" ? percent(t.breakEven, locale) : t.key === "adoption" ? w.perYear(t.breakEven) : m(t.breakEven);
    lines.push(w.top(t.label, be));
  }
  if (extra.metrics) lines.push(w.metrics(JSON.stringify(extra.metrics)));
  if (extra.experiment) lines.push(w.experiment(extra.experiment, m));
  if (extra.tier) lines.push(w.tier(extra.tier));
  return lines;
}

export function userPrompt(turn, state, extra = {}) {
  const locale = state.locale;
  const w = wordsFor(locale);
  const { DIMENSIONS, TIERS } = localeData(locale);
  const idea = ideaFor(state.ideaId, locale);
  const lines = [...companyLines(locale), `${w.idea}: ${idea.title}. ${idea.pitch}`];
  const withSources = ["opening", "review", "response", "assumptions"].includes(turn.kind);
  if (withSources) {
    lines.push(w.pack);
    for (const s of idea.sources) lines.push(`${s.id} [${s.type}, ${s.date}] ${s.title}: ${s.text}`);
  }
  if (turn.kind === "opening" || turn.kind === "response") lines.push(`${w.dimensions}: ${dimensionsFor(turn.agent).map((d) => `"${d}" (${DIMENSIONS[d].label})`).join(", ")}.`);
  if (turn.agent === "delivery" && turn.kind === "opening") {
    lines.push(w.packages(idea.workPackages.map((wp) => `${wp.id} ${wp.label} (${wp.role})`).join("; ")));
  }
  const mine = turn.kind === "response" ? state.claims.filter((c) => c.agent === turn.agent) : state.claims;
  if (turn.kind !== "opening" && mine.length) {
    lines.push(turn.kind === "response" ? w.yourClaims : w.claimsSoFar);
    mine.forEach((c) => lines.push(claimLine(c, locale)));
  }
  if (turn.kind === "review" || (turn.kind === "response" && turn.agent === "delivery")) lines.push(...estimateLines(state));
  if (turn.kind === "response") {
    const ids = new Set(mine.map((c) => c.id));
    if (turn.agent === "delivery") idea.workPackages.forEach((wp) => ids.add(wp.id));
    const challenged = state.challenges.filter((ch) => ids.has(ch.target));
    lines.push(challenged.length
      ? w.challenges + challenged.map((ch) => `${ch.target} ${ch.issue}: ${ch.note}`).join(" | ")
      : w.noChallenges);
  }
  if (turn.kind === "assumptions") {
    lines.push(w.ranges(ASSUMPTION_KEYS.map((k) => {
      const a = idea.assumptions[k];
      const fmt = (v) => (a.unit === "gbp" ? money(v, locale) : a.unit === "percent" ? percent(v, locale) : String(v));
      return w.rangeItem(k, a.label, fmt(a.low), fmt(a.high), a.sources.join(", "));
    }).join("; ")));
  }
  if (["review", "case", "brief"].includes(turn.kind)) {
    const said = state.said.slice(turn.kind === "brief" ? -5 : -4).map((s) => `${AGENTS[s.agent].name}: ${s.text.slice(0, 200)}`);
    if (said.length) lines.push(w.discussion, ...said);
  }
  lines.push(...computedLines(extra, locale));
  if (turn.kind === "brief") lines.push(w.tiers(Object.entries(TIERS).map(([id, label]) => `${id} = ${label}`).join(", "), POLICY));
  lines.push(w.now);
  return lines.join("\n");
}

// One short retry on rate limiting or provider errors; then the caller falls back to the recording.
export async function callLlm({ sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ...options }) {
  const first = await callLlmOnce(options);
  if (first.ok || !first.retryable) return first;
  await sleep(800);
  return callLlmOnce(options);
}

// Thinking is disabled (faster, and nothing to round-trip); reasoning_content is never read or forwarded.
async function callLlmOnce({ apiKey, model, messages, maxTokens, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, timeoutMs = 25000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.6,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });
    if (!res.ok) return { ok: false, retryable: res.status === 429 || res.status >= 500, error: `provider returned HTTP ${res.status}` };
    const data = parseJson(await res.text());
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { ok: false, error: "provider returned no message" };
    return { ok: true, content, usage: readUsage(data.usage) };
  } catch (err) {
    return { ok: false, retryable: false, error: err?.name === "AbortError" ? "provider timed out" : "provider unreachable" };
  } finally {
    clearTimeout(timer);
  }
}

// Bodies may be preceded by keep-alive blank lines; a body that is still not JSON yields null.
export function parseJson(text) {
  const trimmed = typeof text === "string" ? text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "") : "";
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function readUsage(usage) {
  const count = (value) => (Number.isFinite(value) && value >= 0 ? value : 0);
  return { promptTokens: count(usage?.prompt_tokens), completionTokens: count(usage?.completion_tokens) };
}
