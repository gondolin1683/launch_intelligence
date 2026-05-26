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

test("a web-research failure degrades to tweets-only without losing LLM synthesis", async () => {
  let synthesized = false;
  const client = fakeClient({
    researchFirms: async () => {
      throw new Error("web search not enabled for this key");
    },
    synthesize: async ({ rankedThemes }) => {
      synthesized = true;
      return {
        themes: rankedThemes.map((t) => ({ ...t, whatTheyAreSaying: "x", whyItMatters: "y", citations: [] })),
        memo: { title: "M", body: "b" }
      };
    }
  });

  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });

  assert.equal(result.meta.mode, "llm");
  assert.equal(result.meta.webGrounded, false);
  assert.equal(synthesized, true);
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

test("caps the themes passed to synthesis (and returned) at maxThemes", async () => {
  const many = [];
  for (let i = 0; i < 20; i++) many.push(tweet(String(i), `Theme${i}`, "a16z"));

  let synthThemeCount = null;
  const client = fakeClient({
    synthesize: async ({ rankedThemes }) => {
      synthThemeCount = rankedThemes.length;
      return {
        themes: rankedThemes.map((t) => ({ ...t, whatTheyAreSaying: "", whyItMatters: "", citations: [] })),
        memo: { title: "M", body: "b" }
      };
    }
  });

  const result = await runPipeline({ weekKey: "2026-05-25", tweets: many, client, maxThemes: 5 });

  assert.equal(synthThemeCount, 5);
  assert.equal(result.themes.length, 5);
});

test("applies theme consolidation when the client supports it", async () => {
  const client = fakeClient({
    consolidateThemes: async () => ({ "AI Agents": "Agents" })
  });
  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });
  assert.ok(result.themes.some((t) => t.name === "Agents"));
  assert.ok(!result.themes.some((t) => t.name === "AI Agents"));
});

test("consolidation failure is non-fatal — keeps raw labels and stays in llm mode", async () => {
  const client = fakeClient({
    consolidateThemes: async () => {
      throw new Error("consolidation failed");
    }
  });
  const result = await runPipeline({ weekKey: "2026-05-25", tweets: baseTweets, client });
  assert.equal(result.meta.mode, "llm");
  assert.ok(result.themes.some((t) => t.name === "AI Agents"));
});
