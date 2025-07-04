'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DashboardMetrics {
  total_requests_today: number;
  avg_assign_time_today: number;
  avg_resolution_time_today: number;
  requests_by_status: Record<string, number>;
  top_technicians: Array<{ name: string; count: number }>;
  hourly_distribution: Record<string, number>;
}

interface MetricsDashboardProps {
  user: any;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ user }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeader = async () => {
    const token = await user.getIdToken();
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const config = await getAuthHeader();
      const response = await axios.get('http://localhost:4000/metrics/dashboard', config);
      setMetrics(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch metrics:', err);
      setError(err.response?.data?.error || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMetrics();
      // Refresh metrics every 5 minutes
      const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const formatHour = (hour: string): string => {
    const hourNum = parseInt(hour);
    return `${hourNum}:00`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
        <button 
          onClick={fetchMetrics}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return <div>No metrics available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Service Metrics Dashboard</h2>
        <button 
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Requests Today</h3>
          <p className="text-3xl font-bold text-blue-600">{metrics.total_requests_today}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Avg Assignment Time</h3>
          <p className="text-3xl font-bold text-green-600">
            {formatTime(metrics.avg_assign_time_today)}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Avg Resolution Time</h3>
          <p className="text-3xl font-bold text-purple-600">
            {formatTime(metrics.avg_resolution_time_today)}
          </p>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Requests by Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(metrics.requests_by_status).map(([status, count]) => (
            <div key={status} className="text-center">
              <div className={`text-2xl font-bold ${
                status === 'pending' ? 'text-yellow-600' :
                status === 'active' ? 'text-blue-600' :
                status === 'closed' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {count}
              </div>
              <div className="text-sm text-gray-600 capitalize">{status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Technicians */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Performing Technicians</h3>
        <div className="space-y-3">
          {metrics.top_technicians.map((tech, index) => (
            <div key={tech.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div className="flex items-center">
                <span className="text-lg font-semibold text-gray-600 mr-3">#{index + 1}</span>
                <span className="font-medium">{tech.name}</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{tech.count} requests</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Hourly Request Distribution</h3>
        <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
          {Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString();
            const count = metrics.hourly_distribution[hour] || 0;
            return (
              <div key={hour} className="text-center">
                <div className="text-xs text-gray-600 mb-1">{formatHour(hour)}</div>
                <div className="bg-blue-100 rounded p-1">
                  <div className="text-sm font-semibold text-blue-800">{count}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard; 