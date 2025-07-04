#!/usr/bin/env python3
"""
Continuous aggregation runner
Runs the aggregation pipeline every 15 minutes in the background
"""

import time
import schedule
import logging
from datetime import datetime
from aggregation_pipeline import ServiceMetricsAggregator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('continuous_aggregation.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def run_aggregation():
    """Run the aggregation pipeline"""
    try:
        logger.info("🔄 Starting scheduled aggregation...")
        aggregator = ServiceMetricsAggregator()
        result = aggregator.run_aggregation(interval_minutes=15)
        
        if result['success']:
            logger.info(f"✅ Aggregation successful: {result['metrics_summary']}")
        else:
            logger.error(f"❌ Aggregation failed: {result['error']}")
            
    except Exception as e:
        logger.error(f"💥 Aggregation error: {e}")

def main():
    """Main function to run continuous aggregation"""
    logger.info("🚀 Starting continuous aggregation service...")
    logger.info("📊 Will run every 15 minutes")
    
    # Schedule the job to run every 15 minutes
    schedule.every(15).minutes.do(run_aggregation)
    
    # Run immediately on startup
    run_aggregation()
    
    # Keep running
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
            
    except KeyboardInterrupt:
        logger.info("🛑 Stopping aggregation service...")
    except Exception as e:
        logger.error(f"💥 Service error: {e}")

if __name__ == "__main__":
    main() 