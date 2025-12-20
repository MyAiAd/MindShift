'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Calendar, Clock, Video, Plus, User, CheckCircle, AlertCircle, ExternalLink, Activity, Zap, RotateCcw } from 'lucide-react';
import EnhancedBookingModal from '@/components/sessions/EnhancedBookingModal';

interface CoachingSession {
  id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  meeting_link?: string;
  meeting_type: string;
  notes?: string;
  coach: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface TreatmentSession {
  id: string;
  session_id: string;
  user_id: string;
  tenant_id: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  current_phase: string;
  current_step: string;
  problem_statement?: string;
  metadata: any;
  avg_response_time: number;
  scripted_responses: number;
  ai_responses: number;
  duration_minutes: number;
  total_ai_cost: number;
  total_ai_tokens: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface SessionStats {
  total_sessions: number;
  upcoming_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_hours_this_month: number;
  available_slots: number;
  treatment_sessions: number;
  active_treatment_sessions: number;
  completed_treatment_sessions: number;
  total_treatment_hours_this_month: number;
}

export default function SessionsPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [treatmentSessions, setTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [clearingStats, setClearingStats] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const [sessionsResponse, treatmentSessionsResponse, statsResponse] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/sessions/treatment'),
          fetch('/api/sessions/stats')
        ]);

        const [sessionsData, treatmentSessionsData, statsData] = await Promise.all([
          sessionsResponse.json(),
          treatmentSessionsResponse.json(),
          statsResponse.json()
        ]);

        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions);
        }

        if (treatmentSessionsData.treatmentSessions) {
          setTreatmentSessions(treatmentSessionsData.treatmentSessions);
        }

        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } catch (error) {
        console.error('Error fetching session data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchSessionData();
    }
  }, [profile]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Upcoming</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Cancelled</span>;
      default:
        return null;
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { date: dateStr, time: timeStr };
  };

  const formatMethodName = (methodName: string) => {
    if (!methodName) return 'Mind Shifting';
    
    // Convert snake_case to Title Case
    return methodName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getTreatmentSessionTitle = (session: TreatmentSession) => {
    const methodName = session.metadata?.selectedMethod || 'mind_shifting';
    return `${formatMethodName(methodName)} Session`;
  };

  const getTreatmentSessionDescription = (session: TreatmentSession) => {
    if (session.problem_statement) {
      return `Problem: ${session.problem_statement}`;
    }
    return `Phase: ${session.current_phase} • Step: ${session.current_step}`;
  };

  const getTreatmentStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">In Progress</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'paused':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Paused</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Cancelled</span>;
      default:
        return null;
    }
  };

  const isUpcoming = (session: CoachingSession) => {
    return session.status === 'scheduled' && new Date(session.scheduled_at) > new Date();
  };

  const handleJoinSession = (session: CoachingSession) => {
    if (session.meeting_link) {
      window.open(session.meeting_link, '_blank');
    } else {
      alert('Meeting link not available yet. Please check back closer to the session time.');
    }
  };

  const handleDeleteTreatmentSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this treatment session? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/sessions/treatment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        // Remove the session from the local state
        setTreatmentSessions(prev => prev.filter(session => session.session_id !== sessionId));
        // Refresh stats
        const statsResponse = await fetch('/api/sessions/stats');
        const statsData = await statsResponse.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  const handleDeleteCoachingSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this coaching session? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        // Remove the session from the local state
        setSessions(prev => prev.filter(session => session.id !== sessionId));
        // Refresh stats
        const statsResponse = await fetch('/api/sessions/stats');
        const statsData = await statsResponse.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } else {
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session. Please try again.');
    }
  };

  // Bulk delete functions
  const handleSessionSelect = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allSessionIds = new Set([
        ...sessions.map(s => `coaching-${s.id}`),
        ...treatmentSessions.map(s => `treatment-${s.session_id}`)
      ]);
      setSelectedSessions(allSessionIds);
    } else {
      setSelectedSessions(new Set());
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.size === 0) return;

    const sessionCount = selectedSessions.size;
    if (!confirm(`Are you sure you want to delete ${sessionCount} session${sessionCount > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    
    try {
      const deletePromises: Promise<any>[] = [];
      
      // Separate coaching and treatment sessions
      const coachingSessions = Array.from(selectedSessions)
        .filter(id => id.startsWith('coaching-'))
        .map(id => id.replace('coaching-', ''));
      
      const treatmentSessionIds = Array.from(selectedSessions)
        .filter(id => id.startsWith('treatment-'))
        .map(id => id.replace('treatment-', ''));

      // Delete coaching sessions (if API exists)
      coachingSessions.forEach(sessionId => {
        deletePromises.push(
          fetch('/api/sessions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          })
        );
      });

      // Delete treatment sessions
      treatmentSessionIds.forEach(sessionId => {
        deletePromises.push(
          fetch('/api/sessions/treatment', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          })
        );
      });

      const results = await Promise.allSettled(deletePromises);
      
      // Check for any failures and process successful responses
      const failures: string[] = [];
      const successfulCoachingDeletes: string[] = [];
      const successfulTreatmentDeletes: string[] = [];

      // Process coaching session results
      coachingSessions.forEach((sessionId, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          // Check if the response was successful
          const response = result.value as Response;
          if (response.ok) {
            successfulCoachingDeletes.push(sessionId);
          } else {
            failures.push(`Coaching session ${sessionId}`);
          }
        } else {
          failures.push(`Coaching session ${sessionId}`);
        }
      });

      // Process treatment session results
      treatmentSessionIds.forEach((sessionId, index) => {
        const result = results[coachingSessions.length + index];
        if (result.status === 'fulfilled') {
          // Check if the response was successful
          const response = result.value as Response;
          if (response.ok) {
            successfulTreatmentDeletes.push(sessionId);
          } else {
            failures.push(`Treatment session ${sessionId}`);
          }
        } else {
          failures.push(`Treatment session ${sessionId}`);
        }
      });

      if (failures.length > 0) {
        console.error('Some deletions failed:', failures);
        alert(`${failures.length} session${failures.length > 1 ? 's' : ''} failed to delete. Please try again.`);
      }

      // Update local state by removing successfully deleted sessions
      setSessions(prev => prev.filter(session => !successfulCoachingDeletes.includes(session.id)));
      setTreatmentSessions(prev => prev.filter(session => !successfulTreatmentDeletes.includes(session.session_id)));
      
      // Clear selection
      setSelectedSessions(new Set());
      
      // Refresh stats
      const statsResponse = await fetch('/api/sessions/stats');
      const statsData = await statsResponse.json();
      if (statsData.stats) {
        setStats(statsData.stats);
      }

    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('Failed to delete sessions. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBookingComplete = (booking: any) => {
    // Add the new booking to the sessions list
    setSessions(prev => [booking, ...prev]);
    
    // Refresh stats
    const fetchStats = async () => {
      try {
        const statsResponse = await fetch('/api/sessions/stats');
        const statsData = await statsResponse.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } catch (error) {
        console.error('Error refreshing stats:', error);
      }
    };
    
    fetchStats();
    setShowBookModal(false);
  };

  const handleClearStats = async () => {
    if (!confirm('Are you sure you want to clear all statistics? This will reset your session counts and hours but will not delete any actual session data. This action cannot be undone.')) {
      return;
    }

    setClearingStats(true);
    try {
      const response = await fetch('/api/sessions/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_stats' })
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh stats to show cleared values
        const statsResponse = await fetch('/api/sessions/stats');
        const statsData = await statsResponse.json();
        if (statsData.stats) {
          setStats(statsData.stats);
        }
      } else {
        throw new Error(data.error || 'Failed to clear statistics');
      }
    } catch (error) {
      console.error('Error clearing stats:', error);
      alert('Failed to clear statistics. Please try again.');
    } finally {
      setClearingStats(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-[#fdf6e3]">Coaching Sessions</h1>
            <p className="text-gray-600 dark:text-[#93a1a1] mt-1">Manage your coaching sessions and track your progress with AI and human coaches.</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleClearStats}
              disabled={clearingStats}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`h-5 w-5 mr-2 ${clearingStats ? 'animate-spin' : ''}`} />
              {clearingStats ? 'Clearing...' : 'Clear Stats'}
            </button>
            <button 
              onClick={() => setShowBookModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Book Session
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="ml-4 flex-1">
                  <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">
                    {(stats?.total_sessions || 0) + (stats?.treatment_sessions || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Total Sessions</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.total_sessions || 0} coaching + {stats?.treatment_sessions || 0} treatment
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">
                    {(stats?.completed_sessions || 0) + (stats?.completed_treatment_sessions || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Completed</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.completed_sessions || 0} coaching + {stats?.completed_treatment_sessions || 0} treatment
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">
                    {(stats?.upcoming_sessions || 0) + (stats?.active_treatment_sessions || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Active Sessions</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.upcoming_sessions || 0} scheduled + {stats?.active_treatment_sessions || 0} in-progress
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">
                    {((stats?.total_hours_this_month || 0) + (stats?.total_treatment_hours_this_month || 0)).toFixed(1)}
                  </p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Hours This Month</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats?.total_hours_this_month?.toFixed(1) || '0.0'} coaching + {stats?.total_treatment_hours_this_month?.toFixed(1) || '0.0'} treatment
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 mb-8 grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-700 rounded-lg p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <Video className="h-8 w-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">Mind Shifting Session</h3>
          </div>
          <p className="text-gray-600 dark:text-[#93a1a1] mb-4">Start an automated Mind Shifting treatment session with 95% scripted responses for optimal performance.</p>
          <div className="text-xs text-blue-600 mb-6 space-y-1 flex-grow">
            <div>• Instant responses (&lt;200ms)</div>
            <div>• Proven Mind Shifting protocols</div>
            <div>• Minimal AI usage (&lt;5%)</div>
            <div>• Cost effective (&lt;$0.05/session)</div>
          </div>
          <button 
            onClick={() => {
              const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              router.push(`/dashboard/sessions/treatment-v3?sessionId=${sessionId}`);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full mt-auto"
          >
            Start Mind Shifting Session
          </button>
        </div>


        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-700 rounded-lg p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-8 w-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">Human Coach</h3>
          </div>
          <p className="text-gray-600 dark:text-[#93a1a1] mb-6 flex-grow">Book a session with one of our certified human coaches.</p>
          <button 
            onClick={() => setShowBookModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors w-full mt-auto"
          >
            Book with Coach
          </button>
        </div>
      </div>

      {/* Sessions List */}
              <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border dark:border-[#586e75] overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-[#586e75]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">Recent Sessions</h2>
            {(sessions.length > 0 || treatmentSessions.length > 0) && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedSessions.size > 0 && selectedSessions.size === (sessions.length + treatmentSessions.length)}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="select-all" className="text-sm text-gray-700 dark:text-[#93a1a1]">
                    Select All
                  </label>
                </div>
                {selectedSessions.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {bulkDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Delete Selected ({selectedSessions.size})</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {loading ? (
          // Loading skeleton
          <div className="divide-y divide-gray-200">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3"></div>
                  </div>
                  <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : sessions.length > 0 || treatmentSessions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {/* Coaching Sessions */}
            {sessions.map((session) => {
              const { date, time } = formatDateTime(session.scheduled_at);
              const coachName = `${session.coach.first_name} ${session.coach.last_name}`;
              
              return (
                <div key={`coaching-${session.id}`} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`coaching-${session.id}`)}
                        onChange={(e) => handleSessionSelect(`coaching-${session.id}`, e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        aria-label={`Select ${session.title} session`}
                      />
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        {session.meeting_type === 'video' || session.meeting_type === 'zoom' || session.meeting_type === 'google_meet' ? (
                          <Video className="h-6 w-6 text-indigo-600" />
                        ) : (
                          <User className="h-6 w-6 text-indigo-600" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-[#fdf6e3]">{session.title}</h3>
                        <p className="text-sm text-gray-600">with {coachName}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {date}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {time} ({session.duration_minutes} min)
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(session.status)}
                      {isUpcoming(session) && (
                        <button 
                          onClick={() => handleJoinSession(session)}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm inline-flex items-center"
                        >
                          {session.meeting_link ? (
                            <>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Join Session
                            </>
                          ) : (
                            'Join Session'
                          )}
                        </button>
                      )}
                      {session.status === 'completed' && (
                        <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                          View Notes
                        </button>
                      )}
                      {(session.status === 'cancelled' || session.status === 'completed') && (
                        <button 
                          onClick={() => handleDeleteCoachingSession(session.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm inline-flex items-center"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Treatment Sessions */}
            {treatmentSessions.map((session) => {
              const { date, time } = formatDateTime(session.created_at);
              const userName = `${session.profiles.first_name} ${session.profiles.last_name}`;
              const aiUsagePercent = session.ai_responses + session.scripted_responses > 0 
                ? Math.round((session.ai_responses / (session.ai_responses + session.scripted_responses)) * 100)
                : 0;
              
              return (
                <div key={`treatment-${session.id}`} className="p-6 hover:bg-gray-50 dark:hover:bg-[#586e75]/30 border-l-4 border-l-blue-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`treatment-${session.session_id}`)}
                        onChange={(e) => handleSessionSelect(`treatment-${session.session_id}`, e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        aria-label={`Select ${getTreatmentSessionTitle(session)} session`}
                      />
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Activity className="h-6 w-6 text-blue-600" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-[#fdf6e3]">
                          {getTreatmentSessionTitle(session)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {profile?.role === 'super_admin' ? `by ${userName}` : 'Self-guided session'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getTreatmentSessionDescription(session)}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {date}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {time} ({session.duration_minutes || 'N/A'} min)
                          </div>
                          <div className="flex items-center">
                            <Zap className="h-4 w-4 mr-1" />
                            {aiUsagePercent}% AI
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getTreatmentStatusBadge(session.status)}
                      {session.status === 'active' && (
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => router.push(`/dashboard/sessions/treatment-v3?sessionId=${session.session_id}&resume=true`)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm inline-flex items-center"
                          >
                            Continue
                          </button>
                          <button 
                            onClick={() => handleDeleteTreatmentSession(session.session_id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm inline-flex items-center"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {session.status === 'completed' && (
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          ${session.total_ai_cost?.toFixed(4) || '0.00'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Your sessions will appear here</p>
            <p className="text-sm text-gray-400 mt-1">
              Book your first coaching session to get started!
            </p>
          </div>
        )}
      </div>

      {/* Book Session Modal */}
      <EnhancedBookingModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        onBookingComplete={handleBookingComplete}
      />
    </div>
  );
} 