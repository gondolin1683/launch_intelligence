import Anthropic from "@anthropic-ai/sdk";
import {
  buildClassifyUserText,
  buildSynthesisUserText,
  parseClassifyResponse,
  parseSynthesisResponse
} from "./parse.mjs";
import { extractCitations } from "./anthropic-parse.mjs";

const CLASSIFY_BATCH_SIZE = 30;
const MAX_SEARCHES_PER_FIRM = 5;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function textOf(content) {
  return (content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

export function createAnthropicClient({ apiKey, model }) {
  const client = new Anthropic({ apiKey });

  return {
    provider: "anthropic",
    model,
    supportsWebSearch: true,

    async classify(tweets) {
      const out = [];
      for (const batch of chunk(tweets, CLASSIFY_BATCH_SIZE)) {
        const message = await client.messages.create({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: buildClassifyUserText(batch) }]
        });
        out.push(...parseClassifyResponse(textOf(message.content), batch));
      }
      return out;
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

    async synthesize({ rankedThemes, firmResearch, tweetsByTheme }) {
      const message = await client.messages.create({
        model,
        max_tokens: 8000,
        messages: [{ role: "user", content: buildSynthesisUserText({ rankedThemes, firmResearch, tweetsByTheme }) }]
      });
      return parseSynthesisResponse(textOf(message.content), rankedThemes, firmResearch);
    }
  };
}
