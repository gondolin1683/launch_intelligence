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
    }
  };
}
