'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Calendar, Clock, Video, Plus, User, CheckCircle, AlertCircle, ExternalLink, Activity } from 'lucide-react';

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

interface SessionStats {
  total_sessions: number;
  upcoming_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_hours_this_month: number;
  available_slots: number;
}

export default function SessionsPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const [sessionsResponse, statsResponse] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/sessions/stats')
        ]);

        const [sessionsData, statsData] = await Promise.all([
          sessionsResponse.json(),
          statsResponse.json()
        ]);

        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions);
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Coaching Sessions</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your coaching sessions and track your progress with AI and human coaches.</p>
          </div>
          <button 
            onClick={() => setShowBookModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Book Session
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6">
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
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.upcoming_sessions || 0}</p>
                  <p className="text-gray-600 dark:text-gray-300">Upcoming</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.completed_sessions || 0}</p>
                  <p className="text-gray-600 dark:text-gray-300">Completed</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.total_hours_this_month || 0}</p>
                  <p className="text-gray-600 dark:text-gray-300">Hours This Month</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Video className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.available_slots || 0}</p>
                  <p className="text-gray-600 dark:text-gray-300">Available Slots</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sessions List */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sessions</h2>
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
        ) : sessions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {sessions.map((session) => {
              const { date, time } = formatDateTime(session.scheduled_at);
              const coachName = `${session.coach.first_name} ${session.coach.last_name}`;
              
              return (
                <div key={session.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        {session.meeting_type === 'video' || session.meeting_type === 'zoom' || session.meeting_type === 'google_meet' ? (
                          <Video className="h-6 w-6 text-indigo-600" />
                        ) : (
                          <User className="h-6 w-6 text-indigo-600" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{session.title}</h3>
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

      {/* Quick Actions */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <Video className="h-8 w-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mind Shifting Session</h3>
          </div>
          <p className="text-gray-600 mb-4">Start an automated Mind Shifting treatment session with 95% scripted responses for optimal performance.</p>
          <div className="text-xs text-blue-600 mb-6 space-y-1 flex-grow">
            <div>• Instant responses (&lt;200ms)</div>
            <div>• Proven Mind Shifting protocols</div>
            <div>• Minimal AI usage (&lt;5%)</div>
            <div>• Cost effective (&lt;$0.05/session)</div>
          </div>
          <button 
            onClick={() => {
              const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              router.push(`/dashboard/sessions/treatment?sessionId=${sessionId}`);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full mt-auto"
          >
            Start Mind Shifting Session
          </button>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-8 w-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Human Coach</h3>
          </div>
          <p className="text-gray-600 mb-6 flex-grow">Book a session with one of our certified human coaches.</p>
          <button 
            onClick={() => setShowBookModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors w-full mt-auto"
          >
            Book with Coach
          </button>
        </div>
      </div>

      {/* Book Session Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Book a Session</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>Goal Setting</option>
                  <option>Confidence Building</option>
                  <option>Stress Management</option>
                  <option>Career Development</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Coach</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>Any Available</option>
                  <option>Dr. Sarah Miller</option>
                  <option>Michael Chen</option>
                  <option>AI Coach</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>9:00 AM</option>
                  <option>10:00 AM</option>
                  <option>2:00 PM</option>
                  <option>3:00 PM</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Book Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 