#!/bin/bash
# ==============================================================
# PLIK: scripts/setup-autostop.sh
# Konfiguruje automatyczne stop/start instancji EC2
# ==============================================================
set -e

INSTANCE_ID=${1:-""}
REGION=${2:-"eu-central-1"}
STOP_HOUR=${3:-18}
START_HOUR=${4:-7}
TZ_NAME=${5:-"Europe/Warsaw"}

[ -z "$INSTANCE_ID" ] && echo "Błąd: podaj INSTANCE_ID jako argument" && exit 1

echo "Konfigurowanie auto-stop dla $INSTANCE_ID w $REGION"
echo "Stop: $STOP_HOUR:00, Start: $START_HOUR:00 ($TZ_NAME, pon-pt)"

# Konwersja godziny lokalnej na UTC
if [ "$TZ_NAME" = "Europe/Warsaw" ]; then
  UTC_STOP=$((STOP_HOUR - 1))
  UTC_START=$((START_HOUR - 1))
  [ $UTC_STOP -lt 0 ] && UTC_STOP=$((24 + UTC_STOP))
  [ $UTC_START -lt 0 ] && UTC_START=$((24 + UTC_START))
else
  UTC_STOP=$STOP_HOUR
  UTC_START=$START_HOUR
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_NAME="infractrl-autostop-role"

# Utwórz rolę IAM
if ! aws iam get-role --role-name $ROLE_NAME &>/dev/null; then
  aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{
        "Effect":"Allow",
        "Principal":{"Service":"scheduler.amazonaws.com"},
        "Action":"sts:AssumeRole"
      }]
    }' > /dev/null

  aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess

  echo "  ✓ Rola IAM utworzona: $ROLE_NAME"
else
  echo "  ✓ Rola IAM już istnieje: $ROLE_NAME"
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# EventBridge Scheduler - STOP
aws scheduler create-schedule \
  --name "infractrl-stop-${INSTANCE_ID}" \
  --schedule-expression "cron(0 ${UTC_STOP} ? * MON-FRI *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{
    \"Arn\": \"arn:aws:scheduler:::aws-sdk:ec2:stopInstances\",
    \"RoleArn\": \"${ROLE_ARN}\",
    \"Input\": \"{\\\"InstanceIds\\\": [\\\"${INSTANCE_ID}\\\"]}\",
    \"RetryPolicy\": {\"MaximumRetryAttempts\": 3}
  }" \
  --region "$REGION" 2>/dev/null || \
aws scheduler update-schedule \
  --name "infractrl-stop-${INSTANCE_ID}" \
  --schedule-expression "cron(0 ${UTC_STOP} ? * MON-FRI *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{
    \"Arn\": \"arn:aws:scheduler:::aws-sdk:ec2:stopInstances\",
    \"RoleArn\": \"${ROLE_ARN}\",
    \"Input\": \"{\\\"InstanceIds\\\": [\\\"${INSTANCE_ID}\\\"]}\",
    \"RetryPolicy\": {\"MaximumRetryAttempts\": 3}
  }" \
  --region "$REGION"

echo "  ✓ Auto-stop: pon-pt o ${STOP_HOUR}:00"

# EventBridge Scheduler - START
aws scheduler create-schedule \
  --name "infractrl-start-${INSTANCE_ID}" \
  --schedule-expression "cron(0 ${UTC_START} ? * MON-FRI *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{
    \"Arn\": \"arn:aws:scheduler:::aws-sdk:ec2:startInstances\",
    \"RoleArn\": \"${ROLE_ARN}\",
    \"Input\": \"{\\\"InstanceIds\\\": [\\\"${INSTANCE_ID}\\\"]}\",
    \"RetryPolicy\": {\"MaximumRetryAttempts\": 3}
  }" \
  --region "$REGION" 2>/dev/null || \
aws scheduler update-schedule \
  --name "infractrl-start-${INSTANCE_ID}" \
  --schedule-expression "cron(0 ${UTC_START} ? * MON-FRI *)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --target "{
    \"Arn\": \"arn:aws:scheduler:::aws-sdk:ec2:startInstances\",
    \"RoleArn\": \"${ROLE_ARN}\",
    \"Input\": \"{\\\"InstanceIds\\\": [\\\"${INSTANCE_ID}\\\"]}\",
    \"RetryPolicy\": {\"MaximumRetryAttempts\": 3}
  }" \
  --region "$REGION"

echo "  ✓ Auto-start: pon-pt o ${START_HOUR}:00"
echo "Gotowe!"
