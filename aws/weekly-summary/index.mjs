// Scheduled Lambda: builds the weekly VC theme memo from the latest ingested
// tweets and stores it as a WEEKLY_MEMO. Triggered by EventBridge ~30 min after
// the ingestion Lambda. LLM credentials come from Secrets Manager.
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createAnthropicClient } from "./lib/llm/anthropic.mjs";
import { parseCredentials } from "./lib/credentials.mjs";
import { runSummary } from "./lib/summarize-run.mjs";
import { isoWeekKey } from "./lib/normalize.mjs";

const TABLE_NAME = process.env.SIGNALS_TABLE_NAME;
const SECRET_NAME = process.env.LLM_CREDENTIALS_SECRET_NAME;

const secrets = new SecretsManagerClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event = {}) {
  if (!TABLE_NAME) throw new Error("Missing SIGNALS_TABLE_NAME");
  if (!SECRET_NAME) throw new Error("Missing LLM_CREDENTIALS_SECRET_NAME");

  const weekKey = event.weekKey ?? isoWeekKey();

  const secretValue = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  const { provider, model, apiKey } = parseCredentials(secretValue.SecretString);
  if (provider !== "anthropic") throw new Error(`Unsupported LLM provider: ${provider}`);

  const llmClient = createAnthropicClient({ apiKey, model });
  const { result, tweetCount, stored } = await runSummary({ ddb, table: TABLE_NAME, weekKey, llmClient });

  return {
    ok: true,
    weekKey,
    tweetCount,
    themes: result.themes.length,
    mode: result.meta.mode,
    webGrounded: result.meta.webGrounded,
    model,
    stored
  };
}
