"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import axios from "axios";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          // Call backend to get profile
          const res = await axios.post("http://localhost:4000/login", { idToken });
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
                <div className="text-center">
                    <p className="text-lg font-semibold text-gray-700">Location: {profile.location}</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 