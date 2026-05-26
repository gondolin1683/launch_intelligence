import { rankThemes } from "./rank.mjs";
import { distinctLabelCounts, applyConsolidation } from "./consolidate.mjs";
import { classifyByKeyword, deterministicNarrative, deterministicMemo } from "./deterministic.mjs";

export async function runPipeline({ weekKey, tweets, client, representativeLimit = 3, maxThemes = 12 }) {
  const generatedAt = new Date().toISOString();
  const meta = {
    provider: client.provider,
    model: client.model,
    generatedAt,
    mode: "llm",
    webGrounded: false
  };

  try {
    const classifications = await client.classify(tweets);
    const byId = new Map(tweets.map((t) => [t.tweetId, t]));
    let classified = classifications
      .filter((c) => c.investmentRelevant && byId.has(c.tweetId))
      .map((c) => ({ ...byId.get(c.tweetId), theme: c.theme }));

    // Consolidate the free-form per-batch labels into a small canonical set so
    // ranking yields ~10 themes, not hundreds of near-duplicates.
    if (typeof client.consolidateThemes === "function") {
      try {
        const mapping = await client.consolidateThemes(distinctLabelCounts(classified));
        classified = applyConsolidation(classified, mapping);
      } catch {
        // keep raw labels on failure
      }
    }

    // Only the top themes are narrated/returned — bounds the synthesis output so
    // it can't truncate past max_tokens, and matches the dashboard's ranked shortlist.
    const topThemes = rankThemes(classified, { representativeLimit }).slice(0, maxThemes);

    let firmResearch = [];
    if (client.supportsWebSearch) {
      const firms = [...new Set(topThemes.flatMap((t) => t.firmsInvolved))];
      try {
        firmResearch = await client.researchFirms(firms);
      } catch {
        // Web search may be unavailable on the key — degrade to tweets-only
        // rather than dropping the whole run to the deterministic fallback.
        firmResearch = [];
      }
    }
    meta.webGrounded = Boolean(client.supportsWebSearch && firmResearch.length > 0);

    const topNames = new Set(topThemes.map((t) => t.name));
    const tweetsByTheme = {};
    for (const t of classified) {
      if (topNames.has(t.theme)) (tweetsByTheme[t.theme] ??= []).push(t);
    }

    const { themes, memo } = await client.synthesize({ weekKey, rankedThemes: topThemes, firmResearch, tweetsByTheme });
    return { weekKey, themes, memo, meta };
  } catch (err) {
    console.error("[pipeline] LLM path failed, falling back to deterministic:", err?.stack || err?.message || err);
    const classified = classifyByKeyword(tweets);
    const rankedThemes = rankThemes(classified, { representativeLimit }).slice(0, maxThemes);
    const themes = deterministicNarrative(rankedThemes);
    const memo = deterministicMemo(themes);
    return { weekKey, themes, memo, meta: { ...meta, mode: "deterministic", webGrounded: false } };
  }
}
