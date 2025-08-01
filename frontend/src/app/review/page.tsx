"use client";
import { useState } from 'react';
import { Star } from 'lucide-react';
import { auth } from '@/lib/firebase';

const StarRating = ({ rating, setRating }) => {
  return (
    <div className="flex space-x-1">
      {[...Array(5)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            type="button"
            key={starValue}
            onClick={() => setRating(starValue)}
            className="focus:outline-none"
          >
            <Star
              className={`w-8 h-8 ${
                starValue <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

export default function ReviewPage() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const user = auth.currentUser;
    if (!user) {
      setError('You must be logged in to leave a review.');
      return;
    }

    if (rating === 0 || !technicianId) {
      setError('Please provide a rating and a technician ID.');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('http://13.60.214.254/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ technicianId, rating, comment }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review.');
      }

      setMessage('Thank you for your review!');
      setRating(0);
      setComment('');
      setTechnicianId('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Leave a Review</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="technicianId" className="block text-sm font-medium text-gray-700">
            Technician ID
          </label>
          <input
            id="technicianId"
            type="text"
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter the ID of the technician you are reviewing"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Rating</label>
          <StarRating rating={rating} setRating={setRating} />
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
            Comment (Optional)
          </label>
          <textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Tell us more about your experience..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Submit Review
        </button>

        {message && <p className="text-green-600 text-center mt-4">{message}</p>}
        {error && <p className="text-red-600 text-center mt-4">{error}</p>}
      </form>
    </div>
  );
} 