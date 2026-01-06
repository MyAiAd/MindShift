'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import {
  Brain,
  Users,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  Activity,
  CheckCircle,
  X,
  Play,
  BookOpen,
  Zap,
  Timer,
  Hash,
  CalendarDays,
  Sparkles,
  ChevronDown
} from 'lucide-react';

interface MindShiftingStats {
  activeSessionsCount: number;
  totalSessionsCount: number;
  daysActive: number;
  problemsCleared: number;
  goalsOptimised: number;
  negativeExperiencesCleared: number;
  totalMinutes: number;
  avgMinutesPerProblem: number;
}

type TimePeriod = 'week' | 'month' | 'year' | 'custom';

function DashboardContent() {
  const { profile, tenant } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [showConfirmationBanner, setShowConfirmationBanner] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [stats, setStats] = useState<MindShiftingStats>({
    activeSessionsCount: 0,
    totalSessionsCount: 0,
    daysActive: 0,
    problemsCleared: 0,
    goalsOptimised: 0,
    negativeExperiencesCleared: 0,
    totalMinutes: 0,
    avgMinutesPerProblem: 0
  });

  // Check for email confirmation success
  useEffect(() => {
    const confirmedParam = searchParams.get('confirmed');
    if (confirmedParam === 'true') {
      setShowConfirmationBanner(true);
      const timer = setTimeout(() => {
        setShowConfirmationBanner(false);
      }, 8000);
      setTimeout(() => {
        window.history.replaceState({}, '', '/dashboard');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Fetch stats based on time period
  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Calculate days based on time period
        const days = timePeriod === 'week' ? 7 : timePeriod === 'month' ? 30 : 365;
        
        const [sessionsResponse, treatmentResponse] = await Promise.all([
          fetch(`/api/sessions/stats?days=${days}`),
          fetch('/api/sessions/treatment')
        ]);

        const [sessionsData, treatmentData] = await Promise.all([
          sessionsResponse.json(),
          treatmentResponse.json()
        ]);

        // Get stats from the API (now includes new metrics fields)
        const apiStats = sessionsData.stats || {};
        
        // Get treatment sessions for fallback calculation
        const treatmentSessions = treatmentData.treatmentSessions || [];
        
        // Filter sessions by time period
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const filteredSessions = treatmentSessions.filter((s: any) => 
          new Date(s.created_at) >= cutoffDate
        );

        // Calculate stats - prefer API values, fallback to local calculation
        const activeCount = apiStats.active_treatment_sessions ?? 
          filteredSessions.filter((s: any) => s.status === 'active' || s.status === 'paused').length;
        
        const totalSessions = apiStats.treatment_sessions ?? filteredSessions.length;
        
        // Get unique days where user did mind shifting
        const uniqueDays = apiStats.unique_days_active ?? new Set(
          filteredSessions.map((s: any) => new Date(s.created_at).toDateString())
        ).size;

        // Calculate total minutes
        const totalMinutes = filteredSessions.reduce((sum: number, s: any) => 
          sum + (s.duration_minutes || 0), 0
        );

        // Use API values for new metrics, with fallback calculations
        const problemsCleared = apiStats.problems_cleared ?? 
          filteredSessions.reduce((sum: number, s: any) => 
            sum + (s.problems_count || (s.status === 'completed' ? 1 : 0)), 0
          );
        
        const goalsOptimised = apiStats.goals_optimized ?? 
          filteredSessions.reduce((sum: number, s: any) => sum + (s.goals_count || 0), 0);
        
        const experiencesCleared = apiStats.experiences_cleared ?? 
          filteredSessions.reduce((sum: number, s: any) => sum + (s.experiences_count || 0), 0);
        
        // Average time per problem
        const avgMinutes = apiStats.avg_minutes_per_problem ?? 
          (problemsCleared > 0 ? Math.round(totalMinutes / problemsCleared) : 0);

        setStats({
          activeSessionsCount: activeCount,
          totalSessionsCount: totalSessions,
          daysActive: uniqueDays,
          problemsCleared: problemsCleared,
          goalsOptimised: goalsOptimised,
          negativeExperiencesCleared: experiencesCleared,
          totalMinutes: totalMinutes,
          avgMinutesPerProblem: avgMinutes
        });

      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchStats();
    }
  }, [profile, timePeriod]);

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setLoading(true);
    // Re-trigger the effect by toggling time period
    setTimePeriod(prev => prev);
    setTimeout(() => setLoading(false), 1000);
  };

  const handleStartShifting = () => {
    const sessionId = `session-v4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    router.push(`/dashboard/sessions/treatment-v4?sessionId=${sessionId}`);
  };

  const timePeriodLabels: Record<TimePeriod, string> = {
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    custom: 'Custom'
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
        {/* Email Confirmation Success Banner */}
        {showConfirmationBanner && (
          <div className="mb-4 animate-in slide-in-from-top duration-500">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-500 dark:border-green-600 rounded-xl p-4 shadow-lg flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 dark:bg-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-green-900 dark:text-green-100">
                  🎉 Welcome to MindShifting!
                </h3>
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your email has been verified. You're ready to start!
                </p>
              </div>
              <button
                onClick={() => setShowConfirmationBanner(false)}
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header - Compact */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Welcome back, {profile?.first_name}!
          </h1>
        </div>

        {/* Quick Action Buttons - Compact row */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          <Button 
            onClick={handleStartShifting}
            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 sm:px-6"
          >
            <Play className="h-4 w-4 mr-2" />
            START SHIFTING
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => router.push('/dashboard/tutorials')}
            className="flex-1 sm:flex-none py-2 px-4 sm:px-6"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            TUTORIALS
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => router.push('/dashboard/community')}
            className="flex-1 sm:flex-none py-2 px-4 sm:px-6"
          >
            <Users className="h-4 w-4 mr-2" />
            CONNECT
          </Button>
        </div>

        {/* Time Period Selector */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Your Progress</h2>
          <div className="relative">
            <button
              onClick={() => setShowTimePicker(!showTimePicker)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              {timePeriodLabels[timePeriod]}
              <ChevronDown className={`h-4 w-4 transition-transform ${showTimePicker ? 'rotate-180' : ''}`} />
            </button>
            
            {showTimePicker && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowTimePicker(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                  {(['week', 'month', 'year'] as TimePeriod[]).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setTimePeriod(period);
                        setShowTimePicker(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                        timePeriod === period ? 'bg-accent font-medium' : ''
                      }`}
                    >
                      {timePeriodLabels[period]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid - 2x4 on desktop, 2x4 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary rounded-lg">
                    <div className="h-5 w-5 bg-secondary animate-pulse rounded"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-6 bg-secondary rounded animate-pulse mb-1"></div>
                    <div className="h-3 bg-secondary rounded animate-pulse w-2/3"></div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <>
              {/* Active Sessions */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Activity className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.activeSessionsCount}</p>
                    <p className="text-xs text-muted-foreground truncate">Active Sessions</p>
                  </div>
                </div>
              </Card>

              {/* Total Sessions */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.totalSessionsCount}</p>
                    <p className="text-xs text-muted-foreground truncate">Mind Shifting Sessions</p>
                  </div>
                </div>
              </Card>

              {/* Days Active */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.daysActive}</p>
                    <p className="text-xs text-muted-foreground truncate">Days Active</p>
                  </div>
                </div>
              </Card>

              {/* Problems Cleared */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.problemsCleared}</p>
                    <p className="text-xs text-muted-foreground truncate">Problems Cleared</p>
                  </div>
                </div>
              </Card>

              {/* Goals Optimised */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.goalsOptimised}</p>
                    <p className="text-xs text-muted-foreground truncate">Goals Optimised</p>
                  </div>
                </div>
              </Card>

              {/* Negative Experiences Cleared */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                    <Sparkles className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.negativeExperiencesCleared}</p>
                    <p className="text-xs text-muted-foreground truncate">Experiences Cleared</p>
                  </div>
                </div>
              </Card>

              {/* Total Time */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{formatMinutes(stats.totalMinutes)}</p>
                    <p className="text-xs text-muted-foreground truncate">Total Time</p>
                  </div>
                </div>
              </Card>

              {/* Average Time per Problem */}
              <Card className="p-3 sm:p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Timer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{formatMinutes(stats.avgMinutesPerProblem)}</p>
                    <p className="text-xs text-muted-foreground truncate">Avg per Problem</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Motivational message when no stats */}
        {!loading && stats.totalSessionsCount === 0 && (
          <Card className="mt-6 p-6 text-center bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <Brain className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Ready to Start Your Journey?
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Begin your first Mind Shifting session to clear problems and unlock your potential.
            </p>
            <Button onClick={handleStartShifting} size="lg">
              <Play className="h-5 w-5 mr-2" />
              Start Your First Session
            </Button>
          </Card>
        )}
      </div>
    </PullToRefresh>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
