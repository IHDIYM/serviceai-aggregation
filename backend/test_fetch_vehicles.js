const axios = require('axios');

// Replace with a valid Firebase ID token for a technician account
const ID_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImE4ZGY2MmQzYTBhNDRlM2RmY2RjYWZjNmRhMTM4Mzc3NDU5ZjliMDEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiWmF5YW4gS2hhbiIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9zZXJ2aWNlYWktNTFmYjkiLCJhdWQiOiJzZXJ2aWNlYWktNTFmYjkiLCJhdXRoX3RpbWUiOjE3NTI4MzQzODUsInVzZXJfaWQiOiJJUEdjM2xjbmtkZXNSWG9STnd1MjllUTZ6aHYyIiwic3ViIjoiSVBHYzNsY25rZGVzUlhvUk53dTI5ZVE2emh2MiIsImlhdCI6MTc1MjgzODIyNSwiZXhwIjoxNzUyODQxODI1LCJlbWFpbCI6InpheWFuLmtoYW5AdGF0YS5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiemF5YW4ua2hhbkB0YXRhLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.hlf6EtmKa43VQ2hbQddGSb6tyK_HSmIQ8BBqj2xQ8dCegG4J9zF0SABX4vYxn69uQoPB4JIR5jBsi8vOf8EsI3hrK25NQzCDzuC0Nadw7NTLdDVxfh6QdCbDA_Gf-jFAvar0ucxTA2ucWSz2orTW-wMhOH3dBn1-lRMgxrKdf5bVzOKAIC3DRC5f-jtJIi1D5U6yC4WU_p4MH48gXDK1mjHHdnjT1OaLzPyyltPBb5k8Yue5_sOwCoIxJjqjSpzKt-YJiEpWO1msTKs-fd5hyFiJm99JK9E0nJKTrwmvYr_FTBJroG2rZv1J-R6LKqhnU0wDY-M-tI0sjHGK6zs-Gw';

// Replace with the userId you want to test
const USER_ID = '5klpTZnjCwWixqtV6QXyTewFCDU2';

async function fetchVehicles() {
  try {
    const res = await axios.get(
      `http://localhost:4000/profile/vehicles/${USER_ID}`,
      {
        headers: {
          Authorization: `Bearer ${ID_TOKEN}`,
        },
      }
    );
    console.log('Vehicles for user:', USER_ID);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error('Error:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

fetchVehicles();