import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { WeeklyMemoResult } from "./types";

const TABLE_NAME = process.env.SIGNALS_TABLE_NAME ?? "venture-radar-signals";
const REGION = process.env.AWS_REGION ?? "us-east-1";

function isoWeekKey(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString().slice(0, 10);
}

// Reads the current ISO week's generated memo from DynamoDB. Returns null on any
// failure (missing creds, table, or no memo yet) so the dashboard falls back to seed.
export async function getLatestWeeklyMemo(weekKey = isoWeekKey()): Promise<WeeklyMemoResult | null> {
  try {
    const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `WEEK#${weekKey}`, SK: "SUMMARY#LATEST" }
      })
    );
    const item = res.Item;
    if (!item || !Array.isArray(item.themes) || !item.memo) return null;
    return {
      weekKey: item.weekKey,
      themes: item.themes,
      memo: item.memo,
      meta: item.meta
    } as WeeklyMemoResult;
  } catch {
    return null;
  }
}
