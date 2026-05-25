import OpenAI from "openai";
import {
  buildClassifyUserText,
  buildSynthesisUserText,
  parseClassifyResponse,
  parseSynthesisResponse
} from "./parse.mjs";

const CLASSIFY_BATCH_SIZE = 30;

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// classify expects a JSON array; OpenAI's json_object mode requires a JSON
// object at the top level, so we wrap the array under a "results" key.
function buildClassifyJsonObjectText(tweets) {
  return `${buildClassifyUserText(tweets)}\n\nWrap the array in a JSON object: {"results":[...]}.`;
}

export function createOpenAiClient({ apiKey, model }) {
  const client = new OpenAI({ apiKey });

  async function complete(content) {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }]
    });
    return completion.choices?.[0]?.message?.content ?? "";
  }

  return {
    provider: "openai",
    model,
    // Web grounding is currently Anthropic-only; OpenAI runs tweets-only and the
    // pipeline marks webGrounded:false. researchFirms is never invoked as a result.
    supportsWebSearch: false,

    async classify(tweets) {
      const out = [];
      for (const batch of chunk(tweets, CLASSIFY_BATCH_SIZE)) {
        const raw = await complete(buildClassifyJsonObjectText(batch));
        let arrayText = raw;
        try {
          const obj = JSON.parse(raw);
          if (obj && Array.isArray(obj.results)) arrayText = JSON.stringify(obj.results);
        } catch {
          // leave raw; parseClassifyResponse handles bad JSON by returning []
        }
        out.push(...parseClassifyResponse(arrayText, batch));
      }
      return out;
    },

    async researchFirms() {
      return [];
    },

    async synthesize({ rankedThemes, firmResearch, tweetsByTheme }) {
      const raw = await complete(buildSynthesisUserText({ rankedThemes, firmResearch, tweetsByTheme }));
      return parseSynthesisResponse(raw, rankedThemes, firmResearch);
    }
  };
}
