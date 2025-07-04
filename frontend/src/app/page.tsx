import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold mb-4">Streamline Your Services, Delight Your Customers</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          The all-in-one platform that connects users with skilled technicians and enables seamless management for business owners.
        </p>
        <div className="space-x-4">
          <Link href="/signup/user" className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors">
            Get Started
          </Link>
          <Link href="/login" className="px-8 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition-colors">
            Login
          </Link>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-2">How It Works</h2>
          <p className="text-gray-600 mb-12">A simple process to get things done.</p>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 text-blue-600 rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4">1</div>
              <h3 className="text-xl font-semibold mb-2">Book a Service</h3>
              <p className="text-gray-600">Tell us what you need and find the right service in minutes.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 text-blue-600 rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4">2</div>
              <h3 className="text-xl font-semibold mb-2">Connect with a Pro</h3>
              <p className="text-gray-600">We match you with a verified and skilled technician for the job.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 text-blue-600 rounded-full h-16 w-16 flex items-center justify-center text-2xl font-bold mb-4">3</div>
              <h3 className="text-xl font-semibold mb-2">Rate & Review</h3>
              <p className="text-gray-600">Leave feedback to help our community and ensure quality service.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Why Choose ServiceApp?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6">
              <Image src="/feature-verified.svg" alt="Verified Icon" width={48} height={48} className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Verified Technicians</h3>
              <p className="text-gray-600">Every professional on our platform is vetted for quality and reliability.</p>
            </div>
            <div className="p-6">
              <Image src="/feature-schedule.svg" alt="Scheduling Icon" width={48} height={48} className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Easy Scheduling</h3>
              <p className="text-gray-600">Book and manage your appointments with our intuitive calendar system.</p>
            </div>
            <div className="p-6">
              <Image src="/feature-pricing.svg" alt="Pricing Icon" width={48} height={48} className="mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Transparent Pricing</h3>
              <p className="text-gray-600">No hidden fees. Get clear, upfront pricing before you book.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Loved by Users Everywhere</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600 mb-4">"ServiceApp transformed how we handle our repairs. It's incredibly efficient and the technicians are top-notch. A must-have for any homeowner!"</p>
              <p className="font-semibold">- Alex Johnson</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <p className="text-gray-600 mb-4">"As a manager, this platform has given me a bird's-eye view of all ongoing services. It's powerful, yet so simple to use. Highly recommended."</p>
              <p className="font-semibold">- Samantha Lee</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="text-center py-20">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-lg text-gray-600 mb-8">Join thousands of users, technicians, and managers today.</p>
        <Link href="/signup/user" className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105">
          Sign Up Now
        </Link>
      </section>
    </div>
  );
}
