// LLM client and prompts for the Innovation Board: DeepSeek through its OpenAI-compatible chat
// completions API. Prompts are built on the server from allow-listed data and the validated run state;
// no visitor text ever reaches the model.

import { COMPANY, AGENTS, IDEAS, DIMENSIONS, POLICY, TIERS, dimensionsFor, ASSUMPTION_KEYS } from "./data.js";

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

export function systemPrompt(turn) {
  const agent = AGENTS[turn.agent];
  return [
    `You are ${agent.name}, the ${agent.role} on a board of AI agents assessing the commercial potential of a software product idea for ${COMPANY.name}.`,
    "The board prepares decision support for a human. It never decides. All data is synthetic.",
    SHARED_RULES,
    `Your task (round ${turn.round}): ${instructionFor(turn)}`,
    `JSON format: ${formatFor(turn)}`
  ].join("\n");
}

const money = (n) => `£${Math.round(n).toLocaleString("en-GB")}`;

function companyLines() {
  const c = COMPANY;
  return [
    `Company: ${c.name}. ${c.sector}. ${c.size}.`,
    `Priorities: ${c.priorities.join("; ")}.`,
    `Products: ${c.products.join("; ")}.`,
    `Capacity: ${c.capacity}`,
    `Day rates: ${Object.values(c.rateCard).map((r) => `${r.label} ${money(r.rate)}`).join(", ")}. Discount rate ${c.discountRate * 100}%. Horizon ${c.horizonYears} years.`
  ];
}

function claimLine(c) {
  const revised = c.from !== undefined ? ` (revised from ${c.from})` : "";
  return `${c.id} ${AGENTS[c.agent].name} ${c.dimension}: ${c.score}/5${revised} [${c.status}] ${c.source} "${c.quote.slice(0, 110)}"`;
}

function estimateLines(state) {
  if (!state.estimates) return [];
  return ["Current estimate (person-days): " + IDEAS[state.ideaId].workPackages.map((w) => `${w.id} ${w.label} o${state.estimates[w.id].o}/m${state.estimates[w.id].m}/p${state.estimates[w.id].p}`).join("; ") + "."];
}

export function computedLines(extra) {
  const lines = [];
  if (extra.estimate) {
    const e = extra.estimate;
    lines.push(`Computed development estimate: ${e.effort.low} to ${e.effort.high} person-days (expected ${e.effort.expected}), ${e.weeks.low} to ${e.weeks.high} weeks for a squad of ${e.teamSize}, cost ${money(e.cost.low)} to ${money(e.cost.high)} (expected ${money(e.cost.expected)}).`);
  }
  if (extra.finance) {
    const f = extra.finance;
    for (const [name, s] of Object.entries(f.scenarios)) {
      lines.push(`${name}: NPV ${money(s.npv)}, ROI ${s.roiPercent}%, payback ${s.paybackMonths === null ? "not within 3 years" : `${s.paybackMonths} months`}.`);
    }
    const t = f.top;
    lines.push(`Input that moves NPV most: ${t.label}${t.breakEven === null ? "" : `; base-case NPV is zero at ${t.key === "churn" ? `${t.breakEven}%` : t.key === "adoption" ? `${t.breakEven} a year` : money(t.breakEven)}`}.`);
  }
  if (extra.metrics) lines.push(`Computed metrics (0 to 100): ${JSON.stringify(extra.metrics)}.`);
  if (extra.experiment) lines.push(`Cheapest next experiment chosen by code: ${extra.experiment.label}, ${money(extra.experiment.cost)}, ${extra.experiment.weeks} weeks.`);
  if (extra.tier) lines.push(`Investment policy result computed by code: ${extra.tier.label} (${extra.tier.rule}).`);
  return lines;
}

export function userPrompt(turn, state, extra = {}) {
  const idea = IDEAS[state.ideaId];
  const lines = [...companyLines(), `Idea: ${idea.title}. ${idea.pitch}`];
  const withSources = ["opening", "review", "response", "assumptions"].includes(turn.kind);
  if (withSources) {
    lines.push("Evidence pack (synthetic; cite these ids only):");
    for (const s of idea.sources) lines.push(`${s.id} [${s.type}, ${s.date}] ${s.title}: ${s.text}`);
  }
  if (turn.kind === "opening" || turn.kind === "response") lines.push(`Your dimensions: ${dimensionsFor(turn.agent).map((d) => `"${d}" (${DIMENSIONS[d].label})`).join(", ")}.`);
  if (turn.agent === "delivery" && turn.kind === "opening") {
    lines.push("Work packages: " + idea.workPackages.map((w) => `${w.id} ${w.label} (${w.role})`).join("; ") + ". Rules: whole person-days, o ≤ m ≤ p, p at most six times o.");
  }
  const mine = turn.kind === "response" ? state.claims.filter((c) => c.agent === turn.agent) : state.claims;
  if (turn.kind !== "opening" && mine.length) {
    lines.push(turn.kind === "response" ? "Your claims:" : "Claims so far:");
    mine.forEach((c) => lines.push(claimLine(c)));
  }
  if (turn.kind === "review" || (turn.kind === "response" && turn.agent === "delivery")) lines.push(...estimateLines(state));
  if (turn.kind === "response") {
    const ids = new Set(mine.map((c) => c.id));
    if (turn.agent === "delivery") idea.workPackages.forEach((w) => ids.add(w.id));
    const challenged = state.challenges.filter((ch) => ids.has(ch.target));
    lines.push(challenged.length
      ? "Challenges to you: " + challenged.map((ch) => `${ch.target} ${ch.issue}: ${ch.note}`).join(" | ")
      : "No challenges to you.");
  }
  if (turn.kind === "assumptions") {
    lines.push("Evidence ranges for the base case: " + ASSUMPTION_KEYS.map((k) => {
      const a = idea.assumptions[k];
      const fmt = (v) => (a.unit === "gbp" ? money(v) : a.unit === "percent" ? `${v}%` : String(v));
      return `${k} (${a.label}) ${fmt(a.low)} to ${fmt(a.high)}, see ${a.sources.join(", ")}`;
    }).join("; ") + ". Give churn as a percentage number, money in pounds.");
  }
  if (["review", "case", "brief"].includes(turn.kind)) {
    const said = state.said.slice(turn.kind === "brief" ? -5 : -4).map((s) => `${AGENTS[s.agent].name}: ${s.text.slice(0, 200)}`);
    if (said.length) lines.push("Board discussion so far:", ...said);
  }
  lines.push(...computedLines(extra));
  if (turn.kind === "brief") lines.push(`Tiers: ${Object.entries(TIERS).map(([id, label]) => `${id} = ${label}`).join(", ")}. Policy: invest needs fit ≥ ${POLICY.investNow.strategicFit}, evidence ≥ ${POLICY.investNow.evidenceStrength}, NPV > 0 and payback ≤ ${POLICY.investNow.paybackMonths} months.`);
  lines.push("Reply with the JSON object now.");
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
