import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FORMULA } from "../config/board/scoring.js";

const html = await readFile(new URL("../demos/innovation-board/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../demos/innovation-board/app.js", import.meta.url), "utf8");
const matches = (pattern) => [...html.matchAll(pattern)];

test("demo page keeps the site layout, provenance footer and unique IDs", () => {
  assert.equal(matches(/<main(?:\s|>)/g).length, 1);
  assert.equal(matches(/<h1(?:\s|>)/g).length, 1);
  assert.match(html, /<html lang="en-GB">/);
  assert.match(html, /<link rel="stylesheet" href="\/style.css" \/>/);
  assert.equal(matches(/<script src="\/build-info\.js"><\/script>/g).length, 1);
  const ids = matches(/\sid="([^"]+)"/g).map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "IDs must be unique");
  for (const id of ["build-branch", "build-commit", "build-time", "modeBadge", "research", "transcript", "metrics", "brief", "radar", "estimateChart", "wpTable", "npvChart", "scenarioTable", "tornado", "assumptionList", "mindList", "experiment", "dissentList", "decisionActions", "skipButton"]) {
    assert.ok(ids.includes(id), `missing #${id}`);
  }
  for (const id of js.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(id[1]), `app.js references missing #${id[1]}`);
});

test("the notice, mode badge labels, simulated-research statement, speed control and skip are present", () => {
  assert.ok(html.includes("Synthetic company, ideas and sources. Simulated research. Decision support only: a person makes every investment decision."));
  assert.match(js, /Live LLM board/);
  assert.match(js, /Recorded run/);
  assert.match(html, /The research is simulated/);
  assert.match(html, /web search, internal data connectors and document retrieval, keeping the same citation check/);
  assert.match(html, /name="speed" value="normal"/);
  assert.match(html, /name="speed" value="fast"/);
  assert.match(html, /Skip to brief/);
});

test("How it works: five architecture bullets, every formula, the source link and Limits", () => {
  const how = html.slice(html.indexOf('id="how-title"'));
  const bullets = how.slice(0, how.indexOf("</ul>")).match(/<li>/g) || [];
  assert.equal(bullets.length, 5);
  for (const line of FORMULA) assert.ok(html.includes(line), `formula line missing from the page: ${line}`);
  assert.match(html, /<h3 class="mt-12">Limits<\/h3>/);
  assert.match(html, /illustrate a method on invented data and are not forecasts/);
  assert.match(html, /href="https:\/\/github.com\/nepryoon\/innovation-board" target="_blank" rel="noopener noreferrer"/);
});

test("the human decision is recorded on the page only", () => {
  assert.match(html, /Human decision/);
  assert.match(html, /nothing is stored or sent/);
  for (const tier of ["Invest now", "Run a pilot", "Explore further", "Park"]) assert.ok(html.includes(`>${tier}</button>`), tier);
  const handler = js.slice(js.indexOf('$("decisionActions").addEventListener'), js.indexOf("// --- Run loop"));
  assert.doesNotMatch(handler, /fetch|localStorage|sendBeacon/);
});

test("client renders server data as text, never as HTML, and has no free-text input", () => {
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.doesNotMatch(html, /<textarea|type="text"|type="file"/);
});

test("user-facing copy uses British English", () => {
  const american = /\b(color|behavior|organization|prioritize|analyze|initialize|favorite|license|catalog|center|judgment|program|modeled|labeled|optimize)\b/i;
  assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/, ""), american);
  assert.doesNotMatch(js.replace(/behavior:/g, ""), /\b(behavior|organization|prioritize|analyze|favorite|judgment|labeled|modeled)\b/i);
});
