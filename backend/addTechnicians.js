const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const technicians = [
  {
    email: "aarav.menon@tata.com",
    password: "Password123!",
    firstName: "Aarav",
    lastName: "Menon",
    department: "Electrical System",
    title: "Senior Electrical Systems Specialist",
    experience: "8+ years in automotive electrical diagnostics, with a focus on EV systems across Tata's passenger lineup.",
    specialties: [
      "ECU tuning",
      "battery management systems",
      "hybrid/electric vehicle electronics",
      "digital control unit programming",
    ],
    skills: [
      "ECU diagnostics & flashing",
      "High-voltage battery management (EV/HEV)",
      "Wiring harness analysis & repair",
      "Oscilloscope & multimeter expert",
      "CAN bus troubleshooting",
      "Controller reprogramming for Tata EV platforms",
    ],
  },
  {
    email: "simran.kaur@tata.com",
    password: "Password123!",
    firstName: "Simran",
    lastName: "Kaur",
    department: "Electrical System",
    title: "Vehicle Electronics Engineer",
    experience: "5 years focused on infotainment systems and in-vehicle smart electronics across Nexon and Altroz variants.",
    specialties: [
      "Sensor integration",
      "dashboard interface systems",
      "CAN bus communication",
    ],
    skills: [
      "Infotainment system calibration (Harman/Android Auto)",
      "Reverse camera & parking sensor integration",
      "Smart dashboard interface config",
      "Electronic module replacement & coding",
      "CAN/LIN communication debugging",
      "Battery health monitoring systems",
    ],
  },
  {
    email: "raghav.joshi@tata.com",
    password: "Password123!",
    firstName: "Raghav",
    lastName: "Joshi",
    department: "Powertrain",
    title: "Lead Powertrain Technician",
    experience: "10 years working hands-on with petrol and diesel engines in both passenger and commercial segments.",
    specialties: [
      "Engine overhauling",
      "emission control systems",
      "turbocharging",
    ],
    skills: [
      "Engine teardown & rebuild",
      "Turbocharger performance tuning",
      "Emissions control calibration (BS6 compliance)",
      "Crankshaft/piston alignment",
      "EGR & DPF maintenance",
      "Drivability diagnostics (engine knocking, misfiring)",
    ],
  },
  {
    email: "fatima.sheikh@tata.com",
    password: "Password123!",
    firstName: "Fatima",
    lastName: "Sheikh",
    department: "Powertrain",
    title: "Fuel & Cooling Systems Engineer",
    experience: "6 years working on fuel injection systems and cooling optimization in high-temperature zones.",
    specialties: [
      "Fuel pressure tuning",
      "radiator systems",
      "thermal efficiency improvements",
    ],
    skills: [
      "Fuel injector diagnostics & cleaning",
      "Fuel pump calibration & pressure testing",
      "Radiator leak detection & core replacement",
      "Thermostat & fan control tuning",
      "Ethanol-blend optimization",
      "Coolant flow & heat dissipation modeling",
    ],
  },
  {
    email: "ishaan.rawat@tata.com",
    password: "Password123!",
    firstName: "Ishaan",
    lastName: "Rawat",
    department: "Steering & Suspension",
    title: "Suspension Dynamics Expert",
    experience: "7 years in suspension system diagnostics and ride quality optimization for rural and off-road applications.",
    specialties: [
      "Suspension geometry",
      "NVH reduction",
      "custom damping for ride comfort",
    ],
    skills: [
      "Shock absorber & strut tuning",
      "Caster/camber/toe angle setup",
      "Control arm & bushing replacement",
      "Stabilizer bar diagnostics",
      "Spring rate analysis",
      "Terrain-specific ride tuning",
    ],
  },
  {
    email: "neha.patel@tata.com",
    password: "Password123!",
    firstName: "Neha",
    lastName: "Patel",
    department: "Steering & Suspension",
    title: "Steering Systems Engineer",
    experience: "5 years specializing in steering alignment and electric steering systems across Tata SUVs and hatchbacks.",
    specialties: [
      "EPS systems",
      "road feedback optimization",
      "alignment correction",
    ],
    skills: [
      "Electric power steering calibration",
      "Rack-and-pinion diagnostics",
      "Torque sensor fault detection",
      "Wheel alignment & balancing",
      "Steering column tuning",
      "Low-speed maneuverability improvements",
    ],
  },
  {
    email: "kunal.verma@tata.com",
    password: "Password123!",
    firstName: "Kunal",
    lastName: "Verma",
    department: "Vehicle Control",
    title: "Vehicle Control & ADAS Specialist",
    experience: "9 years in safety and control system engineering, including Tata's first-gen ADAS integration.",
    specialties: [
      "Collision avoidance",
      "cruise control calibration",
      "radar/lidar sensor mapping",
    ],
    skills: [
      "Lane assist and auto-braking setup",
      "Blind spot monitoring calibration",
      "Cruise control diagnostics",
      "ADAS radar & camera alignment",
      "Crash simulation data review",
      "Sensor-fusion troubleshooting",
    ],
  },
  {
    email: "priya.nambiar@tata.com",
    password: "Password123!",
    firstName: "Priya",
    lastName: "Nambiar",
    department: "Vehicle Control",
    title: "Brake & Wheel Systems Engineer",
    experience: "6 years in braking systems and tire dynamics for both highway and urban driving environments.",
    specialties: [
      "ABS/EBD optimization",
      "performance tire balancing",
      "braking load analysis",
    ],
    skills: [
      "ABS/EBD system diagnostics",
      "Brake pad/disc wear pattern analysis",
      "Brake fluid bleeding & line servicing",
      "Performance tire fitting & tuning",
      "Disc/drum brake system servicing",
      "Road grip & braking stability tuning",
    ],
  },
  {
    email: "devika.rane@tata.com",
    password: "Password123!",
    firstName: "Devika",
    lastName: "Rane",
    department: "Safety Systems",
    title: "Vehicle Safety & Sensor Engineer",
    experience: "7 years dedicated to passive safety tech, crash testing and sensor-based accident prevention systems.",
    specialties: [
      "Airbag deployment systems",
      "windshield visibility enhancements",
      "sensor layout design",
    ],
    skills: [
      "Airbag controller diagnostics",
      "Crash sensor layout and testing",
      "Visibility enhancement systems",
      "Fog/defogger system calibration",
      "Sensor data mapping for safety feedback",
      "Compliance reporting (Global NCAP)",
    ],
  },
  {
    email: "zayan.khan@tata.com",
    password: "Password123!",
    firstName: "Zayan",
    lastName: "Khan",
    department: "Safety Systems",
    title: "Exterior Lighting & Visibility Specialist",
    experience: "5 years focused on automotive lighting systems and exterior visibility tech, including work on concept cars.",
    specialties: [
      "LED systems",
      "adaptive lighting",
      "weather-based visibility optimization",
    ],
    skills: [
      "Adaptive headlamp calibration",
      "DRL/taillight wiring",
      "LED retrofit & brightness control",
      "Beam pattern optimization",
      "Heated windshield wiring",
      "Visibility testing for adverse conditions",
    ],
  },
];

async function addTechnicians() {
  for (const tech of technicians) {
    try {
      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: tech.email,
        password: tech.password,
        displayName: `${tech.firstName} ${tech.lastName}`,
      });

      // Add user profile to Firestore
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        email: tech.email,
        role: 'technician',
        firstName: tech.firstName,
        lastName: tech.lastName,
        department: tech.department,
        title: tech.title,
        experience: tech.experience,
        specialties: tech.specialties,
        skills: tech.skills,
      });

      console.log(`Technician added: ${tech.firstName} ${tech.lastName}`);
    } catch (error) {
      console.error(`Error adding ${tech.firstName} ${tech.lastName}:`, error.message);
    }
  }
}

addTechnicians(); 