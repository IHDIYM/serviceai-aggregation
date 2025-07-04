import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import logging
import os
import re
import pytz

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set timezone to IST (UTC+5:30)
IST = pytz.timezone('Asia/Kolkata')

def get_interval_from_env(interval_minutes=15):
    interval_start_str = os.environ.get('INTERVAL_START')
    if interval_start_str:
        # Parse ISO string in UTC
        start_time = datetime.strptime(interval_start_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        end_time = start_time + timedelta(minutes=interval_minutes)
        return start_time, end_time
    else:
        # Fallback to old logic (local time, rounded down)
        now = datetime.now(timezone.utc)
        minutes_to_subtract = now.minute % interval_minutes
        start_time = now.replace(minute=now.minute - minutes_to_subtract, second=0, microsecond=0)
        end_time = start_time + timedelta(minutes=interval_minutes)
        return start_time, end_time

class ServiceMetricsAggregator:
    def __init__(self):
        """Initialize Firebase Admin and Firestore client"""
        try:
            # Initialize Firebase Admin (use existing service account)
            if not firebase_admin._apps:
                cred = credentials.Certificate("serviceAccountKey.json")
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            logger.info("Firebase Admin initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin: {e}")
            raise

    def get_date_range(self, interval_minutes=15):
        """Get the date range for the current aggregation interval"""
        now = datetime.now(IST)
        
        # Round down to the nearest interval
        minutes_to_subtract = now.minute % interval_minutes
        start_time = now.replace(minute=now.minute - minutes_to_subtract, second=0, microsecond=0)
        end_time = start_time + timedelta(minutes=interval_minutes)
        
        return start_time, end_time

    def fetch_requests_data(self, start_time, end_time):
        """Fetch requests data for the given time range"""
        try:
            requests_ref = self.db.collection('requests')
            
            # Query for requests created in the time range
            requests = requests_ref \
                .where('createdAt', '>=', start_time) \
                .where('createdAt', '<', end_time) \
                .stream()
            
            return list(requests)
        except Exception as e:
            logger.error(f"Failed to fetch requests data: {e}")
            return []

    def convert_timestamp(self, timestamp):
        """Convert Firestore timestamp to Python datetime"""
        if timestamp is None:
            return None
        if hasattr(timestamp, 'timestamp'):
            return timestamp
        return timestamp

    def calculate_metrics(self, requests_data):
        """Calculate comprehensive metrics from requests data"""
        metrics = {
            'total_requests': 0,
            'requests_by_status': defaultdict(int),
            'requests_by_technician': defaultdict(int),
            'requests_by_hour': defaultdict(int),
            'assign_times': [],
            'resolution_times': [],
            'technician_performance': defaultdict(lambda: {
                'total_requests': 0,
                'completed_requests': 0,
                'avg_resolution_time': 0,
                'total_resolution_time': 0
            }),
            'hourly_distribution': defaultdict(int),
            'status_transitions': defaultdict(int)
        }

        for doc in requests_data:
            data = doc.to_dict()
            metrics['total_requests'] += 1

            # Extract timestamps
            created = self.convert_timestamp(data.get('createdAt'))
            accepted = self.convert_timestamp(data.get('acceptedAt'))
            closed = self.convert_timestamp(data.get('closedAt'))
            
            status = data.get('status', 'unknown')
            technician_id = data.get('technicianId')
            technician_name = data.get('technicianName', 'Unknown')
            author_name = data.get('authorName', 'Unknown')

            # Status distribution
            metrics['requests_by_status'][status] += 1

            # Technician distribution
            if technician_id:
                metrics['requests_by_technician'][technician_name] += 1

            # Hourly distribution
            if created:
                hour = created.hour
                metrics['hourly_distribution'][hour] += 1

            # Calculate time metrics
            if created and accepted:
                assign_time = (accepted - created).total_seconds()
                metrics['assign_times'].append(assign_time)

            if created and closed:
                resolution_time = (closed - created).total_seconds()
                metrics['resolution_times'].append(resolution_time)

            # Technician performance metrics
            if technician_id and technician_name:
                tech_metrics = metrics['technician_performance'][technician_name]
                tech_metrics['total_requests'] += 1
                
                if status == 'closed':
                    tech_metrics['completed_requests'] += 1
                
                if created and closed:
                    resolution_time = (closed - created).total_seconds()
                    tech_metrics['total_resolution_time'] += resolution_time

        # Calculate averages and finalize metrics
        metrics['avg_assign_time'] = sum(metrics['assign_times']) / len(metrics['assign_times']) if metrics['assign_times'] else 0
        metrics['avg_resolution_time'] = sum(metrics['resolution_times']) / len(metrics['resolution_times']) if metrics['resolution_times'] else 0
        
        # Calculate technician performance averages
        for tech_name, tech_data in metrics['technician_performance'].items():
            if tech_data['completed_requests'] > 0:
                tech_data['avg_resolution_time'] = tech_data['total_resolution_time'] / tech_data['completed_requests']

        # Convert defaultdict to regular dict for JSON serialization
        metrics['requests_by_status'] = dict(metrics['requests_by_status'])
        metrics['requests_by_technician'] = dict(metrics['requests_by_technician'])
        metrics['hourly_distribution'] = dict(metrics['hourly_distribution'])
        metrics['technician_performance'] = dict(metrics['technician_performance'])

        return metrics

    def to_regular_dict(self, obj):
        if isinstance(obj, defaultdict):
            obj = dict(obj)
        if isinstance(obj, dict):
            return {str(k): self.to_regular_dict(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.to_regular_dict(i) for i in obj]
        else:
            return obj

    def save_metrics(self, metrics, start_time, end_time, custom_id=None):
        """Save aggregated metrics to Firestore"""
        try:
            # Create metrics document
            metrics = self.to_regular_dict(metrics)
            metrics_doc = {
                'interval_start': start_time.isoformat() if hasattr(start_time, 'isoformat') else str(start_time),
                'interval_end': end_time.isoformat() if hasattr(end_time, 'isoformat') else str(end_time),
                'generated_at': datetime.now(IST).isoformat(),
                'metrics': metrics
            }

            # Save to metrics collection
            if custom_id:
                doc_id = custom_id
            else:
                # Create a more robust document ID
                start_str = start_time.strftime('%Y%m%d_%H%M')
                end_str = end_time.strftime('%H%M')
                doc_id = f"{start_str}_{end_str}"
            
            # Ensure doc_id is a valid string and clean it
            doc_id = str(doc_id).replace(':', '').replace(' ', '').replace('.', '')
            
            # Ensure it's not empty and is valid
            if not doc_id or len(doc_id.strip()) == 0:
                doc_id = f"metrics_{int(datetime.now(IST).timestamp())}"
            
            # Additional validation for Firestore document ID
            if not doc_id or len(doc_id) > 1500:  # Firestore limit
                doc_id = f"metrics_{int(datetime.now(IST).timestamp())}"
            
            logger.info(f"Saving metrics with document ID: {doc_id}")
            logger.info(f"Document ID type: {type(doc_id)}, length: {len(doc_id)}")
            logger.info(f"Collection path: service_metrics")
            
            # Validate document ID
            if not isinstance(doc_id, str):
                doc_id = str(doc_id)
            
            if len(doc_id.strip()) == 0:
                doc_id = f"metrics_{int(datetime.now(IST).timestamp())}"
            
            # Remove any invalid characters for Firestore document IDs
            doc_id = re.sub(r'[^a-zA-Z0-9_-]', '_', doc_id)
            
            logger.info(f"Final document ID: {doc_id}")
            self.db.collection('service_metrics').document(doc_id).set(metrics_doc)
            
            logger.info(f"Metrics saved successfully for interval {start_time} to {end_time}")
            return doc_id
        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")
            raise

    def run_aggregation(self, interval_minutes=15):
        """Main method to run the complete aggregation pipeline"""
        try:
            logger.info("Starting aggregation pipeline...")
            
            # Get time range
            start_time, end_time = get_interval_from_env(interval_minutes)
            logger.info(f"Aggregating data from {start_time} to {end_time}")
            
            # Fetch data
            requests_data = self.fetch_requests_data(start_time, end_time)
            logger.info(f"Fetched {len(requests_data)} requests")
            
            # Calculate metrics
            metrics = self.calculate_metrics(requests_data)
            logger.info(f"Calculated metrics for {metrics['total_requests']} requests")
            
            # Save metrics
            doc_id = self.save_metrics(metrics, start_time, end_time)
            
            logger.info(f"Aggregation completed successfully. Document ID: {doc_id}")
            return {
                'success': True,
                'document_id': doc_id,
                'metrics_summary': {
                    'total_requests': metrics['total_requests'],
                    'avg_assign_time': metrics['avg_assign_time'],
                    'avg_resolution_time': metrics['avg_resolution_time']
                }
            }
            
        except Exception as e:
            logger.error(f"Aggregation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    def run_aggregation_custom(self, start_time, end_time):
        """Run aggregation for custom time range (for testing)"""
        try:
            logger.info(f"Running custom aggregation from {start_time} to {end_time}")
            
            # Fetch data
            requests_data = self.fetch_requests_data(start_time, end_time)
            logger.info(f"Fetched {len(requests_data)} requests")
            
            # Calculate metrics
            metrics = self.calculate_metrics(requests_data)
            logger.info(f"Calculated metrics for {metrics['total_requests']} requests")
            
            # Save metrics with custom ID
            start_str = start_time.strftime('%Y%m%d_%H%M')
            end_str = end_time.strftime('%H%M')
            doc_id = f"custom_{start_str}_{end_str}".replace(':', '').replace(' ', '').replace('.', '')
            self.save_metrics(metrics, start_time, end_time, custom_id=doc_id)
            
            logger.info(f"Custom aggregation completed successfully. Document ID: {doc_id}")
            return {
                'success': True,
                'document_id': doc_id,
                'metrics_summary': {
                    'total_requests': metrics['total_requests'],
                    'avg_assign_time': metrics['avg_assign_time'],
                    'avg_resolution_time': metrics['avg_resolution_time']
                }
            }
            
        except Exception as e:
            logger.error(f"Custom aggregation failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }

def get_last_aggregated_interval(db, interval_minutes=15):
    """Get the end time of the last aggregated interval from service_metrics collection (UTC)."""
    docs = db.collection('service_metrics').order_by('interval_end', direction=firestore.Query.DESCENDING).limit(1).stream()
    for doc in docs:
        data = doc.to_dict()
        interval_end = data.get('interval_end')
        if interval_end:
            # Parse ISO string
            return datetime.fromisoformat(interval_end.replace('Z', '+00:00')).astimezone(timezone.utc)
    return None

def run_backfill(interval_minutes=15):
    aggregator = ServiceMetricsAggregator()
    now = datetime.now(timezone.utc)
    # Round down to nearest interval
    minutes_to_subtract = now.minute % interval_minutes
    current_interval_start = now.replace(minute=now.minute - minutes_to_subtract, second=0, microsecond=0)
    current_interval_end = current_interval_start + timedelta(minutes=interval_minutes)

    last_end = get_last_aggregated_interval(aggregator.db, interval_minutes)
    if not last_end:
        # If no previous doc, start from midnight UTC
        last_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    intervals = []
    while last_end < current_interval_start:
        start_time = last_end
        end_time = start_time + timedelta(minutes=interval_minutes)
        intervals.append((start_time, end_time))
        last_end = end_time
    if not intervals:
        logger.info("No missed intervals to backfill.")
    for start_time, end_time in intervals:
        logger.info(f"Backfilling interval: {start_time} to {end_time}")
        aggregator.run_aggregation_custom(start_time, end_time)
    # Always run the current interval as well
    logger.info(f"Running aggregation for current interval: {current_interval_start} to {current_interval_end}")
    aggregator.run_aggregation_custom(current_interval_start, current_interval_end)

def main():
    """Main function to run the aggregation with backfill"""
    run_backfill(interval_minutes=15)

if __name__ == "__main__":
    main() 