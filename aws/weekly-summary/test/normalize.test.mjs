import { test } from "node:test";
import assert from "node:assert/strict";
import { ddbItemToTweet, isoWeekKey } from "../lib/normalize.mjs";

test("ddbItemToTweet maps fields and sums engagement", () => {
  const item = {
    tweetId: "123",
    firm: "a16z",
    authorType: "partner",
    text: "Agents are eating workflows",
    publicMetrics: { like_count: 10, retweet_count: 2, reply_count: 3 }
  };
  assert.deepEqual(ddbItemToTweet(item), {
    tweetId: "123",
    firm: "a16z",
    authorType: "partner",
    text: "Agents are eating workflows",
    engagement: 15
  });
});

test("ddbItemToTweet tolerates missing publicMetrics", () => {
  const tweet = ddbItemToTweet({ tweetId: "1", firm: "YC", authorType: "partner", text: "hi" });
  assert.equal(tweet.engagement, 0);
});

test("isoWeekKey returns the Monday of the ISO week (matches ingestion Lambda)", () => {
  assert.equal(isoWeekKey(new Date("2026-05-25T09:00:00Z")), "2026-05-25"); // Monday
  assert.equal(isoWeekKey(new Date("2026-05-27T09:00:00Z")), "2026-05-25"); // Wednesday
  assert.equal(isoWeekKey(new Date("2026-05-31T23:00:00Z")), "2026-05-25"); // Sunday
});
