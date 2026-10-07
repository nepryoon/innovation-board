// Locales: one engine, one data structure, and the words of each locale laid over it. English is the
// base (data.js); a locale overlay replaces text only, so ids, numbers and ranges are shared and every
// computed result is identical in every locale. To add a locale, add an overlay like data-it.js, its
// messages in messages.js and its interface strings in the page script.

import { COMPANY, POLICY, TIERS, AGENTS, DIMENSIONS, SOURCE_TYPES, IDEAS } from "./data.js";
import { COMPANY_IT, POLICY_NOTE_IT, TIERS_IT, AGENT_ROLES_IT, DIMENSION_LABELS_IT, SOURCE_TYPE_LABELS_IT, IDEAS_IT } from "./data-it.js";

export const LOCALES = Object.freeze(["en", "it"]);
export const DEFAULT_LOCALE = "en";
export const isLocale = (value) => typeof value === "string" && LOCALES.includes(value);

const OVERLAYS = {
  it: { company: COMPANY_IT, policyNote: POLICY_NOTE_IT, tiers: TIERS_IT, roles: AGENT_ROLES_IT, dimensions: DIMENSION_LABELS_IT, sourceTypes: SOURCE_TYPE_LABELS_IT, ideas: IDEAS_IT }
};

const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]));

function build(o) {
  return {
    COMPANY: { ...COMPANY, ...o.company, rateCard: mapValues(COMPANY.rateCard, (r, k) => ({ ...r, label: o.company.rateCard[k] })) },
    POLICY: { ...POLICY, note: o.policyNote },
    TIERS: { ...o.tiers },
    AGENTS: mapValues(AGENTS, (a, k) => ({ ...a, role: o.roles[k] })),
    DIMENSIONS: mapValues(DIMENSIONS, (d, k) => ({ ...d, label: o.dimensions[k] })),
    SOURCE_TYPES: mapValues(SOURCE_TYPES, (t, k) => ({ ...t, label: o.sourceTypes[k] })),
    IDEAS: mapValues(IDEAS, (idea, id) => {
      const t = o.ideas[id];
      return {
        ...idea,
        title: t.title, tagline: t.tagline, profile: t.profile, pitch: t.pitch, unit: t.unit,
        assumptions: mapValues(idea.assumptions, (a, k) => ({ ...a, label: t.assumptions[k] })),
        workPackages: idea.workPackages.map((w) => ({ ...w, label: t.workPackages[w.id] })),
        experiments: idea.experiments.map((x) => ({ ...x, label: t.experiments[x.id] })),
        sources: idea.sources.map((s) => ({ ...s, ...t.sources[s.id] }))
      };
    })
  };
}

const BASE = { COMPANY, POLICY, TIERS, AGENTS, DIMENSIONS, SOURCE_TYPES, IDEAS };
const cache = new Map([["en", BASE]]);

// The catalogue for one locale; unknown values get English.
export function localeData(locale = DEFAULT_LOCALE) {
  const key = isLocale(locale) ? locale : DEFAULT_LOCALE;
  if (!cache.has(key)) cache.set(key, build(OVERLAYS[key]));
  return cache.get(key);
}

export const ideaFor = (ideaId, locale) => localeData(locale).IDEAS[ideaId];

// Number formats. English keeps the pound sign it always had; Italian shows the same values in euro.
export function money(n, locale = DEFAULT_LOCALE) {
  if (locale === "it") return `${Math.round(n).toLocaleString("it-IT", { useGrouping: "always" })} €`;
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

export function num(n, locale = DEFAULT_LOCALE) {
  return locale === "it" ? n.toLocaleString("it-IT", { useGrouping: "always", maximumFractionDigits: 2 }) : String(n);
}

export const percent = (n, locale = DEFAULT_LOCALE) => `${num(n, locale)}%`;
