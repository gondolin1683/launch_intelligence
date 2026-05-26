# Weekly X Ingestion

This folder contains the AWS scheduled ingestion path for Venture Radar.

Architecture:

- EventBridge schedule runs once per week.
- Lambda reads `weekly-ingestion/trackedAccounts.json`, which is synced from the app's `data/trackedAccounts.json`.
- Lambda calls X API recent search for the last 7 days of partner posts.
- Lambda writes raw normalized posts to DynamoDB.
- X API Bearer Token is stored in AWS Secrets Manager.

## X API Setup

1. Create or use an X Developer account.
2. Create an X app in the developer portal.
3. Copy the app Bearer Token.
4. Store it in Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name venture-radar/x-bearer-token \
  --secret-string "YOUR_X_BEARER_TOKEN"
```

The Lambda uses X API v2 recent search:

- Endpoint: `https://api.x.com/2/tweets/search/recent`
- Query shape: `(from:handle1 OR from:handle2) -is:retweet`
- Window: last 7 days via `start_time`
- Fields: `created_at,public_metrics,author_id,conversation_id,referenced_tweets`

## Deploy With AWS CLI

The repo includes a deploy script that creates or updates Secrets Manager, DynamoDB, IAM, Lambda, and EventBridge.

First deploy with a token:

```bash
X_BEARER_TOKEN="YOUR_X_BEARER_TOKEN" ./scripts/deploy-aws-ingestion.sh
```

Later deploys can omit the token if the secret already exists:

```bash
./scripts/deploy-aws-ingestion.sh
```

## Deploy With SAM

If you prefer SAM, install AWS SAM CLI, then run:

```bash
npm run sync:aws-accounts
cd aws
sam build
sam deploy --guided
```

Use the default secret name unless you created a different Secrets Manager secret.

The default schedule is:

```text
cron(0 14 ? * MON *)
```

That means Monday at 14:00 UTC.

## DynamoDB Access Patterns

The table is `venture-radar-signals`.

Primary key:

- `PK = WEEK#2026-05-25`
- `SK = FIRM#a16z#HANDLE#pmarca#TWEET#123`

GSI by account:

- `GSI1PK = ACCOUNT#pmarca`
- `GSI1SK = tweet createdAt`

GSI by firm:

- `GSI2PK = FIRM#a16z`
- `GSI2SK = tweet createdAt`

## Notes

- The job stores raw normalized posts first. Summarization should run as a separate step after ingestion succeeds.
- The X recent search endpoint covers the last 7 days, so weekly scheduling is the right fit.
- Keep AWS credentials out of chat and source control. Use AWS profiles, IAM roles, or environment variables locally.
