import { test } from "node:test";
import assert from "node:assert/strict";
import { rankThemes } from "../lib/rank.mjs";

function tweet(id, theme, firm, authorType = "partner", engagement = 0) {
  return { tweetId: id, theme, firm, authorType, engagement };
}

test("returns themes sorted by signalStrength descending", () => {
  const tweets = [
    tweet("1", "AI Agents", "a16z"),
    tweet("2", "AI Agents", "YC"),
    tweet("3", "AI Agents", "Sequoia"),
    tweet("4", "DevTools", "a16z")
  ];

  const ranked = rankThemes(tweets);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].name, "AI Agents");
  assert.equal(ranked[1].name, "DevTools");
  assert.ok(ranked[0].signalStrength >= ranked[1].signalStrength);
});

test("a cross-firm theme outranks an equal-volume single-firm theme", () => {
  const tweets = [
    tweet("a1", "Single", "a16z"),
    tweet("a2", "Single", "a16z"),
    tweet("a3", "Single", "a16z"),
    tweet("b1", "Cross", "a16z"),
    tweet("b2", "Cross", "YC"),
    tweet("b3", "Cross", "Sequoia")
  ];

  const ranked = rankThemes(tweets);
  const cross = ranked.find((t) => t.name === "Cross");
  const single = ranked.find((t) => t.name === "Single");

  assert.ok(cross.signalStrength > single.signalStrength);
});

test("computes firmsInvolved (unique) and partnerSignalCount per theme", () => {
  const tweets = [
    tweet("1", "Theme", "a16z", "partner"),
    tweet("2", "Theme", "YC", "partner"),
    tweet("3", "Theme", "a16z", "founder")
  ];

  const [theme] = rankThemes(tweets);

  assert.deepEqual([...theme.firmsInvolved].sort(), ["YC", "a16z"]);
  assert.equal(theme.partnerSignalCount, 2);
  assert.equal(theme.signalCount, 3);
});

test("representativeTweetIds are the highest-engagement tweets, capped", () => {
  const tweets = [
    tweet("low", "Theme", "a16z", "partner", 5),
    tweet("high", "Theme", "a16z", "partner", 500),
    tweet("mid", "Theme", "YC", "partner", 50),
    tweet("tiny", "Theme", "YC", "partner", 1)
  ];

  const [theme] = rankThemes(tweets, { representativeLimit: 2 });

  assert.deepEqual(theme.representativeTweetIds, ["high", "mid"]);
});

test("signalStrength is clamped to the 0..100 range", () => {
  const tweets = [];
  for (let i = 0; i < 200; i++) {
    tweets.push(tweet(`t${i}`, "Huge", i % 2 ? "a16z" : "YC", "partner", i));
  }

  const [theme] = rankThemes(tweets);

  assert.ok(theme.signalStrength > 0);
  assert.ok(theme.signalStrength <= 100);
});
