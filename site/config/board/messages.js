// Every sentence the server writes for the page, per locale: guardrail verdicts, notes, tier rules,
// what would change the board's mind, the dissent log, fallback reasons and errors.

import { DEFAULT_LOCALE, isLocale } from "./locale.js";

const EN = {
  unverified: (f) => `Unverified figure: “${f}” is not in a cited source or computed by code`,
  unverifiedPromo: (f) => `Unverified figure: “${f}” comes from a promotional source with no method or primary data`,
  quoteShort: () => "Quote too short to verify.",
  quoteLong: () => "Quote too long: cite one passage.",
  unknownSource: (id) => `Unknown source ${id}.`,
  quoteElsewhere: (found, cited) => `Quote is from ${found}, not the cited ${cited}.`,
  quoteMissing: (id) => `Quote not found in ${id}.`,
  quoteScreened: (id) => `Quote comes from a passage of ${id} struck by the source screen.`,
  verifiedIn: (id) => `Verified in ${id}`,
  noSource: () => "No source cited.",
  cautious: (reason, v) => `${reason} Code used the cautious end of the range (${v}).`,
  withinRange: (id) => `Within the evidence range; quote verified in ${id}.`,
  clamped: (p, lo, hi) => `Proposed ${p} lies outside the evidence range ${lo} to ${hi}; code clamped it.`,
  revisionStruck: (f) => `Revision struck: unverified figure “${f}”`,
  scoreRevised: () => "Score revised",
  stillExcluded: (status) => `Revised, but still excluded (${status})`,
  status: { accepted: "accepted", unsupported: "unsupported", struck: "struck" },
  estimateTarget: (label) => `Estimate: ${label}`,
  rationaleStruck: (note, struck) => `${note} Rationale struck: ${struck.toLowerCase()}.`,
  chairNoteStruck: (struck) => `A Chair's note was struck: ${struck.toLowerCase()}.`,
  noBreakEven: (label) => `No reachable value of ${label.toLowerCase()} alone brings the base-case NPV to zero; several inputs would have to change together.`,
  wouldBreak: (label, at, now) => `If ${label.toLowerCase()} came in at ${at} instead of ${now}, the base-case NPV would fall to zero.`,
  wouldRecover: (label, at, now) => `${label} would need to reach ${at} instead of ${now} for the base-case NPV to break even.`,
  gapFit: (now, need) => `strategic fit ${now} → ${need}`,
  gapEvidence: (now, need) => `evidence strength ${now} → ${need}`,
  gapNpv: () => "base-case NPV above zero",
  gapPayback: (need, now) => `payback within ${need} months (now ${now === null ? "beyond 3 years" : `${now} months`})`,
  toInvest: (tier, gaps) => `To reach “${tier}” under the policy: ${gaps.join("; ")}.`,
  devCost: () => "Development cost",
  rules: (p) => ({
    invest: `Invest now: strategic fit ≥ ${p.investNow.strategicFit}, evidence strength ≥ ${p.investNow.evidenceStrength}, base-case NPV > 0 and base-case payback ≤ ${p.investNow.paybackMonths} months`,
    pilot: `Run a pilot: strategic fit ≥ ${p.pilot.strategicFit}, evidence strength ≥ ${p.pilot.evidenceStrength} and base-case NPV > 0`,
    explore: "Explore further: the optimistic-case NPV is above zero, so there is upside, but the stronger rules are not met",
    park: "Park: none of the rules above is met; even the optimistic case does not return the investment"
  }),
  experimentTargeted: (label) => `Cheapest listed experiment that tests the assumption that moves the result most (${label.toLowerCase()}).`,
  experimentFallback: () => "No listed experiment tests the most sensitive input directly, so this is the cheapest listed experiment.",
  dissentEstimateTopic: () => "Development estimate",
  dissentEstimate: (auditor, note) => `${auditor} challenged the estimate: ${note}`,
  dissentUnanswered: (auditor, id, score) => `${auditor}'s challenge to ${id} was not answered with a revision; the score stands at ${score} of 5.`,
  dissentFitTopic: () => "Fit against demand",
  dissentFit: (fit, pull) => `Strategic fit is ${fit} but market pull is ${pull}: the idea suits the strategy better than the evidence of demand supports, or the reverse.`,
  chairTopic: () => "Chair's note",
  issue: { unsupported: "unsupported", optimistic: "optimistic", weak: "weak", inconsistent: "inconsistent", unverified: "unverified" },
  noKey: () => "No LLM key is configured.",
  providerDown: (error) => `The LLM provider was unavailable (${error}).`,
  invalidTwice: () => "The agent returned an invalid turn twice.",
  turnsUsed: () => "The board has already used all its turns.",
  recordingMissing: () => "The recorded transcript is missing this turn.",
  recordingInvalid: () => "The recorded transcript failed validation.",
  unexpected: () => "The board hit an unexpected error."
};

const IT = {
  unverified: (f) => `Dato non verificato: “${f}” non compare in una fonte citata e non è calcolato dal codice`,
  unverifiedPromo: (f) => `Dato non verificato: “${f}” viene da una fonte promozionale, senza metodo né dati primari`,
  quoteShort: () => "Citazione troppo breve per essere verificata.",
  quoteLong: () => "Citazione troppo lunga: citare un solo passaggio.",
  unknownSource: (id) => `Fonte sconosciuta: ${id}.`,
  quoteElsewhere: (found, cited) => `La citazione è tratta da ${found}, non dalla fonte citata ${cited}.`,
  quoteMissing: (id) => `Citazione non trovata in ${id}.`,
  quoteScreened: (id) => `La citazione viene da un passaggio di ${id} escluso dal filtro delle fonti.`,
  verifiedIn: (id) => `Verificata in ${id}`,
  noSource: () => "Nessuna fonte citata.",
  cautious: (reason, v) => `${reason} Il codice ha usato l'estremo prudente dell'intervallo (${v}).`,
  withinRange: (id) => `Nell'intervallo delle evidenze; citazione verificata in ${id}.`,
  clamped: (p, lo, hi) => `Il valore proposto (${p}) è fuori dall'intervallo delle evidenze (${lo}–${hi}): il codice lo ha riportato entro i limiti.`,
  revisionStruck: (f) => `Revisione stralciata: dato non verificato “${f}”`,
  scoreRevised: () => "Punteggio rivisto",
  stillExcluded: (status) => `Rivista, ma ancora esclusa (${status})`,
  status: { accepted: "accettata", unsupported: "non supportata", struck: "stralciata" },
  estimateTarget: (label) => `Stima: ${label}`,
  rationaleStruck: (note, struck) => `${note} Motivazione stralciata (${struck.toLowerCase()}).`,
  chairNoteStruck: (struck) => `Una nota del Presidente è stata stralciata (${struck.toLowerCase()}).`,
  noBreakEven: (label) => `Nessun valore raggiungibile della variabile “${label}” porta da solo a zero il VAN dello scenario base: dovrebbero cambiare più variabili insieme.`,
  wouldBreak: (label, at, now) => `Se la variabile “${label}” valesse ${at} anziché ${now}, il VAN dello scenario base si azzererebbe.`,
  wouldRecover: (label, at, now) => `Per portare in pareggio il VAN dello scenario base, la variabile “${label}” dovrebbe arrivare a ${at} anziché ${now}.`,
  gapFit: (now, need) => `coerenza strategica ${now} → ${need}`,
  gapEvidence: (now, need) => `solidità delle evidenze ${now} → ${need}`,
  gapNpv: () => "VAN dello scenario base sopra zero",
  gapPayback: (need, now) => `payback entro ${need} mesi (oggi ${now === null ? "oltre 3 anni" : `${String(now).replace(".", ",")} mesi`})`,
  toInvest: (tier, gaps) => `Per arrivare a “${tier}” secondo la politica di investimento: ${gaps.join("; ")}.`,
  devCost: () => "Costo di sviluppo",
  rules: (p) => ({
    invest: `Investire ora: coerenza strategica ≥ ${p.investNow.strategicFit}, solidità delle evidenze ≥ ${p.investNow.evidenceStrength}, VAN dello scenario base > 0 e payback dello scenario base ≤ ${p.investNow.paybackMonths} mesi`,
    pilot: `Avviare un progetto pilota: coerenza strategica ≥ ${p.pilot.strategicFit}, solidità delle evidenze ≥ ${p.pilot.evidenceStrength} e VAN dello scenario base > 0`,
    explore: "Approfondire: il VAN dello scenario ottimistico è positivo, quindi un potenziale c'è, ma le regole più severe non sono soddisfatte",
    park: "Accantonare: nessuna delle regole precedenti è soddisfatta; nemmeno lo scenario ottimistico ripaga l'investimento"
  }),
  experimentTargeted: (label) => `È l'esperimento più economico tra quelli che mettono alla prova l'ipotesi che incide di più sul risultato (${label.toLowerCase()}).`,
  experimentFallback: () => "Nessun esperimento in elenco mette alla prova direttamente la variabile più sensibile: questo è il più economico tra quelli disponibili.",
  dissentEstimateTopic: () => "Stima di sviluppo",
  dissentEstimate: (auditor, note) => `${auditor} ha contestato la stima: ${note}`,
  dissentUnanswered: (auditor, id, score) => `Alla contestazione di ${auditor} su ${id} non è seguita una revisione; il punteggio resta ${score} su 5.`,
  dissentFitTopic: () => "Coerenza e domanda",
  dissentFit: (fit, pull) => `La coerenza strategica è ${fit}, ma la domanda di mercato è ${pull}: l'idea si adatta alla strategia più di quanto le evidenze sulla domanda giustifichino, o viceversa.`,
  chairTopic: () => "Nota del Presidente",
  issue: { unsupported: "non supportata", optimistic: "ottimistica", weak: "debole", inconsistent: "incoerente", unverified: "dato non verificato" },
  noKey: () => "Nessuna chiave LLM configurata.",
  providerDown: (error) => `Il fornitore dell'LLM non era disponibile (${providerErrorIt(error)}).`,
  invalidTwice: () => "L'agente ha restituito per due volte un turno non valido.",
  turnsUsed: () => "Il board ha già usato tutti i suoi turni.",
  recordingMissing: () => "Nella trascrizione registrata manca questo turno.",
  recordingInvalid: () => "La trascrizione registrata non ha superato la validazione.",
  unexpected: () => "Il board ha riscontrato un errore imprevisto."
};

function providerErrorIt(error) {
  const http = /HTTP (\d+)/.exec(error);
  if (http) return `il servizio ha risposto con HTTP ${http[1]}`;
  if (/timed out/.test(error)) return "tempo di risposta scaduto";
  if (/no message/.test(error)) return "nessun messaggio nella risposta";
  return "servizio non raggiungibile";
}

// Request and state errors, which code writes in English; the page shows the Italian ones.
const ERRORS_IT = {
  "Request body is too large.": "Il corpo della richiesta è troppo grande.",
  "Body must be valid JSON.": "Il corpo della richiesta deve essere JSON valido.",
  "Body must be a JSON object.": "Il corpo della richiesta deve essere un oggetto JSON.",
  "Only start.ideaId, start.mode and start.locale are accepted.": "Sono accettati solo start.ideaId, start.mode e start.locale.",
  "Unknown ideaId.": "Idea sconosciuta.",
  "Unknown mode.": "Modalità sconosciuta.",
  "Unknown locale.": "Lingua non supportata.",
  "Send either start or state.": "Inviare start oppure state.",
  "State is not signed.": "Lo stato dell'esecuzione non è firmato.",
  "State signature does not match: the state was altered.": "La firma dello stato non corrisponde: lo stato è stato alterato.",
  "The board has already used all its turns.": IT.turnsUsed()
};

export const MESSAGES = { en: EN, it: IT };

export function messages(locale = DEFAULT_LOCALE) {
  return MESSAGES[isLocale(locale) ? locale : DEFAULT_LOCALE];
}

// English errors pass through unchanged. Italian structural state errors, which only a tampered
// request can trigger, are reported with one general sentence.
export function localiseError(error, locale) {
  if (locale !== "it") return error;
  return ERRORS_IT[error] || "Lo stato dell'esecuzione non è valido ed è stato rifiutato.";
}
