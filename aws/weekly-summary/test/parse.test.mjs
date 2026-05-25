import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClassifyUserText,
  buildSynthesisUserText,
  parseClassifyResponse,
  parseSynthesisResponse
} from "../lib/llm/parse.mjs";

const batch = [
  { tweetId: "1", text: "Agents are eating enterprise workflows" },
  { tweetId: "2", text: "Just bought a sandwich" }
];

test("buildClassifyUserText includes every tweet id and text", () => {
  const out = buildClassifyUserText(batch);
  assert.match(out, /1/);
  assert.match(out, /Agents are eating enterprise workflows/);
  assert.match(out, /2/);
  assert.match(out, /Just bought a sandwich/);
});

test("buildSynthesisUserText includes the theme names and asks for JSON", () => {
  const out = buildSynthesisUserText({
    rankedThemes: [{ name: "AI Agents", signalStrength: 90, firmsInvolved: ["a16z"] }],
    firmResearch: [{ firm: "a16z", summary: "investing in agents" }],
    tweetsByTheme: { "AI Agents": [{ text: "agents everywhere" }] }
  });
  assert.match(out, /AI Agents/);
  assert.match(out, /JSON/);
  assert.match(out, /agents everywhere/);
});

test("parseClassifyResponse parses a clean JSON array", () => {
  const text = JSON.stringify([
    { tweetId: "1", theme: "AI Agents", investmentRelevant: true },
    { tweetId: "2", theme: "Off-topic", investmentRelevant: false }
  ]);
  const result = parseClassifyResponse(text, batch);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { tweetId: "1", theme: "AI Agents", investmentRelevant: true });
  assert.equal(result[1].investmentRelevant, false);
});

test("parseClassifyResponse strips ```json code fences", () => {
  const text = "```json\n[{\"tweetId\":\"1\",\"theme\":\"AI Agents\",\"investmentRelevant\":true}]\n```";
  const result = parseClassifyResponse(text, batch);
  assert.equal(result.length, 1);
  assert.equal(result[0].theme, "AI Agents");
});

test("parseClassifyResponse defaults missing investmentRelevant to true", () => {
  const text = JSON.stringify([{ tweetId: "1", theme: "AI Agents" }]);
  const [entry] = parseClassifyResponse(text, batch);
  assert.equal(entry.investmentRelevant, true);
});

test("parseClassifyResponse ignores tweetIds not in the batch", () => {
  const text = JSON.stringify([{ tweetId: "999", theme: "Ghost", investmentRelevant: true }]);
  assert.equal(parseClassifyResponse(text, batch).length, 0);
});

test("parseClassifyResponse returns [] on invalid JSON", () => {
  assert.deepEqual(parseClassifyResponse("not json at all", batch), []);
});

test("parseSynthesisResponse merges narrative onto ranked themes and attaches firm citations", () => {
  const ranked = [
    { name: "AI Agents", signalStrength: 90, firmsInvolved: ["a16z", "YC"], partnerSignalCount: 5, signalCount: 8, representativeTweetIds: ["1"] }
  ];
  const firmResearch = [
    { firm: "a16z", summary: "...", citations: [{ title: "A", url: "https://a16z.com/a" }] },
    { firm: "Sequoia", summary: "...", citations: [{ title: "S", url: "https://sequoia.com/s" }] }
  ];
  const text = JSON.stringify({
    themes: [{ name: "AI Agents", whatTheyAreSaying: "saying", whyItMatters: "matters" }],
    memo: { title: "Brief", body: "body" }
  });

  const { themes, memo } = parseSynthesisResponse(text, ranked, firmResearch);

  assert.equal(themes[0].whatTheyAreSaying, "saying");
  assert.equal(themes[0].whyItMatters, "matters");
  assert.equal(themes[0].signalStrength, 90);
  assert.deepEqual(themes[0].citations, [{ title: "A", url: "https://a16z.com/a" }]);
  assert.deepEqual(memo, { title: "Brief", body: "body" });
});

test("parseSynthesisResponse throws on invalid JSON so the pipeline can fall back", () => {
  assert.throws(() => parseSynthesisResponse("garbage", [], []));
});
