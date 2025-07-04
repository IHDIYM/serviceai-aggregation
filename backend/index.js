const express = require('express');
const cors = require('cors');
const admin = require('./firebase');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Middleware to verify Firebase ID token for protected routes
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add user info to the request object
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

const verifyManager = async (req, res, next) => {
  const uid = req.user.uid;
  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().role === 'manager') {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Access is restricted to managers.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify manager role.' });
  }
};

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Endpoint to sign up a user with a role and additional data
app.post('/signup', async (req, res) => {
  // Destructure all possible fields from the body
  const { email, password, role, firstName, lastName, department, specialTech, location } = req.body;

  if (!email || !password || !role || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, role, and name are required.' });
  }

  // Prevent technician or manager signup via API
  if (role === 'technician' || role === 'manager') {
    return res.status(403).json({ error: `Signup for role '${role}' is not allowed via API. Please contact your administrator.` });
  }

  try {
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Prepare the data to be stored in Firestore
    const userData = {
      email,
      role,
      firstName,
      lastName,
    };

    // Add role-specific data
    if (role === 'manager' && department) {
      userData.department = department;
    } else if (role === 'user' && location) {
      userData.location = location;
    }

    // Store the complete user profile in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set(userData);

    res.status(201).json({ message: 'User created successfully', uid: userRecord.uid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to verify login and return user role
app.post('/login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'idToken is required.' });
  }
  try {
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    // Get user role from Firestore
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const userData = userDoc.data();
    res.json({ uid, ...userData });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: error.message });
  }
});

// --- Manager Endpoints ---

// Get all technicians (manager only)
app.get('/users/technicians', verifyToken, verifyManager, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('users').where('role', '==', 'technician').get();
    const technicians = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(technicians);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch technicians.' });
  }
});

// Get all service requests (manager only)
app.get('/requests/all', verifyToken, verifyManager, async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('requests').orderBy('createdAt', 'desc').get();
    const requests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        acceptedAt: data.acceptedAt && data.acceptedAt.toDate ? data.acceptedAt.toDate().toISOString() : data.acceptedAt,
        closedAt: data.closedAt && data.closedAt.toDate ? data.closedAt.toDate().toISOString() : data.closedAt,
      };
    });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch all requests.' });
  }
});

// Assign a service request to a technician (manager only)
app.put('/requests/:id/assign', verifyToken, verifyManager, async (req, res) => {
  const { id } = req.params;
  const { technicianId } = req.body;

  if (!technicianId) {
    return res.status(400).json({ error: 'Technician ID is required.' });
  }

  try {
    const requestRef = admin.firestore().collection('requests').doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
      return res.status(400).json({ error: 'Request must be pending to be assigned.' });
    }

    const techDoc = await admin.firestore().collection('users').doc(technicianId).get();
    if (!techDoc.exists || techDoc.data().role !== 'technician') {
        return res.status(404).json({ error: 'Technician not found.' });
    }

    const technicianName = `${techDoc.data().firstName} ${techDoc.data().lastName}`;

    await requestRef.update({
      status: 'active',
      technicianId: technicianId,
      technicianName: technicianName,
      acceptedAt: new Date(),
    });

    res.json({ message: 'Request assigned successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign request.' });
  }
});

// --- Metrics Endpoints ---

// Get aggregated metrics (manager only)
app.get('/metrics', verifyToken, verifyManager, async (req, res) => {
  try {
    const { interval = '15min', limit = 10 } = req.query;
    
    // Get the most recent metrics documents
    const snapshot = await admin.firestore()
      .collection('service_metrics')
      .orderBy('generated_at', 'desc')
      .limit(parseInt(limit))
      .get();
    
    const metrics = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        interval_start: data.interval_start && data.interval_start.toDate ? data.interval_start.toDate().toISOString() : data.interval_start,
        interval_end: data.interval_end && data.interval_end.toDate ? data.interval_end.toDate().toISOString() : data.interval_end,
        generated_at: data.generated_at && data.generated_at.toDate ? data.generated_at.toDate().toISOString() : data.generated_at,
        metrics: data.metrics
      };
    });
    
    res.json(metrics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch metrics.' });
  }
});

// Get real-time dashboard metrics (manager only)
app.get('/metrics/dashboard', verifyToken, verifyManager, async (req, res) => {
  try {
    // Calculate UTC midnight for today and tomorrow
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));

    const snapshot = await admin.firestore()
      .collection('service_metrics')
      .where('interval_start', '>=', todayUTC.toISOString())
      .where('interval_start', '<', tomorrowUTC.toISOString())
      .orderBy('interval_start', 'desc')
      .get();

    const todayMetrics = snapshot.docs.map(doc => doc.data().metrics);

    // Aggregate today's data
    const dashboardMetrics = {
      total_requests_today: sum(todayMetrics, 'total_requests'),
      avg_assign_time_today: average(todayMetrics, 'avg_assign_time'),
      avg_resolution_time_today: average(todayMetrics, 'avg_resolution_time'),
      requests_by_status: aggregateStatusCounts(todayMetrics),
      top_technicians: getTopTechnicians(todayMetrics),
      hourly_distribution: aggregateHourlyDistribution(todayMetrics)
    };

    res.json(dashboardMetrics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
});

// Helper functions for aggregation
function sum(metrics, field) {
  return metrics.reduce((sum, metric) => sum + (metric[field] || 0), 0);
}

function average(metrics, field) {
  const values = metrics.filter(m => m[field] && m[field] > 0);
  return values.length > 0 ? values.reduce((sum, m) => sum + m[field], 0) / values.length : 0;
}

function aggregateStatusCounts(metrics) {
  const statusCounts = {};
  metrics.forEach(metric => {
    Object.entries(metric.requests_by_status || {}).forEach(([status, count]) => {
      statusCounts[status] = (statusCounts[status] || 0) + count;
    });
  });
  return statusCounts;
}

function getTopTechnicians(metrics) {
  const techCounts = {};
  metrics.forEach(metric => {
    Object.entries(metric.requests_by_technician || {}).forEach(([tech, count]) => {
      techCounts[tech] = (techCounts[tech] || 0) + count;
    });
  });
  
  return Object.entries(techCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function aggregateHourlyDistribution(metrics) {
  const hourlyCounts = {};
  metrics.forEach(metric => {
    Object.entries(metric.hourly_distribution || {}).forEach(([hour, count]) => {
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + count;
    });
  });
  return hourlyCounts;
}

// --- Service Request Endpoints ---

// Create a new service request (for users)
app.post('/requests', verifyToken, async (req, res) => {
    const { requestDetails } = req.body;
    const authorId = req.user.uid;
    const authorName = req.user.name;

    if (!requestDetails) {
        return res.status(400).json({ error: 'Request details are required.' });
    }

    try {
        const requestData = {
            authorId,
            authorName,
            requestDetails,
            status: 'pending',
            createdAt: new Date(),
            technicianId: null,
            technicianName: null,
            acceptedAt: null,
            closedAt: null,
        };

        const docRef = await admin.firestore().collection('requests').add(requestData);
        res.status(201).json({ message: 'Request created successfully', requestId: docRef.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create request.' });
    }
});

// Get pending service requests
app.get('/requests/pending', verifyToken, async (req, res) => {
  console.log('Fetching pending requests for user:', req.user);
  try {
    const query = admin.firestore().collection('requests').where('status', '==', 'pending').orderBy('createdAt', 'desc');
    console.log('Firestore query: status == pending, orderBy createdAt desc');
    const snapshot = await query.get();
    console.log('Number of pending requests found:', snapshot.size);
    const requests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        acceptedAt: data.acceptedAt && data.acceptedAt.toDate ? data.acceptedAt.toDate().toISOString() : data.acceptedAt,
        closedAt: data.closedAt && data.closedAt.toDate ? data.closedAt.toDate().toISOString() : data.closedAt,
      };
    });
    res.json(requests);
  } catch (error) {
    console.error('Error in /requests/pending:', error.stack || error);
    res.status(500).json({ error: 'Failed to fetch pending requests.' });
  }
});

// Get active service requests for the logged-in technician
app.get('/requests/active', verifyToken, async (req, res) => {
    const technicianId = req.user.uid;
    try {
        const snapshot = await admin.firestore().collection('requests')
            .where('technicianId', '==', technicianId)
            .where('status', '==', 'active')
            .orderBy('acceptedAt', 'desc')
            .get();
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            acceptedAt: data.acceptedAt && data.acceptedAt.toDate ? data.acceptedAt.toDate().toISOString() : data.acceptedAt,
            closedAt: data.closedAt && data.closedAt.toDate ? data.closedAt.toDate().toISOString() : data.closedAt,
          };
        });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active requests.' });
    }
});

// Get closed service requests for the logged-in technician
app.get('/requests/closed', verifyToken, async (req, res) => {
    const technicianId = req.user.uid;
    try {
        const snapshot = await admin.firestore().collection('requests')
            .where('technicianId', '==', technicianId)
            .where('status', '==', 'closed')
            .orderBy('closedAt', 'desc')
            .get();
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            acceptedAt: data.acceptedAt && data.acceptedAt.toDate ? data.acceptedAt.toDate().toISOString() : data.acceptedAt,
            closedAt: data.closedAt && data.closedAt.toDate ? data.closedAt.toDate().toISOString() : data.closedAt,
          };
        });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch closed requests.' });
    }
});


// Accept a service request
app.put('/requests/:id/accept', verifyToken, async (req, res) => {
  const { id } = req.params;
  const technicianId = req.user.uid;
  const technicianName = req.user.name;

  try {
    const requestRef = admin.firestore().collection('requests').doc(id);
    const doc = await requestRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Request not found.' });
    }
    if (doc.data().status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending and cannot be accepted.' });
    }

    await requestRef.update({
      status: 'active',
      technicianId,
      technicianName,
      acceptedAt: new Date(),
    });

    res.json({ message: 'Request accepted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to accept request.' });
  }
});

// Close a service request
app.put('/requests/:id/close', verifyToken, async (req, res) => {
    const { id } = req.params;
    const technicianId = req.user.uid;

    try {
        const requestRef = admin.firestore().collection('requests').doc(id);
        const doc = await requestRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        if (doc.data().technicianId !== technicianId) {
            return res.status(403).json({ error: 'You are not authorized to close this request.' });
        }
        if (doc.data().status !== 'active') {
            return res.status(400).json({ error: 'Only active requests can be closed.' });
        }

        await requestRef.update({
            status: 'closed',
            closedAt: new Date(),
        });

        res.json({ message: 'Request closed successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to close request.' });
    }
});

// Get all requests for the logged-in user
app.get('/requests/mine', verifyToken, async (req, res) => {
  const userId = req.user.uid;
  try {
    const snapshot = await admin.firestore().collection('requests')
      .where('authorId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const requests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        acceptedAt: data.acceptedAt && data.acceptedAt.toDate ? data.acceptedAt.toDate().toISOString() : data.acceptedAt,
        closedAt: data.closedAt && data.closedAt.toDate ? data.closedAt.toDate().toISOString() : data.closedAt,
      };
    });
    res.json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch your requests.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});