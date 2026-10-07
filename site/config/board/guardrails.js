// Guardrails enforced in code: the citation check, the source screen and the unverified-figure filter.
// The prompts ask the agents to behave; these functions make sure they did.

import { SOURCE_TYPES } from "./data.js";

const MIN_QUOTE_CHARS = 12;
const MAX_QUOTE_CHARS = 260;

// Case, whitespace, typographic quotes and dashes are normalised before matching.
export function normalise(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

// Quotation marks, ellipses and a final full stop around a quote are not part of the evidence.
function trimQuote(text) {
  return normalise(text).replace(/^["'.\s]+/, "").replace(/["'\s]+$/, "").replace(/\.+$/, "").trim();
}

export function splitSentences(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘(£€$])/)
    .filter(Boolean);
}

// --- Figures ------------------------------------------------------------------------------
// A figure is a number with a unit: currency, percentage, market size, users or customers, or time.
// Each is reduced to { kind, value } so that "£1.2m" and "£1,200,000" compare as equal.

const SCALE = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };
const COUNT_UNITS = "users|customers|customer firms|firms|companies|clients|accounts|subscribers|businesses|contractors|technicians|seats|sites|tickets|prospects|deals|installations";
const TIME_DAYS = { minute: 1 / 480, hour: 1 / 8, day: 1, "working day": 1, "person-day": 1, week: 7, month: 30.4, quarter: 91.3, year: 365 };
const NUM = "\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?";

const PATTERNS = [
  { kind: "money", re: new RegExp(`[£€$]\\s?(${NUM})\\s?(k|m|bn|thousand|million|billion)?\\b`, "gi") },
  { kind: "percent", re: new RegExp(`(${NUM})\\s?(?:%|per ?cent\\b|percentage points?\\b|points\\b)`, "gi") },
  { kind: "count", re: new RegExp(`(${NUM})\\s?(k|m|thousand|million)?\\s(?:new\\s|more\\s|active\\s|paying\\s)?(${COUNT_UNITS})\\b`, "gi") },
  { kind: "time", re: new RegExp(`(${NUM})[\\s-]?(working days?|person-days?|minutes?|hours?|days?|weeks?|months?|quarters?|years?)\\b`, "gi") },
  { kind: "money", re: new RegExp(`(${NUM})\\s?(bn|billion|million)\\b`, "gi") }
];

const toNumber = (raw) => Number(String(raw).replace(/,/g, ""));

export function extractFigures(text) {
  const value = String(text ?? "");
  const found = [];
  const taken = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of value.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      let n = toNumber(m[1]);
      if (!Number.isFinite(n)) continue;
      // Half of the last written digit, in the figure's unit: "£0.4m" may stand for £350,000 to £450,000.
      let step = 0.5 * 10 ** -((m[1].split(".")[1] || "").length);
      let scale = 1;
      if (kind === "money" || kind === "count") scale = SCALE[(m[2] || "").toLowerCase()] || 1;
      if (kind === "time") scale = TIME_DAYS[m[2].toLowerCase().replace(/s$/, "")] ?? 1;
      if ((kind === "money" || kind === "count") && scale === 1) step = 0;
      n *= scale;
      taken.push([start, end]);
      found.push({ kind, value: n, tolerance: step * scale, text: m[0].trim(), at: start });
    }
  }
  return found.sort((a, b) => a.at - b.at).map(({ at, ...f }) => f);
}

// Rounding is allowed to the precision the figure is written in ("£438k" or "£0.4m" match a computed
// £437,912; "15 months" matches 15.2), and otherwise to within 1%. Signs are ignored.
export function figureMatches(figure, allowed) {
  return allowed.some((a) => {
    if (a.kind !== figure.kind) return false;
    const x = Math.abs(figure.value);
    const y = Math.abs(a.value);
    return Math.abs(x - y) <= Math.max(figure.tolerance ?? 0, 0.01 * y, 1e-9);
  });
}

export function figuresIn(texts) {
  return texts.flatMap((t) => extractFigures(t));
}

// Strikes any sentence holding a figure that is neither in a source that passed the screen nor
// computed by code in this run (allowed is a list of { kind, value }).
export function checkFigures(sentences, allowed) {
  return sentences.map((s) => {
    if (s.struck) return s;
    const wrong = extractFigures(s.text).find((f) => !figureMatches(f, allowed));
    return wrong ? { ...s, struck: `Unverified figure: “${wrong.text}” is not in a cited source or computed by code`, figure: wrong.text } : s;
  });
}

export function screenStatement(text, allowed) {
  return checkFigures(splitSentences(text).map((t) => ({ text: t, struck: null })), allowed);
}

// --- Source screen ------------------------------------------------------------------------
// Before the debate, code screens the evidence pack. A sentence in a promotional source (trend article,
// vendor blog, keynote) that states a figure gives no method or primary data, so it is struck as an
// unverified figure: quoting it does not support a claim and its figures do not count as evidence.

export function screenSources(sources) {
  const passages = [];
  const clean = {};
  for (const source of sources) {
    const promotional = SOURCE_TYPES[source.type]?.grade === "promotional";
    const kept = [];
    for (const sentence of splitSentences(source.text)) {
      const figures = extractFigures(sentence);
      if (promotional && figures.length) {
        passages.push({ source: source.id, title: source.title, text: sentence, struck: `Unverified figure: “${figures[0].text}” comes from a promotional source with no method or primary data` });
      } else kept.push(sentence);
    }
    clean[source.id] = kept.join(" ");
  }
  return { passages, clean };
}

// --- Citation check -----------------------------------------------------------------------

// The quote must appear in the named source (case and whitespace normalised) and must not come from a
// passage the source screen struck.
export function checkCitation(quote, sources, sourceId, screen) {
  const needle = trimQuote(quote);
  if (needle.length < MIN_QUOTE_CHARS) return { ok: false, reason: "Quote too short to verify." };
  if (needle.length > MAX_QUOTE_CHARS) return { ok: false, reason: "Quote too long: cite one passage." };
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return { ok: false, reason: `Unknown source ${String(sourceId).slice(0, 12)}.` };
  if (!normalise(source.text).includes(needle)) {
    const elsewhere = sources.find((s) => normalise(s.text).includes(needle));
    return { ok: false, reason: elsewhere ? `Quote is from ${elsewhere.id}, not the cited ${source.id}.` : `Quote not found in ${source.id}.` };
  }
  if (screen && !normalise(screen.clean[source.id]).includes(needle)) {
    return { ok: false, reason: `Quote comes from a passage of ${source.id} struck by the source screen.` };
  }
  return { ok: true, source: source.id };
}
