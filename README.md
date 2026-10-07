# Innovation Board

**Live demo:** https://www.neuromorphicinference.com/demos/innovation-board/

A board of six AI agents assesses the commercial potential of a software product idea and debates it in a
live, chat-style view. Every claim must quote the evidence, figures that nobody can trace are struck from
the record, and code computes the development estimate, the cash flows, ROI, NPV, payback and the
investment tier. The board never decides: it prepares a brief for the person who holds the budget.

> Synthetic company, ideas and sources. Simulated research. Decision support only: a person makes every
> investment decision.

The demo shows two things at once: that a multi-agent workflow can be pleasant to watch and useful to
someone who approves budgets, and that the numbers in an AI-written investment case can be governed by code
rather than by good intentions in a prompt.

## What the demo shows

The company is invented: **Brindlecote Systems (synthetic)**, a 240-person B2B software firm selling
scheduling and job-management software to building-maintenance contractors. Its profile includes strategy
priorities, existing products, one free product squad, a rate card, a 10% discount rate and an investment
policy. Visitors choose one of three invented ideas:

- **Inspection Planner**: a strong idea with solid evidence of customer need and a good fit (lost-deal data,
  support tickets, a 212-firm survey, interviews that partly disagree, a technical spike).
- **Field Copilot AI**: a fashionable idea with exciting language and thin evidence of demand. Its pack
  leans on a trend article, a vendor blog and a keynote summary; the real customer evidence is weak or
  negative. This is the trap: it lets the Evidence Auditor and the unverified-figure filter be seen working.
- **Automatic Payment Matching**: a sound but unglamorous internal efficiency product with modest upside
  and low risk.

| Agent | Role in the debate |
| --- | --- |
| Ada, Strategy Lead | Fit with the company's strategy, products and capabilities. |
| Milo, Market Analyst | Trends, customer needs and competition. |
| Dara, Delivery Lead | Feasibility, scope and risk; three-point effort estimates per work package. |
| Vera, Evidence Auditor | Challenges optimism, unsupported claims and unverified figures. |
| Fen, Finance Analyst | Proposes price, adoption, churn and running cost; explains the results code computes. |
| Sol, Chair | Summarises, records dissent, suggests a tier; code applies the policy. |

The page runs in four parts:

1. **Research (simulated).** Each idea has a fixed evidence pack of nine short synthetic sources (market
   report excerpts, customer interviews, a survey, competitor notes, internal sales and support data, a
   technical spike). The sources appear one by one under the agent that "retrieves" them. Code screens the
   pack first and strikes figures in promotional sources that give no method or primary data. A production
   version would replace the pack with web search, internal data connectors and document retrieval, keeping
   the same citation check.
2. **Debate.** Ten turns in three rounds, with a typing indicator, live score bars, claims that turn green,
   amber or red as code checks them, and a strike-through animation for unverified figures.
3. **Brief.** A radar of six metrics; development time and cost as ranges with the work-package breakdown;
   pessimistic, base and optimistic NPV, ROI and payback; a sensitivity chart; the tier and the rule that
   produced it (and a note when code overrides the Chair); key assumptions with their evidence ranges;
   what would change the board's mind; the cheapest next experiment costed from the rate card; the dissent
   log and the audit counters.
4. **Human decision.** Four buttons (Invest now, Run a pilot, Explore further, Park). The choice is shown
   on the page only; nothing is stored or sent.

## Architecture

```
Browser (fixed turn order, animation)            Cloudflare Pages Function  POST /api/board/turn
  │  { start: { ideaId } }  ─────────────────▶   1. validate body (allow-listed idea ID only)
  │  or { state }  (signed, compact)              2. verify state: structure + HMAC signature
  │                                               3. one agent turn:
  │                                                    live: DeepSeek chat completions, JSON reply,
  │                                                          one retry on an invalid reply
  │                                                    recorded: the saved live transcript for the idea
  │                                               4. guardrails: citation check, source screen,
  │                                                  unverified-figure filter, range checks
  │                                               5. code computes metrics, PERT estimate, cash flows,
  │                                                  sensitivity, tier, next experiment
  ◀──────────── { event, state (re-signed), brief when done } or { fallback: true, reason }
```

- **One agent turn per HTTP request.** The orchestrator fixes the order (three openings, the audit, three
  responses, the Finance Analyst's assumptions, the Finance Analyst's explanation, the Chair) and caps the
  run at ten turns. The page prefetches the next turn while the current one animates.
- **No server-side session.** The compact run state (claims, short summaries, challenges, estimates,
  assumptions, counters) travels with each request. The server validates its shape, allow-listed IDs, the
  estimate ranges and the assumption bounds, and verifies an HMAC-SHA256 signature. The key is
  `BOARD_STATE_SECRET`, else `PANEL_STATE_SECRET`, else derived from the LLM key as the Hiring Panel does.
- **Short prompts.** Each prompt is built on the server from the company profile, the idea, the evidence
  pack and the compact state; the output limit is 220 to 650 tokens depending on the turn. Thinking is
  disabled and `reasoning_content` is never read or forwarded. Model `deepseek-flash`, overridable with
  `BOARD_LLM_MODEL`. Live runs used about 1,300 to 2,300 tokens per turn and 17,500 to 18,200 per run.
- **Recorded fallback.** Each idea was run live and saved as JSON in
  `site/demos/innovation-board/recordings/`. If the key is missing, the provider errors (after one short
  retry) or a turn is invalid twice, the page restarts the run in recorded mode and the badge reads
  "Recorded run". Recorded turns go through the same Function, validation, guardrails and computations.

## Guardrails (enforced in code)

- **Citation check.** Every scored claim and every financial assumption names a source id and a quote. The
  quote must be a real substring of that source after normalising case, whitespace, quotation marks and
  dashes, and must not come from a passage the source screen struck. Otherwise the claim is "unsupported"
  and excluded; an unsupported assumption falls back to the cautious end of its evidence range.
- **Unverified-figure filter.** Any number with a unit (currency, percentage, market size, customers or
  users, time) in an agent's statement must appear in a source passage that passed the screen, the company
  profile, the evidence ranges, or the values code computed in this run. Rounding to the written precision
  is allowed ("£438k" for £437,912). Otherwise the sentence is struck from the record with the label
  "unverified figure" and excluded from later prompts; a claim whose reason holds one is struck and does not
  count. Before the debate, the same rule screens the evidence pack: figures in promotional sources (trend
  articles, vendor blogs, keynotes) are struck because they give no method or primary data.
- **Estimates validated, then computed.** The Delivery Lead gives optimistic, likely and pessimistic
  person-days per work package; code requires whole days from 1 to 400, o ≤ m ≤ p and p ≤ 6o, or the turn
  is rejected and retried.
- **Assumptions bounded.** Each assumption must lie inside the range the evidence pack supports; values
  outside it are clamped and flagged.
- **Classification by code.** The investment policy's thresholds decide the tier. The Chair may suggest
  one; when the rule disagrees, the rule wins and the page says so.
- **No visitor text reaches the model.** Visitors choose an idea from an allow-list; there is no free-text
  field or upload.

## Formulas

```
Dimension score   = 20 × mean of accepted 1-to-5 scores (strategic fit, market pull, feasibility, risk)
Evidence strength = 100 × (accepted ÷ claims made) × Σ q·score ÷ (5·Σ q), over accepted claims;
                    q = 1 primary, 0.6 secondary, 0.2 promotional source
Financial return  = clamp(40 + 30 × base-case ROI, 0, 100)

PERT per package  E = (o + 4m + p) ÷ 6, σ = (p − o) ÷ 6; total σ = √Σσ²; range = E ± 1.28σ (about 80%)
Duration (weeks)  = person-days ÷ (squad size 5 × 4 productive days)
Cost              = Σ person-days × role day rate

Customers         C₀ = 0; Cₜ = Cₜ₋₁ × (1 − churn) + adoption
Revenue (saving)  = price × (Cₜ₋₁ + Cₜ) ÷ 2;  net = revenue − running cost
NPV               = −development cost + Σ netₜ ÷ 1.1ᵗ, t = 1..3
ROI               = (Σ net − development cost) ÷ development cost
Payback           = month when cumulative cash (from −development cost) reaches zero, linear in the year

Scenarios         pessimistic / optimistic = cautious / favourable end of every evidence range and the
                  high / low end of the cost range; base = the Finance Analyst's verified values and the
                  expected cost. Sensitivity moves one input at a time across its range; the break-even
                  value of the biggest mover is found by bisection.

Tier (first match) Invest now: fit ≥ 60, evidence ≥ 60, base NPV > 0, payback ≤ 24 months
                   Run a pilot: fit ≥ 50, evidence ≥ 45, base NPV > 0
                   Explore further: optimistic NPV > 0
                   Park: otherwise
Next experiment   = cheapest listed experiment that tests the biggest mover; cost from the rate card
```

## Limits

The figures illustrate a method on invented data and are not forecasts. The company, the ideas, the
evidence packs, the rate card and every number are synthetic and are not modelled on any real
organisation, vendor or report; the research phase is simulated. The three-year model has four assumptions
and leaves out tax, inflation, financing, cannibalisation and the opportunity cost of the squad. The
language model can still misread a source within the rules: the checks guarantee that what counts is
traceable to the evidence or to the code, not that it is right. ROI below −100% is possible when running
costs exceed revenue. A person makes every investment decision.

## Run locally

Requirements: Node 20 or later. There are no runtime dependencies and no build step.

```bash
# Unit tests (citation check, figure filter, PERT, cash flows, tiers, protocol, signing, fallback, page)
cd site && node --test

# Copy the demo into the portfolio site repository (mirrors this demo's folders only)
scripts/sync-to-site.sh ../neuromorphic-inference-lab-site

# Serve the site with the Pages Functions; put DEEPSEEK_API_KEY in the site's .dev.vars for live mode
cd ../neuromorphic-inference-lab-site && npx wrangler pages dev .

# Re-record the fallback transcripts (spends API credit)
DEEPSEEK_API_KEY=... node scripts/record-board.mjs [ideaId ...]
```

Without a key the demo runs in recorded mode. Optional variables: `BOARD_LLM_MODEL`,
`BOARD_STATE_SECRET`.

## Layout

```
site/                                  mirrors the site repository's paths
  demos/innovation-board/              page, client script, recorded runs
  functions/api/board/turn.js          the Pages Function (GET config, POST one turn)
  config/board/                        data, guardrails, scoring, protocol, LLM client, engine
  test/board-*.test.js                 node --test suites
scripts/sync-to-site.sh                copy into the site repo, removing files this demo no longer has
scripts/record-board.mjs               record a validated live run per idea
```

The architecture follows the [Hiring Panel](https://github.com/nepryoon/hr-hiring-panel) demo.
