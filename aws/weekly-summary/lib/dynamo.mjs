import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

export async function readWeekTweets(ddb, table, weekKey) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: "PK = :pk",
      FilterExpression: "entityType = :t",
      ExpressionAttributeValues: { ":pk": `WEEK#${weekKey}`, ":t": "X_POST" },
      ExclusiveStartKey
    }));
    items.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function putItems(ddb, table, items) {
  for (const item of items) {
    await ddb.send(new PutCommand({ TableName: table, Item: item }));
  }
}
