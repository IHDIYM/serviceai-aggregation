import functions_framework
from aggregation_pipeline import ServiceMetricsAggregator
import logging

# Configure logging for Cloud Functions
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@functions_framework.http
def run_aggregation(request):
    """Cloud Function entry point for running the aggregation pipeline"""
    try:
        # Set CORS headers for web requests
        if request.method == 'OPTIONS':
            headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
            return ('', 204, headers)

        headers = {
            'Access-Control-Allow-Origin': '*'
        }

        # Get interval from request or use default
        request_json = request.get_json(silent=True)
        interval_minutes = request_json.get('interval_minutes', 15) if request_json else 15

        # Run aggregation
        aggregator = ServiceMetricsAggregator()
        result = aggregator.run_aggregation(interval_minutes=interval_minutes)

        if result['success']:
            return {
                'success': True,
                'message': 'Aggregation completed successfully',
                'data': result
            }, 200, headers
        else:
            return {
                'success': False,
                'error': result['error']
            }, 500, headers

    except Exception as e:
        logger.error(f"Cloud Function error: {e}")
        return {
            'success': False,
            'error': str(e)
        }, 500, headers

@functions_framework.cloud_event
def scheduled_aggregation(cloud_event):
    """Cloud Function triggered by Cloud Scheduler"""
    try:
        logger.info("Scheduled aggregation triggered")
        
        # Run aggregation with default 15-minute interval
        aggregator = ServiceMetricsAggregator()
        result = aggregator.run_aggregation(interval_minutes=15)
        
        if result['success']:
            logger.info(f"Scheduled aggregation successful: {result['metrics_summary']}")
        else:
            logger.error(f"Scheduled aggregation failed: {result['error']}")
            
    except Exception as e:
        logger.error(f"Scheduled aggregation error: {e}")
        raise 