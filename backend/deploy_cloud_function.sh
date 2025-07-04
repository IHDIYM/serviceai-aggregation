#!/bin/bash

# Deploy Cloud Function for Service Metrics Aggregation
# Make sure you have gcloud CLI installed and authenticated

PROJECT_ID="serviceai-51fb9"
FUNCTION_NAME="service-metrics-aggregator"
REGION="us-central1"
RUNTIME="python311"

echo "🚀 Deploying Service Metrics Aggregation Cloud Function..."

# Deploy the HTTP function
gcloud functions deploy $FUNCTION_NAME \
    --gen2 \
    --runtime=$RUNTIME \
    --region=$REGION \
    --source=. \
    --entry-point=run_aggregation \
    --trigger=http \
    --allow-unauthenticated \
    --project=$PROJECT_ID

echo "✅ HTTP Function deployed successfully!"

# Deploy the scheduled function
SCHEDULED_FUNCTION_NAME="scheduled-metrics-aggregator"

gcloud functions deploy $SCHEDULED_FUNCTION_NAME \
    --gen2 \
    --runtime=$RUNTIME \
    --region=$REGION \
    --source=. \
    --entry-point=scheduled_aggregation \
    --trigger-topic=metrics-aggregation-topic \
    --project=$PROJECT_ID

echo "✅ Scheduled Function deployed successfully!"

# Create Cloud Scheduler job (runs every 15 minutes)
gcloud scheduler jobs create http metrics-aggregation-job \
    --schedule="*/15 * * * *" \
    --uri="https://$REGION-$PROJECT_ID.cloudfunctions.net/$SCHEDULED_FUNCTION_NAME" \
    --http-method=POST \
    --project=$PROJECT_ID

echo "✅ Cloud Scheduler job created successfully!"
echo "📊 Aggregation pipeline will run every 15 minutes" 