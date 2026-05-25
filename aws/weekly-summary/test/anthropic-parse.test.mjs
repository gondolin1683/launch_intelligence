import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCitations } from "../lib/llm/anthropic-parse.mjs";

test("extractCitations reads citations off text blocks", () => {
  const content = [
    { type: "text", text: "a16z is investing in X", citations: [{ type: "web_search_result_location", url: "https://a16z.com/x", title: "X thesis" }] }
  ];
  assert.deepEqual(extractCitations(content), [{ title: "X thesis", url: "https://a16z.com/x" }]);
});

test("extractCitations reads web_search_tool_result blocks and dedupes by url", () => {
  const content = [
    { type: "text", text: "...", citations: [{ url: "https://a16z.com/x", title: "X" }] },
    { type: "web_search_tool_result", content: [
      { type: "web_search_result", url: "https://a16z.com/x", title: "X dup" },
      { type: "web_search_result", url: "https://a16z.com/y", title: "Y" }
    ] }
  ];
  const cites = extractCitations(content);
  assert.equal(cites.length, 2);
  assert.deepEqual(cites.map((c) => c.url), ["https://a16z.com/x", "https://a16z.com/y"]);
});

test("extractCitations returns [] when there are none", () => {
  assert.deepEqual(extractCitations([{ type: "text", text: "no sources" }]), []);
});
