#!/bin/bash

# Setup local cron job for aggregation pipeline
# This runs the aggregation every 15 minutes on your local machine

echo "🚀 Setting up local cron job for aggregation pipeline..."

# Get the absolute path to the backend directory
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$BACKEND_DIR/aggregation_pipeline.py"

# Create the cron job entry
CRON_JOB="*/15 * * * * cd $BACKEND_DIR && python $PYTHON_SCRIPT >> $BACKEND_DIR/aggregation.log 2>&1"

echo "📋 Cron job to be added:"
echo "$CRON_JOB"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "aggregation_pipeline.py"; then
    echo "⚠️  Cron job already exists. Removing old entry..."
    crontab -l 2>/dev/null | grep -v "aggregation_pipeline.py" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job added successfully!"
echo "📊 Aggregation will run every 15 minutes"
echo "📝 Logs will be saved to: $BACKEND_DIR/aggregation.log"
echo ""
echo "🔍 To check if it's working:"
echo "   tail -f $BACKEND_DIR/aggregation.log"
echo ""
echo "🛑 To stop the cron job:"
echo "   crontab -e"
echo "   (then delete the line with aggregation_pipeline.py)" 