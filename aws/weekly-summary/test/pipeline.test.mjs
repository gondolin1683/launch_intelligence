import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline } from "../lib/pipeline.mjs";

function tweet(id, text, firm, authorType = "partner", engagement = 0) {
  return { tweetId: id, text, firm, authorType, engagement };
}

// Hand-rolled fake LlmClient (dependency injection, no mocking framework).
function fakeClient(overrides = {}) {
  return {
    provider: "test",
    model: "test-model",
    supportsWebSearch: true,
    classify: async (tweets) =>
      tweets.map((t) => ({
        tweetId: t.tweetId,
        theme: t.text,
        investmentRelevant: t.text !== "noise"
      })),
    researchFirms: async (firms) =>
      firms.map((f) => ({ firm: f, summary: `${f} focus`, citations: [{ title: `${f} src`, url: `https://x/${f}` }] })),
    synthesize: async ({ rankedThemes }) => ({
      themes: rankedThemes.map((t) => ({ ...t, whatTheyAreSaying: "saying", whyItMatters: "matters", citations: [] })),
      memo: { title: "Memo", body: "memo body" }
    }),
    ...overrides
  };
}

const baseTweets = [
  tweet("1", "AI Agents", "a16z"),
  tweet("2", "AI Agents", "YC"),
  tweet("3", "noise", "a16z")
];

test("drops tweets classified as not investment-relevant before ranking", async () => {
  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client: fakeClient() });
  const names = result.themes.map((t) => t.name);
  assert.ok(names.includes("AI Agents"));
  assert.ok(!names.includes("noise"));
});

test("skips web research and marks webGrounded false when client lacks web search", async () => {
  let researched = false;
  const client = fakeClient({
    supportsWebSearch: false,
    researchFirms: async (firms) => {
      researched = true;
      return firms.map((f) => ({ firm: f, summary: "", citations: [] }));
    }
  });

  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });

  assert.equal(researched, false);
  assert.equal(result.meta.webGrounded, false);
});

test("runs web research and marks webGrounded true when supported", async () => {
  let researchedFirms = null;
  const client = fakeClient({
    researchFirms: async (firms) => {
      researchedFirms = firms;
      return firms.map((f) => ({ firm: f, summary: `${f} focus`, citations: [{ title: "s", url: "https://x" }] }));
    }
  });

  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });

  assert.equal(result.meta.webGrounded, true);
  assert.deepEqual([...researchedFirms].sort(), ["YC", "a16z"]);
});

test("falls back to deterministic generation when an LLM call throws", async () => {
  const client = fakeClient({
    synthesize: async () => {
      throw new Error("provider 500");
    }
  });

  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });

  assert.equal(result.meta.mode, "deterministic");
  assert.ok(result.themes.length > 0);
  assert.ok(result.memo.body.length > 0);
});

test("carries provider/model/weekKey and marks mode llm on success", async () => {
  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client: fakeClient() });

  assert.equal(result.weekKey, "2026-05-25");
  assert.equal(result.meta.provider, "test");
  assert.equal(result.meta.model, "test-model");
  assert.equal(result.meta.mode, "llm");
  assert.ok(result.meta.generatedAt);
});
