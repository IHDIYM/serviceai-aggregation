# Service Metrics Aggregation Pipeline

This is an OLAP-style aggregation pipeline that processes Firestore service request data and generates comprehensive metrics every 15 minutes.

## 🏗️ Architecture

```
Firestore Requests → Python Aggregation → Firestore Metrics → Dashboard
     ↓                      ↓                    ↓
  Raw Data             15-min Cron          Aggregated Data
```

## 📊 Metrics Generated

### **Key Performance Indicators:**
- Total requests per interval
- Average assignment time
- Average resolution time
- Request status distribution
- Technician performance metrics
- Hourly request distribution

### **Data Structure:**
```json
{
  "interval_start": "2025-01-04T10:00:00Z",
  "interval_end": "2025-01-04T10:15:00Z",
  "generated_at": "2025-01-04T10:15:30Z",
  "metrics": {
    "total_requests": 25,
    "avg_assign_time": 180.5,
    "avg_resolution_time": 3600.0,
    "requests_by_status": {
      "pending": 5,
      "active": 10,
      "closed": 10
    },
    "requests_by_technician": {
      "John Doe": 8,
      "Jane Smith": 7
    },
    "hourly_distribution": {
      "9": 5,
      "10": 8,
      "11": 12
    },
    "technician_performance": {
      "John Doe": {
        "total_requests": 8,
        "completed_requests": 6,
        "avg_resolution_time": 3200.0
      }
    }
  }
}
```

## 🚀 Setup Instructions

### **Prerequisites:**
1. Google Cloud Project with billing enabled
2. Firebase project with Firestore enabled
3. Google Cloud CLI installed and authenticated
4. Python 3.11+ installed

### **Step 1: Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
```

### **Step 2: Configure Firebase**
1. Copy your `serviceAccountKey.json` to the backend directory
2. Ensure Firestore is enabled in your Firebase project

### **Step 3: Test Locally**
```bash
# Run aggregation manually
python aggregation_pipeline.py

# Test the aggregation
python -c "
from aggregation_pipeline import ServiceMetricsAggregator
aggregator = ServiceMetricsAggregator()
result = aggregator.run_aggregation(interval_minutes=15)
print(result)
"
```

### **Step 4: Deploy to Cloud Functions**
```bash
# Make deployment script executable
chmod +x deploy_cloud_function.sh

# Deploy the functions
./deploy_cloud_function.sh
```

### **Step 5: Verify Deployment**
1. Check Google Cloud Console → Cloud Functions
2. Verify both functions are deployed:
   - `service-metrics-aggregator` (HTTP trigger)
   - `scheduled-metrics-aggregator` (Cloud Scheduler trigger)
3. Check Cloud Scheduler for the job `metrics-aggregation-job`

## 🔧 Configuration

### **Environment Variables:**
```bash
# Optional: Set custom interval (default: 15 minutes)
AGGREGATION_INTERVAL_MINUTES=15

# Optional: Set custom project ID
GOOGLE_CLOUD_PROJECT=serviceai-51fb9
```

### **Customization:**
- **Interval**: Modify `interval_minutes` parameter in `run_aggregation()`
- **Metrics**: Add new metrics in `calculate_metrics()` method
- **Storage**: Change collection name in `save_metrics()` method

## 📈 API Endpoints

### **Get Metrics (Manager Only):**
```bash
GET /metrics?interval=15min&limit=10
```

### **Get Dashboard Metrics (Manager Only):**
```bash
GET /metrics/dashboard
```

### **Manual Trigger (HTTP):**
```bash
POST https://us-central1-serviceai-51fb9.cloudfunctions.net/service-metrics-aggregator
Content-Type: application/json

{
  "interval_minutes": 15
}
```

## 🎯 Usage Examples

### **Local Development:**
```python
from aggregation_pipeline import ServiceMetricsAggregator

# Initialize aggregator
aggregator = ServiceMetricsAggregator()

# Run aggregation for last 15 minutes
result = aggregator.run_aggregation(interval_minutes=15)

# Run aggregation for custom interval
result = aggregator.run_aggregation(interval_minutes=60)  # 1 hour
```

### **Frontend Integration:**
```typescript
// Fetch dashboard metrics
const response = await axios.get('/metrics/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Fetch historical metrics
const response = await axios.get('/metrics?limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🔍 Monitoring & Debugging

### **Cloud Function Logs:**
```bash
# View function logs
gcloud functions logs read service-metrics-aggregator --limit=50

# View scheduled function logs
gcloud functions logs read scheduled-metrics-aggregator --limit=50
```

### **Firestore Queries:**
```javascript
// View metrics collection
db.collection('service_metrics')
  .orderBy('generated_at', 'desc')
  .limit(10)
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => console.log(doc.data()));
  });
```

### **Common Issues:**
1. **Index Errors**: Create required Firestore indexes
2. **Permission Errors**: Ensure service account has Firestore access
3. **Scheduling Issues**: Check Cloud Scheduler job status

## 📊 Dashboard Integration

The `MetricsDashboard.tsx` component provides:
- Real-time metrics display
- Auto-refresh every 5 minutes
- Responsive design
- Error handling and retry logic

### **Add to Manager Dashboard:**
```tsx
import MetricsDashboard from '../components/MetricsDashboard';

// In your manager dashboard component
{user && user.role === 'manager' && (
  <MetricsDashboard user={user} />
)}
```

## 🔄 Scheduling

The pipeline runs automatically every 15 minutes via Cloud Scheduler:
- **Cron Expression**: `*/15 * * * *`
- **Trigger**: Cloud Function `scheduled-metrics-aggregator`
- **Data**: Stored in `service_metrics` collection

## 📈 Performance Considerations

### **Optimizations:**
- Uses Firestore streaming for large datasets
- In-memory aggregation for efficiency
- Batch writes to Firestore
- Configurable time intervals

### **Scaling:**
- Cloud Functions auto-scale based on load
- Firestore handles concurrent reads/writes
- Metrics collection can be partitioned by date

## 🛠️ Development

### **Adding New Metrics:**
1. Modify `calculate_metrics()` method
2. Add new fields to metrics dictionary
3. Update TypeScript interfaces in frontend
4. Test with sample data

### **Testing:**
```bash
# Run tests
python -m pytest tests/

# Test with sample data
python test_aggregation.py
```

## 📝 License

This project is part of the ServiceAI platform. All rights reserved. 