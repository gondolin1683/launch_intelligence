import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const __dirname = dirname(fileURLToPath(import.meta.url));
const trackedAccountsPath = resolve(__dirname, "trackedAccounts.json");

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});

const TABLE_NAME = process.env.SIGNALS_TABLE_NAME;
const SECRET_NAME = process.env.X_BEARER_TOKEN_SECRET_NAME;

function assertConfig() {
  if (!TABLE_NAME) throw new Error("Missing SIGNALS_TABLE_NAME");
  if (!SECRET_NAME) throw new Error("Missing X_BEARER_TOKEN_SECRET_NAME");
}

function startOfIsoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function isoWeekKey(date = new Date()) {
  return startOfIsoWeek(date).toISOString().slice(0, 10);
}

function sinceSevenDaysIso(date = new Date()) {
  const xApiSafetyBufferMs = 10 * 60 * 1000;
  return new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000 + xApiSafetyBufferMs).toISOString();
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeSecret(secretValue) {
  if (secretValue.SecretString) {
    try {
      const parsed = JSON.parse(secretValue.SecretString);
      return parsed.X_BEARER_TOKEN ?? parsed.bearerToken ?? parsed.token ?? secretValue.SecretString;
    } catch {
      return secretValue.SecretString;
    }
  }

  if (secretValue.SecretBinary) {
    return Buffer.from(secretValue.SecretBinary, "base64").toString("utf8");
  }

  throw new Error("Secret did not contain a token");
}

async function getBearerToken() {
  const secretValue = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  return normalizeSecret(secretValue).trim();
}

async function loadTrackedAccounts() {
  const accounts = JSON.parse(await readFile(trackedAccountsPath, "utf8"));
  return Array.from(
    new Map(
      accounts
        .filter((account) => account.platform === "X" && account.type === "partner")
        .map((account) => [account.handle.toLowerCase(), account])
    ).values()
  );
}

async function fetchBatch({ accounts, bearerToken, startTime }) {
  const query = `(${accounts.map((account) => `from:${account.handle}`).join(" OR ")}) -is:retweet`;
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("start_time", startTime);
  url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id,conversation_id,referenced_tweets");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,name,verified");
  url.searchParams.set("max_results", "100");

  const tweets = [];
  let nextToken;

  do {
    if (nextToken) url.searchParams.set("next_token", nextToken);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X API request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const usersById = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]));
    const accountsByHandle = new Map(accounts.map((account) => [account.handle.toLowerCase(), account]));

    for (const tweet of payload.data ?? []) {
      const user = usersById.get(tweet.author_id);
      const account = user ? accountsByHandle.get(user.username.toLowerCase()) : undefined;
      tweets.push({ tweet, user, account });
    }

    nextToken = payload.meta?.next_token;
  } while (nextToken);

  return tweets;
}

function toDynamoItem({ tweet, user, account, weekKey, ingestedAt }) {
  const handle = user?.username ?? account?.handle ?? "unknown";
  const firm = account?.firm ?? "Unknown";
  const createdAt = tweet.created_at ?? ingestedAt;

  return {
    PK: `WEEK#${weekKey}`,
    SK: `FIRM#${firm}#HANDLE#${handle.toLowerCase()}#TWEET#${tweet.id}`,
    GSI1PK: `ACCOUNT#${handle.toLowerCase()}`,
    GSI1SK: createdAt,
    GSI2PK: `FIRM#${firm}`,
    GSI2SK: createdAt,
    entityType: "X_POST",
    tweetId: tweet.id,
    url: `https://x.com/${handle}/status/${tweet.id}`,
    text: tweet.text,
    createdAt,
    ingestedAt,
    weekKey,
    source: "X",
    firm,
    author: account?.name ?? user?.name ?? handle,
    handle,
    authorType: account?.type ?? "partner",
    role: account?.role,
    sourceUrl: account?.sourceUrl,
    publicMetrics: tweet.public_metrics ?? {},
    conversationId: tweet.conversation_id,
    referencedTweets: tweet.referenced_tweets ?? []
  };
}

async function storeTweets({ tweets, weekKey, ingestedAt }) {
  let stored = 0;

  for (const tweet of tweets) {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: toDynamoItem({ ...tweet, weekKey, ingestedAt })
      })
    );
    stored += 1;
  }

  return stored;
}

async function storeRunSummary({ weekKey, ingestedAt, trackedAccounts, batches, fetched, stored, errors }) {
  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `WEEK#${weekKey}`,
        SK: `RUN#${ingestedAt}`,
        GSI1PK: "INGESTION_RUNS",
        GSI1SK: ingestedAt,
        GSI2PK: "INGESTION_RUNS",
        GSI2SK: ingestedAt,
        entityType: "INGESTION_RUN",
        weekKey,
        ingestedAt,
        trackedAccounts,
        batches,
        fetched,
        stored,
        ok: errors.length === 0,
        errors
      }
    })
  );
}

export async function handler(event = {}) {
  assertConfig();

  const now = new Date();
  const weekKey = event.weekKey ?? isoWeekKey(now);
  const startTime = event.startTime ?? sinceSevenDaysIso(now);
  const ingestedAt = now.toISOString();
  const bearerToken = await getBearerToken();
  const trackedAccounts = await loadTrackedAccounts();
  const batches = chunk(trackedAccounts, 8);

  let fetched = 0;
  let stored = 0;
  const errors = [];

  for (const accounts of batches) {
    try {
      const tweets = await fetchBatch({ accounts, bearerToken, startTime });
      fetched += tweets.length;
      stored += await storeTweets({ tweets, weekKey, ingestedAt });
    } catch (error) {
      errors.push({
        handles: accounts.map((account) => account.handle),
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await storeRunSummary({
    weekKey,
    ingestedAt,
    trackedAccounts: trackedAccounts.length,
    batches: batches.length,
    fetched,
    stored,
    errors
  });

  return {
    ok: errors.length === 0,
    weekKey,
    startTime,
    trackedAccounts: trackedAccounts.length,
    batches: batches.length,
    fetched,
    stored,
    errors
  };
}
