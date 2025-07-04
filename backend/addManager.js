const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// --- Configuration ---
// Add the details of the manager you want to create here.
const managerDetails = {
  email: 'manager@example.com',
  password: 'SecurePassword123!',
  firstName: 'Sanjay',
  lastName: 'Verma',
  department: 'Operations', // Example department
};
// --------------------

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
}); 

async function addManager(details) {
  const { email, password, firstName, lastName, department } = details;

  if (!email || !password || !firstName || !lastName || !department) {
    console.error('Error: All fields in managerDetails must be filled out.');
    return;
  }

  try {
    console.log(`Creating manager account for ${email}...`);

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Add manager profile to Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      role: 'manager',
      firstName,
      lastName,
      department,
    });

    console.log('✅ Successfully created manager:');
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Department: ${department}`);

  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.error(`Error: The email address "${email}" is already in use by another account.`);
    } else {
      console.error('Error creating manager:', error.message);
    }
  }
}

addManager(managerDetails); 