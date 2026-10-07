// Client for the Innovation Board demo. Plain ES module, no dependencies.
// The page only drives the turn order and animates; every check, estimate and financial result is
// computed on the server. All values from the server are rendered with textContent, never as HTML.

// --- Interface strings (begin) -------------------------------------------------------------
// One dictionary per locale. The page's lang attribute picks one; the server sends the data and its
// own sentences in the same locale. Values are strings or functions of preformatted strings only.
const UI = {
  en: {
    metrics: { strategicFit: "Strategic fit", marketPull: "Market pull", feasibility: "Feasibility", evidenceStrength: "Evidence strength", financialReturn: "Financial return", risk: "Risk (higher = lower)" },
    kinds: { opening: "Opening assessment", review: "Evidence audit", response: "Response to challenges", assumptions: "Financial assumptions", case: "Financial case", brief: "Closing brief" },
    status: { accepted: "Accepted", unsupported: "Unsupported", struck: "Struck: unverified figure", clamped: "Clamped to evidence range" },
    issues: { unsupported: "unsupported", optimistic: "optimistic", weak: "weakly supported", inconsistent: "inconsistent", unverified: "unverified figure" },
    scenarios: { pessimistic: "Pessimistic", base: "Base", optimistic: "Optimistic" },
    inputs: { price: "Price or saving", adoption: "Adoption", churn: "Churn or fallback", running: "Running cost", devCost: "Development cost" },
    notWithin: "not within 3 years",
    months: (m) => `${m} months`,
    live: "Live LLM board",
    recorded: "Recorded run",
    liveTitle: (model) => `Each turn calls ${model} live`,
    theLlm: "the LLM",
    recordedTitle: "Replaying a recorded live run through the same checks and computations",
    docPitch: "Pitch",
    docCompany: "Company",
    docPriorities: "Strategy priorities",
    docProducts: "Products",
    docCapacity: "Engineering capacity",
    docRates: "Rate card (per day)",
    docPolicy: "Investment policy",
    policyLine: (rate, years, note) => `Discount rate ${rate}%, horizon ${years} years. ${note}`,
    apiDown: "The demo API is unavailable right now. Please try again shortly.",
    unavailable: "Unavailable",
    profile: (p) => `Synthetic profile: ${p}`,
    retrieved: "retrieved",
    pending: "pending",
    thinking: "thinking",
    preparing: (name) => `${name} is preparing a turn`,
    checkingQuote: "checking quote…",
    challengeTo: (name, target, label) => `Challenge to ${name}’s ${target} · ${label}`,
    challenged: "challenged",
    revised: (id, label) => `Revised ${id} · ${label}`,
    reEstimated: (wp, label) => `Re-estimated ${wp} · ${label}`,
    days: "days",
    rangeValid: "range valid",
    range: (lo, hi) => `range ${lo} to ${hi}`,
    screenSome: (n) => `Source screen (code, before the debate): ${n} ${n === "1" ? "passage" : "passages"} in promotional sources struck as unverified figures. Quotes from them cannot support a claim and their figures do not count.`,
    screenNone: "Source screen (code, before the debate): no promotional passages with unverified figures in this evidence pack.",
    round: (r, kind) => `Round ${r} · ${kind}`,
    invalidReplies: (n) => `${n} invalid ${n === "1" ? "reply" : "replies"} rejected by the validator and retried`,
    computedPert: "Computed by code (PERT)",
    pertLine: (eLow, eHigh, wLow, wHigh, team, cLow, cHigh) => `${eLow} to ${eHigh} person-days, ${wLow} to ${wHigh} weeks for a squad of ${team}, cost ${cLow} to ${cHigh}. All ranges valid.`,
    computed: "Computed by code",
    npvLine: (pess, base, opt, roi, payback) => `NPV ${pess} / ${base} / ${opt} (pessimistic / base / optimistic); base ROI ${roi}%, payback ${payback}.`,
    policyApplied: "Investment policy, applied by code",
    overridden: (tier, chair) => `${tier}. The Chair suggested “${chair}”; the rule overrides it.`,
    asSuggested: (tier) => `${tier}, as the Chair suggested.`,
    tokens: (n) => `${n} tokens`,
    effort: "Effort",
    duration: "Duration",
    cost: "Cost",
    personDays: (lo, hi) => `${lo}–${hi} person-days`,
    weeks: (lo, hi) => `${lo}–${hi} weeks`,
    expected: (v) => `Expected ${v}`,
    wpHead: ["Work package", "o / m / p days", "PERT E", "Cost"],
    perDay: (role, rate) => `${role}, ${rate} a day`,
    totalExpected: "Total (expected)",
    npvZero: (zero) => `NPV ${zero}`,
    scenarioHead: ["Scenario", "NPV", "ROI", "Payback"],
    beyond36: "> 36 mo",
    mo: (m) => `${m} mo`,
    financeNote: (dev, nets, rate, years) => `Base case: development ${dev}; net cash flow by year ${nets}. Discount rate ${rate}%, ${years}-year horizon.`,
    baseMarker: (v) => `base ${v}`,
    sensitivityNote: (label, lo, hi) => `${label} moves the result most: across its evidence range the base-case NPV runs from ${lo} to ${hi}. Red: worse end of the range; green: better end.`,
    briefIdea: (title, tagline, company) => `${title}: ${tagline}. ${company}.`,
    ruleLine: (rule) => `Rule that produced it: ${rule}.`,
    overrideNote: (chair, tier) => `Code overrides the Chair: the Chair suggested “${chair}”, but the investment policy gives “${tier}” on this evidence.`,
    matchNote: (chair) => `The Chair suggested “${chair}”, which matches the policy.`,
    inBase: (label, value) => `${label}: ${value} in the base case`,
    rangeLine: (sources, lo, hi, pess, opt) => `Range from the evidence (${sources}): ${lo} to ${hi}; pessimistic ${pess}, optimistic ${opt}.`,
    byCode: "Computed by code",
    byChair: "Chair’s note (figures verified)",
    experimentLine: (targets, weeks, cost, breakdown) => `Tests: ${targets}. ${weeks} weeks, ${cost} from the rate card (${breakdown}).`,
    breakdownItem: (role, days, rate) => `${role} ${days} days × ${rate}`,
    versus: " vs ",
    noDissent: "No remaining disagreement was recorded.",
    liveSummary: (model, turns, prompt, completion) => `Live LLM board (${model}) · ${turns} LLM turns · ${prompt} prompt and ${completion} completion tokens.`,
    recordedSummary: (model) => `Recorded run${model ? ` (originally produced live by ${model})` : ""}: the same citation check, figure filter and computations ran on the recorded content.`,
    decisionRecord: (time, choice, advised) => `Recorded on this page at ${time}: “${choice}”. The board advised “${advised}”.`,
    departed: " You departed from the board’s advice; in a real process your reason would be logged with the decision.",
    networkError: "network error",
    gathering: "The agents are gathering evidence…",
    inSession: "The board is in session…",
    serviceError: (error) => `the board service answered with an error (${error})`,
    switched: (reason) => `Switched to the recorded run: ${reason}. The same checks and computations run on the recorded content.`,
    recordingFailed: (reason) => `The recorded run could not be loaded (${reason}). Please try again shortly.`,
    skipping: "Skipping to the brief…"
  },
  it: {
    metrics: { strategicFit: "Coerenza strategica", marketPull: "Domanda di mercato", feasibility: "Fattibilità", evidenceStrength: "Solidità delle evidenze", financialReturn: "Ritorno finanziario", risk: "Rischio (più alto = minore)" },
    kinds: { opening: "Valutazione iniziale", review: "Verifica delle evidenze", response: "Risposta alle contestazioni", assumptions: "Ipotesi finanziarie", case: "Business case", brief: "Sintesi finale" },
    status: { accepted: "Accettata", unsupported: "Non supportata", struck: "Stralciata: dato non verificato", clamped: "Riportata nell'intervallo delle evidenze" },
    issues: { unsupported: "non supportata", optimistic: "ottimistica", weak: "debolmente supportata", inconsistent: "incoerente", unverified: "dato non verificato" },
    scenarios: { pessimistic: "Pessimistico", base: "Base", optimistic: "Ottimistico" },
    inputs: { price: "Prezzo o risparmio", adoption: "Adozione", churn: "Churn o rientro", running: "Costo di esercizio", devCost: "Costo di sviluppo" },
    notWithin: "non raggiunto entro 3 anni",
    months: (m) => `${m} mesi`,
    live: "Board LLM dal vivo",
    recorded: "Esecuzione registrata",
    liveTitle: (model) => `Ogni turno chiama ${model} in tempo reale`,
    theLlm: "l'LLM",
    recordedTitle: "Riproduce un'esecuzione dal vivo registrata, con gli stessi controlli e calcoli",
    docPitch: "Proposta",
    docCompany: "Azienda",
    docPriorities: "Priorità strategiche",
    docProducts: "Prodotti",
    docCapacity: "Capacità di sviluppo",
    docRates: "Tariffe (al giorno)",
    docPolicy: "Politica di investimento",
    policyLine: (rate, years, note) => `Tasso di sconto ${rate}%, orizzonte di ${years} anni. ${note}`,
    apiDown: "L'API della demo al momento non è disponibile. Riprovare tra poco.",
    unavailable: "Non disponibile",
    profile: (p) => `Profilo dell'idea: ${p}`,
    retrieved: "acquisita",
    pending: "in attesa",
    thinking: "sta elaborando",
    preparing: (name) => `${name} sta preparando il suo turno`,
    checkingQuote: "verifica della citazione…",
    challengeTo: (name, target, label) => `Contestazione ${/^[aeiou]/i.test(name) ? "ad" : "a"} ${name}, ${target} · ${label}`,
    challenged: "contestata",
    revised: (id, label) => `${id} rivista · ${label}`,
    reEstimated: (wp, label) => `${wp} stimato di nuovo · ${label}`,
    days: "giorni",
    rangeValid: "intervallo valido",
    range: (lo, hi) => `intervallo ${lo}–${hi}`,
    screenSome: (n) => `Filtro delle fonti (codice, prima del dibattito): ${n === "1" ? "1 passaggio" : `${n} passaggi`} di fonti promozionali ${n === "1" ? "stralciato" : "stralciati"} come dati non verificati. Le citazioni tratte da questi passaggi non possono sostenere un'affermazione e i loro dati non contano.`,
    screenNone: "Filtro delle fonti (codice, prima del dibattito): in questo pacchetto di evidenze non ci sono passaggi promozionali con dati non verificati.",
    round: (r, kind) => `Fase ${r} · ${kind}`,
    invalidReplies: (n) => (n === "1" ? "1 risposta non valida respinta dal validatore e ripetuta" : `${n} risposte non valide respinte dal validatore e ripetute`),
    computedPert: "Calcolato dal codice (PERT)",
    pertLine: (eLow, eHigh, wLow, wHigh, team, cLow, cHigh) => `da ${eLow} a ${eHigh} giorni-persona, da ${wLow} a ${wHigh} settimane per un team di ${team} persone, costo da ${cLow} a ${cHigh}. Tutti gli intervalli sono validi.`,
    computed: "Calcolato dal codice",
    npvLine: (pess, base, opt, roi, payback) => `VAN ${pess} / ${base} / ${opt} (pessimistico / base / ottimistico); ROI dello scenario base ${roi}%, payback ${payback}.`,
    policyApplied: "Politica di investimento, applicata dal codice",
    overridden: (tier, chair) => `${tier}. Il Presidente aveva suggerito “${chair}”: prevale la regola.`,
    asSuggested: (tier) => `${tier}, come suggerito dal Presidente.`,
    tokens: (n) => `${n} token`,
    effort: "Impegno",
    duration: "Durata",
    cost: "Costo",
    personDays: (lo, hi) => `${lo}–${hi} giorni-persona`,
    weeks: (lo, hi) => `${lo}–${hi} settimane`,
    expected: (v) => `Atteso ${v}`,
    wpHead: ["Pacchetto di lavoro", "o / m / p (gg)", "PERT E", "Costo"],
    perDay: (role, rate) => `${role}, ${rate} al giorno`,
    totalExpected: "Totale (atteso)",
    npvZero: (zero) => `VAN ${zero}`,
    scenarioHead: ["Scenario", "VAN", "ROI", "Payback (mesi)"],
    beyond36: "> 36",
    mo: (m) => m,
    financeNote: (dev, nets, rate, years) => `Scenario base: sviluppo ${dev}; flusso di cassa netto per anno ${nets}. Tasso di sconto ${rate}%, orizzonte di ${years} anni.`,
    baseMarker: (v) => `base ${v}`,
    sensitivityNote: (label, lo, hi) => `È la variabile “${label}” a incidere di più: nel suo intervallo di evidenze il VAN dello scenario base va da ${lo} a ${hi}. In rosso l'estremo peggiore dell'intervallo, in verde quello migliore.`,
    briefIdea: (title, tagline, company) => `${title}: ${tagline}. ${company}.`,
    ruleLine: (rule) => `Regola applicata: ${rule}.`,
    overrideNote: (chair, tier) => `Il codice non segue il Presidente: il Presidente aveva suggerito “${chair}”, ma con queste evidenze la politica di investimento indica “${tier}”.`,
    matchNote: (chair) => `Il Presidente ha suggerito “${chair}”, in linea con la politica di investimento.`,
    inBase: (label, value) => `${label}: ${value} nello scenario base`,
    rangeLine: (sources, lo, hi, pess, opt) => `Intervallo dalle evidenze (${sources}): ${lo}–${hi}; pessimistico ${pess}, ottimistico ${opt}.`,
    byCode: "Calcolato dal codice",
    byChair: "Nota del Presidente (dati verificati)",
    experimentLine: (targets, weeks, cost, breakdown) => `Mette alla prova: “${targets}”. ${weeks} settimane, ${cost} secondo le tariffe (${breakdown}).`,
    breakdownItem: (role, days, rate) => `${role} ${days} giorni × ${rate}`,
    versus: " e ",
    noDissent: "Non è rimasto alcun disaccordo da registrare.",
    liveSummary: (model, turns, prompt, completion) => `Board LLM dal vivo (${model}) · ${turns} turni LLM · ${prompt} token di prompt e ${completion} token di risposta.`,
    recordedSummary: (model) => `Esecuzione registrata${model ? ` (prodotta in origine dal vivo con ${model})` : ""}: sui contenuti registrati sono stati applicati gli stessi controlli delle citazioni, lo stesso filtro dei dati e gli stessi calcoli.`,
    decisionRecord: (time, choice, advised) => `Decisione registrata su questa pagina alle ${time}: “${choice}”. Il board aveva consigliato “${advised}”.`,
    departed: " La decisione si discosta dal parere del board: in un processo reale la motivazione verrebbe registrata insieme alla decisione.",
    networkError: "errore di rete",
    gathering: "Gli agenti stanno raccogliendo le evidenze…",
    inSession: "Il board è riunito…",
    serviceError: (error) => `il servizio del board ha risposto con un errore (${error})`,
    switched: (reason) => `Passaggio all'esecuzione registrata: ${reason}. Sui contenuti registrati vengono eseguiti gli stessi controlli e calcoli.`,
    recordingFailed: (reason) => `Non è stato possibile caricare l'esecuzione registrata (${reason}). Riprovare tra poco.`,
    skipping: "Passaggio diretto alla sintesi…"
  }
};
// --- Interface strings (end) ---------------------------------------------------------------

const LOCALE = document.documentElement.lang.toLowerCase().startsWith("it") ? "it" : "en";
const T = UI[LOCALE];

const API = "/api/board/turn";
const SVG_NS = "http://www.w3.org/2000/svg";
const $ = (id) => document.getElementById(id);

const METRICS = Object.entries(T.metrics);
const KIND_LABELS = T.kinds;
const STATUS = { accepted: ["ok", T.status.accepted], unsupported: ["warn", T.status.unsupported], struck: ["bad", T.status.struck], clamped: ["warn", T.status.clamped] };
const ISSUE_LABELS = T.issues;
const SCENARIOS = Object.entries(T.scenarios);
const RESEARCHERS = ["strategy", "market", "delivery"];
const SHORT_INPUTS = T.inputs;
const PACE = { normal: 1, fast: 0.3 };

let config = null;
let agents = {};
let runToken = 0;
let running = false;
let skipping = false;
let lastMetrics = null;

// --- Small helpers ----------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

// Numbers: English as before; Italian with it-IT grouping and decimal comma, amounts in euro.
const IT = LOCALE === "it";
const num = (n) => (IT ? n.toLocaleString("it-IT", { useGrouping: "always", maximumFractionDigits: 1 }) : String(n));
const sign = (n) => (n < 0 ? "−" : "");
const money = (n) => (IT ? `${sign(n)}${Math.abs(Math.round(n)).toLocaleString("it-IT", { useGrouping: "always" })} €` : `${sign(n)}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`);
function moneyShort(n) {
  const a = Math.abs(n);
  if (IT) {
    if (a >= 1e6) return `${sign(n)}${(a / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 2 })} mln €`;
    if (a >= 1e3) return `${sign(n)}${Math.round(a / 1e3).toLocaleString("it-IT", { useGrouping: "always" })} mila €`;
    return money(n);
  }
  if (a >= 1e6) return `${sign(n)}£${(a / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 2 })}m`;
  if (a >= 1e3) return `${sign(n)}£${Math.round(a / 1e3).toLocaleString("en-GB")}k`;
  return money(n);
}
// Table cells: Italian amounts in k€ and M€ so the columns fit at phone width; English unchanged.
function moneyCell(n) {
  const a = Math.abs(n);
  if (!IT || a < 1e3) return moneyShort(n);
  if (a >= 1e6) return `${sign(n)}${(a / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 2 })} M€`;
  return `${sign(n)}${Math.round(a / 1e3).toLocaleString("it-IT", { useGrouping: "always" })} k€`;
}
const months = (m) => (m === null ? T.notWithin : T.months(num(m)));
const date = (iso) => (IT ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : iso);
const speed = () => document.querySelector('input[name="speed"]:checked')?.value || "normal";
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function fmtAssumption(unit, v) {
  if (unit === "gbp") return money(v);
  if (unit === "percent") return `${num(v)}%`;
  return String(Math.round(v));
}

function wait(ms) {
  if (skipping) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms * PACE[speed()]));
}

function scrollTranscript() {
  if (skipping) return;
  const list = $("transcript");
  list.scrollTop = list.scrollHeight;
}

// Simple geometric avatars, one glyph per agent.
const GLYPHS = {
  compass: [["circle", { cx: 20, cy: 20, r: 9, fill: "none" }], ["path", { d: "M23.5 16.5l-2 5-5 2 2-5z" }]],
  trend: [["path", { d: "M10 27l6-6 4 4 9-10", fill: "none" }], ["path", { d: "M24 15h5v5", fill: "none" }]],
  blocks: [["rect", { x: 11, y: 21, width: 8, height: 8, rx: 1.5, fill: "none" }], ["rect", { x: 21, y: 21, width: 8, height: 8, rx: 1.5, fill: "none" }], ["rect", { x: 16, y: 11, width: 8, height: 8, rx: 1.5, fill: "none" }]],
  coin: [["circle", { cx: 20, cy: 20, r: 9, fill: "none" }], ["path", { d: "M22.5 15.5c-.6-.9-1.6-1.4-2.7-1.4-1.6 0-2.8 1-2.8 2.4v3.5c0 1.6-.6 2.8-1.6 3.6h7.6M15.5 19.5h5", fill: "none" }]],
  lens: [["circle", { cx: 18, cy: 18, r: 6.5, fill: "none" }], ["path", { d: "M23 23l6 6", fill: "none" }]],
  gavel: [["path", { d: "M14 15l6-6 5 5-6 6zM19.5 17.5l7 7M11 30h12", fill: "none" }]]
};

function avatar(agent) {
  const root = svg("svg", { viewBox: "0 0 40 40", class: "avatar", "aria-hidden": "true" });
  root.append(svg("circle", { cx: 20, cy: 20, r: 18.5, fill: agent.colour, "fill-opacity": 0.14, stroke: agent.colour, "stroke-width": 1.5 }));
  const glyph = svg("g", { stroke: agent.colour, fill: agent.colour, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" });
  for (const [tag, attrs] of GLYPHS[agent.glyph] || []) glyph.append(svg(tag, attrs));
  root.append(glyph);
  return root;
}

// --- Configuration and choices ---------------------------------------------------------

function setMode(mode, model) {
  const badge = $("modeBadge");
  badge.className = `mode-badge ${mode}`;
  badge.textContent = mode === "live" ? T.live : T.recorded;
  badge.title = mode === "live" ? T.liveTitle(model || T.theLlm) : T.recordedTitle;
}

function choice(name, value, title, lines, checked) {
  const label = el("label", "choice");
  const input = el("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  const face = el("span", "face");
  face.append(el("b", "", title));
  lines.forEach((line) => face.append(el("span", "", line)));
  label.append(input, face);
  return label;
}

const selectedIdea = () => config.ideas.find((i) => i.id === document.querySelector('input[name="idea"]:checked')?.value);

function renderDocs() {
  const idea = selectedIdea();
  if (!idea) return;
  const c = config.company;
  const rows = [
    [T.docPitch, idea.pitch],
    [T.docCompany, `${c.name}. ${c.sector}. ${c.size}.`],
    [T.docPriorities, c.priorities.join("; ") + "."],
    [T.docProducts, c.products.join("; ") + "."],
    [T.docCapacity, c.capacity],
    [T.docRates, Object.values(c.rateCard).map((r) => `${r.label} ${money(r.rate)}`).join(", ") + "."],
    [T.docPolicy, T.policyLine(num(c.discountRate * 100), String(c.horizonYears), config.policy.note)]
  ];
  $("docList").replaceChildren(...rows.flatMap(([dt, dd]) => [el("dt", "", dt), el("dd", "", dd)]));
}

function renderRoster() {
  $("roster").replaceChildren(...Object.values(agents).map((agent) => {
    const li = el("li");
    li.dataset.agent = agent.id;
    li.append(avatar(agent), el("span", "", `${agent.name} · ${agent.role}`));
    return li;
  }));
}

function renderMetricBars() {
  $("metrics").replaceChildren(...METRICS.map(([key, label]) => {
    const row = el("div", "metric");
    row.dataset.metric = key;
    const head = el("div", "metric-head");
    head.append(el("span", "", label), el("b", "", key === "financialReturn" ? T.pending : "0"));
    const bar = el("div", "bar");
    bar.setAttribute("role", "meter");
    bar.setAttribute("aria-label", label);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", "0");
    bar.append(el("i"));
    row.append(head, bar);
    return row;
  }));
}

async function loadConfig() {
  try {
    const res = await fetch(IT ? `${API}?locale=it` : API, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = await res.json();
  } catch {
    $("ideaChoices").replaceChildren(el("p", "small", T.apiDown));
    $("modeBadge").textContent = T.unavailable;
    return;
  }
  agents = Object.fromEntries(config.agents.map((a) => [a.id, a]));
  setMode(config.mode, config.model);
  $("ideaChoices").replaceChildren(...config.ideas.map((idea, i) =>
    choice("idea", idea.id, idea.title, [idea.tagline, T.profile(idea.profile.toLowerCase())], i === 0)));
  $("ideaChoices").addEventListener("change", renderDocs);
  renderDocs();
  renderRoster();
  renderMetricBars();
  $("runButton").disabled = false;
}

// --- Simulated research ------------------------------------------------------------------

function sourceCard(source) {
  const li = el("li", `source retrieving ${source.grade}`);
  const head = el("div", "source-head");
  head.append(el("span", "pill", source.id), el("b", "", source.title));
  li.append(head, el("div", "scan"));
  return li;
}

async function revealSource(li, source) {
  li.classList.remove("retrieving");
  li.querySelector(".scan")?.remove();
  const head = li.querySelector(".source-head");
  head.append(el("span", `pill ${source.grade === "promotional" ? "warn" : source.grade === "primary" ? "ok" : "info"}`, `${source.typeLabel} · ${date(source.date)}`), el("span", "pill ok", T.retrieved));
  const p = el("p");
  const struck = [];
  source.segments.forEach((seg, i) => {
    if (i) p.append(document.createTextNode(" "));
    const span = el("span", "sentence", seg.text);
    p.append(span);
    if (seg.struck) { p.append(el("span", "strike-label", seg.struck)); struck.push(span); }
  });
  li.append(p);
  return struck;
}

async function renderResearch(idea) {
  const cols = RESEARCHERS.map((id) => {
    const col = el("div", "research-col");
    const h = el("h3");
    h.append(avatar(agents[id]), el("span", "", `${agents[id].name} · ${agents[id].role}`));
    const list = el("ul", "sources");
    col.append(h, list);
    return { id, col, list };
  });
  $("research").replaceChildren(...cols.map((c) => c.col));
  const queue = [];
  for (const source of idea.sources) {
    const target = cols.find((c) => c.id === source.agent) || cols[1];
    const li = sourceCard(source);
    target.list.append(li);
    await wait(260);
    queue.push(...(await revealSource(li, source)));
    await wait(120);
  }
  await wait(300);
  queue.forEach((span) => span.classList.add("struck"));
  if (queue.length) await wait(900);
}

// --- Live scoreboard -----------------------------------------------------------------

function animateNumber(node, from, to) {
  if (skipping || reducedMotion() || from === to) { node.textContent = String(to); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    node.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateMetrics(metrics) {
  for (const [key] of METRICS) {
    const row = document.querySelector(`.metric[data-metric="${key}"]`);
    const value = metrics[key];
    const label = row.querySelector(".metric-head b");
    if (value === null) { label.textContent = T.pending; continue; }
    const before = lastMetrics && lastMetrics[key] !== null ? lastMetrics[key] : 0;
    row.querySelector(".bar i").style.width = `${value}%`;
    row.querySelector(".bar").setAttribute("aria-valuenow", String(value));
    animateNumber(label, before, value);
    row.classList.remove("bump", "dip");
    if (value !== before) {
      void row.offsetWidth;
      row.classList.add(value > before ? "bump" : "dip");
    }
  }
  lastMetrics = metrics;
}

function updateCounters(c) {
  $("cMade").textContent = String(c.claimsMade);
  $("cAccepted").textContent = String(c.claimsAccepted);
  $("cUnsupported").textContent = String(c.unsupported);
  $("cStruck").textContent = String(c.struckFigures);
  $("cStruckBox").classList.toggle("hot", c.struckFigures > 0);
}

function setSpeaker(agentId, round) {
  document.querySelectorAll("#roster li").forEach((li) => li.classList.toggle("on", li.dataset.agent === agentId));
  document.querySelectorAll(".round").forEach((node) => {
    const r = Number(node.dataset.round);
    node.classList.toggle("on", r === round);
    node.classList.toggle("done", round !== null && r < round);
  });
}

// --- Transcript ------------------------------------------------------------------------

function messageShell(agent, subtitle) {
  const li = el("li", "msg");
  li.style.setProperty("--c", agent.colour);
  const bubble = el("div", "bubble");
  const who = el("div", "who");
  who.append(el("b", "", agent.name), el("span", "", `${agent.role} · ${subtitle}`));
  bubble.append(who);
  li.append(avatar(agent), bubble);
  return { li, bubble };
}

function showTyping(agentId) {
  const agent = agents[agentId];
  const { li, bubble } = messageShell(agent, T.thinking);
  li.classList.add("typing");
  bubble.replaceChildren(el("span", "", T.preparing(agent.name)));
  const dots = el("span", "dots");
  dots.append(el("i"), el("i"), el("i"));
  bubble.append(dots);
  $("transcript").append(li);
  scrollTranscript();
  return li;
}

function addSystemNote(text) {
  $("transcript").append(el("li", "system", text));
  scrollTranscript();
}

function pill(status) {
  const [kind, label] = STATUS[status];
  return el("span", `pill ${kind}`, label);
}

async function renderClaims(bubble, claims) {
  if (!claims.length) return;
  const list = el("ul", "items");
  bubble.append(list);
  for (const c of claims) {
    const li = el("li", "claim");
    li.dataset.claim = c.id;
    const head = el("div", "claim-head");
    const status = el("span", "pill info", T.checkingQuote);
    head.append(el("b", "", `${c.id} · ${c.label}`), el("span", "score", `${c.score}/5`), el("span", "pill", c.source), status);
    li.append(head, el("q", "", c.quote));
    if (c.reason) li.append(el("div", "reason", c.reason));
    list.append(li);
    scrollTranscript();
    await wait(380);
    status.replaceWith(pill(c.status));
    li.classList.add(c.status, "flash");
    if (c.status !== "accepted") li.append(el("div", "note", c.note));
    await wait(160);
  }
}

function renderSentences(bubble, sentences) {
  const p = el("p", "sentences");
  const struck = [];
  sentences.forEach((s, i) => {
    if (i) p.append(document.createTextNode(" "));
    const span = el("span", "sentence", s.text);
    p.append(span);
    if (s.struck) {
      p.append(el("span", "strike-label", s.struck));
      struck.push(span);
    }
  });
  bubble.append(p);
  return struck;
}

function renderChallenges(bubble, challenges) {
  if (!challenges.length) return;
  const list = el("ul", "items");
  for (const ch of challenges) {
    const li = el("li", "claim");
    const head = el("div", "claim-head");
    head.append(el("b", "", T.challengeTo(agents[ch.targetAgent].name, ch.target, ch.label)), el("span", "pill warn", ISSUE_LABELS[ch.issue] || ch.issue));
    li.append(head);
    if (ch.note) li.append(el("div", "reason", ch.note));
    list.append(li);
    const target = document.querySelector(`.claim[data-claim="${ch.target}"] .claim-head`);
    if (target && !target.querySelector(".challenged")) target.append(el("span", "pill warn challenged", T.challenged));
  }
  bubble.append(list);
}

async function renderRevisions(bubble, revisions, changes) {
  if (!revisions.length && !changes.length) return;
  const list = el("ul", "items");
  bubble.append(list);
  for (const rv of revisions) {
    const li = el("li", "claim flash");
    const head = el("div", "claim-head");
    head.append(el("b", "", T.revised(rv.claim, rv.label)), el("span", "score", `${rv.from}/5 → ${rv.to}/5`), el("span", `pill ${rv.status === "accepted" ? "info" : rv.status === "struck" ? "bad" : "warn"}`, rv.note));
    li.append(head);
    if (rv.reason) li.append(el("div", "reason", rv.reason));
    list.append(li);
    const original = document.querySelector(`.claim[data-claim="${rv.claim}"] .score`);
    if (original && rv.status !== "struck") original.textContent = `${rv.from}/5 → ${rv.to}/5`;
    scrollTranscript();
    await wait(450);
  }
  for (const ch of changes) {
    const li = el("li", "claim flash");
    const head = el("div", "claim-head");
    head.append(el("b", "", T.reEstimated(ch.wp, ch.label)), el("span", "score", `${ch.from.o}/${ch.from.m}/${ch.from.p} → ${ch.to.o}/${ch.to.m}/${ch.to.p} ${T.days}`), el("span", "pill ok", T.rangeValid));
    li.append(head);
    list.append(li);
    scrollTranscript();
    await wait(350);
  }
}

function computedLine(bubble, label, text) {
  const div = el("div", "computed");
  div.append(el("b", "", `${label}: `), document.createTextNode(text));
  bubble.append(div);
}

function renderAssumptionItems(bubble, rows) {
  const list = el("ul", "items");
  for (const a of rows) {
    const li = el("li", `claim ${a.status}`);
    const head = el("div", "claim-head");
    head.append(el("b", "", a.label), el("span", "score", fmtAssumption(a.unit, a.value)), el("span", "pill", T.range(fmtAssumption(a.unit, a.low), fmtAssumption(a.unit, a.high))), pill(a.status));
    li.append(head);
    if (a.quote) li.append(el("q", "", a.quote));
    li.append(el("div", "note", a.note));
    list.append(li);
  }
  bubble.append(list);
}

async function renderScreen(passages) {
  addSystemNote(passages.length ? T.screenSome(String(passages.length)) : T.screenNone);
  await wait(400);
}

async function renderTurn(event) {
  if (event.sourceScreen) await renderScreen(event.sourceScreen);
  const agent = agents[event.agent];
  setSpeaker(event.agent, event.round);
  const { li, bubble } = messageShell(agent, T.round(event.round, KIND_LABELS[event.kind]));
  $("transcript").append(li);
  const struck = renderSentences(bubble, event.sentences);
  if (event.invalidReplies?.length) {
    bubble.append(el("span", "pill warn", T.invalidReplies(String(event.invalidReplies.length))));
  }
  scrollTranscript();
  await wait(500);
  struck.forEach((span) => span.classList.add("struck"));
  if (struck.length) await wait(700);

  await renderClaims(bubble, event.claims);
  renderChallenges(bubble, event.challenges);
  await renderRevisions(bubble, event.revisions, event.estimateChanges || []);
  if (event.estimate) {
    const e = event.estimate;
    computedLine(bubble, T.computedPert, T.pertLine(num(e.effort.low), num(e.effort.high), num(e.weeks.low), num(e.weeks.high), String(e.teamSize), moneyShort(e.cost.low), moneyShort(e.cost.high)));
  }
  if (event.assumptions) renderAssumptionItems(bubble, event.assumptions);
  if (event.finance) {
    const s = event.finance.scenarios;
    computedLine(bubble, T.computed, T.npvLine(moneyShort(s.pessimistic.npv), moneyShort(s.base.npv), moneyShort(s.optimistic.npv), num(s.base.roiPercent), months(s.base.paybackMonths)));
  }
  if (event.tier) computedLine(bubble, T.policyApplied, event.tier.overridden ? T.overridden(event.tier.label, event.tier.chairSuggestion) : T.asSuggested(event.tier.label));
  for (const note of event.notes || []) bubble.append(el("p", "small", note));
  if (event.usage) bubble.append(el("p", "small", T.tokens(num(event.usage.promptTokens + event.usage.completionTokens))));
  updateMetrics(event.metrics);
  updateCounters(event.counters);
  scrollTranscript();
}

// --- Brief ------------------------------------------------------------------------------

function clearSvg(id, viewBox) {
  const root = $(id);
  const desc = root.querySelector("desc");
  root.replaceChildren(desc);
  if (viewBox) root.setAttribute("viewBox", viewBox);
  return root;
}

function renderRadar(metrics) {
  const root = clearSvg("radar", "0 0 520 330");
  const cx = 260, cy = 165, R = 105;
  const n = METRICS.length;
  const angle = (i) => (-90 + i * (360 / n)) * (Math.PI / 180);
  const point = (i, v) => [cx + Math.cos(angle(i)) * R * v / 100, cy + Math.sin(angle(i)) * R * v / 100];
  for (const ring of [25, 50, 75, 100]) {
    root.append(svg("polygon", { points: METRICS.map((_, i) => point(i, ring).join(",")).join(" "), fill: "none", stroke: "rgba(255,255,255,.12)" }));
  }
  METRICS.forEach(([key, label], i) => {
    const [x, y] = point(i, 100);
    root.append(svg("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "rgba(255,255,255,.12)" }));
    const [lx, ly] = point(i, 118);
    const anchor = Math.abs(lx - cx) < 10 ? "middle" : lx > cx ? "start" : "end";
    const text = svg("text", { x: lx, y: ly + (ly < cy - 10 ? -8 : ly > cy + 10 ? 12 : 0), "text-anchor": anchor, "font-size": 14 });
    // Labels longer than the English ones break before their bracket: "Rischio / (più alto = minore)".
    const lines = label.length > 22 && label.includes(" (") ? [label.slice(0, label.indexOf(" (")), label.slice(label.indexOf(" (") + 1)] : [label];
    lines.forEach((line, n) => text.append(svg("tspan", { x: lx, dy: n ? 16 : lines.length > 1 && ly < cy ? -16 : 0 }, line)));
    text.append(svg("tspan", { x: lx, dy: 17, "font-weight": 700, fill: "#EAF0FF" }, String(metrics[key] ?? 0)));
    root.append(text);
  });
  const shape = svg("polygon", { fill: "rgba(110,231,255,.22)", stroke: "#6EE7FF", "stroke-width": 2, "stroke-linejoin": "round" });
  const dots = METRICS.map(() => svg("circle", { r: 3.5, fill: "#6EE7FF" }));
  root.append(shape, ...dots);
  const draw = (t) => {
    const pts = METRICS.map(([key], i) => point(i, (metrics[key] ?? 0) * t));
    shape.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
    pts.forEach(([x, y], i) => { dots[i].setAttribute("cx", x); dots[i].setAttribute("cy", y); });
  };
  if (skipping || reducedMotion()) { draw(1); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 900);
    draw(1 - Math.pow(1 - t, 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function figure(label, value) {
  const span = el("span", "", `${label} `);
  span.append(el("b", "", value));
  return span;
}

function renderEstimate(e) {
  $("estimateFigures").replaceChildren(
    figure(T.effort, T.personDays(num(e.effort.low), num(e.effort.high))),
    figure(T.duration, T.weeks(num(e.weeks.low), num(e.weeks.high))),
    figure(T.cost, `${moneyShort(e.cost.low)}–${moneyShort(e.cost.high)}`)
  );
  const root = clearSvg("estimateChart");
  const lo = e.cost.low - (e.cost.high - e.cost.low) * 0.6;
  const hi = e.cost.high + (e.cost.high - e.cost.low) * 0.6;
  const x = (v) => 20 + ((v - lo) / (hi - lo)) * 360;
  root.append(svg("rect", { x: 20, y: 40, width: 360, height: 12, rx: 6, fill: "rgba(255,255,255,.06)" }));
  root.append(svg("rect", { x: x(e.cost.low), y: 36, width: x(e.cost.high) - x(e.cost.low), height: 20, rx: 4, fill: "rgba(52,211,153,.25)", stroke: "#34D399" }));
  root.append(svg("line", { x1: x(e.cost.expected), y1: 30, x2: x(e.cost.expected), y2: 62, stroke: "#EAF0FF", "stroke-width": 2 }));
  root.append(svg("text", { x: x(e.cost.expected), y: 22, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "#EAF0FF" }, T.expected(moneyShort(e.cost.expected))));
  root.append(svg("text", { x: x(e.cost.low), y: 80, "text-anchor": "middle", "font-size": 12 }, `P10 ${moneyShort(e.cost.low)}`));
  root.append(svg("text", { x: x(e.cost.high), y: 80, "text-anchor": "middle", "font-size": 12 }, `P90 ${moneyShort(e.cost.high)}`));

  const head = el("tr");
  T.wpHead.forEach((h, i) => head.append(el("th", i > 1 ? "num" : "", h)));
  const rows = e.packages.map((p) => {
    const tr = el("tr");
    const name = el("td", "", p.label);
    name.append(el("div", "small", T.perDay(p.role, money(p.rate))));
    tr.append(name, el("td", "num", `${p.o} / ${p.m} / ${p.p}`), el("td", "num", num(p.expected)), el("td", "num", moneyCell(p.cost)));
    return tr;
  });
  const total = el("tr", "base");
  total.append(el("td", "", T.totalExpected), el("td", "num", ""), el("td", "num", num(e.effort.expected)), el("td", "num", moneyCell(e.cost.expected)));
  $("wpTable").replaceChildren(head, ...rows, total);
}

function renderFinance(f) {
  const root = clearSvg("npvChart");
  const values = SCENARIOS.map(([k]) => f.scenarios[k].npv);
  const max = Math.max(1, ...values.map(Math.abs));
  const hasNeg = values.some((v) => v < 0);
  const hasPos = values.some((v) => v > 0);
  const zero = hasNeg && hasPos ? 120 + 260 * (Math.abs(Math.min(...values)) / (Math.abs(Math.min(...values)) + Math.max(...values))) : hasNeg ? 380 : 120;
  const scale = hasNeg && hasPos ? 260 / (Math.abs(Math.min(...values)) + Math.max(...values)) : 260 / max;
  root.append(svg("line", { x1: zero, y1: 8, x2: zero, y2: 132, stroke: "rgba(234,240,255,.5)" }));
  root.append(svg("text", { x: zero, y: 146, "text-anchor": "middle", "font-size": 11 }, T.npvZero(money(0))));
  SCENARIOS.forEach(([key, label], i) => {
    const v = f.scenarios[key].npv;
    const y = 14 + i * 40;
    const w = Math.max(2, Math.abs(v) * scale);
    const x0 = v >= 0 ? zero : zero - w;
    root.append(svg("text", { x: 4, y: y + 17, "font-size": 13, fill: key === "base" ? "#EAF0FF" : undefined }, label));
    const bar = svg("rect", { x: x0, y, width: w, height: 24, rx: 4, fill: v >= 0 ? "rgba(52,211,153,.55)" : "rgba(248,113,113,.55)" });
    root.append(bar);
    const inside = w > 70;
    const tx = v >= 0 ? (inside ? x0 + w - 6 : x0 + w + 6) : (inside ? x0 + 6 : x0 - 6);
    const anchor = v >= 0 ? (inside ? "end" : "start") : (inside ? "start" : "end");
    root.append(svg("text", { x: tx, y: y + 17, "text-anchor": anchor, "font-size": 12.5, "font-weight": 700, fill: "#EAF0FF" }, moneyShort(v)));
  });

  const head = el("tr");
  T.scenarioHead.forEach((h, i) => head.append(el("th", i ? "num" : "", h)));
  const rows = SCENARIOS.map(([key, label]) => {
    const s = f.scenarios[key];
    const tr = el("tr", key === "base" ? "base" : "");
    tr.append(el("td", "", label), el("td", "num", moneyCell(s.npv)), el("td", "num", `${num(s.roiPercent)}%`), el("td", "num", s.paybackMonths === null ? T.beyond36 : T.mo(num(s.paybackMonths))));
    return tr;
  });
  $("scenarioTable").replaceChildren(head, ...rows);
  const b = f.scenarios.base;
  $("financeNote").textContent = T.financeNote(moneyShort(b.inputs.devCost), b.rows.map((r) => moneyShort(r.net)).join(IT ? "; " : ", "), String(Math.round(f.discountRate * 100)), String(f.horizonYears));
}

function renderTornado(f) {
  const rows = f.sensitivity;
  const root = clearSvg("tornado", `0 0 400 ${24 + rows.length * 32}`);
  const base = f.scenarios.base.npv;
  const all = rows.flatMap((r) => [r.npvWorst, r.npvBest]).concat(base);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const x = (v) => 150 + ((v - lo) / Math.max(1, hi - lo)) * 230;
  root.append(svg("line", { x1: x(base), y1: 4, x2: x(base), y2: 12 + rows.length * 32, stroke: "rgba(234,240,255,.55)", "stroke-dasharray": "3 3" }));
  rows.forEach((r, i) => {
    const y = 10 + i * 32;
    root.append(svg("text", { x: 0, y: y + 14, "font-size": 12.5, fill: i === 0 ? "#EAF0FF" : undefined }, SHORT_INPUTS[r.key]));
    const a = x(Math.min(r.npvWorst, r.npvBest));
    const b = x(Math.max(r.npvWorst, r.npvBest));
    root.append(svg("rect", { x: a, y, width: Math.max(2, x(base) - a), height: 18, fill: "rgba(248,113,113,.5)" }));
    root.append(svg("rect", { x: x(base), y, width: Math.max(2, b - x(base)), height: 18, fill: "rgba(52,211,153,.5)" }));
  });
  root.append(svg("text", { x: x(base), y: 24 + rows.length * 32 - 2, "text-anchor": "middle", "font-size": 11 }, T.baseMarker(moneyShort(base))));
  const top = f.top;
  $("sensitivityNote").textContent = T.sensitivityNote(top.label, moneyShort(rows[0].npvWorst), moneyShort(rows[0].npvBest));
}

function renderBrief(brief, model) {
  $("brief").hidden = false;
  const idea = config.ideas.find((i) => i.id === brief.ideaId);
  $("briefIdea").textContent = T.briefIdea(idea.title, idea.tagline, config.company.name);
  const label = $("tierLabel");
  label.textContent = brief.tier.label;
  label.className = `outcome-label ${brief.tier.id}`;
  $("tierRule").textContent = T.ruleLine(brief.tier.rule);
  const note = $("tierNote");
  note.className = brief.tier.overridden ? "small override" : "small";
  note.textContent = brief.tier.overridden
    ? T.overrideNote(brief.tier.chairSuggestion, brief.tier.label)
    : brief.tier.chairSuggestion ? T.matchNote(brief.tier.chairSuggestion) : "";
  renderRadar(brief.metrics);
  renderEstimate(brief.estimate);
  renderFinance(brief.finance);
  renderTornado(brief.finance);

  $("assumptionList").replaceChildren(...brief.assumptions.map((a) => {
    const s = brief.finance.scenarios;
    const li = el("li", "", T.inBase(a.label, fmtAssumption(a.unit, a.value)));
    li.append(el("span", "", T.rangeLine(a.rangeSources.join(", "), fmtAssumption(a.unit, a.low), fmtAssumption(a.unit, a.high), fmtAssumption(a.unit, s.pessimistic.inputs[a.key]), fmtAssumption(a.unit, s.optimistic.inputs[a.key]))));
    li.append(el("span", "", `${STATUS[a.status][1]}. ${a.note}`));
    return li;
  }));

  $("mindList").replaceChildren(...brief.mindChangers.map((m) => {
    const li = el("li", "", m.text);
    li.append(el("span", "", m.by === "code" ? T.byCode : T.byChair));
    return li;
  }));
  const x = brief.experiment;
  const exp = el("ul", "list");
  const item = el("li", "", x.label);
  item.append(el("span", "", T.experimentLine(x.targets, String(x.weeks), money(x.cost), x.breakdown.map((b) => T.breakdownItem(b.role, String(b.days), money(b.rate))).join(", "))));
  item.append(el("span", "", x.reason));
  exp.append(item);
  $("experiment").replaceChildren(exp);

  $("dissentList").replaceChildren(...(brief.dissent.length ? brief.dissent.map((d) => {
    const li = el("li", "", `${d.agents.map((id) => agents[id].name).join(T.versus)} · ${d.topic}`);
    li.append(el("span", "", d.note));
    return li;
  }) : [el("li", "", T.noDissent)]));

  const c = brief.counters;
  $("sMade").textContent = String(c.claimsMade);
  $("sAccepted").textContent = String(c.claimsAccepted);
  $("sUnsupported").textContent = String(c.unsupported);
  $("sStruck").textContent = String(c.struckFigures);
  $("sScreened").textContent = String(c.screenedPassages);
  $("sTokens").textContent = brief.mode === "live" ? num(brief.usage.promptTokens + brief.usage.completionTokens) : "0";
  $("sMode").textContent = brief.mode === "live"
    ? T.liveSummary(model, String(brief.usage.llmTurns), num(brief.usage.promptTokens), num(brief.usage.completionTokens))
    : T.recordedSummary(model);

  document.querySelectorAll("#decisionActions button").forEach((b) => b.setAttribute("aria-pressed", "false"));
  $("decisionRecord").textContent = "";
  $("decisionActions").dataset.tier = brief.tier.id;
  setSpeaker(null, 4);
  $("brief").scrollIntoView({ behavior: skipping || reducedMotion() ? "auto" : "smooth", block: "start" });
}

$("decisionActions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-decision]");
  if (!button) return;
  document.querySelectorAll("#decisionActions button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  const time = new Date().toLocaleTimeString(IT ? "it-IT" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const advised = $("tierLabel").textContent;
  const differs = button.dataset.decision !== $("decisionActions").dataset.tier;
  $("decisionRecord").textContent = T.decisionRecord(time, button.textContent, advised) + (differs ? T.departed : "");
});

// --- Run loop: one request per turn, the next one prefetched while this one animates ------

async function requestTurn(body) {
  try {
    const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { httpError: data.error || `HTTP ${res.status}` };
    return data;
  } catch {
    return { httpError: T.networkError };
  }
}

function resetView() {
  $("transcript").replaceChildren();
  $("brief").hidden = true;
  lastMetrics = null;
  renderMetricBars();
  updateCounters({ claimsMade: 0, claimsAccepted: 0, unsupported: 0, struckFigures: 0 });
  setSpeaker(null, null);
}

async function run(ideaId, mode, notice) {
  const token = ++runToken;
  resetView();
  setMode(mode, config.model);
  const order = config.turnOrder;
  let pending = requestTurn({ start: { ideaId, mode, locale: LOCALE } });
  if (!notice) {
    $("runStatus").textContent = T.gathering;
    await renderResearch(config.ideas.find((i) => i.id === ideaId));
    if (token !== runToken) return;
    $("runStatus").textContent = T.inSession;
  } else addSystemNote(notice);
  for (let i = 0; i < order.length; i++) {
    const typing = showTyping(order[i].agent);
    setSpeaker(order[i].agent, order[i].round);
    const [res] = await Promise.all([pending, wait(900)]);
    if (token !== runToken) return;
    typing.remove();
    if (res.fallback || res.httpError) {
      const reason = res.reason || T.serviceError(res.httpError);
      if (mode === "live") return run(ideaId, "recorded", T.switched(reason.replace(/\.$/, "")));
      addSystemNote(T.recordingFailed(res.httpError || reason));
      return;
    }
    setMode(res.mode, res.model);
    if (!res.done) pending = requestTurn({ state: res.state });
    await renderTurn(res.event);
    if (token !== runToken) return;
    if (res.done) {
      renderBrief(res.brief, res.model);
      return;
    }
    await wait(350);
  }
}

$("runForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (running || !config) return;
  running = true;
  skipping = false;
  $("runButton").disabled = true;
  $("skipButton").disabled = false;
  try {
    await run(selectedIdea().id, config.mode);
  } finally {
    running = false;
    skipping = false;
    $("runButton").disabled = false;
    $("skipButton").disabled = true;
    $("runStatus").textContent = "";
  }
});

$("skipButton").addEventListener("click", () => {
  skipping = true;
  $("skipButton").disabled = true;
  $("runStatus").textContent = T.skipping;
});

loadConfig();
