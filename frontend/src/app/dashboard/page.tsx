"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import axios from "axios";
import MetricsDashboard from '@/components/MetricsDashboard';
import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import { FaCar, FaBatteryFull, FaCogs, FaCalendarAlt, FaTachometerAlt, FaCheckCircle, FaExclamationCircle, FaTools, FaShieldAlt } from 'react-icons/fa';

// --- Technician Components ---
const Timer = ({ startTime }: { startTime: string }) => {
  const [elapsedTime, setElapsedTime] = useState('');
  useEffect(() => {
    const updateTimer = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const difference = now - start;
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [startTime]);
  return <span className="font-mono text-lg text-gray-800">{elapsedTime}</span>;
};

const TechnicianDashboard = ({ profile, requests, onAccept, onClose }: any) => {
  const [manualMeta, setManualMeta] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchModal, setSearchModal] = useState<{ open: boolean, requestId: string | null }>({ open: false, requestId: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to get auth header
  const getAuthHeader = async () => {
    const user = auth.currentUser;
    if (!user) return { headers: {} };
    const idToken = await user.getIdToken();
    return { headers: { Authorization: `Bearer ${idToken}` } };
  };

  // Manual upload handler
  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const config = await getAuthHeader();
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await axios.post('http://localhost:4000/manual/upload', formData, {
        ...config,
        headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
      });
      setManualMeta(res.data.metadata);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Failed to upload manual.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open search modal for a request
  const openSearchModal = (requestId: string) => {
    setSearchModal({ open: true, requestId });
    setSearchQuery('');
    setSearchResult(null);
    setSearchError(null);
  };

  // Close search modal
  const closeSearchModal = () => {
    setSearchModal({ open: false, requestId: null });
    setSearchQuery('');
    setSearchResult(null);
    setSearchError(null);
  };

  // Handle search submit
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const config = await getAuthHeader();
      const res = await axios.post('http://localhost:4000/manual/search', { query: searchQuery }, config);
      setSearchResult(res.data);
    } catch (err: any) {
      setSearchError(err?.response?.data?.error || 'Failed to search manual.');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Manual Upload Section */}
      <div className="bg-white shadow-lg rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleManualUpload}
          />
          <button
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload PDF Manual'}
          </button>
        </div>
        {manualMeta && (
          <div className="text-sm text-gray-700">
            <div><b>Manual:</b> {manualMeta.currentFileName}</div>
            <div><b>Pages:</b> {manualMeta.pageCount}</div>
            <div><b>Total Chunks:</b> {manualMeta.totalChunks}</div>
          </div>
        )}
        {uploadError && <div className="text-red-600 text-sm">{uploadError}</div>}
      </div>
      {/* Service Request Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Incoming Requests */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Incoming Requests</h2>
          <div className="space-y-4">
            {requests.pending.length > 0 ? requests.pending.map((req: any) => (
              <div key={req.id} className="p-4 border rounded-lg bg-gray-50">
                <p className="font-semibold">{req.authorName || 'User'}</p>
                <p className="text-gray-600 text-sm">{new Date(req.createdAt.seconds * 1000).toLocaleString()}</p>
                <p className="mt-2">{req.requestDetails}</p>
                <button onClick={() => onAccept(req.id)} className="mt-3 w-full bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">Accept</button>
                <button onClick={() => openSearchModal(req.id)} className="mt-2 w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">Search solution from the manual</button>
              </div>
            )) : <p className="text-gray-500">No pending requests.</p>}
          </div>
        </div>
        {/* Active Services */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Active Services</h2>
          <div className="space-y-4">
            {requests.active.length > 0 ? requests.active.map((req: any) => (
              <div key={req.id} className="p-4 border rounded-lg bg-yellow-50">
                <div className="flex justify-between items-center">
                  <p className="font-semibold">{req.authorName || 'User'}</p>
                  {req.acceptedAt && req.acceptedAt.seconds ? (
                    <Timer startTime={new Date(req.acceptedAt.seconds * 1000).toISOString()} />
                  ) : (
                    <span className="text-gray-500">Not started</span>
                  )}
                </div>
                <p className="mt-2">{req.requestDetails}</p>
                <button onClick={() => onClose(req.id)} className="mt-3 w-full bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Mark as Complete</button>
                <button onClick={() => openSearchModal(req.id)} className="mt-2 w-full bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">Search solution from the manual</button>
              </div>
            )) : <p className="text-gray-500">No active services.</p>}
          </div>
        </div>
        {/* Service History */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Service History</h2>
          <div className="space-y-4">
            {requests.closed.length > 0 ? requests.closed.map((req: any) => (
              <div key={req.id} className="p-4 border rounded-lg bg-blue-50">
                <p className="font-semibold">{req.authorName || 'User'}</p>
                <p className="text-gray-600 text-sm">
                  Closed: {formatDate(req.closedAt)}
                </p>
                <p className="mt-2 text-gray-700">{req.requestDetails}</p>
              </div>
            )) : <p className="text-gray-500">No completed services.</p>}
          </div>
        </div>
      </div>
      {/* Search Modal */}
      {searchModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="relative w-full max-w-xl mx-auto bg-white rounded-2xl shadow-2xl p-8 border border-blue-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              onClick={closeSearchModal}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-extrabold text-blue-700 mb-4 text-center tracking-tight">Manual AI Solution</h2>
            <form onSubmit={handleSearch} className="mb-6">
              <label className="block text-gray-700 font-semibold mb-2">Describe your problem or question:</label>
              <textarea
                className="w-full border border-blue-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none min-h-[80px] mb-2"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="E.g. How do I refill oil in NHL 40 gearbox?"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow mt-2 transition-colors duration-150"
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching...' : 'Get Solution'}
              </button>
            </form>
            {searchError && <div className="text-red-600 font-semibold mb-2">{searchError}</div>}
            {searchResult && (
              <div className="mt-4">
                <h3 className="font-bold text-lg mb-2 text-blue-700">AI Solution</h3>
                <div className="bg-gray-50 border border-blue-100 rounded-lg p-4 mb-2 max-h-60 overflow-y-auto prose prose-blue">
                  <ReactMarkdown>{searchResult.answer}</ReactMarkdown>
                </div>
                {/* YouTube Video Suggestion */}
                {searchResult.youtube && (
                  <div className="mt-4 bg-white border border-red-200 rounded-lg p-4 shadow-sm">
                    <h4 className="font-bold text-red-600 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a2.994 2.994 0 0 0-2.107-2.12C19.077 3.5 12 3.5 12 3.5s-7.077 0-9.391.566A2.994 2.994 0 0 0 .502 6.186C0 8.5 0 12 0 12s0 3.5.502 5.814a2.994 2.994 0 0 0 2.107 2.12C4.923 20.5 12 20.5 12 20.5s7.077 0 9.391-.566a2.994 2.994 0 0 0 2.107-2.12C24 15.5 24 12 24 12s0-3.5-.502-5.814zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>
                      Suggested YouTube Video
                    </h4>
                    <div className="flex gap-4 items-start">
                      <a href={searchResult.youtube.url} target="_blank" rel="noopener noreferrer">
                        <img src={searchResult.youtube.thumbnail} alt="YouTube thumbnail" className="w-32 h-20 rounded-lg border" />
                      </a>
                      <div className="flex-1">
                        <a href={searchResult.youtube.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline block mb-1">
                          {searchResult.youtube.title}
                        </a>
                        {searchResult.youtube.chapters && searchResult.youtube.chapters.length > 0 ? (
                          <div className="mt-2">
                            <span className="font-semibold text-gray-700">Video Timeline:</span>
                            <ul className="list-disc ml-5 mt-1 text-sm">
                              {searchResult.youtube.chapters.map((ch: any, idx: number) => (
                                <li key={idx}>
                                  <a
                                    href={`${searchResult.youtube.url}&t=${ch.time.replace(/:/g, 'm').replace('m', 's')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-mono mr-2"
                                  >
                                    {ch.time}
                                  </a>
                                  <span className="text-gray-700">{ch.title}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-gray-500 italic">No suggested timeline available for this video.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* End YouTube Video Suggestion */}
                {searchResult.relevantSections && searchResult.relevantSections.length > 0 && (
                  <div className="text-xs text-gray-600 max-h-32 overflow-y-auto mt-2">
                    <b>Relevant Manual Sections:</b>
                    <ul className="list-disc ml-5">
                      {searchResult.relevantSections.map((section: any, idx: number) => (
                        <li key={idx}>
                          <b>Page {section.page}:</b> {section.text.slice(0, 120)}{section.text.length > 120 ? '...' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// --- Manager Components ---
const ManagerDashboard = ({ profile, allRequests, technicians, onAssign, onAssignAI, aiLoading, aiError, aiAssignedId, onBulkAssignAI, bulkLoading, bulkResult }: any) => {
    const [assignments, setAssignments] = useState<{ [key: string]: string }>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState("id"); // 'id' or 'requester'
    const [filteredRequests, setFilteredRequests] = useState(allRequests);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredRequests(allRequests);
        } else {
            setFilteredRequests(
                allRequests.filter((req: any) =>
                    searchType === 'id'
                        ? req.id.toLowerCase().includes(searchTerm.toLowerCase())
                        : (req.authorName || '').toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }
    }, [searchTerm, searchType, allRequests]);

    const activeTechnicianIds = new Set(
        allRequests
            .filter((req: any) => req.status === 'active')
            .map((req: any) => req.technicianId)
    );

    const getStatusPill = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">Pending</span>;
            case 'active': return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Active</span>;
            case 'closed': return <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-200 rounded-full">Closed</span>;
            default: return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">Unknown</span>;
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold">Manager Dashboard</h1>
                <p className="text-lg text-gray-600">Welcome, {profile.firstName}!</p>
            </div>

            {/* Search Bar */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="flex gap-2 items-center">
                <select
                  value={searchType}
                  onChange={e => setSearchType(e.target.value)}
                  className="border rounded p-2 text-sm"
                >
                  <option value="id">Request ID</option>
                  <option value="requester">Requester</option>
                </select>
                <input
                  type="text"
                  placeholder={`Search by ${searchType === 'id' ? 'Request ID' : 'Requester'}`}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="border rounded p-2 text-sm"
                />
                <button
                  onClick={() => setSearchTerm("")}
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm"
                >
                  Clear
                </button>
              </div>
              <button
                onClick={onBulkAssignAI}
                disabled={bulkLoading}
                className="px-4 py-2 bg-purple-700 text-white font-semibold rounded-md shadow-sm hover:bg-purple-800 disabled:bg-gray-400"
              >
                {bulkLoading ? 'Bulk Assigning by AI...' : 'Bulk Assign All by AI'}
              </button>
            </div>
            {bulkResult && (
                <div className="mb-4">
                    <div className="text-green-700 font-semibold">Assigned: {bulkResult.assignments.length}</div>
                    {bulkResult.errors.length > 0 && (
                        <div className="text-red-600 text-sm">Errors: {bulkResult.errors.map((e: any) => `Request ${e.requestId}: ${e.error}`).join(', ')}</div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                {/* Service Requests Overview */}
                <div className="bg-white shadow-lg rounded-xl p-6 xl:col-span-3">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">All Service Requests</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Request ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Technician</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRequests.map((req: any) => (
                                    <tr key={req.id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-blue-700">{req.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{req.authorName || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{req.requestDetails}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{req.technicianName || 'Unassigned'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusPill(req.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{req.createdAt ? new Date(req.createdAt).toLocaleString() : "N/A"}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {req.status === 'pending' && (
                                                <div className="flex flex-col space-y-2">
                                                    <div className="flex items-center space-x-2">
                                                        <select
                                                            value={assignments[req.id] || ''}
                                                            onChange={(e) => setAssignments({ ...assignments, [req.id]: e.target.value })}
                                                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                                        >
                                                            <option value="" disabled>
                                                                {technicians.filter((t: any) => !activeTechnicianIds.has(t.id)).length === 0
                                                                    ? "No available technicians"
                                                                    : "Select Technician"}
                                                            </option>
                                                            {technicians.filter((t: any) => !activeTechnicianIds.has(t.id)).map((tech: any) => (
                                                                <option key={tech.id} value={tech.id}>{tech.firstName} {tech.lastName}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => onAssign(req.id, assignments[req.id])}
                                                            disabled={!assignments[req.id]}
                                                            className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400"
                                                        >
                                                            Assign
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => onAssignAI(req.id)}
                                                        disabled={aiLoading === req.id}
                                                        className="px-3 py-2 bg-purple-600 text-white font-semibold rounded-md shadow-sm hover:bg-purple-700 disabled:bg-gray-400 mt-1"
                                                    >
                                                        {aiLoading === req.id ? 'Assigning by AI...' : 'Assign Technician by AI'}
                                                    </button>
                                                    {aiError && aiLoading === req.id && (
                                                        <span className="text-red-500 text-xs">{aiError}</span>
                                                    )}
                                                    {aiAssignedId === req.id && (
                                                        <span className="text-green-600 text-xs">Assigned by AI!</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Technicians List */}
                <div className="bg-white shadow-lg rounded-xl p-6 xl:col-span-2">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Technicians</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {technicians.map((tech: any) => {
                                    const isBusy = activeTechnicianIds.has(tech.id);
                                    return (
                                        <tr key={tech.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{tech.firstName} {tech.lastName}</div>
                                                <div className="text-sm text-gray-500">{tech.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{tech.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isBusy ? (
                                                    <span className="px-2 py-1 text-xs font-semibold text-orange-800 bg-orange-200 rounded-full">On a Job</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Available</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="bg-white shadow-lg rounded-xl p-6">
                <MetricsDashboard user={auth.currentUser} />
            </div>
        </div>
    );
};

const UserDashboard = ({ profile, userRequests, onSubmitRequest }: any) => {
  const [requestDetails, setRequestDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  useEffect(() => {
    const fetchVehicles = async () => {
      setVehicleLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const idToken = await user.getIdToken();
        const res = await axios.get('http://localhost:4000/profile/vehicles', {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        setVehicles(res.data.vehicles || []);
      } catch (err) {
        setVehicles([]);
      } finally {
        setVehicleLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedVehicleId) {
      setError("Please select a vehicle for this request.");
      return;
    }
    if (!requestDetails.trim()) {
      setError("Please enter your service request details.");
      return;
    }
    setSubmitting(true);
    await onSubmitRequest(requestDetails, setError, selectedVehicleId);
    setSubmitting(false);
    setRequestDetails("");
    setSelectedVehicleId("");
    setShowForm(false);
  };

  const statusColor = (status: string) => status === 'Active' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white shadow-lg rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Welcome, {profile.firstName}!</h1>
          <button
            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => setShowForm(true)}
          >
            Add Service
          </button>
        </div>
        {/* Vehicle Info Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-extrabold mb-4 flex items-center gap-2 text-blue-800">
            <FaCar className="inline-block text-blue-500" /> Your Vehicles
          </h2>
          {vehicleLoading ? (
            <p className="text-gray-500">Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <p className="text-gray-500">No vehicles added yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vehicles.map(vehicle => (
                <div key={vehicle.id} className="bg-white rounded-xl shadow-lg p-6 border border-blue-100 flex flex-col gap-2">
                  <div className="flex items-center gap-3 mb-2">
                    <FaCar className="text-2xl text-blue-500" />
                    <span className="text-lg font-bold capitalize">{vehicle.model || vehicle.vehicleModel || '-'} ({vehicle.vehicleType})</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mb-2">
                    <span className="flex items-center gap-1 text-gray-700"><FaCalendarAlt /> <b>Purchase:</b> {vehicle.purchaseDate ? dayjs(vehicle.purchaseDate).format('YYYY-MM-DD') : '-'}</span>
                    <span className="flex items-center gap-1 text-gray-700"><FaTachometerAlt /> <b>Odometer:</b> {vehicle.odometerKm || '-'} km</span>
                  </div>
                  {/* Warranty Info */}
                  {vehicle.warranty && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-3">
                      <h4 className="font-semibold mb-2 text-blue-700 flex items-center gap-2"><FaShieldAlt /> Warranty Status</h4>
                      <div className="flex flex-wrap gap-4 justify-center">
                        {Object.entries(vehicle.warranty).map(([component, details]: any) => (
                          <div key={component} className="bg-white rounded p-3 border border-gray-100 shadow-sm mb-2 min-w-[220px] max-w-xs flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {component.toLowerCase().includes('battery') && <FaBatteryFull className="text-yellow-500" />}
                              {component.toLowerCase().includes('engine') && <FaCogs className="text-gray-700" />}
                              {component.toLowerCase().includes('motor') && <FaTools className="text-purple-600" />}
                              {component.toLowerCase().includes('transmission') && <FaCogs className="text-blue-600" />}
                              {component.toLowerCase().includes('rust') && <FaExclamationCircle className="text-orange-600" />}
                              <span className="font-medium text-gray-800 text-base">{component}</span>
                            </div>
                            <ul className="ml-2 text-sm space-y-1">
                              {Object.entries(details).map(([k, v]) => (
                                <li key={k} className={k === 'Status' ? statusColor(v as string) + ' font-semibold' : ''}>
                                  <b>{k}:</b> {v}
                                  {k === 'Status' && (v === 'Active' ? <FaCheckCircle className="inline ml-1 text-green-500" /> : <FaExclamationCircle className="inline ml-1 text-red-500" />)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* End Vehicle Info Section */}
        {showForm && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                onClick={() => { setShowForm(false); setError(""); }}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="text-xl font-bold mb-2">New Service Request</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <label htmlFor="vehicle" className="font-medium">Select Vehicle</label>
                <select
                  id="vehicle"
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={submitting || vehicleLoading}
                >
                  <option value="">-- Select your vehicle --</option>
                  {vehicles.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleModel || v.model} ({v.vehicleType})
                    </option>
                  ))}
                </select>
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe your issue or service needed..."
                  value={requestDetails}
                  onChange={e => setRequestDetails(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300"
                    onClick={() => { setShowForm(false); setError(""); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white shadow-lg rounded-xl p-6 mt-8">
        <h2 className="text-2xl font-extrabold mb-4 text-blue-800 flex items-center gap-2"><FaTools className="text-blue-500" /> Your Service Requests</h2>
        {userRequests.length === 0 ? (
          <p className="text-gray-500">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {userRequests.map((req: any) => (
              <li key={req.id} className="py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">Request ID: <span className="text-blue-700 font-mono">{req.id}</span></p>
                    <p className="font-semibold">{req.requestDetails}</p>
                    <p className="text-xs text-gray-500">Submitted: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "N/A"}</p>
                    {req.vehicleModel && (
                      <p className="text-xs text-gray-600 mt-1">Vehicle: {req.vehicleModel} ({req.vehicleType})</p>
                    )}
                  </div>
                  <span className={
                    req.status === 'pending' ? 'px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold' :
                    req.status === 'active' ? 'px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold' :
                    req.status === 'closed' ? 'px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold' :
                    'px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold'
                  }>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                </div>
                {req.technicianName && (
                  <p className="text-xs text-gray-600 mt-1">Assigned to: {req.technicianName}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Helper function for date formatting
function formatDate(date: any) {
  if (!date) return "N/A";
  if (typeof date === 'string' || date instanceof Date) return new Date(date).toLocaleString();
  if (date.seconds) return new Date(date.seconds * 1000).toLocaleString();
  return "N/A";
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [techRequests, setTechRequests] = useState({ pending: [], active: [], closed: [] });
  const [managerData, setManagerData] = useState({ allRequests: [], technicians: [] });
  const [apiError, setApiError] = useState<string | null>(null);
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAssignedId, setAiAssignedId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);

  const getAuthHeader = async () => {
    const user = auth.currentUser;
    if (!user) return { headers: {} };
    const idToken = await user.getIdToken();
    return { headers: { Authorization: `Bearer ${idToken}` } };
  };
  
  const fetchTechnicianData = async () => {
      const config = await getAuthHeader();
      if (!config.headers) return;

      const [pendingRes, activeRes, closedRes] = await Promise.all([
        axios.get("http://localhost:4000/requests/pending", config),
        axios.get("http://localhost:4000/requests/active", config),
        axios.get("http://localhost:4000/requests/closed", config)
      ]);
      
      setTechRequests({ pending: pendingRes.data, active: activeRes.data, closed: closedRes.data });
  };
  
  const fetchManagerData = async () => {
      const config = await getAuthHeader();
      if (!config.headers) return;

      const [requestsRes, techsRes] = await Promise.all([
          axios.get("http://localhost:4000/requests/all", config),
          axios.get("http://localhost:4000/users/technicians", config)
      ]);

      setManagerData({ allRequests: requestsRes.data, technicians: techsRes.data });
  };
  
  const fetchUserRequests = async () => {
    const config = await getAuthHeader();
    if (!config.headers) return;
    try {
      const res = await axios.get("http://localhost:4000/requests/mine", config);
      setUserRequests(res.data);
    } catch (err) {
      setApiError("Could not load your service requests.");
    }
  };

  const handleSubmitUserRequest = async (details: string, setError: (msg: string) => void, vehicleId: string) => {
    try {
      const config = await getAuthHeader();
      await axios.post("http://localhost:4000/requests", { requestDetails: details, vehicleId }, config);
      await fetchUserRequests();
    } catch (error: any) {
      setError(error?.response?.data?.error || "Failed to submit request.");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const res = await axios.post("http://localhost:4000/login", { idToken });
          const userProfile = res.data;
          setProfile(userProfile);

          if (userProfile.role === 'manager') {
            await fetchManagerData();
          } else if (userProfile.role === 'technician') {
            await fetchTechnicianData();
          } else if (userProfile.role === 'user') {
            await fetchUserRequests();
          }
          setApiError(null);
        } catch (err) {
          setProfile(null);
          setApiError("Failed to load dashboard data.");
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const config = await getAuthHeader();
      await axios.put(`http://localhost:4000/requests/${requestId}/accept`, {}, config);
      await fetchTechnicianData();
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };
  
  const handleCloseRequest = async (requestId: string) => {
    try {
      const config = await getAuthHeader();
      await axios.put(`http://localhost:4000/requests/${requestId}/close`, {}, config);
      await fetchTechnicianData();
    } catch (error) {
      console.error("Failed to close request:", error);
    }
  };

  const handleAssignRequest = async (requestId: string, technicianId: string) => {
    if (!technicianId) {
        alert("Please select a technician to assign.");
        return;
    }
    try {
        const config = await getAuthHeader();
        const response = await axios.put(`http://localhost:4000/requests/${requestId}/assign`, { technicianId }, config);
        console.log("Assignment successful:", response.data);
        
        // Add a small delay before refreshing data to avoid race conditions
        setTimeout(async () => {
            try {
                await fetchManagerData(); // Re-fetch manager data to update UI
            } catch (refreshError) {
                console.error("Error refreshing data after assignment:", refreshError);
            }
        }, 500);
        
    } catch (error: any) {
        console.error("Failed to assign request:", error);
        const errorMessage = error?.response?.data?.error || "Failed to assign request. Please try again.";
        
        // Only show alert if it's a real assignment error, not a refresh error
        if (error?.response?.status === 400 && errorMessage.includes("Request must be pending")) {
            alert(`Assignment failed: ${errorMessage}`);
        } else {
            console.log("Assignment may have succeeded, but refresh failed. Please refresh the page.");
        }
    }
  };

  const handleAssignAI = async (requestId: string) => {
    setAiLoading(requestId);
    setAiError(null);
    setAiAssignedId(null);
    try {
      const config = await getAuthHeader();
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/requests/${requestId}/assign-ai`,
        {},
        config
      );
      setAiAssignedId(requestId);
      // Optionally, refresh data here
      await fetchManagerData();
    } catch (err: any) {
      setAiError(err?.response?.data?.error || 'Failed to assign by AI');
    } finally {
      setAiLoading(null);
    }
  };

  const handleBulkAssignAI = async () => {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const config = await getAuthHeader();
      const res = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/requests/assign-ai-bulk`,
        {},
        config
      );
      setBulkResult(res.data);
      await fetchManagerData();
    } catch (err: any) {
      setBulkResult({ assignments: [], errors: [{ error: err?.response?.data?.error || 'Bulk AI assignment failed.' }] });
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p>Loading Dashboard...</p></div>;
  }

  if (!profile) {
    return <div className="flex items-center justify-center h-screen"><p>Could not load profile data.</p></div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        {apiError && <p className="text-center text-red-500 mb-4">{apiError}</p>}
        {profile.role === 'manager' && (
            <ManagerDashboard
                profile={profile}
                allRequests={managerData.allRequests}
                technicians={managerData.technicians}
                onAssign={handleAssignRequest}
                onAssignAI={handleAssignAI}
                aiLoading={aiLoading}
                aiError={aiError}
                aiAssignedId={aiAssignedId}
                onBulkAssignAI={handleBulkAssignAI}
                bulkLoading={bulkLoading}
                bulkResult={bulkResult}
            />
        )}
        {profile.role === 'technician' && (
            <TechnicianDashboard profile={profile} requests={techRequests} onAccept={handleAcceptRequest} onClose={handleCloseRequest} />
        )}
        {profile.role === 'user' && (
            <UserDashboard profile={profile} userRequests={userRequests} onSubmitRequest={handleSubmitUserRequest} />
        )}
        {!['manager','technician','user'].includes(profile.role) && (
            <div className="text-center text-red-600 font-bold mt-8">Unknown user role. Please contact support.</div>
        )}
    </div>
  );
}