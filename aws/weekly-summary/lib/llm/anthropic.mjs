import Anthropic from "@anthropic-ai/sdk";
import {
  buildClassifyUserText,
  buildSynthesisUserText,
  buildConsolidateUserText,
  parseClassifyResponse,
  parseConsolidationResponse,
  parseSynthesisResponse
} from "./parse.mjs";
import { extractCitations } from "./anthropic-parse.mjs";

const CLASSIFY_BATCH_SIZE = 30;
const MAX_SEARCHES_PER_FIRM = 5;
const MAX_CONSOLIDATE_LABELS = 80;

// Structured-output schema guarantees the synthesis response is valid JSON,
// even when the memo prose contains quotes/markdown that would break raw JSON.
const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          whatTheyAreSaying: { type: "string" },
          whyItMatters: { type: "string" }
        },
        required: ["name", "whatTheyAreSaying", "whyItMatters"],
        additionalProperties: false
      }
    },
    memo: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" } },
      required: ["title", "body"],
      additionalProperties: false
    }
  },
  required: ["themes", "memo"],
  additionalProperties: false
};

const COMPANY_HIGHLIGHT_SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string" },
    website: { type: "string" },
    stage: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    whyMatchesMemo: { type: "string" },
    matchedThemes: { type: "array", items: { type: "string" } },
    knownDetails: { type: "string" },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
          positioning: { type: "string" }
        },
        required: ["name", "url", "positioning"],
        additionalProperties: false
      }
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" }
        },
        required: ["title", "url"],
        additionalProperties: false
      }
    }
  },
  required: ["company", "website", "stage", "category", "description", "whyMatchesMemo", "matchedThemes", "knownDetails", "competitors", "sources"],
  additionalProperties: false
};

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function textOf(content) {
  return (content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

export function createAnthropicClient({ apiKey, model }) {
  // maxRetries rides out transient 429/529s across the ~30+ sequential calls a
  // full week's run makes (SDK uses exponential backoff).
  const client = new Anthropic({ apiKey, maxRetries: 4 });

  return {
    provider: "anthropic",
    model,
    supportsWebSearch: true,

    async classify(tweets) {
      const out = [];
      for (const batch of chunk(tweets, CLASSIFY_BATCH_SIZE)) {
        try {
          const message = await client.messages.create({
            model,
            max_tokens: 4096,
            messages: [{ role: "user", content: buildClassifyUserText(batch) }]
          });
          out.push(...parseClassifyResponse(textOf(message.content), batch));
        } catch (err) {
          // Skip a failed batch rather than losing the whole run's classification.
          console.error(`[anthropic] classify batch failed (${batch.length} tweets), skipping:`, err?.message);
        }
      }
      return out;
    },

    async consolidateThemes(labelCounts) {
      if (!labelCounts.length) return {};
      const top = labelCounts.slice(0, MAX_CONSOLIDATE_LABELS);
      const message = await client.messages.create({
        model,
        max_tokens: 8192,
        messages: [{ role: "user", content: buildConsolidateUserText(top) }]
      });
      return parseConsolidationResponse(textOf(message.content), top.map((l) => l.label));
    },

    async researchFirms(firms) {
      const results = [];
      for (const firm of firms) {
        const message = await client.messages.create({
          model,
          max_tokens: 2048,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES_PER_FIRM }],
          messages: [{
            role: "user",
            content: `Using web search, summarize in 2-3 sentences what the venture firm ${firm} is currently investing in and the themes its partners are emphasizing. Cite 3-5 recent sources.`
          }]
        });
        results.push({
          firm,
          summary: textOf(message.content).trim(),
          citations: extractCitations(message.content).slice(0, MAX_SEARCHES_PER_FIRM)
        });
      }
      return results;
    },

    async synthesize({ weekKey, rankedThemes, firmResearch, tweetsByTheme }) {
      const message = await client.messages.create({
        model,
        max_tokens: 8000,
        output_config: { format: { type: "json_schema", schema: SYNTHESIS_SCHEMA } },
        messages: [{ role: "user", content: buildSynthesisUserText({ weekKey, rankedThemes, firmResearch, tweetsByTheme }) }]
      });
      return parseSynthesisResponse(textOf(message.content), rankedThemes, firmResearch);
    },

    async findCompanyHighlight({ weekKey, memo, themes }) {
      const themeContext = themes.map((theme) => [
        `Theme: ${theme.name}`,
        `Signal strength: ${theme.signalStrength}`,
        `Firms: ${(theme.firmsInvolved ?? []).join(", ")}`,
        `What they are saying: ${theme.whatTheyAreSaying}`,
        `Why it matters: ${theme.whyItMatters}`
      ].join("\n")).join("\n\n");

      const message = await client.messages.create({
        model,
        max_tokens: 4096,
        output_config: { format: { type: "json_schema", schema: COMPANY_HIGHLIGHT_SCHEMA } },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }],
        messages: [{
          role: "user",
          content: [
            "You are a venture research analyst for LAUNCH.",
            `Find exactly one real Seed or Series A startup that most closely matches the weekly partner memo for the week of ${weekKey}.`,
            "Use web search. Prefer companies with credible current public evidence, a clear website, and fit to the memo themes.",
            "Do not pick a public company, a late-stage company, or a company without public evidence. If stage is uncertain, say Unknown but only if it otherwise strongly fits.",
            "Return only JSON that matches the requested schema.",
            "",
            "WEEKLY MEMO:",
            `Title: ${memo.title}`,
            memo.body,
            "",
            "THEMES:",
            themeContext
          ].join("\n")
        }]
      });

      return JSON.parse(textOf(message.content));
    }
  };
}
