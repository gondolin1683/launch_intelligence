import { test } from "node:test";
import assert from "node:assert/strict";
import { distinctLabelCounts, applyConsolidation } from "../lib/consolidate.mjs";

test("distinctLabelCounts counts tweets per theme label, most common first", () => {
  const tweets = [
    { tweetId: "1", theme: "A" },
    { tweetId: "2", theme: "A" },
    { tweetId: "3", theme: "B" }
  ];
  assert.deepEqual(distinctLabelCounts(tweets), [
    { label: "A", count: 2 },
    { label: "B", count: 1 }
  ]);
});

test("applyConsolidation rewrites themes via the mapping, leaving unmapped labels intact", () => {
  const tweets = [
    { tweetId: "1", theme: "AI video generation", firm: "a16z" },
    { tweetId: "2", theme: "AI Short Drama", firm: "a16z" },
    { tweetId: "3", theme: "Space / SpaceX", firm: "Sequoia" }
  ];
  const mapping = { "AI video generation": "Generative Media", "AI Short Drama": "Generative Media" };

  const out = applyConsolidation(tweets, mapping);

  assert.equal(out[0].theme, "Generative Media");
  assert.equal(out[1].theme, "Generative Media");
  assert.equal(out[2].theme, "Space / SpaceX");
  // other fields preserved
  assert.equal(out[0].firm, "a16z");
});
