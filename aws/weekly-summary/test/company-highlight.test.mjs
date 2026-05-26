import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompanyHighlightItems } from "../lib/company-highlight.mjs";

const highlight = {
  slug: "acme-ai",
  company: "Acme AI",
  website: "https://acme.example",
  stage: "Seed",
  category: "AI infrastructure",
  description: "Builds eval tooling for agentic workflows.",
  whyMatchesMemo: "Matches the agent reliability theme.",
  matchedThemes: ["AI Agents"],
  knownDetails: "Raised a seed round.",
  competitors: [],
  sources: [{ title: "Acme", url: "https://acme.example" }],
  weekKey: "2026-05-25",
  meta: {
    generatedAt: "2026-05-25T15:00:00Z",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    mode: "llm",
    webGrounded: true
  }
};

test("buildCompanyHighlightItems writes history and latest pointer", () => {
  const items = buildCompanyHighlightItems(highlight);
  assert.equal(items.length, 2);

  const latest = items.find((item) => item.SK === "COMPANY_HIGHLIGHT#LATEST");
  const history = items.find((item) => item.SK === "COMPANY_HIGHLIGHT#2026-05-25T15:00:00Z");

  assert.ok(latest);
  assert.ok(history);

  for (const item of items) {
    assert.equal(item.PK, "WEEK#2026-05-25");
    assert.equal(item.entityType, "WEEKLY_COMPANY_HIGHLIGHT");
    assert.equal(item.weekKey, "2026-05-25");
    assert.deepEqual(item.highlight, highlight);
    assert.deepEqual(item.meta, highlight.meta);
  }
});
