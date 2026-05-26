import { readWeekTweets, putItems } from "./dynamo.mjs";
import { ddbItemToTweet } from "./normalize.mjs";
import { runPipeline } from "./pipeline.mjs";
import { buildMemoItems } from "./memo-item.mjs";

// Composes the tested pieces: read week's tweets -> run pipeline -> store memo.
export async function runSummary({ ddb, table, weekKey, llmClient, tweetLimit = 0, dryRun = false }) {
  const rawItems = await readWeekTweets(ddb, table, weekKey);
  let tweets = rawItems.map(ddbItemToTweet).filter((t) => t.text && t.tweetId);
  if (tweetLimit > 0) tweets = tweets.slice(0, tweetLimit);
  const result = await runPipeline({ weekKey, tweets, client: llmClient });
  if (!dryRun) await putItems(ddb, table, buildMemoItems(result));
  return { result, tweetCount: tweets.length, stored: !dryRun };
}
