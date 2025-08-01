"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import axios from "axios";
import dayjs from 'dayjs';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Vehicle state for user
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType || '');
  const [vehicleModel, setVehicleModel] = useState(profile?.vehicleModel || '');
  const [purchaseDate, setPurchaseDate] = useState(profile?.purchaseDate ? profile.purchaseDate.slice(0,10) : '');
  const [odometerKm, setOdometerKm] = useState(profile?.odometerKm || '');
  const [vehicleMsg, setVehicleMsg] = useState('');

  // Vehicles state for user
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleType: '',
    vehicleModel: '',
    purchaseDate: '',
    odometerKm: ''
  });
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Update vehicle info handler
  const handleVehicleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleMsg('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const idToken = await user.getIdToken();
      const res = await axios.put('http://13.60.214.254/profile/vehicle', {
        vehicleType, vehicleModel, purchaseDate, odometerKm
      }, { headers: { Authorization: `Bearer ${idToken}` } });
      setVehicleMsg('Vehicle info updated!');
    } catch (err: any) {
      setVehicleMsg(err.message || 'Failed to update vehicle info');
    }
  };

  // Handle vehicle form input
  const handleVehicleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setVehicleForm({ ...vehicleForm, [e.target.name]: e.target.value });
  };

  // Add or update vehicle
  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleMsg('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const idToken = await user.getIdToken();
      if (editingVehicleId) {
        // Update vehicle
        await axios.patch(`http://13.60.214.254/profile/vehicle/${editingVehicleId}`, vehicleForm, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setVehicleMsg('Vehicle updated!');
      } else {
        // Add new vehicle
        await axios.post('http://13.60.214.254/profile/vehicle', vehicleForm, {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setVehicleMsg('Vehicle added!');
      }
      // Refresh vehicles
      const res = await axios.get('http://13.60.214.254/profile/vehicles', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setVehicles(res.data.vehicles || []);
      setVehicleForm({ vehicleType: '', vehicleModel: '', purchaseDate: '', odometerKm: '' });
      setEditingVehicleId(null);
    } catch (err: any) {
      setVehicleMsg(err.message || 'Failed to save vehicle');
    }
  };

  // Edit vehicle
  const handleEditVehicle = (vehicle: any) => {
    setVehicleForm({
      vehicleType: vehicle.vehicleType || '',
      vehicleModel: vehicle.vehicleModel || '',
      purchaseDate: vehicle.purchaseDate ? vehicle.purchaseDate.slice(0,10) : '',
      odometerKm: vehicle.odometerKm || ''
    });
    setEditingVehicleId(vehicle.id);
  };

  // Delete vehicle
  const handleDeleteVehicle = async (vehicleId: string) => {
    setVehicleMsg('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const idToken = await user.getIdToken();
      await axios.delete(`http://13.60.214.254/profile/vehicle/${vehicleId}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      // Refresh vehicles
      const res = await axios.get('http://13.60.214.254/profile/vehicles', {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      setVehicles(res.data.vehicles || []);
      setVehicleMsg('Vehicle deleted.');
      setEditingVehicleId(null);
      setVehicleForm({ vehicleType: '', vehicleModel: '', purchaseDate: '', odometerKm: '' });
    } catch (err: any) {
      setVehicleMsg(err.message || 'Failed to delete vehicle');
    }
  };

  // Fetch vehicles on profile load and after add/edit/delete
  useEffect(() => {
    const fetchVehicles = async () => {
      setVehicleLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const idToken = await user.getIdToken();
        const res = await axios.get('http://13.60.214.254/profile/vehicles', {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setVehicles(res.data.vehicles || []);
      } catch (err) {
        setVehicles([]);
      } finally {
        setVehicleLoading(false);
      }
    };
    if (profile && profile.role === 'user') fetchVehicles();
  }, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          // Call backend to get profile
          const res = await axios.post("http://13.60.214.254/login", { idToken });
          setProfile(res.data);
        } catch (err) {
          setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        // No user is signed in, redirect to login.
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Loading Profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">Could not load profile data.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
                <div className="h-32 w-32 rounded-full bg-gray-200 mx-auto flex items-center justify-center ring-4 ring-indigo-300">
                  <span className="text-5xl font-bold text-gray-500">
                    {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
                  </span>
                </div>
                 <h1 className="text-4xl font-extrabold text-gray-900 mt-4">{profile.firstName} {profile.lastName}</h1>
                 <p className="text-xl font-semibold text-indigo-600">{profile.title || profile.role}</p>
                 <p className="text-md text-gray-500 mt-1">{profile.email}</p>
            </div>
            
            {profile.role === 'technician' && (
              <>
                <div className="mt-8 text-center">
                  <h2 className="text-lg font-bold text-gray-800">Experience</h2>
                  <p className="mt-2 text-gray-600 max-w-2xl mx-auto">{profile.experience}</p>
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 text-center">Specialties</h2>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.specialties?.map((specialty: string, index: number) => (
                      <span key={index} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-3 text-center">Skills</h2>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.skills?.map((skill: string, index: number) => (
                      <span key={index} className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {profile.role === 'manager' && (
                <div className="text-center">
                    <p className="text-lg font-semibold text-gray-700">Department: {profile.department}</p>
                </div>
            )}
             {profile.role === 'user' && (
                <div className="text-center mt-8">
                    <p className="text-lg font-semibold text-gray-700">Location: {profile.location}</p>
                    <form onSubmit={handleVehicleSubmit} className="mt-6 flex flex-col gap-4 max-w-md mx-auto bg-gray-100 p-4 rounded-lg">
                      <h2 className="text-xl font-bold mb-2">{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
                      <label htmlFor="vehicleType" className="font-medium">Vehicle Type</label>
                      <select id="vehicleType" name="vehicleType" value={vehicleForm.vehicleType} onChange={handleVehicleInput} className="border p-2 rounded" required>
                        <option value="">Select Type</option>
                        <option value="diesel">Diesel</option>
                        <option value="petrol">Petrol</option>
                        <option value="electric">Electric</option>
                      </select>
                      <label htmlFor="vehicleModel" className="font-medium">Vehicle Model</label>
                      <input id="vehicleModel" name="vehicleModel" type="text" placeholder="e.g. Honda City" value={vehicleForm.vehicleModel} onChange={handleVehicleInput} className="border p-2 rounded" required />
                      <label htmlFor="purchaseDate" className="font-medium">Purchase Date</label>
                      <input id="purchaseDate" name="purchaseDate" type="date" value={vehicleForm.purchaseDate} onChange={handleVehicleInput} className="border p-2 rounded" required />
                      <label htmlFor="odometerKm" className="font-medium">Odometer Reading (km)</label>
                      <input id="odometerKm" name="odometerKm" type="number" min="0" step="0.1" placeholder="Enter current odometer reading" value={vehicleForm.odometerKm} onChange={handleVehicleInput} className="border p-2 rounded" required />
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">{editingVehicleId ? 'Update Vehicle' : 'Add Vehicle'}</button>
                      {editingVehicleId && <button type="button" className="bg-gray-400 text-white p-2 rounded hover:bg-gray-500" onClick={() => { setEditingVehicleId(null); setVehicleForm({ vehicleType: '', vehicleModel: '', purchaseDate: '', odometerKm: '' }); }}>Cancel Edit</button>}
                      {vehicleMsg && <p className="text-green-600 mt-2">{vehicleMsg}</p>}
                    </form>
                    {/* List of vehicles */}
                    <div className="mt-8 max-w-2xl mx-auto">
                      <h3 className="font-bold mb-4 text-lg">Your Vehicles</h3>
                      {vehicleLoading ? (
                        <p className="text-gray-500">Loading vehicles...</p>
                      ) : vehicles.length === 0 ? (
                        <p className="text-gray-500">No vehicles added yet.</p>
                      ) : (
                        vehicles.map(vehicle => (
                          <div key={vehicle.id} className="bg-white p-4 rounded shadow mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="text-left">
                              <p><b>Type:</b> {vehicle.vehicleType || '-'}</p>
                              <p><b>Model:</b> {vehicle.vehicleModel || '-'}</p>
                              <p><b>Purchase Date:</b> {vehicle.purchaseDate ? dayjs(vehicle.purchaseDate).format('YYYY-MM-DD') : '-'}</p>
                              <p><b>Odometer (km):</b> {vehicle.odometerKm || '-'}</p>
                            </div>
                            <div className="flex gap-2">
                              <button className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600" onClick={() => handleEditVehicle(vehicle)}>Edit</button>
                              <button className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700" onClick={() => handleDeleteVehicle(vehicle.id)}>Delete</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 