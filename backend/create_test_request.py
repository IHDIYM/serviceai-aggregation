import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import logging
import pytz

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set timezone to IST (UTC+5:30)
IST = pytz.timezone('Asia/Kolkata')

def create_test_request():
    """Create a test request that will be included in the next aggregation interval"""
    try:
        # Initialize Firebase Admin
        if not firebase_admin._apps:
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        logger.info("Firebase Admin initialized successfully")
        
        # Calculate the current 15-minute interval using IST timezone
        now = datetime.now(IST)
        minutes_to_subtract = now.minute % 15
        interval_start = now.replace(minute=now.minute - minutes_to_subtract, second=0, microsecond=0)
        interval_end = interval_start + timedelta(minutes=15)
        
        # Create a request timestamp that falls within the current interval
        # Add 5 minutes to the interval start to ensure it's within the window
        request_time = interval_start + timedelta(minutes=5)
        
        # Create the test request
        test_request = {
            'authorId': 'test_user_123',
            'authorName': 'Test User',
            'requestDetails': 'Manual test request for aggregation testing (IST timezone)',
            'status': 'pending',
            'createdAt': request_time,
            'acceptedAt': None,
            'closedAt': None,
            'technicianId': None,
            'technicianName': None
        }
        
        # Add to Firestore
        doc_ref = db.collection('requests').add(test_request)
        
        logger.info(f"Test request created successfully!")
        logger.info(f"Request ID: {doc_ref[1].id}")
        logger.info(f"Created at (IST): {request_time}")
        logger.info(f"Current interval (IST): {interval_start} to {interval_end}")
        logger.info(f"Request will be included in aggregation: {interval_start <= request_time < interval_end}")
        
        return doc_ref[1].id, request_time, interval_start, interval_end
        
    except Exception as e:
        logger.error(f"Failed to create test request: {e}")
        raise

if __name__ == "__main__":
    create_test_request() 