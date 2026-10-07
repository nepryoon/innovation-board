// Synthetic data for the Innovation Board demo: an invented company, three invented product ideas and
// an invented evidence pack for each. Every organisation, source, quote and figure here is fictional and
// is not modelled on any real company, product, vendor or report.

export const COMPANY = {
  name: "Brindlecote Systems (synthetic)",
  sector: "B2B software: scheduling and job management for building-maintenance contractors",
  size: "240 staff, 1,100 customer firms, £21m annual recurring revenue",
  priorities: [
    "Grow revenue from existing customers with add-ons to the current products",
    "Reduce cost-to-serve in support and finance operations",
    "Keep the core platform reliable and avoid bets that need a new sales channel"
  ],
  products: [
    "Brindle Dispatch: job scheduling for contractors",
    "Brindle Field: the technicians' mobile app",
    "Brindle Ledger: invoicing and payments"
  ],
  capacity: "One product squad of 5 people is free for a new initiative next quarter, at 4 productive days a week each.",
  teamSize: 5,
  daysPerWeek: 4,
  // Day rates in GBP (synthetic).
  rateCard: {
    pm: { label: "Product manager", rate: 650 },
    engineer: { label: "Software engineer", rate: 600 },
    data: { label: "Data engineer", rate: 640 },
    designer: { label: "Designer", rate: 550 },
    qa: { label: "QA engineer", rate: 480 }
  },
  discountRate: 0.1,
  horizonYears: 3
};

// Investment policy (synthetic). Thresholds are applied by code, top tier first.
export const POLICY = {
  investNow: { strategicFit: 60, evidenceStrength: 60, paybackMonths: 24 },
  pilot: { strategicFit: 50, evidenceStrength: 45 },
  note: "Code classifies every idea from these thresholds. The Chair may suggest a tier; where the rule disagrees, the rule wins and the page says so."
};

export const TIERS = {
  invest: "Invest now",
  pilot: "Run a pilot",
  explore: "Explore further",
  park: "Park"
};

export const AGENTS = {
  strategy: { id: "strategy", name: "Ada", role: "Strategy Lead", colour: "#6EE7FF", glyph: "compass" },
  market: { id: "market", name: "Milo", role: "Market Analyst", colour: "#A78BFA", glyph: "trend" },
  delivery: { id: "delivery", name: "Dara", role: "Delivery Lead", colour: "#34D399", glyph: "blocks" },
  finance: { id: "finance", name: "Fen", role: "Finance Analyst", colour: "#FBBF24", glyph: "coin" },
  auditor: { id: "auditor", name: "Vera", role: "Evidence Auditor", colour: "#F87171", glyph: "lens" },
  chair: { id: "chair", name: "Sol", role: "Chair", colour: "#EAF0FF", glyph: "gavel" }
};

// Each assessor scores its own dimensions (1 to 5). For risk, 5 means low risk.
export const DIMENSIONS = {
  fit: { label: "Strategic fit", agents: ["strategy"] },
  market: { label: "Market pull", agents: ["market"] },
  feasibility: { label: "Feasibility", agents: ["delivery"] },
  risk: { label: "Risk (5 = low)", agents: ["delivery"] }
};

export function dimensionsFor(agentId) {
  return Object.keys(DIMENSIONS).filter((d) => DIMENSIONS[d].agents.includes(agentId));
}

// Source quality grades used in the evidence-strength formula.
export const SOURCE_TYPES = {
  interview: { label: "Customer interview", grade: "primary" },
  survey: { label: "Survey", grade: "primary" },
  "sales-data": { label: "Internal sales data", grade: "primary" },
  "support-data": { label: "Internal support data", grade: "primary" },
  "internal-data": { label: "Internal operations data", grade: "primary" },
  spike: { label: "Technical spike", grade: "primary" },
  "market-report": { label: "Market report excerpt", grade: "secondary" },
  competitor: { label: "Competitor notes", grade: "secondary" },
  "trend-article": { label: "Trend article", grade: "promotional" },
  "vendor-blog": { label: "Vendor blog", grade: "promotional" },
  keynote: { label: "Keynote summary", grade: "promotional" }
};

export const GRADE_WEIGHTS = { primary: 1, secondary: 0.6, promotional: 0.2 };

export const ASSUMPTION_KEYS = ["price", "adoption", "churn", "running"];

export const IDEAS = {
  "inspection-planner": {
    id: "inspection-planner",
    title: "Inspection Planner",
    tagline: "Add-on that plans statutory inspections and chases certificates",
    profile: "Strong evidence of need, good fit",
    pitch: "An add-on to Brindle Dispatch that plans recurring statutory inspections (fire alarms, emergency lighting, gas appliances) across a contractor's client sites, stores the certificates and warns before deadlines. Contractors keep these schedules in spreadsheets beside our product today. It would be sold to existing customers as an annual add-on per customer firm.",
    unit: "customer firm",
    assumptions: {
      price: { label: "Price per customer firm per year", unit: "gbp", low: 1500, high: 2400, sources: ["s1"] },
      adoption: { label: "New customer firms per year", unit: "count", low: 80, high: 160, sources: ["s6"] },
      churn: { label: "Annual churn", unit: "percent", low: 5, high: 10, sources: ["s6"] },
      running: { label: "Running cost per year", unit: "gbp", low: 50000, high: 80000, sources: ["s9"] }
    },
    workPackages: [
      { id: "w1", label: "Inspection rules and schedule engine", role: "engineer" },
      { id: "w2", label: "Certificate store and deadline reminders", role: "engineer" },
      { id: "w3", label: "Dispatch integration and spreadsheet migration", role: "data" },
      { id: "w4", label: "Planner screens and usability testing", role: "designer" },
      { id: "w5", label: "Testing and pilot support", role: "qa" }
    ],
    experiments: [
      { id: "x1", label: "Pre-order page for the add-on shown to 300 customer firms", targets: "adoption", weeks: 4, days: { pm: 4, designer: 3, engineer: 3 } },
      { id: "x2", label: "Two-price offer to 40 accounts through account managers", targets: "price", weeks: 6, days: { pm: 6, designer: 2 } },
      { id: "x3", label: "Migration test on 10 customers' real inspection spreadsheets", targets: "devCost", weeks: 3, days: { data: 8, qa: 3 } }
    ],
    sources: [
      { id: "s1", type: "sales-data", agent: "strategy", date: "2026-07-03", title: "Lost-deal analysis, first half of 2026",
        text: "Sales recorded 214 lost or stalled deals in the first half of 2026. In 61 of them the prospect named inspection tracking as a gap, most often fire alarm and emergency lighting checks. Three competitors were mentioned as offering it. Account managers estimate that existing customers would accept an add-on priced between £1,500 and £2,400 per year." },
      { id: "s2", type: "support-data", agent: "delivery", date: "2026-06-30", title: "Support ticket themes, 12 months to June 2026",
        text: "Of 9,800 support tickets, 1,240 asked how to schedule recurring inspections or attach certificates to jobs. Agents currently suggest workarounds with repeating jobs, which break when a client site changes. Median handling time for these tickets is 22 minutes, above the overall median of 14 minutes." },
      { id: "s3", type: "interview", agent: "market", date: "2026-05-12", title: "Customer interview: regional fire-safety contractor",
        text: "We track about three thousand inspection dates in two spreadsheets and a whiteboard. Missing one costs us the contract, not just a fine. If Dispatch planned the inspections and chased the certificates, I would pay for it tomorrow, provided it reads our existing site list. Our coordinators would stop double-checking dates every Friday." },
      { id: "s4", type: "interview", agent: "market", date: "2026-05-19", title: "Customer interview: small building-maintenance firm",
        text: "Inspections are maybe a fifth of our work. Honestly, our spreadsheet works most of the time. I would want to see it save my coordinator a day a week before paying extra. Price matters more to us than features, and we already pay for three add-ons we barely use." },
      { id: "s5", type: "survey", agent: "market", date: "2026-05-30", title: "Customer survey, May 2026 (212 customer firms)",
        text: "58% of respondents manage statutory inspections for their clients. Of those, 41% rated a built-in inspection planner as their most wanted feature. 34% said they would probably buy it as an add-on and 12% said definitely. Firms with more than 50 technicians were twice as likely to say definitely." },
      { id: "s6", type: "sales-data", agent: "strategy", date: "2026-06-18", title: "Customer success forecast note",
        text: "Customer success reviewed the survey with account managers. They expect 80 to 160 customer firms to adopt in each of the first three years if the add-on launches to the whole base. Comparable add-ons lost between 5% and 10% of subscribers a year. Two large accounts asked for a launch date in writing." },
      { id: "s7", type: "market-report", agent: "market", date: "2026-04-08", title: "Sector report excerpt: maintenance compliance software",
        text: "Compliance scheduling is becoming a standard expectation in maintenance software tenders. Buyers increasingly ask for audit trails of inspection certificates. The report sizes the UK segment at £140m but notes that the estimate relies on vendor-reported revenue and may double-count bundled products." },
      { id: "s8", type: "competitor", agent: "market", date: "2026-06-02", title: "Competitor notes: two rival scheduling products",
        text: "One rival launched an inspection module last year, priced into its top plan. Customers we interviewed describe it as rigid: rules cannot vary by client site. A second rival offers reminders only, without certificate storage. Neither integrates with a technician app, which is where certificates are actually captured." },
      { id: "s9", type: "spike", agent: "delivery", date: "2026-07-10", title: "Technical spike: inspection schedule engine",
        text: "A short spike built a rules engine for 12 inspection types on the existing job model. Recurrence and certificate expiry worked well. Migrating customers' spreadsheets did not, because site names rarely match our records. Running cost is estimated at £50,000 to £80,000 a year, mostly storage and support." }
    ]
  },
  "field-copilot": {
    id: "field-copilot",
    title: "Field Copilot AI",
    tagline: "Generative AI assistant that diagnoses faults from photos and voice",
    profile: "Fashionable, thin evidence of demand",
    pitch: "A generative AI assistant inside Brindle Field that listens to technicians, looks at photos of faulty equipment, diagnoses the fault on the spot and writes the job report automatically. Positioned as a revolutionary leap: an autonomous expert in every technician's pocket, sold as a premium add-on that puts us ahead of an AI wave reshaping the industry.",
    unit: "customer firm",
    assumptions: {
      price: { label: "Price per customer firm per year", unit: "gbp", low: 600, high: 1500, sources: ["s5"] },
      adoption: { label: "New customer firms per year", unit: "count", low: 10, high: 60, sources: ["s9"] },
      churn: { label: "Annual churn", unit: "percent", low: 15, high: 35, sources: ["s8"] },
      running: { label: "Running cost per year", unit: "gbp", low: 120000, high: 220000, sources: ["s7"] }
    },
    workPackages: [
      { id: "w1", label: "Photo and voice diagnosis models", role: "data" },
      { id: "w2", label: "Labelled fault data collection", role: "data" },
      { id: "w3", label: "Copilot experience in the mobile app", role: "engineer" },
      { id: "w4", label: "Report generation and job integration", role: "engineer" },
      { id: "w5", label: "Safety review and field trials", role: "qa" }
    ],
    experiments: [
      { id: "x1", label: "Concierge test: a person writes job reports from voice notes for 5 firms", targets: "adoption", weeks: 6, days: { pm: 6, engineer: 4 } },
      { id: "x2", label: "Accuracy test on 2,000 labelled fault photos", targets: "running", weeks: 6, days: { data: 15, qa: 5 } },
      { id: "x3", label: "Willingness-to-pay interviews with 12 customer firms", targets: "price", weeks: 3, days: { pm: 6, designer: 2 } }
    ],
    sources: [
      { id: "s1", type: "trend-article", agent: "market", date: "2026-03-14", title: "Trend article: “The autonomous technician is here”",
        text: "Generative AI will transform field service beyond recognition. Industry watchers say the AI field-service market will reach £48bn by 2030, growing 37% a year. Early adopters report first-time fix rates rising by 40%. Contractors that wait risk being left behind by a wave of AI-native competitors." },
      { id: "s2", type: "vendor-blog", agent: "market", date: "2026-05-02", title: "Vendor blog: copilots for the trades",
        text: "Our customers tell us copilots pay for themselves within 3 months. One installer cut report writing time by 90% after switching on voice notes. Every technician deserves an expert in their pocket, and the technology is finally ready for the van." },
      { id: "s3", type: "keynote", agent: "strategy", date: "2026-06-11", title: "Conference keynote summary: the future of maintenance",
        text: "The keynote predicted that 70% of maintenance visits will involve an AI assistant within five years. The speaker urged software providers to go all in on agents and argued that customers will pay a premium for anything labelled AI. No data sources were given for the predictions." },
      { id: "s4", type: "interview", agent: "market", date: "2026-06-20", title: "Customer interview: heating and plumbing contractor",
        text: "It sounds clever, but my technicians won't talk to a phone in a customer's kitchen. What would help is the report writing; that takes them 20 minutes a job. I would not pay much for diagnosis: the experienced ones know the fault, and the new ones phone a supervisor." },
      { id: "s5", type: "survey", agent: "market", date: "2026-07-08", title: "Pulse survey, July 2026 (14 customer firms)",
        text: "Of 14 firms asked, five said they were interested in an AI assistant for technicians, two said they would pay for it, and seven were worried about wrong diagnoses on gas or electrical faults. Most interest came from very small firms. Respondents suggested a price between £600 and £1,500 per year." },
      { id: "s6", type: "support-data", agent: "delivery", date: "2026-06-30", title: "Support tickets and feature requests, 12 months to June 2026",
        text: "Three of 9,800 support tickets asked for AI features. Report writing in Brindle Field produced 410 tickets, mainly about lost photos and slow uploads on poor mobile signal. Customer votes rank voice notes 23rd of 40 feature requests, and nobody has asked for photo diagnosis." },
      { id: "s7", type: "spike", agent: "delivery", date: "2026-07-15", title: "Technical spike: photo fault diagnosis",
        text: "A spike tested a general vision model on 300 labelled photos of boiler and alarm faults. It named the correct fault 58% of the time, and technicians judged one answer in five unsafe to act on. Useful accuracy would need far more labelled photos than we hold. Inference and human review would cost £120,000 to £220,000 a year." },
      { id: "s8", type: "competitor", agent: "market", date: "2026-07-01", title: "Competitor notes: AI announcements",
        text: "Two rivals announced AI assistants this year. Neither has published customer numbers or accuracy results, and one remains in a waiting-list beta. A former customer of one rival called the assistant a demo, not a tool. Analysts expect churn on early AI add-ons to run between 15% and 35% a year as novelty fades." },
      { id: "s9", type: "sales-data", agent: "strategy", date: "2026-06-25", title: "Sales pipeline note, June 2026",
        text: "Prospects ask about AI in roughly one demo in four, usually as a general question rather than a requirement. No lost deal in the first half of 2026 named AI as the reason. Account managers think between 10 and 60 firms a year might buy a premium AI add-on, mostly smaller firms." }
    ]
  },
  "payment-matching": {
    id: "payment-matching",
    title: "Automatic Payment Matching",
    tagline: "Internal service that matches payments to invoices for the finance team",
    profile: "Unglamorous internal efficiency, modest upside",
    pitch: "An internal service that matches customers' subscription payments to invoices automatically and sends only the exceptions to the finance team. Two finance assistants reconcile most accounts by hand each month. There is no new revenue: the case rests on staff time saved and fewer billing errors reaching customers.",
    unit: "account",
    assumptions: {
      price: { label: "Saving per account per year", unit: "gbp", low: 110, high: 180, sources: ["s1"] },
      adoption: { label: "Accounts moved to automatic matching per year", unit: "count", low: 250, high: 400, sources: ["s6"] },
      churn: { label: "Accounts falling back to manual matching per year", unit: "percent", low: 5, high: 15, sources: ["s6"] },
      running: { label: "Running cost per year", unit: "gbp", low: 15000, high: 30000, sources: ["s5"] }
    },
    workPackages: [
      { id: "w1", label: "Matching rules engine", role: "engineer" },
      { id: "w2", label: "Bank file import and invoice data feed", role: "data" },
      { id: "w3", label: "Exception review screen for finance", role: "engineer" },
      { id: "w4", label: "Parallel run and testing", role: "qa" },
      { id: "w5", label: "Finance rollout and training", role: "pm" }
    ],
    experiments: [
      { id: "x1", label: "Shadow run: match one month of payments alongside the manual process", targets: "price", weeks: 5, days: { engineer: 6, qa: 4, pm: 2 } },
      { id: "x2", label: "Direct-debit pilot on 50 accounts", targets: "adoption", weeks: 8, days: { engineer: 8, pm: 3 } },
      { id: "x3", label: "Exception-rate check on three months of partial payments", targets: "churn", weeks: 3, days: { data: 5, qa: 2 } }
    ],
    sources: [
      { id: "s1", type: "internal-data", agent: "strategy", date: "2026-07-05", title: "Finance operations time log, second quarter of 2026",
        text: "Two finance assistants spent 41% of their time on payment reconciliation in the quarter. Each account takes about 25 minutes a month to reconcile by hand. Finance estimates the saving at £110 to £180 per account per year once matching is automatic, counting staff time and fewer credit notes." },
      { id: "s2", type: "interview", agent: "market", date: "2026-06-09", title: "Interview: finance operations lead",
        text: "Month end is the bottleneck. We reconcile in the evenings to close on time, and errors turn into wrong reminder letters to customers. I do not need anything clever: match the obvious ones and show me the rest. The bank file format changed twice last year, which broke our macros." },
      { id: "s3", type: "interview", agent: "market", date: "2026-06-11", title: "Interview: customer support team lead",
        text: "Billing questions are our second-largest ticket type. Most start with a payment we applied to the wrong invoice. If finance matched payments correctly, I think billing tickets would fall noticeably, but I could not put a number on it and I would not promise it." },
      { id: "s4", type: "support-data", agent: "delivery", date: "2026-06-30", title: "Billing ticket analysis, 12 months to June 2026",
        text: "Billing tickets numbered 1,630, of which 520 related to misapplied payments. Average handling time was 19 minutes. Misapplied payments also triggered 140 incorrect reminder letters, and 9 customers cited billing errors when cancelling their subscription. Support leads expect most of these cases to disappear once matching is reliable." },
      { id: "s5", type: "spike", agent: "delivery", date: "2026-07-12", title: "Technical spike: matching rules on historic payments",
        text: "We replayed six months of payments against invoices. Simple rules on reference and amount matched 82% of payments automatically; fuzzy matching on customer names added 9 points but produced false matches that finance must review. Running cost would be £15,000 to £30,000 a year." },
      { id: "s6", type: "internal-data", agent: "strategy", date: "2026-07-18", title: "Finance roll-out plan, draft",
        text: "Finance proposes moving 250 to 400 accounts a year onto automatic matching, starting with direct-debit customers, whose references are cleanest. Accounts with irregular payments would stay manual. The team expects 5% to 15% of moved accounts to fall back to manual matching each year." },
      { id: "s7", type: "market-report", agent: "market", date: "2026-03-20", title: "Benchmark note: finance automation in mid-sized software firms",
        text: "Mid-sized software firms that automated payment matching reported shorter month-end closes, typically by two to four days. The note warns that benefits depend on clean payment references, and that staff time saved is often redeployed to other work rather than removed from the budget." },
      { id: "s8", type: "competitor", agent: "delivery", date: "2026-05-28", title: "Review of packaged reconciliation tools",
        text: "Finance reviewed two packaged reconciliation tools. Both need our invoice data exported nightly, and their licences would cost more than building the matching rules ourselves. Neither handles our partial payments for multi-site contracts, which make up 12% of invoices, so a manual queue would remain either way." },
      { id: "s9", type: "survey", agent: "market", date: "2026-07-02", title: "Finance team pulse check (six staff)",
        text: "All six finance staff rated reconciliation as their most tedious task. Four worried that automation could hide mistakes unless exceptions are easy to review. Two asked for training time, which the team lead estimates at 3 days per person. Nobody expected to lose their role over it." }
    ]
  }
};

export function sourceMap(ideaId) {
  return Object.fromEntries(IDEAS[ideaId].sources.map((s) => [s.id, s]));
}

export function sourceIds(ideaId) {
  return IDEAS[ideaId].sources.map((s) => s.id);
}

export function experimentCost(experiment) {
  return Object.entries(experiment.days).reduce((sum, [role, days]) => sum + days * COMPANY.rateCard[role].rate, 0);
}
