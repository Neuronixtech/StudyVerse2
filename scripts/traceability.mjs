#!/usr/bin/env node
/**
 * Regenerates the case-by-case section of design/docs/TEST_TRACEABILITY.md from real results.
 *
 *   node scripts/traceability.mjs [--vitest reports/vitest.json] [--e2e reports/playwright.json]
 *
 * Inputs
 *   - design/docs/FRONTEND_TEST_PLAN.md   case IDs, titles, priority and planned layer
 *   - Vitest JSON report                  unit + component results (vitest.config.mts writes it)
 *   - Playwright JSON report(s)           E2E results, one entry per browser project
 *
 * A case is mapped to every executed test whose full title (describe blocks + test) contains its ID,
 * plus the few documented groups in GROUPS below. Status comes only from those results.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const VITEST = args.vitest ?? "reports/vitest.json";
const E2E = (args.e2e ?? "reports/playwright.json").split(",");
const PLAN = "design/docs/FRONTEND_TEST_PLAN.md";
const DOC = "design/docs/TEST_TRACEABILITY.md";
const START = "<!-- generated:start -->";
const END = "<!-- generated:end -->";
const ID_RE = /\b(PUB|AUTH|SUB|COURSE|VID|EXAM|ADMIN|BOOKADM|BOOK|RESP|A11Y|STATE)-\d{3}\b/g;
const AREAS = [
  ["PUB", "Public website and navigation"],
  ["AUTH", "Authentication UI"],
  ["SUB", "Subscription and access state"],
  ["COURSE", "Courses and lessons"],
  ["VID", "Video player and simulated progress"],
  ["EXAM", "Examination system"],
  ["ADMIN", "Admin learning content, tests and permissions"],
  ["BOOK", "Bookstore — customer"],
  ["BOOKADM", "Bookstore — administration"],
  ["RESP", "Responsive behaviour"],
  ["A11Y", "Accessibility"],
  ["STATE", "Loading, empty, error and resilience"],
];

/** Untagged tests that cover a case as a documented group (the file predates the ID convention). */
const GROUPS = {
  "BOOK-002": { file: "src/features/bookstore/storefront.test.tsx", prefixes: ["BookCatalog — search"] },
  "BOOK-003": {
    file: "src/features/bookstore/storefront.test.tsx",
    prefixes: ["BookCatalog — filter panel", "BookCatalog — exam and subject filters", "BookCatalog — price filter", "BookCatalog — availability filter", "BookCatalog — publisher filter", "BookCatalog — combined filters and reset", "BookCatalog — default state › sorts by", "BookCatalog — default state › offers all four sort options"],
  },
};

/** Cases intentionally not (fully) automated, with the reason. Empty means none. */
const DEFERRED = {};
const NOT_IMPLEMENTED = {};
const PARTIAL = {};

/* ------------------------------- plan -------------------------------- */

const planText = readFileSync(PLAN, "utf8");
const cases = [...planText.matchAll(/^### ([A-Z0-9]+-\d{3}) — (.+)\n- \*\*Priority \/ layer:\*\* (P\d) \/ (.+)$/gm)].map((m) => ({ id: m[1], title: m[2].trim(), priority: m[3], planLayer: m[4].trim() }));

/* ------------------------------ results ------------------------------ */

const rel = (f) => f.replace(`${process.cwd()}/`, "");
const tests = []; // { runner, file, title, results: { [project]: status } }

const vitest = JSON.parse(readFileSync(VITEST, "utf8"));
for (const file of vitest.testResults) {
  for (const a of file.assertionResults) {
    tests.push({ runner: "vitest", file: rel(file.name), title: [...a.ancestorTitles, a.title].join(" › "), results: { vitest: a.status } });
  }
}

const e2eRuns = E2E.map((f) => JSON.parse(readFileSync(f, "utf8")));
const e2eIndex = new Map();
const statusOf = (t) => ({ expected: "passed", unexpected: "failed", flaky: "flaky", skipped: "skipped" })[t.status] ?? t.status;
function walk(suite, file, titles) {
  for (const spec of suite.specs ?? []) {
    const title = [...titles, spec.title].join(" › ");
    const key = `${file}::${title}`;
    let entry = e2eIndex.get(key);
    if (!entry) {
      entry = { runner: "playwright", file: `e2e/${file}`, title, results: {}, attempts: 0 };
      e2eIndex.set(key, entry);
      tests.push(entry);
    }
    for (const t of spec.tests) {
      entry.results[t.projectName] = statusOf(t);
      entry.attempts += t.results.length;
    }
  }
  for (const child of suite.suites ?? []) walk(child, file, [...titles, child.title]);
}
for (const run of e2eRuns) for (const top of run.suites) walk(top, top.file, []);

/* ----------------------------- mapping ------------------------------ */

const byId = new Map(cases.map((c) => [c.id, []]));
for (const t of tests) {
  for (const id of new Set(t.title.match(ID_RE) ?? [])) byId.get(id)?.push(t);
}
for (const [id, g] of Object.entries(GROUPS)) {
  for (const t of tests) if (t.file === g.file && g.prefixes.some((p) => t.title.startsWith(p)) && !byId.get(id).includes(t)) byId.get(id).push(t);
}

const outcomes = (t) => Object.values(t.results);
const testFailed = (t) => outcomes(t).some((s) => s === "failed" || s === "flaky");
const testPassed = (t) => outcomes(t).length > 0 && outcomes(t).every((s) => s === "passed");
const layerOf = (t) => (t.runner === "playwright" ? "E" : /^src\/lib\/|^src\/app\/routes\.test/.test(t.file) ? "U" : "C");

function classify(c) {
  const list = byId.get(c.id);
  if (NOT_IMPLEMENTED[c.id]) return { status: "⛔ Not implemented", note: NOT_IMPLEMENTED[c.id] };
  if (DEFERRED[c.id] && !list.length) return { status: "⏸ Deferred", note: DEFERRED[c.id] };
  if (!list.length) return { status: "❌ Not automated", note: "" };
  if (list.some(testFailed)) return { status: "🔴 Failing", note: "" };
  if (!list.every(testPassed)) return { status: "⚪ Skipped", note: "" };
  if (PARTIAL[c.id]) return { status: "🟡 Partial", note: PARTIAL[c.id] };
  return { status: "✅ Passing", note: "" };
}

/* ------------------------------ output ------------------------------ */

const projects = [...new Set(tests.filter((t) => t.runner === "playwright").flatMap((t) => Object.keys(t.results)))];
const mark = (s) => ({ passed: "✓", failed: "✗", flaky: "≈", skipped: "–" })[s] ?? "?";
const esc = (s) => s.replace(/\|/g, "\\|");
const cell = (t) => {
  const where = t.runner === "playwright" ? `${projects.map((p) => `${mark(t.results[p])}${p}`).join(" ")}` : mark(t.results.vitest);
  return `\`${t.file}\` › ${esc(t.title)} (${where})`;
};
const MAX = 6;

const lines = [];
const rows = cases.map((c) => ({ ...c, ...classify(c), tests: byId.get(c.id) }));
const count = (prefix) => rows.filter((r) => r.status.startsWith(prefix)).length;

let sha = "unknown";
let dirty = false;
try {
  sha = execSync("git rev-parse --short HEAD").toString().trim();
  dirty = execSync("git status --porcelain").toString().trim().length > 0;
} catch {}

const vt = { files: vitest.testResults.length, total: vitest.numTotalTests, passed: vitest.numPassedTests, failed: vitest.numFailedTests, skipped: vitest.numPendingTests + (vitest.numTodoTests ?? 0) };
const e2eTests = tests.filter((t) => t.runner === "playwright");
const perProject = projects.map((p) => {
  const s = e2eTests.map((t) => t.results[p]).filter(Boolean);
  return { p, total: s.length, passed: s.filter((x) => x === "passed").length, failed: s.filter((x) => x === "failed").length, flaky: s.filter((x) => x === "flaky").length, skipped: s.filter((x) => x === "skipped").length };
});
const attempts = e2eTests.reduce((a, t) => a + t.attempts, 0);
const projectsRun = (suite) => [...(suite.specs ?? []).flatMap((sp) => sp.tests.map((t) => t.projectName)), ...(suite.suites ?? []).flatMap(projectsRun)];
const runStarts = e2eRuns.map((r) => `${[...new Set(r.suites.flatMap(projectsRun))].join("+") || "e2e"} started ${r.stats?.startTime ?? "n/a"} (${Math.round((r.stats?.duration ?? 0) / 1000)} s)`);
const vitestStart = vitest.startTime ? new Date(vitest.startTime).toISOString() : "n/a";

lines.push(START, "", "## 5. Latest execution summary", "");
lines.push(`Generated by \`npm run traceability\` from the reports of the latest local runs. Commit \`${sha}\`${dirty ? " **plus uncommitted changes**" : ""}. Vitest started ${vitestStart}. E2E runs: ${runStarts.join("; ")}.`, "");
lines.push("| Suite | Unique tests | Executions | Passed | Failed | Flaky | Skipped |", "|---|---|---|---|---|---|---|");
lines.push(`| Vitest (unit + component), ${vt.files} files | ${vt.total} | ${vt.total} | ${vt.passed} | ${vt.failed} | 0 | ${vt.skipped} |`);
for (const r of perProject) lines.push(`| Playwright E2E — ${r.p} | ${r.total} | ${r.total} | ${r.passed} | ${r.failed} | ${r.flaky} | ${r.skipped} |`);
lines.push(`| **Playwright E2E — all projects** | **${e2eTests.length}** | **${perProject.reduce((a, r) => a + r.total, 0)}** (${attempts} attempts incl. retries) | ${perProject.reduce((a, r) => a + r.passed, 0)} | ${perProject.reduce((a, r) => a + r.failed, 0)} | ${perProject.reduce((a, r) => a + r.flaky, 0)} | ${perProject.reduce((a, r) => a + r.skipped, 0)} |`);
lines.push("", `*Unique tests* counts each \`test()\` once. *Executions* counts it once per browser project it ran in. The ${e2eTests.length} unique E2E tests ran in ${projects.length} project(s): ${projects.join(", ")}.`, "");

lines.push("## 6. Case status", "");
lines.push("| Status | Count |", "|---|---|");
for (const [label, prefix] of [["✅ Passing", "✅"], ["🔴 Failing", "🔴"], ["🟡 Partially automated", "🟡"], ["⛔ Not implemented", "⛔"], ["⏸ Deferred", "⏸"], ["❌ Not automated", "❌"], ["⚪ Skipped", "⚪"]]) lines.push(`| ${label} | ${count(prefix)} |`);
lines.push(`| **Total** | **${rows.length}** |`, "");
const p0Open = rows.filter((r) => r.priority === "P0" && !r.status.startsWith("✅"));
lines.push(p0Open.length ? `P0 cases not passing: ${p0Open.map((r) => r.id).join(", ")}.` : "Every P0 case is passing.", "");
const manual = rows.filter((r) => /manual/i.test(r.planLayer)).map((r) => r.id);
lines.push(`*Passing* means every automated test mapped to the case passed in every runner and browser. Where the plan also asks for a manual check (${manual.join(", ")}), that manual part is tracked separately in §10 and isn't implied by this status.`, "");

lines.push("## 7. Traceability matrix", "");
lines.push("Each row lists the executed tests mapped to the case: `file` › describe › test title, followed by the result (✓ passed, ✗ failed, ≈ flaky, – skipped). E2E rows show the result per browser project. Layers: U unit, C component, E end-to-end.", "");
for (const [prefix, name] of AREAS) {
  lines.push(`### ${name}`, "", "| ID | Case | P | Plan layer | Automated | Status | Tests |", "|---|---|---|---|---|---|---|");
  for (const r of rows.filter((x) => x.id.replace(/-\d+$/, "") === prefix)) {
    const layers = [...new Set(r.tests.map(layerOf))].sort((a, b) => "UCE".indexOf(a) - "UCE".indexOf(b)).join(" ") || "—";
    const shown = r.tests.slice(0, MAX).map(cell);
    const rest = r.tests.length - shown.length;
    if (rest > 0) {
      const files = [...new Set(r.tests.slice(MAX).map((t) => t.file))];
      const ok = r.tests.slice(MAX).every(testPassed);
      shown.push(`… and ${rest} more in ${files.map((f) => `\`${f}\``).join(", ")} (${ok ? "all passed" : "some failed"})`);
    }
    const note = r.note ? ` — ${r.note}` : "";
    lines.push(`| ${r.id} | ${esc(r.title)} | ${r.priority} | ${r.planLayer} | ${layers} | ${r.status}${note} | ${shown.join("<br>") || "—"} |`);
  }
  lines.push("");
}

const AREA_RE = /(AUTH \(password reset\)|LEARNER \([a-z]+\)|ADMIN \([a-z]+\)|route table|route safety|route audit)/;
const extra = tests.filter((t) => AREA_RE.test(t.title));
lines.push("## 8. Route coverage beyond the numbered catalogue", "");
lines.push("These tests cover routes and flows that have no case ID of their own in the plan (some also support a numbered case). They are tagged by area instead of inventing new IDs, so the catalogue stays at 139.", "");
lines.push("| Area | Tests |", "|---|---|");
const areaOf = (t) => (t.title.match(AREA_RE) ?? [])[0];
for (const area of [...new Set(extra.map(areaOf))]) {
  const list = extra.filter((t) => areaOf(t) === area);
  lines.push(`| ${area} | ${list.map(cell).join("<br>")} |`);
}
lines.push("", END);

const doc = readFileSync(DOC, "utf8");
const a = doc.indexOf(START);
const b = doc.indexOf(END);
if (a < 0 || b < 0) throw new Error(`Markers ${START} / ${END} not found in ${DOC}`);
writeFileSync(DOC, doc.slice(0, a) + lines.join("\n") + doc.slice(b + END.length));
console.log(`Updated ${DOC}: ${rows.length} cases — ${count("✅")} passing, ${count("🔴")} failing, ${count("🟡")} partial, ${count("⛔")} not implemented, ${count("⏸")} deferred, ${count("❌")} not automated.`);
