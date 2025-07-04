import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="container mx-auto px-6 py-4 text-center text-gray-600">
        <p>&copy; 2024 ServiceApp. All rights reserved.</p>
        <div className="mt-2">
          <Link href="/signup/manager" className="text-sm hover:text-blue-600 hover:underline">
            Are you a manager? Sign up here.
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 