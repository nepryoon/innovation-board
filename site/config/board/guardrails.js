// Guardrails enforced in code: the citation check, the source screen and the unverified-figure filter.
// The prompts ask the agents to behave; these functions make sure they did.

import { SOURCE_TYPES } from "./data.js";
import { messages } from "./messages.js";

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
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“‘(£€$À-Ý])/)
    .filter(Boolean);
}

// --- Figures ------------------------------------------------------------------------------
// A figure is a number with a unit: currency, percentage, market size, users or customers, or time.
// Each is reduced to { kind, value } so that "£1.2m" and "£1,200,000" compare as equal. Each locale
// has its own number format and unit words; the rounding rules are the same for all of them.

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

// Italian: thousands dot and decimal comma (1.240; 12,5), "mila", "mln", "milioni", "mld", "miliardi",
// the euro sign before or after the number, "per cento", and time in giorni, giornate, settimane,
// mesi, anni. JavaScript's \\b does not see accented letters, so the end of a word is a lookahead.
const END = "(?![A-Za-zÀ-ÿ])";
const SCALE_IT = { k: 1e3, mila: 1e3, mln: 1e6, milione: 1e6, milioni: 1e6, mld: 1e9, miliardo: 1e9, miliardi: 1e9 };
const SCALE_WORDS_IT = "k|mila|mln|milioni|milione|mld|miliardi|miliardo";
const COUNT_UNITS_IT = "utenti|aziende clienti|aziende|imprese|clienti|potenziali clienti|conti|account|abbonati|tecnici|postazioni|siti|sedi|ticket|trattative|installazioni";
const TIME_WORDS_IT = "giorni lavorativi|giornate lavorative|giorni[- ]persona|giornate[- ]persona|giorno lavorativo|giornata lavorativa|giorni|giorno|giornate|giornata|minuti|minuto|ore|ora|settimane|settimana|mesi|mese|trimestri|trimestre|anni|anno";
const NUM_IT = "\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?";

function timeDaysIt(word) {
  const w = word.toLowerCase();
  if (w.startsWith("minut")) return 1 / 480;
  if (w === "ore" || w === "ora") return 1 / 8;
  if (w.startsWith("settiman")) return 7;
  if (w.startsWith("mes")) return 30.4;
  if (w.startsWith("trimestr")) return 91.3;
  if (w.startsWith("ann")) return 365;
  return 1;
}

const PATTERNS_IT = [
  { kind: "money", re: new RegExp(`[£€$]\\s?(${NUM_IT})\\s?(${SCALE_WORDS_IT})?${END}`, "gi") },
  { kind: "money", re: new RegExp(`(${NUM_IT})\\s?(${SCALE_WORDS_IT})?\\s?(?:di\\s)?(?:€|euro${END}|sterline${END}|dollari${END})`, "gi") },
  { kind: "percent", re: new RegExp(`(${NUM_IT})\\s?(?:%|per\\s?cento${END}|punti percentuali${END}|punti${END}|punto percentuale${END})`, "gi") },
  { kind: "count", re: new RegExp(`(${NUM_IT})\\s?(mila|milioni|milione)?\\s(?:di\\s)?(?:(?:nuovi|nuove|altri|altre|attivi|attive|paganti)\\s)?(${COUNT_UNITS_IT})${END}`, "gi") },
  { kind: "time", re: new RegExp(`(${NUM_IT})[\\s-]?(${TIME_WORDS_IT})${END}`, "gi") },
  { kind: "money", re: new RegExp(`(${NUM_IT})\\s?(miliardi|miliardo|milioni|milione|mld|mln)${END}`, "gi") }
];

const FORMATS = {
  en: { patterns: PATTERNS, number: (raw) => Number(String(raw).replace(/,/g, "")), decimals: (raw) => (raw.split(".")[1] || "").length,
    scale: (unit) => SCALE[unit] || 1, days: (unit) => TIME_DAYS[unit.replace(/s$/, "")] ?? 1, bare: /\d{1,3}(?:,\d{3})+|\d+/g },
  it: { patterns: PATTERNS_IT, number: (raw) => Number(String(raw).replace(/\./g, "").replace(",", ".")), decimals: (raw) => (raw.split(",")[1] || "").length,
    scale: (unit) => SCALE_IT[unit] || 1, days: timeDaysIt, bare: /\d{1,3}(?:\.\d{3})+|\d+/g }
};
const formatFor = (locale) => FORMATS[locale] || FORMATS.en;

// Bare numbers in a text, in the locale's format ("Of 9,800 tickets, 1,240 asked…").
export function bareNumbers(text, locale = "en") {
  const f = formatFor(locale);
  return [...String(text ?? "").matchAll(f.bare)].map((m) => f.number(m[0]));
}

export function extractFigures(text, locale = "en") {
  const value = String(text ?? "");
  const format = formatFor(locale);
  const found = [];
  const taken = [];
  for (const { kind, re } of format.patterns) {
    for (const m of value.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      let n = format.number(m[1]);
      if (!Number.isFinite(n)) continue;
      // Half of the last written digit, in the figure's unit: "£0.4m" may stand for £350,000 to £450,000.
      let step = 0.5 * 10 ** -format.decimals(m[1]);
      let scale = 1;
      if (kind === "money" || kind === "count") scale = format.scale((m[2] || "").toLowerCase());
      if (kind === "time") scale = format.days(m[2].toLowerCase());
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

export function figuresIn(texts, locale = "en") {
  return texts.flatMap((t) => extractFigures(t, locale));
}

// Strikes any sentence holding a figure that is neither in a source that passed the screen nor
// computed by code in this run (allowed is a list of { kind, value }).
export function checkFigures(sentences, allowed, locale = "en") {
  return sentences.map((s) => {
    if (s.struck) return s;
    const wrong = extractFigures(s.text, locale).find((f) => !figureMatches(f, allowed));
    return wrong ? { ...s, struck: messages(locale).unverified(wrong.text), figure: wrong.text } : s;
  });
}

export function screenStatement(text, allowed, locale = "en") {
  return checkFigures(splitSentences(text).map((t) => ({ text: t, struck: null })), allowed, locale);
}

// --- Source screen ------------------------------------------------------------------------
// Before the debate, code screens the evidence pack. A sentence in a promotional source (trend article,
// vendor blog, keynote) that states a figure gives no method or primary data, so it is struck as an
// unverified figure: quoting it does not support a claim and its figures do not count as evidence.

export function screenSources(sources, locale = "en") {
  const passages = [];
  const clean = {};
  for (const source of sources) {
    const promotional = SOURCE_TYPES[source.type]?.grade === "promotional";
    const kept = [];
    for (const sentence of splitSentences(source.text)) {
      const figures = extractFigures(sentence, locale);
      if (promotional && figures.length) {
        passages.push({ source: source.id, title: source.title, text: sentence, struck: messages(locale).unverifiedPromo(figures[0].text) });
      } else kept.push(sentence);
    }
    clean[source.id] = kept.join(" ");
  }
  return { passages, clean };
}

// --- Citation check -----------------------------------------------------------------------

// The quote must appear in the named source (case and whitespace normalised) and must not come from a
// passage the source screen struck.
// The sources must be those of the run's locale: an Italian quote is checked against the Italian pack.
export function checkCitation(quote, sources, sourceId, screen, locale = "en") {
  const msg = messages(locale);
  const needle = trimQuote(quote);
  if (needle.length < MIN_QUOTE_CHARS) return { ok: false, reason: msg.quoteShort() };
  if (needle.length > MAX_QUOTE_CHARS) return { ok: false, reason: msg.quoteLong() };
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return { ok: false, reason: msg.unknownSource(String(sourceId).slice(0, 12)) };
  if (!normalise(source.text).includes(needle)) {
    const elsewhere = sources.find((s) => normalise(s.text).includes(needle));
    return { ok: false, reason: elsewhere ? msg.quoteElsewhere(elsewhere.id, source.id) : msg.quoteMissing(source.id) };
  }
  if (screen && !normalise(screen.clean[source.id]).includes(needle)) {
    return { ok: false, reason: msg.quoteScreened(source.id) };
  }
  return { ok: true, source: source.id };
}
