#!/usr/bin/env bash
set -euo pipefail

# Deploys the weekly summarization Lambda. Reuses the existing DynamoDB table
# created by the ingestion deploy. Run with the sthumm_dev profile:
#   AWS_PROFILE=sthumm_dev LLM_API_KEY="sk-ant-..." ./scripts/deploy-aws-summary.sh
# LLM_API_KEY is only needed the first time (to create the credentials secret) or
# to rotate it; subsequent deploys reuse the stored secret.

TABLE_NAME="${TABLE_NAME:-venture-radar-signals}"
FUNCTION_NAME="${FUNCTION_NAME:-venture-radar-weekly-summary}"
RULE_NAME="${RULE_NAME:-venture-radar-weekly-summary}"
ROLE_NAME="${ROLE_NAME:-venture-radar-weekly-summary-role}"
SECRET_NAME="${SECRET_NAME:-venture-radar/llm-credentials}"
SCHEDULE_EXPRESSION="${SCHEDULE_EXPRESSION:-cron(30 14 ? * MON *)}"
LLM_PROVIDER="${LLM_PROVIDER:-anthropic}"
LLM_MODEL="${LLM_MODEL:-claude-sonnet-4-6}"
REGION="${AWS_REGION:-$(aws configure get region)}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
ZIP_PATH="/tmp/${FUNCTION_NAME}.zip"

if [[ -z "${REGION}" ]]; then
  echo "AWS region is not configured. Set AWS_REGION or run aws configure." >&2
  exit 1
fi

echo "Deploying ${FUNCTION_NAME} to account ${ACCOUNT_ID} (${REGION})"

if [[ -n "${LLM_API_KEY:-}" ]]; then
  echo "Creating or updating LLM credentials secret..."
  SECRET_JSON=$(LLM_PROVIDER="${LLM_PROVIDER}" LLM_MODEL="${LLM_MODEL}" LLM_API_KEY="${LLM_API_KEY}" \
    node -e 'process.stdout.write(JSON.stringify({provider:process.env.LLM_PROVIDER,model:process.env.LLM_MODEL,apiKey:process.env.LLM_API_KEY}))')
  if aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "${SECRET_NAME}" --secret-string "${SECRET_JSON}" --region "${REGION}" >/dev/null
  else
    aws secretsmanager create-secret --name "${SECRET_NAME}" --secret-string "${SECRET_JSON}" --region "${REGION}" >/dev/null
  fi
else
  echo "Using existing LLM credentials secret..."
  if ! aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "Secret ${SECRET_NAME} does not exist. Set LLM_API_KEY to create it." >&2
    exit 1
  fi
fi

echo "Creating IAM role if needed..."
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }
      ]
    }' >/dev/null
fi

aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${ROLE_NAME}-policy" \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"logs:CreateLogGroup\", \"logs:CreateLogStream\", \"logs:PutLogEvents\"],
        \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"dynamodb:PutItem\", \"dynamodb:BatchWriteItem\", \"dynamodb:GetItem\", \"dynamodb:Query\"],
        \"Resource\": [
          \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}\",
          \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}/index/*\"
        ]
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": \"secretsmanager:GetSecretValue\",
        \"Resource\": \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${SECRET_NAME}*\"
      }
    ]
  }" >/dev/null

echo "Packaging Lambda..."
(
  cd aws/weekly-summary
  npm install --omit=dev >/dev/null
  rm -f "${ZIP_PATH}"
  # Explicit includes so .env.local, tests, and the local runner are never packaged.
  zip -qr "${ZIP_PATH}" index.mjs lib package.json node_modules
)

echo "Creating or updating Lambda function..."
if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "${FUNCTION_NAME}" --zip-file "fileb://${ZIP_PATH}" --region "${REGION}" >/dev/null
  aws lambda wait function-updated --function-name "${FUNCTION_NAME}" --region "${REGION}"
  aws lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --runtime nodejs20.x --handler index.handler --timeout 900 --memory-size 1024 \
    --environment "Variables={SIGNALS_TABLE_NAME=${TABLE_NAME},LLM_CREDENTIALS_SECRET_NAME=${SECRET_NAME}}" \
    --role "${ROLE_ARN}" --region "${REGION}" >/dev/null
else
  sleep 10
  aws lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --runtime nodejs20.x --handler index.handler --architectures arm64 --timeout 900 --memory-size 1024 \
    --role "${ROLE_ARN}" \
    --environment "Variables={SIGNALS_TABLE_NAME=${TABLE_NAME},LLM_CREDENTIALS_SECRET_NAME=${SECRET_NAME}}" \
    --zip-file "fileb://${ZIP_PATH}" --region "${REGION}" >/dev/null
fi

aws lambda wait function-active --function-name "${FUNCTION_NAME}" --region "${REGION}"

echo "Creating or updating EventBridge schedule..."
aws events put-rule \
  --name "${RULE_NAME}" \
  --schedule-expression "${SCHEDULE_EXPRESSION}" \
  --state ENABLED \
  --description "Run Venture Radar weekly theme summarization after ingestion." \
  --region "${REGION}" >/dev/null

RULE_ARN="$(aws events describe-rule --name "${RULE_NAME}" --region "${REGION}" --query Arn --output text)"
FUNCTION_ARN="$(aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" --query Configuration.FunctionArn --output text)"

aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id "${RULE_NAME}-invoke" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "${RULE_ARN}" \
  --region "${REGION}" >/dev/null 2>&1 || true

aws events put-targets \
  --rule "${RULE_NAME}" \
  --targets "Id=${FUNCTION_NAME},Arn=${FUNCTION_ARN}" \
  --region "${REGION}" >/dev/null

echo "Deployed weekly summarization:"
echo "  Table:    ${TABLE_NAME} (existing)"
echo "  Secret:   ${SECRET_NAME}"
echo "  Function: ${FUNCTION_NAME} (timeout 900s)"
echo "  Schedule: ${SCHEDULE_EXPRESSION}"
