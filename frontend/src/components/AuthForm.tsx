"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

type Role = "user" | "manager" | "technician";

interface AuthFormProps {
  formType: "login" | "signup";
  role?: Role;
}

export default function AuthForm({ formType, role }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] = useState("");
  const [specialTech, setSpecialTech] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");

  const handleGetCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser.");
      return;
    }

    setMessage("Getting location...");
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        if (data && data.display_name) {
          setLocation(data.display_name);
          setMessage("Location found!");
        } else {
          setMessage("Could not find address for your location.");
        }
      } catch (error) {
        setMessage("Failed to fetch address.");
      }
    }, () => {
      setMessage("Unable to retrieve your location. Please check browser permissions.");
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    if (formType === "signup") {
      const signupData: any = { email, password, role, firstName, lastName };
      if (role === 'manager') signupData.department = department;
      if (role === 'technician') signupData.specialTech = specialTech;
      if (role === 'user') signupData.location = location;

      try {
        const res = await fetch('http://localhost:4000/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signupData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Signup failed");
        
        // After successful signup, log the user in and redirect to dashboard
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");

      } catch (error: any) {
        setMessage(error.message);
      }
    } else { // Login logic
      try {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/dashboard");
      } catch (error: any) {
        setMessage(error.message);
      }
    }
  };

  const title = formType === 'login' ? 'Login' : `Sign Up as ${role?.charAt(0).toUpperCase() + role!.slice(1)}`;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-center mb-6">{title}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formType === 'signup' && (
          <>
            <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className="border p-2 rounded" required />
            <input type="text" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} className="border p-2 rounded" required />
          </>
        )}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 rounded" required />

        {formType === 'signup' && role === 'user' && (
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Living Location" value={location} onChange={e => setLocation(e.target.value)} className="border p-2 rounded w-full" required />
            <button type="button" onClick={handleGetCurrentLocation} className="bg-gray-200 p-2 rounded text-sm whitespace-nowrap">Use Current</button>
          </div>
        )}
        {formType === 'signup' && role === 'manager' && <input type="text" placeholder="Department" value={department} onChange={e => setDepartment(e.target.value)} className="border p-2 rounded" required />}
        {formType === 'signup' && role === 'technician' && <input type="text" placeholder="Special Tech" value={specialTech} onChange={e => setSpecialTech(e.target.value)} className="border p-2 rounded" required />}

        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {formType === 'login' ? 'Login' : 'Sign Up'}
        </button>
        {message && <p className="mt-2 text-center text-red-600">{message}</p>}
      </form>
    </div>
  );
} 