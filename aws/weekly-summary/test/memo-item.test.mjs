import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMemoItems } from "../lib/memo-item.mjs";

const result = {
  weekKey: "2026-05-25",
  themes: [{ name: "AI Agents", signalStrength: 90 }],
  memo: { title: "Brief", body: "body" },
  meta: { provider: "anthropic", model: "claude-opus-4-7", generatedAt: "2026-05-25T18:00:00Z", mode: "llm", webGrounded: true }
};

test("buildMemoItems writes a history item and a LATEST pointer", () => {
  const items = buildMemoItems(result);
  assert.equal(items.length, 2);

  const latest = items.find((i) => i.SK === "SUMMARY#LATEST");
  const history = items.find((i) => i.SK === "SUMMARY#2026-05-25T18:00:00Z");
  assert.ok(latest && history);

  for (const item of items) {
    assert.equal(item.PK, "WEEK#2026-05-25");
    assert.equal(item.entityType, "WEEKLY_MEMO");
    assert.deepEqual(item.themes, result.themes);
    assert.deepEqual(item.memo, result.memo);
    assert.deepEqual(item.meta, result.meta);
    assert.equal(item.weekKey, "2026-05-25");
  }
});
