import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCredentials } from "../lib/credentials.mjs";

test("parseCredentials reads provider, model, and apiKey", () => {
  const out = parseCredentials(JSON.stringify({ provider: "anthropic", model: "claude-opus-4-7", apiKey: "sk-x" }));
  assert.deepEqual(out, { provider: "anthropic", model: "claude-opus-4-7", apiKey: "sk-x" });
});

test("parseCredentials defaults provider and model when omitted", () => {
  const out = parseCredentials(JSON.stringify({ apiKey: "sk-x" }));
  assert.equal(out.provider, "anthropic");
  assert.equal(out.model, "claude-sonnet-4-6");
});

test("parseCredentials accepts ANTHROPIC_API_KEY as an alias for apiKey", () => {
  const out = parseCredentials(JSON.stringify({ ANTHROPIC_API_KEY: "sk-y" }));
  assert.equal(out.apiKey, "sk-y");
});

test("parseCredentials throws when no api key is present", () => {
  assert.throws(() => parseCredentials(JSON.stringify({ model: "claude-sonnet-4-6" })));
});

test("parseCredentials throws on invalid JSON", () => {
  assert.throws(() => parseCredentials("not json"));
});
