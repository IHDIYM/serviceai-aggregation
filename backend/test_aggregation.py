#!/usr/bin/env python3
"""
Test script to run aggregation with real data
"""

from aggregation_pipeline import ServiceMetricsAggregator
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore

def test_with_real_data():
    """Test aggregation with actual data from different time windows"""
    
    # Initialize Firebase
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    # Get all requests to see the time range
    print("📊 Fetching all requests to analyze time range...")
    requests = db.collection('requests').get()
    
    if not requests:
        print("❌ No requests found in database")
        return
    
    print(f"✅ Found {len(requests)} total requests")
    
    # Analyze time range
    timestamps = []
    for doc in requests:
        data = doc.to_dict()
        if data.get('createdAt'):
            timestamps.append(data['createdAt'])
    
    if not timestamps:
        print("❌ No timestamps found in requests")
        return
    
    # Find time range
    min_time = min(timestamps)
    max_time = max(timestamps)
    
    print(f"📅 Data time range: {min_time} to {max_time}")
    
    # Test aggregation for different intervals
    aggregator = ServiceMetricsAggregator()
    
    # Test 1: Last hour
    print("\n🧪 Test 1: Last hour")
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=1)
    result = aggregator.run_aggregation_custom(start_time, end_time)
    print(f"Result: {result}")
    
    # Test 2: Today
    print("\n🧪 Test 2: Today")
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = datetime.utcnow()
    result = aggregator.run_aggregation_custom(today_start, today_end)
    print(f"Result: {result}")
    
    # Test 3: Last 24 hours
    print("\n🧪 Test 3: Last 24 hours")
    day_ago = datetime.utcnow() - timedelta(days=1)
    result = aggregator.run_aggregation_custom(day_ago, datetime.utcnow())
    print(f"Result: {result}")

def test_15_minute_intervals():
    """Test the 15-minute interval logic"""
    print("\n🕐 Testing 15-minute interval logic...")
    
    aggregator = ServiceMetricsAggregator()
    
    # Test current interval
    start_time, end_time = aggregator.get_date_range(15)
    print(f"Current 15-min interval: {start_time} to {end_time}")
    
    # Test with custom time
    test_time = datetime(2025, 7, 4, 10, 23, 45)  # 10:23:45
    print(f"Test time: {test_time}")
    
    # Calculate what the interval should be
    minutes_to_subtract = test_time.minute % 15
    expected_start = test_time.replace(minute=test_time.minute - minutes_to_subtract, second=0, microsecond=0)
    expected_end = expected_start + timedelta(minutes=15)
    
    print(f"Expected interval: {expected_start} to {expected_end}")

if __name__ == "__main__":
    print("🧪 Testing Aggregation Pipeline with Real Data")
    print("=" * 50)
    
    test_15_minute_intervals()
    test_with_real_data()
    
    print("\n✅ Testing completed!") 