// Local test runner: reads the week's tweets from DynamoDB (sthumm_dev),
// runs the summarization pipeline with a user-supplied Anthropic key, and
// stores the WEEKLY_MEMO. Usage:
//   AWS_PROFILE=sthumm_dev AWS_REGION=us-east-1 node bin/run-local.mjs
// Key comes from ANTHROPIC_API_KEY env or aws/weekly-summary/.env.local.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createAnthropicClient } from "../lib/llm/anthropic.mjs";
import { runSummary } from "../lib/summarize-run.mjs";
import { isoWeekKey } from "../lib/normalize.mjs";

function loadEnvLocal() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}

const fileEnv = loadEnvLocal();
// Prefer the file (the user's BYOK key) over any ambient ANTHROPIC_API_KEY,
// which may be set (even to an empty string) in this environment.
const apiKey = fileEnv.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Missing ANTHROPIC_API_KEY (set it in aws/weekly-summary/.env.local or the environment).");
  process.exit(1);
}

const table = process.env.SIGNALS_TABLE_NAME ?? fileEnv.SIGNALS_TABLE_NAME ?? "venture-radar-signals";
const model = process.env.LLM_MODEL ?? fileEnv.LLM_MODEL ?? "claude-opus-4-7";
const weekKey = process.env.WEEK_KEY ?? fileEnv.WEEK_KEY ?? isoWeekKey();
const tweetLimit = Number(process.env.TWEET_LIMIT ?? fileEnv.TWEET_LIMIT ?? 0);
const dryRun = Boolean(process.env.DRY_RUN ?? fileEnv.DRY_RUN);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const llmClient = createAnthropicClient({ apiKey, model });

console.log(`Summarizing WEEK#${weekKey} with ${model}${tweetLimit ? ` (limit ${tweetLimit})` : ""}${dryRun ? " [dry-run]" : ""} ...`);
const started = Date.now();
const { result, tweetCount, stored } = await runSummary({ ddb, table, weekKey, llmClient, tweetLimit, dryRun });

console.log(`\ntweets read: ${tweetCount}`);
console.log(`mode: ${result.meta.mode}   webGrounded: ${result.meta.webGrounded}`);
console.log(`elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`\nRANKED THEMES (${result.themes.length}):`);
for (const t of result.themes.slice(0, 10)) {
  console.log(`  [${String(t.signalStrength).padStart(3)}] ${t.name}  (${t.firmsInvolved.join(", ")})  ${t.citations?.length ?? 0} sources`);
}
console.log(`\nMEMO — ${result.memo.title}`);
console.log(result.memo.body);
console.log(stored
  ? `\nStored SUMMARY#LATEST + SUMMARY#${result.meta.generatedAt} under WEEK#${weekKey}.`
  : `\n[dry-run] Not stored.`);
