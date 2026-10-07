// Debate protocol: fixed turn order, hard turn cap and the compact run state that travels with every
// request. There is no server-side session: the server signs the state and re-validates it each turn.

import { IDEAS, AGENTS, ASSUMPTION_KEYS, dimensionsFor, sourceIds } from "./data.js";
import { rangeError } from "./scoring.js";

export const TURN_ORDER = Object.freeze([
  { agent: "strategy", round: 1, kind: "opening" },
  { agent: "market", round: 1, kind: "opening" },
  { agent: "delivery", round: 1, kind: "opening" },
  { agent: "auditor", round: 2, kind: "review" },
  { agent: "strategy", round: 2, kind: "response" },
  { agent: "market", round: 2, kind: "response" },
  { agent: "delivery", round: 2, kind: "response" },
  { agent: "finance", round: 3, kind: "assumptions" },
  { agent: "finance", round: 3, kind: "case" },
  { agent: "chair", round: 3, kind: "brief" }
].map((t) => Object.freeze(t)));

export const MAX_TURNS = TURN_ORDER.length;
export const MAX_CLAIMS = 30;
export const MODES = ["live", "recorded"];
export const ISSUES = ["unsupported", "optimistic", "weak", "inconsistent", "unverified"];
export const TIER_IDS = ["invest", "pilot", "explore", "park"];
const STATUSES = ["accepted", "unsupported", "struck"];
const ASSUMPTION_STATUSES = ["accepted", "clamped", "unsupported"];

export function turnAt(index) {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_TURNS) return null;
  return TURN_ORDER[index];
}

export function initialState(ideaId, mode) {
  return {
    v: 1,
    ideaId,
    mode,
    turn: 0,
    claims: [],
    said: [],
    challenges: [],
    estimates: null,
    revisedPackages: [],
    assumptions: null,
    chairSuggestion: null,
    chairNotes: [],
    mindNotes: [],
    figureStrikes: 0,
    usage: { promptTokens: 0, completionTokens: 0, llmTurns: 0 }
  };
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v, max) => typeof v === "string" && v.length <= max;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const onlyKeys = (obj, keys) => Object.keys(obj).every((k) => keys.includes(k));
const strList = (v, maxItems, maxLen) => Array.isArray(v) && v.length <= maxItems && v.every((n) => isStr(n, maxLen));

// Structural validation: allow-listed IDs, types, sizes and consistency with the turn order.
export function validateState(state) {
  const fail = (error) => ({ ok: false, error });
  if (!isObj(state)) return fail("State must be an object.");
  const keys = ["v", "ideaId", "mode", "turn", "claims", "said", "challenges", "estimates", "revisedPackages", "assumptions", "chairSuggestion", "chairNotes", "mindNotes", "figureStrikes", "usage", "sig"];
  if (!onlyKeys(state, keys)) return fail("State has unexpected fields.");
  if (state.v !== 1) return fail("Unsupported state version.");
  if (typeof state.ideaId !== "string" || !Object.hasOwn(IDEAS, state.ideaId)) return fail("Unknown idea.");
  if (!MODES.includes(state.mode)) return fail("Unknown mode.");
  if (!isInt(state.turn, 0, MAX_TURNS)) return fail("Turn out of range.");
  if (state.turn >= MAX_TURNS) return fail("The board has already used all its turns.");
  const idea = IDEAS[state.ideaId];
  const sources = sourceIds(state.ideaId);
  const packages = idea.workPackages.map((w) => w.id);

  const spoken = new Set(TURN_ORDER.slice(0, state.turn).map((t) => t.agent));
  if (!Array.isArray(state.claims) || state.claims.length > MAX_CLAIMS) return fail("Too many claims.");
  const ids = new Set();
  for (const c of state.claims) {
    if (!isObj(c) || !onlyKeys(c, ["id", "agent", "dimension", "score", "source", "quote", "reason", "status", "note", "from", "round"])) return fail("Malformed claim.");
    if (!/^c\d{1,2}$/.test(c.id) || ids.has(c.id)) return fail("Bad claim ID.");
    ids.add(c.id);
    if (!spoken.has(c.agent) || !["strategy", "market", "delivery"].includes(c.agent)) return fail("Claim from an agent that has not spoken.");
    if (!dimensionsFor(c.agent).includes(c.dimension)) return fail("Claim targets a dimension outside the agent's lens.");
    if (!isInt(c.score, 1, 5) || (c.from !== undefined && !isInt(c.from, 1, 5))) return fail("Bad claim score.");
    if (!sources.includes(c.source)) return fail("Bad claim source.");
    if (!isStr(c.quote, 300) || !isStr(c.reason, 300) || !isStr(c.note ?? "", 200)) return fail("Claim text too long.");
    if (!STATUSES.includes(c.status) || !isInt(c.round, 1, 2)) return fail("Bad claim status.");
  }
  if (!Array.isArray(state.said) || state.said.length > state.turn) return fail("Bad transcript summary.");
  for (const s of state.said) {
    if (!isObj(s) || !onlyKeys(s, ["agent", "text"]) || !Object.hasOwn(AGENTS, s.agent) || !isStr(s.text, 500)) return fail("Bad transcript entry.");
  }
  if (!Array.isArray(state.challenges) || state.challenges.length > 6) return fail("Bad challenges.");
  for (const ch of state.challenges) {
    if (!isObj(ch) || !onlyKeys(ch, ["target", "issue", "note"]) || !(ids.has(ch.target) || packages.includes(ch.target)) || !ISSUES.includes(ch.issue) || !isStr(ch.note, 240)) return fail("Bad challenge.");
  }
  if (state.estimates !== null) {
    if (!spoken.has("delivery") || !isObj(state.estimates) || !onlyKeys(state.estimates, packages) || Object.keys(state.estimates).length !== packages.length) return fail("Bad estimates.");
    for (const e of Object.values(state.estimates)) {
      if (!isObj(e) || !onlyKeys(e, ["o", "m", "p"]) || rangeError(e)) return fail("Bad estimate range.");
    }
  }
  if (!Array.isArray(state.revisedPackages) || !state.revisedPackages.every((w) => packages.includes(w))) return fail("Bad revised packages.");
  if (state.assumptions !== null) {
    if (!spoken.has("finance") || !isObj(state.assumptions) || !onlyKeys(state.assumptions, ASSUMPTION_KEYS) || Object.keys(state.assumptions).length !== ASSUMPTION_KEYS.length) return fail("Bad assumptions.");
    for (const [key, a] of Object.entries(state.assumptions)) {
      const b = idea.assumptions[key];
      if (!isObj(a) || !onlyKeys(a, ["value", "proposed", "source", "quote", "rationale", "status", "note"])) return fail("Malformed assumption.");
      if (typeof a.value !== "number" || a.value < b.low || a.value > b.high) return fail("Assumption outside its evidence bounds.");
      if (typeof a.proposed !== "number" || !Number.isFinite(a.proposed)) return fail("Bad proposed value.");
      if (!(a.source === null || sources.includes(a.source)) || !isStr(a.quote, 300) || !isStr(a.rationale, 300) || !isStr(a.note, 200)) return fail("Bad assumption citation.");
      if (!ASSUMPTION_STATUSES.includes(a.status)) return fail("Bad assumption status.");
    }
  }
  if (state.chairSuggestion !== null && !TIER_IDS.includes(state.chairSuggestion)) return fail("Bad chair suggestion.");
  if (!strList(state.chairNotes, 3, 240) || !strList(state.mindNotes, 3, 240)) return fail("Bad chair notes.");
  if (!isInt(state.figureStrikes, 0, 200)) return fail("Bad counter.");
  const u = state.usage;
  if (!isObj(u) || !onlyKeys(u, ["promptTokens", "completionTokens", "llmTurns"]) || ![u.promptTokens, u.completionTokens, u.llmTurns].every((n) => isInt(n, 0, 1e7))) return fail("Bad usage.");
  return { ok: true };
}

// --- Signing ---------------------------------------------------------------------------
// The state carries agent text, estimates and assumptions that later turns reuse, so the server signs
// it (HMAC-SHA256) and refuses any state it did not produce. The key comes from server secrets only:
// BOARD_STATE_SECRET, else PANEL_STATE_SECRET, else the Hiring Panel's derivation from the LLM key.

const encoder = new TextEncoder();

export function secretFor(env = {}) {
  if (env.BOARD_STATE_SECRET) return `board-state:${env.BOARD_STATE_SECRET}`;
  if (env.PANEL_STATE_SECRET) return `board-state:${env.PANEL_STATE_SECRET}`;
  if (env.DEEPSEEK_API_KEY) return `board-state:${env.DEEPSEEK_API_KEY}`;
  return "board-state:recorded-only";
}

async function hmac(env, payload) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secretFor(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unsignedJson(state) {
  const { sig, ...rest } = state;
  return JSON.stringify(rest);
}

export async function signState(state, env) {
  const { sig, ...rest } = state;
  return { ...rest, sig: await hmac(env, unsignedJson(rest)) };
}

export async function verifyState(state, env) {
  const valid = validateState(state);
  if (!valid.ok) return valid;
  if (typeof state.sig !== "string" || !/^[0-9a-f]{64}$/.test(state.sig)) return { ok: false, error: "State is not signed." };
  const expected = await hmac(env, unsignedJson(state));
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ state.sig.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, error: "State signature does not match: the state was altered." };
}
