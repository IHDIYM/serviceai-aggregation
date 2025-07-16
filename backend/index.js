const express = require('express');
const cors = require('cors');
const admin = require('./firebase');
const fetch = require('node-fetch');
const { registerManualRoutes, router: manualRouter } = require('./manual');
const { v4: uuidv4 } = require('uuid');
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

// Add after login endpoint
app.put('/profile/vehicle', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const { vehicleType, vehicleModel, purchaseDate, odometerKm } = req.body;
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      vehicleType,
      vehicleModel,
      purchaseDate,
      odometerKm
    });
    res.json({ message: 'Vehicle info updated.' });
  } catch (error) {
    console.error('Failed to update vehicle info:', error);
    res.status(500).json({ error: 'Failed to update vehicle info.' });
  }
});

// Get all vehicles for the user
app.get('/profile/vehicles', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
    const vehicles = (userDoc.data().vehicles || []).map(v => ({ ...v, warranty: calculateWarranty(v) }));
    res.json({ vehicles });
  } catch (error) {
    console.error('Failed to get vehicles:', error);
    res.status(500).json({ error: 'Failed to get vehicles.' });
  }
});

// Add a new vehicle
app.post('/profile/vehicle', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const { vehicleType, vehicleModel, purchaseDate, odometerKm } = req.body;
  const newVehicle = {
    id: uuidv4(),
    vehicleType,
    vehicleModel,
    purchaseDate,
    odometerKm
  };
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      vehicles: admin.firestore.FieldValue.arrayUnion(newVehicle)
    });
    res.json({ message: 'Vehicle added.', vehicle: newVehicle });
  } catch (error) {
    console.error('Failed to add vehicle:', error);
    res.status(500).json({ error: 'Failed to add vehicle.' });
  }
});

// Update a specific vehicle (e.g., odometer)
app.patch('/profile/vehicle/:vehicleId', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const { vehicleId } = req.params;
  const updateFields = req.body; // e.g., { odometerKm: 12345 }
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
    const vehicles = userDoc.data().vehicles || [];
    const updatedVehicles = vehicles.map(v => v.id === vehicleId ? { ...v, ...updateFields } : v);
    await userRef.update({ vehicles: updatedVehicles });
    res.json({ message: 'Vehicle updated.', vehicles: updatedVehicles });
  } catch (error) {
    console.error('Failed to update vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle.' });
  }
});

// Delete a vehicle
app.delete('/profile/vehicle/:vehicleId', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const { vehicleId } = req.params;
  try {
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found.' });
    const vehicles = userDoc.data().vehicles || [];
    const updatedVehicles = vehicles.filter(v => v.id !== vehicleId);
    await userRef.update({ vehicles: updatedVehicles });
    res.json({ message: 'Vehicle deleted.', vehicles: updatedVehicles });
  } catch (error) {
    console.error('Failed to delete vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle.' });
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

// Warranty calculation utility
function calculateWarranty(vehicle) {
  const { vehicleType, purchaseDate, odometerKm } = vehicle;
  if (!vehicleType || !purchaseDate || odometerKm == null) return null;
  const today = new Date();
  const purchase = new Date(purchaseDate);
  // Helper to add years
  const addYears = (date, years) => new Date(date.getFullYear() + years, date.getMonth(), date.getDate());
  // Helper to days between
  const daysBetween = (d1, d2) => Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
  let warranty = {};
  // Base warranty
  let baseWarrantyYears = 3, baseWarrantyKm = 100000;
  let baseExpiry = addYears(purchase, baseWarrantyYears);
  let remainingBaseDays = daysBetween(baseExpiry, today);
  let remainingBaseKm = Math.max(0, baseWarrantyKm - odometerKm);
  warranty["Standard Warranty"] = {
    Status: (remainingBaseDays > 0 && remainingBaseKm > 0) ? "Active" : "Expired",
    "Expiry Date": baseExpiry.toISOString().slice(0, 10),
    "Remaining Days": remainingBaseDays,
    "Remaining KM": remainingBaseKm
  };
  // Component-specific
  if (vehicleType === "electric") {
    // Battery
    let batteryWarrantyYears = 8, batteryWarrantyKm = 160000;
    let batteryExpiry = addYears(purchase, batteryWarrantyYears);
    let remainingBatteryKm = Math.max(0, batteryWarrantyKm - odometerKm);
    warranty["Battery Pack"] = {
      Status: (batteryExpiry > today && remainingBatteryKm > 0) ? "Active" : "Expired",
      "Expiry Date": batteryExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingBatteryKm
    };
    // Motor
    let motorWarrantyYears = 5, motorWarrantyKm = 100000;
    let motorExpiry = addYears(purchase, motorWarrantyYears);
    let remainingMotorKm = Math.max(0, motorWarrantyKm - odometerKm);
    warranty["Electric Motor"] = {
      Status: (motorExpiry > today && remainingMotorKm > 0) ? "Active" : "Expired",
      "Expiry Date": motorExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingMotorKm
    };
  } else if (vehicleType === "diesel") {
    let engineWarrantyYears = 5, engineWarrantyKm = 150000;
    let engineExpiry = addYears(purchase, engineWarrantyYears);
    let remainingEngineKm = Math.max(0, engineWarrantyKm - odometerKm);
    warranty["Engine Assembly"] = {
      Status: (engineExpiry > today && remainingEngineKm > 0) ? "Active" : "Expired",
      "Expiry Date": engineExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingEngineKm
    };
    warranty["Transmission"] = {
      Status: (remainingBaseDays > 0 && remainingBaseKm > 0) ? "Active" : "Expired",
      "Expiry Date": baseExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingBaseKm
    };
  } else { // petrol
    let engineWarrantyYears = 3, engineWarrantyKm = 100000;
    let engineExpiry = addYears(purchase, engineWarrantyYears);
    let remainingEngineKm = Math.max(0, engineWarrantyKm - odometerKm);
    warranty["Engine Assembly"] = {
      Status: (engineExpiry > today && remainingEngineKm > 0) ? "Active" : "Expired",
      "Expiry Date": engineExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingEngineKm
    };
    warranty["Transmission"] = {
      Status: (remainingBaseDays > 0 && remainingBaseKm > 0) ? "Active" : "Expired",
      "Expiry Date": baseExpiry.toISOString().slice(0, 10),
      "Remaining KM": remainingBaseKm
    };
  }
  // Rust Perforation
  let rustExpiry = addYears(purchase, 6);
  warranty["Rust Perforation"] = {
    Status: (rustExpiry > today) ? "Active" : "Expired",
    "Expiry Date": rustExpiry.toISOString().slice(0, 10)
  };
  return warranty;
}

// --- Service Request Endpoints ---

// Create a new service request (for users)
app.post('/requests', verifyToken, async (req, res) => {
    const { requestDetails, vehicleId } = req.body;
    const authorId = req.user.uid;
    const authorName = req.user.name;

    if (!requestDetails) {
        return res.status(400).json({ error: 'Request details are required.' });
    }
    if (!vehicleId) {
        return res.status(400).json({ error: 'Vehicle ID is required.' });
    }

    try {
        // Lookup vehicle info
        const userDoc = await admin.firestore().collection('users').doc(authorId).get();
        const vehicles = userDoc.exists ? (userDoc.data().vehicles || []) : [];
        const vehicle = vehicles.find(v => v.id === vehicleId);
        if (!vehicle) {
            return res.status(400).json({ error: 'Selected vehicle not found.' });
        }
        const requestData = {
            authorId,
            authorName,
            requestDetails,
            // vehicleId, // Do not store vehicleId
            vehicleModel: vehicle.vehicleModel || vehicle.model || '',
            vehicleType: vehicle.vehicleType || '',
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

// Gemini Flash 2.0 API integration
const GEMINI_API_KEY = "AIzaSyCfGebLoSxI50ugKpe9OQ8LVlQEWRLTbws";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + GEMINI_API_KEY;

// Assign technician by AI (Gemini)
app.put('/requests/:id/assign-ai', verifyToken, verifyManager, async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch the request
    const requestRef = admin.firestore().collection('requests').doc(id);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      console.error(`[AI ASSIGN] Request not found: ${id}`);
      return res.status(404).json({ error: 'Request not found.' });
    }
    const requestData = requestDoc.data();
    if (requestData.status !== 'pending') {
      console.error(`[AI ASSIGN] Request not pending: ${id}`);
      return res.status(400).json({ error: 'Request must be pending to assign.' });
    }

    // Fetch all available technicians (not currently active)
    const techSnapshot = await admin.firestore().collection('users').where('role', '==', 'technician').get();
    const allTechnicians = techSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Exclude busy technicians (assigned to active requests)
    const activeSnapshot = await admin.firestore().collection('requests').where('status', '==', 'active').get();
    const busyTechIds = new Set(activeSnapshot.docs.map(doc => doc.data().technicianId));
    const availableTechnicians = allTechnicians.filter(tech => !busyTechIds.has(tech.id));
    if (availableTechnicians.length === 0) {
      console.error(`[AI ASSIGN] No available technicians for request: ${id}`);
      return res.status(400).json({ error: 'No available technicians.' });
    }

    // Prepare prompt for Gemini
    const prompt = `Given the following service request and a list of technicians, select the best technician for the job based on their skills and specialties.\n\nService Request:\n${requestData.requestDetails}\n\nAvailable Technicians (JSON array):\n${JSON.stringify(availableTechnicians, null, 2)}\n\nRespond ONLY with the id of the best technician from the list.`;

    // Call Gemini Flash 2.0
    let geminiRes, geminiData;
    try {
      geminiRes = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      geminiData = await geminiRes.json();
      console.log(`[AI ASSIGN] Gemini API response for request ${id}:`, JSON.stringify(geminiData));
    } catch (err) {
      console.error(`[AI ASSIGN] Gemini API call failed for request ${id}:`, err);
      return res.status(500).json({ error: 'Gemini API call failed.' });
    }
    if (!geminiData || !geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content || !geminiData.candidates[0].content.parts) {
      console.error(`[AI ASSIGN] Gemini API invalid response for request ${id}:`, JSON.stringify(geminiData));
      return res.status(500).json({ error: 'Gemini API did not return a valid response.' });
    }
    // Extract technician id from Gemini response
    const aiResponse = geminiData.candidates[0].content.parts[0].text.trim();
    const selectedTechId = aiResponse.replace(/[^a-zA-Z0-9]/g, ''); // sanitize
    const selectedTech = availableTechnicians.find(t => t.id === selectedTechId);
    if (!selectedTech) {
      console.error(`[AI ASSIGN] AI did not select a valid technician for request ${id}. AI response:`, aiResponse, 'Available IDs:', availableTechnicians.map(t => t.id));
      return res.status(500).json({ error: 'AI did not select a valid technician.' });
    }

    // Assign the technician
    try {
      await requestRef.update({
        status: 'active',
        technicianId: selectedTech.id,
        technicianName: `${selectedTech.firstName} ${selectedTech.lastName}`,
        acceptedAt: new Date(),
      });
    } catch (err) {
      console.error(`[AI ASSIGN] Firestore update failed for request ${id}:`, err);
      return res.status(500).json({ error: 'Failed to update request in Firestore.' });
    }

    res.json({ message: 'Technician assigned by AI.', technician: selectedTech });
  } catch (error) {
    console.error(`[AI ASSIGN] Unexpected error for request ${id}:`, error);
    res.status(500).json({ error: 'Failed to assign technician by AI.' });
  }
});

// Bulk assign all pending requests by AI (Gemini)
app.put('/requests/assign-ai-bulk', verifyToken, verifyManager, async (req, res) => {
  try {
    // Fetch all pending requests
    const pendingSnapshot = await admin.firestore().collection('requests').where('status', '==', 'pending').get();
    const pendingRequests = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (pendingRequests.length === 0) {
      return res.status(400).json({ error: 'No pending requests.' });
    }

    // Fetch all technicians
    const techSnapshot = await admin.firestore().collection('users').where('role', '==', 'technician').get();
    const allTechnicians = techSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch all today's assignments (active or closed)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const assignmentsSnapshot = await admin.firestore().collection('requests')
      .where('createdAt', '>=', startOfDay.toISOString())
      .get();
    // Count assignments per technician
    const assignmentsCount = {};
    assignmentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.technicianId) {
        assignmentsCount[data.technicianId] = (assignmentsCount[data.technicianId] || 0) + 1;
      }
    });

    // Fetch all active requests to determine busy technicians
    const activeSnapshot = await admin.firestore().collection('requests').where('status', '==', 'active').get();
    const busyTechIds = new Set(activeSnapshot.docs.map(doc => doc.data().technicianId));

    const assignments = [];
    const errors = [];

    for (const req of pendingRequests) {
      // Step 1: Try available technicians (<10 assignments today)
      const availableTechnicians = allTechnicians.filter(tech =>
        !busyTechIds.has(tech.id) && (assignmentsCount[tech.id] || 0) < 10
      );
      let selectedTech = null;
      let selectedTechId = null;
      let usedFallback = false;
      if (availableTechnicians.length > 0) {
        const idList = availableTechnicians.map(t => t.id).join(', ');
        const prompt = `Given the following service request and a list of technicians, select the best technician for the job based on their skills and specialties.\n\nService Request:\n${req.requestDetails}\n\nAvailable Technicians (JSON array):\n${JSON.stringify(availableTechnicians, null, 2)}\n\nRespond ONLY with the id of the best technician from the list. If no technician is a perfect fit, select the closest match and respond ONLY with their id. The id must be one of: [${idList}]`;
        try {
          const geminiRes = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          const geminiData = await geminiRes.json();
          if (geminiData && geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts) {
            const aiResponse = geminiData.candidates[0].content.parts[0].text.trim();
            selectedTechId = aiResponse.replace(/[^a-zA-Z0-9]/g, '');
            selectedTech = availableTechnicians.find(t => t.id === selectedTechId);
          }
        } catch (err) {
          // ignore, will try all eligible next
        }
      }
      // Step 2: If not found, try all eligible (<10 assignments today)
      if (!selectedTech) {
        const eligibleTechnicians = allTechnicians.filter(tech => (assignmentsCount[tech.id] || 0) < 10);
        if (eligibleTechnicians.length > 0) {
          const idList = eligibleTechnicians.map(t => t.id).join(', ');
          const prompt = `Given the following service request and a list of technicians, select the best technician for the job based on their skills and specialties.\n\nService Request:\n${req.requestDetails}\n\nEligible Technicians (JSON array):\n${JSON.stringify(eligibleTechnicians, null, 2)}\n\nRespond ONLY with the id of the best technician from the list. If no technician is a perfect fit, select the closest match and respond ONLY with their id. The id must be one of: [${idList}]`;
          try {
            const geminiRes = await fetch(GEMINI_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const geminiData = await geminiRes.json();
            if (geminiData && geminiData.candidates && geminiData.candidates[0] && geminiData.candidates[0].content && geminiData.candidates[0].content.parts) {
              const aiResponse = geminiData.candidates[0].content.parts[0].text.trim();
              selectedTechId = aiResponse.replace(/[^a-zA-Z0-9]/g, '');
              selectedTech = eligibleTechnicians.find(t => t.id === selectedTechId);
            }
          } catch (err) {
            // ignore, will error below if not found
          }
        }
      }
      // Fallback: assign to technician with fewest assignments if possible
      if (!selectedTech) {
        const eligibleTechnicians = allTechnicians.filter(tech => (assignmentsCount[tech.id] || 0) < 10);
        if (eligibleTechnicians.length > 0) {
          eligibleTechnicians.sort((a, b) => (assignmentsCount[a.id] || 0) - (assignmentsCount[b.id] || 0));
          selectedTech = eligibleTechnicians[0];
          usedFallback = true;
          console.warn(`[AI ASSIGN] Fallback used: Assigned request ${req.id} to technician ${selectedTech.id} (${selectedTech.firstName} ${selectedTech.lastName}) with fewest assignments.`);
        }
      }
      if (!selectedTech) {
        errors.push({ requestId: req.id, error: 'No eligible technician (limit reached or no match).' });
        continue;
      }
      // Assign the technician
      // Increment the count BEFORE updating Firestore to prevent over-assignment in the same batch
      assignmentsCount[selectedTech.id] = (assignmentsCount[selectedTech.id] || 0) + 1;
      await admin.firestore().collection('requests').doc(req.id).update({
        status: 'active',
        technicianId: selectedTech.id,
        technicianName: `${selectedTech.firstName} ${selectedTech.lastName}`,
        acceptedAt: new Date(),
      });
      assignments.push({ requestId: req.id, technicianId: selectedTech.id, technicianName: `${selectedTech.firstName} ${selectedTech.lastName}`, fallback: usedFallback });
    }
    res.json({ assignments, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Bulk AI assignment failed.' });
  }
});

// Register /manual endpoints with verifyToken
registerManualRoutes(verifyToken);
app.use('/manual', manualRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});