#!/usr/bin/env bash
set -euo pipefail

TABLE_NAME="${TABLE_NAME:-venture-radar-signals}"
FUNCTION_NAME="${FUNCTION_NAME:-venture-radar-weekly-ingestion}"
RULE_NAME="${RULE_NAME:-venture-radar-weekly-ingestion}"
ROLE_NAME="${ROLE_NAME:-venture-radar-weekly-ingestion-role}"
SECRET_NAME="${SECRET_NAME:-venture-radar/x-bearer-token}"
SCHEDULE_EXPRESSION="${SCHEDULE_EXPRESSION:-cron(0 14 ? * MON *)}"
REGION="${AWS_REGION:-$(aws configure get region)}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
ZIP_PATH="/tmp/${FUNCTION_NAME}.zip"

if [[ -z "${REGION}" ]]; then
  echo "AWS region is not configured. Set AWS_REGION or run aws configure." >&2
  exit 1
fi

echo "Syncing tracked accounts into Lambda package..."
npm run sync:aws-accounts

if [[ -n "${X_BEARER_TOKEN:-}" ]]; then
  echo "Creating or updating Secrets Manager secret..."
  if aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value \
      --secret-id "${SECRET_NAME}" \
      --secret-string "${X_BEARER_TOKEN}" \
      --region "${REGION}" >/dev/null
  else
    aws secretsmanager create-secret \
      --name "${SECRET_NAME}" \
      --secret-string "${X_BEARER_TOKEN}" \
      --region "${REGION}" >/dev/null
  fi
else
  echo "Using existing Secrets Manager secret..."
  if ! aws secretsmanager describe-secret --secret-id "${SECRET_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    echo "Secret ${SECRET_NAME} does not exist. Set X_BEARER_TOKEN to create it." >&2
    exit 1
  fi
fi

echo "Creating DynamoDB table if needed..."
if ! aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  aws dynamodb create-table \
    --table-name "${TABLE_NAME}" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=GSI1PK,AttributeType=S \
      AttributeName=GSI1SK,AttributeType=S \
      AttributeName=GSI2PK,AttributeType=S \
      AttributeName=GSI2SK,AttributeType=S \
    --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
      "IndexName=by-account,KeySchema=[{AttributeName=GSI1PK,KeyType=HASH},{AttributeName=GSI1SK,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
      "IndexName=by-firm,KeySchema=[{AttributeName=GSI2PK,KeyType=HASH},{AttributeName=GSI2SK,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
    --region "${REGION}" >/dev/null
  aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
fi

echo "Creating IAM role if needed..."
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": { "Service": "lambda.amazonaws.com" },
          "Action": "sts:AssumeRole"
        }
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
        \"Action\": [
          \"logs:CreateLogGroup\",
          \"logs:CreateLogStream\",
          \"logs:PutLogEvents\"
        ],
        \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"dynamodb:PutItem\",
          \"dynamodb:BatchWriteItem\",
          \"dynamodb:GetItem\",
          \"dynamodb:Query\"
        ],
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
  cd aws/weekly-ingestion
  npm install --omit=dev >/dev/null
  rm -f "${ZIP_PATH}"
  zip -qr "${ZIP_PATH}" .
)

echo "Creating or updating Lambda function..."
if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "${REGION}" >/dev/null
  aws lambda wait function-updated --function-name "${FUNCTION_NAME}" --region "${REGION}"
  aws lambda update-function-configuration \
    --function-name "${FUNCTION_NAME}" \
    --runtime nodejs20.x \
    --handler index.handler \
    --timeout 300 \
    --memory-size 512 \
    --environment "Variables={SIGNALS_TABLE_NAME=${TABLE_NAME},X_BEARER_TOKEN_SECRET_NAME=${SECRET_NAME}}" \
    --role "${ROLE_ARN}" \
    --region "${REGION}" >/dev/null
else
  sleep 10
  aws lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --runtime nodejs20.x \
    --handler index.handler \
    --architectures arm64 \
    --timeout 300 \
    --memory-size 512 \
    --role "${ROLE_ARN}" \
    --environment "Variables={SIGNALS_TABLE_NAME=${TABLE_NAME},X_BEARER_TOKEN_SECRET_NAME=${SECRET_NAME}}" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "${REGION}" >/dev/null
fi

aws lambda wait function-active --function-name "${FUNCTION_NAME}" --region "${REGION}"

echo "Creating or updating EventBridge schedule..."
aws events put-rule \
  --name "${RULE_NAME}" \
  --schedule-expression "${SCHEDULE_EXPRESSION}" \
  --state ENABLED \
  --description "Run Venture Radar partner X ingestion weekly." \
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

echo "Deployed weekly ingestion:"
echo "  Table: ${TABLE_NAME}"
echo "  Secret: ${SECRET_NAME}"
echo "  Function: ${FUNCTION_NAME}"
echo "  Schedule: ${SCHEDULE_EXPRESSION}"
