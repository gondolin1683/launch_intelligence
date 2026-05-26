import { readLatestMemo, putItems } from "./dynamo.mjs";

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "company";
}

function normalizeHighlight(raw, { weekKey, client }) {
  const generatedAt = new Date().toISOString();
  const company = String(raw.company ?? "").trim();
  if (!company) throw new Error("Company highlight response missing company");

  return {
    slug: slugify(company),
    company,
    website: String(raw.website ?? "").trim(),
    stage: String(raw.stage ?? "Unknown").trim(),
    category: String(raw.category ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    whyMatchesMemo: String(raw.whyMatchesMemo ?? "").trim(),
    matchedThemes: Array.isArray(raw.matchedThemes) ? raw.matchedThemes.map(String).filter(Boolean) : [],
    knownDetails: String(raw.knownDetails ?? "").trim(),
    competitors: Array.isArray(raw.competitors) ? raw.competitors.map((competitor) => ({
      name: String(competitor.name ?? "").trim(),
      url: String(competitor.url ?? "").trim(),
      positioning: String(competitor.positioning ?? "").trim()
    })).filter((competitor) => competitor.name) : [],
    sources: Array.isArray(raw.sources) ? raw.sources.map((source) => ({
      title: String(source.title ?? "").trim(),
      url: String(source.url ?? "").trim()
    })).filter((source) => source.url) : [],
    weekKey,
    meta: {
      generatedAt,
      provider: client.provider,
      model: client.model,
      mode: "llm",
      webGrounded: true
    }
  };
}

export function buildCompanyHighlightItems(highlight) {
  const base = {
    PK: `WEEK#${highlight.weekKey}`,
    entityType: "WEEKLY_COMPANY_HIGHLIGHT",
    weekKey: highlight.weekKey,
    highlight,
    meta: highlight.meta
  };

  return [
    { ...base, SK: `COMPANY_HIGHLIGHT#${highlight.meta.generatedAt}` },
    { ...base, SK: "COMPANY_HIGHLIGHT#LATEST" }
  ];
}

export async function runCompanyHighlight({ ddb, table, weekKey, llmClient }) {
  const memoItem = await readLatestMemo(ddb, table, weekKey);
  if (!memoItem?.memo || !Array.isArray(memoItem.themes)) {
    throw new Error(`No weekly memo found for ${weekKey}; run summary before company highlight`);
  }
  if (typeof llmClient.findCompanyHighlight !== "function") {
    throw new Error("LLM client does not support company highlight generation");
  }

  const raw = await llmClient.findCompanyHighlight({
    weekKey,
    memo: memoItem.memo,
    themes: memoItem.themes
  });
  const highlight = normalizeHighlight(raw, { weekKey, client: llmClient });
  const items = buildCompanyHighlightItems(highlight);
  await putItems(ddb, table, items);

  return { highlight, stored: items.length };
}
