'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Calendar, Clock, Video, User, ExternalLink, Activity, Zap } from 'lucide-react';

// Dynamic import for audio preloader - loads treatment audio in background
const V4AudioPreloader = dynamic(() => import('@/components/treatment/v4/V4AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

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

export default function SessionsPage() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [treatmentSessions, setTreatmentSessions] = useState<TreatmentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const [sessionsResponse, treatmentSessionsResponse] = await Promise.all([
          fetch('/api/sessions'),
          fetch('/api/sessions/treatment')
        ]);

        const [sessionsData, treatmentSessionsData] = await Promise.all([
          sessionsResponse.json(),
          treatmentSessionsResponse.json()
        ]);

        if (sessionsData.sessions) {
          setSessions(sessionsData.sessions);
        }

        if (treatmentSessionsData.treatmentSessions) {
          setTreatmentSessions(treatmentSessionsData.treatmentSessions);
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
        return <span className="px-2 py-1 text-xs bg-secondary text-foreground rounded-full">Paused</span>;
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

    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('Failed to delete sessions. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="p-8">
      {/* V4 Audio Preloader - starts loading audio for treatment sessions */}
      <V4AudioPreloader />
      
      <div className="mb-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-foreground">MIND SHIFTING</h1>
          <p className="text-muted-foreground mt-2 max-w-lg">Follow the guided process to clear your problems and subconscious blockages in minutes.</p>
          <button 
            onClick={() => {
              const sessionId = `session-v4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              router.push(`/dashboard/sessions/treatment-v4?sessionId=${sessionId}`);
            }}
            className="mt-6 bg-primary text-primary-foreground px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors text-lg font-semibold"
          >
            START MIND SHIFTING
          </button>
        </div>
      </div>


      {/* Ongoing Sessions List */}
              <div className="bg-card rounded-lg shadow-sm border dark:border-[#586e75] overflow-hidden">
                  <div className="px-6 py-4 border-b border-border dark:border-[#586e75]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Ongoing Sessions</h2>
            {(sessions.length > 0 || treatmentSessions.length > 0) && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedSessions.size > 0 && selectedSessions.size === (sessions.length + treatmentSessions.length)}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-border rounded"
                  />
                  <label htmlFor="select-all" className="text-sm text-foreground dark:text-[#93a1a1]">
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
                  <div className="w-12 h-12 bg-secondary rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-secondary rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-secondary rounded animate-pulse w-1/2 mb-2"></div>
                    <div className="h-3 bg-secondary rounded animate-pulse w-1/3"></div>
                  </div>
                  <div className="h-8 w-20 bg-secondary rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (() => {
          // Filter to only show ongoing/unfinished sessions
          const ongoingCoachingSessions = sessions.filter(s => s.status === 'scheduled');
          const ongoingTreatmentSessions = treatmentSessions.filter(s => s.status === 'active' || s.status === 'paused');
          
          return ongoingCoachingSessions.length > 0 || ongoingTreatmentSessions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {/* Coaching Sessions */}
            {ongoingCoachingSessions.map((session) => {
              const { date, time } = formatDateTime(session.scheduled_at);
              const coachName = `${session.coach.first_name} ${session.coach.last_name}`;
              
              return (
                <div key={`coaching-${session.id}`} className="p-4 md:p-6 hover:bg-secondary/20">
                  {/* Desktop Layout (md and up) */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`coaching-${session.id}`)}
                        onChange={(e) => handleSessionSelect(`coaching-${session.id}`, e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                        aria-label={`Select ${session.title} session`}
                      />
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        {session.meeting_type === 'video' || session.meeting_type === 'zoom' || session.meeting_type === 'google_meet' ? (
                          <Video className="h-6 w-6 text-primary" />
                        ) : (
                          <User className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-foreground">{session.title}</h3>
                        <p className="text-sm text-muted-foreground">with {coachName}</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
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
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm inline-flex items-center"
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
                        <button className="border border-border text-foreground px-4 py-2 rounded-lg hover:bg-secondary/20 transition-colors text-sm">
                          View Notes
                        </button>
                      )}
                      {(session.status === 'cancelled' || session.status === 'completed') && (
                        <button 
                          onClick={() => handleDeleteCoachingSession(session.id)}
                          className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors text-sm inline-flex items-center"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    {/* Header: Checkbox + Icon + Title */}
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`coaching-${session.id}`)}
                        onChange={(e) => handleSessionSelect(`coaching-${session.id}`, e.target.checked)}
                        className="h-5 w-5 mt-1 text-primary focus:ring-primary border-border rounded"
                        aria-label={`Select ${session.title} session`}
                      />
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        {session.meeting_type === 'video' || session.meeting_type === 'zoom' || session.meeting_type === 'google_meet' ? (
                          <Video className="h-5 w-5 text-primary" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{session.title}</h3>
                        <p className="text-sm text-muted-foreground">with {coachName}</p>
                      </div>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground pl-14">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{date}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{time} ({session.duration_minutes}m)</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="pl-14">
                      {getStatusBadge(session.status)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 pl-14">
                      {isUpcoming(session) && (
                        <button 
                          onClick={() => handleJoinSession(session)}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm inline-flex items-center justify-center"
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
                        <button className="border border-border text-foreground px-4 py-2 rounded-lg hover:bg-secondary/20 transition-colors text-sm">
                          View Notes
                        </button>
                      )}
                      {(session.status === 'cancelled' || session.status === 'completed') && (
                        <button 
                          onClick={() => handleDeleteCoachingSession(session.id)}
                          className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors text-sm inline-flex items-center justify-center"
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
            {ongoingTreatmentSessions.map((session) => {
              const { date, time } = formatDateTime(session.created_at);
              const userName = `${session.profiles.first_name} ${session.profiles.last_name}`;
              const aiUsagePercent = session.ai_responses + session.scripted_responses > 0 
                ? Math.round((session.ai_responses / (session.ai_responses + session.scripted_responses)) * 100)
                : 0;
              
              return (
                <div key={`treatment-${session.id}`} className="p-4 md:p-6 hover:bg-secondary/20 border-l-4 border-l-primary">
                  {/* Desktop Layout (md and up) */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`treatment-${session.session_id}`)}
                        onChange={(e) => handleSessionSelect(`treatment-${session.session_id}`, e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                        aria-label={`Select ${getTreatmentSessionTitle(session)} session`}
                      />
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Activity className="h-6 w-6 text-primary" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-foreground">
                          {getTreatmentSessionTitle(session)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {profile?.role === 'super_admin' ? `by ${userName}` : 'Self-guided session'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getTreatmentSessionDescription(session)}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
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
                            onClick={() => router.push(`/dashboard/sessions/treatment-v4?sessionId=${session.session_id}&resume=true`)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm inline-flex items-center"
                          >
                            Continue
                          </button>
                          <button 
                            onClick={() => handleDeleteTreatmentSession(session.session_id)}
                            className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors text-sm inline-flex items-center"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {session.status === 'completed' && (
                        <div className="text-xs text-accent bg-accent/10 px-2 py-1 rounded">
                          ${session.total_ai_cost?.toFixed(4) || '0.00'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    {/* Header: Checkbox + Icon + Title */}
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(`treatment-${session.session_id}`)}
                        onChange={(e) => handleSessionSelect(`treatment-${session.session_id}`, e.target.checked)}
                        className="h-5 w-5 mt-1 text-primary focus:ring-primary border-border rounded"
                        aria-label={`Select ${getTreatmentSessionTitle(session)} session`}
                      />
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Activity className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">
                          {getTreatmentSessionTitle(session)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {profile?.role === 'super_admin' ? `by ${userName}` : 'Self-guided session'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getTreatmentSessionDescription(session)}
                        </p>
                      </div>
                    </div>

                    {/* Date, Time & AI Usage */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pl-14">
                      <div className="flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span className="truncate">{date}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span>{time}</span>
                      </div>
                      <div className="flex items-center">
                        <Zap className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                        <span>{aiUsagePercent}% AI</span>
                      </div>
                      <div>
                        {session.duration_minutes || 'N/A'} min
                      </div>
                    </div>

                    {/* Status Badge & Cost */}
                    <div className="flex items-center space-x-2 pl-14">
                      {getTreatmentStatusBadge(session.status)}
                      {session.status === 'completed' && (
                        <div className="text-xs text-accent bg-accent/10 px-2 py-1 rounded">
                          ${session.total_ai_cost?.toFixed(4) || '0.00'}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {session.status === 'active' && (
                      <div className="flex flex-col space-y-2 pl-14">
                        <button 
                          onClick={() => router.push(`/dashboard/sessions/treatment-v4?sessionId=${session.session_id}&resume=true`)}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm inline-flex items-center justify-center"
                        >
                          Continue
                        </button>
                        <button 
                          onClick={() => handleDeleteTreatmentSession(session.session_id)}
                          className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors text-sm inline-flex items-center justify-center"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">No ongoing sessions</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start a Mind Shifting session to begin clearing your blockages.
            </p>
          </div>
        );
        })()}
      </div>

    </div>
  );
} 