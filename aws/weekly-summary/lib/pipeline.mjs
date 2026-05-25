import { rankThemes } from "./rank.mjs";
import { classifyByKeyword, deterministicNarrative, deterministicMemo } from "./deterministic.mjs";

export async function runPipeline({ weekKey, tweets, client, representativeLimit = 3 }) {
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
    const classified = classifications
      .filter((c) => c.investmentRelevant && byId.has(c.tweetId))
      .map((c) => ({ ...byId.get(c.tweetId), theme: c.theme }));

    const rankedThemes = rankThemes(classified, { representativeLimit });

    let firmResearch = [];
    if (client.supportsWebSearch) {
      const firms = [...new Set(classified.map((t) => t.firm))];
      firmResearch = await client.researchFirms(firms);
    }
    meta.webGrounded = Boolean(client.supportsWebSearch && firmResearch.length > 0);

    const tweetsByTheme = {};
    for (const t of classified) {
      (tweetsByTheme[t.theme] ??= []).push(t);
    }

    const { themes, memo } = await client.synthesize({ rankedThemes, firmResearch, tweetsByTheme });
    return { weekKey, themes, memo, meta };
  } catch {
    const classified = classifyByKeyword(tweets);
    const rankedThemes = rankThemes(classified, { representativeLimit });
    const themes = deterministicNarrative(rankedThemes);
    const memo = deterministicMemo(themes);
    return { weekKey, themes, memo, meta: { ...meta, mode: "deterministic", webGrounded: false } };
  }
}
