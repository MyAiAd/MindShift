'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import FeatureGuard, { FeatureBanner } from '@/components/auth/FeatureGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { 
  Brain, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Award,
  Clock,
  Activity,
  MessageCircle,
  Loader2
} from 'lucide-react';

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  avatar: string;
}

interface DashboardStats {
  totalUsers: number;
  completedGoals: number;
  totalSessions: number;
  avgProgress: number;
}

interface PerformanceMetrics {
  userSatisfaction: number;
  goalCompletionRate: number;
  sessionAttendance: number;
}

export default function DashboardPage() {
  const { profile, tenant } = useAuth();
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch real data from existing APIs
        const [goalsResponse, progressResponse, gamificationResponse, performanceResponse] = await Promise.all([
          fetch('/api/goals'),
          fetch('/api/progress/stats'),
          fetch('/api/gamification'),
          fetch('/api/dashboard/performance')
        ]);

        const [goalsData, progressData, gamificationData, performanceData] = await Promise.all([
          goalsResponse.json(),
          progressResponse.json(),
          gamificationResponse.json(),
          performanceResponse.json()
        ]);

        // Set performance metrics
        if (performanceData.metrics) {
          setPerformanceMetrics(performanceData.metrics);
        }
        setMetricsLoading(false);

        // Calculate stats from real data
        const stats = {
          totalUsers: 1, // For now, just showing current user
          completedGoals: goalsData.goals?.filter((g: any) => g.status === 'completed').length || 0,
          totalSessions: gamificationData.data?.userStats?.treatment_sessions_count || 0,
          avgProgress: progressData.stats?.overview?.overallProgress || 0
        };

        setDashboardStats(stats);

        // Create activities from real data
        const activities: Activity[] = [];
        
        // Add recent goal completions
        if (goalsData.goals) {
          goalsData.goals
            .filter((goal: any) => goal.status === 'completed')
            .slice(0, 3)
            .forEach((goal: any) => {
              activities.push({
                id: `goal-${goal.id}`,
                user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
                action: 'completed goal',
                target: goal.title,
                time: formatTimeAgo(goal.updated_at || goal.created_at),
                avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
              });
            });
        }

        // Add recent progress entries
        if (progressData.stats?.recentProgressEntries) {
          progressData.stats.recentProgressEntries
            .slice(0, 3)
            .forEach((entry: any) => {
              activities.push({
                id: `progress-${entry.id}`,
                user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
                action: 'updated progress',
                target: 'Daily Progress',
                time: formatTimeAgo(entry.entry_date),
                avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
              });
            });
        }

        // Add recent achievements
        if (gamificationData.data?.recentAchievements) {
          gamificationData.data.recentAchievements
            .slice(0, 2)
            .forEach((achievement: any) => {
              activities.push({
                id: `achievement-${achievement.id}`,
                user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
                action: 'earned achievement',
                target: achievement.title,
                time: formatTimeAgo(achievement.earned_at),
                avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
              });
            });
        }

        // Sort activities by most recent and limit to 5
        const sortedActivities = activities
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 5);

        setRecentActivities(sortedActivities);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Fallback to sample data if API fails
        setRecentActivities([
          {
            id: 'sample-1',
            user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
            action: 'started using',
                            target: 'MyAi Dashboard',
            time: 'just now',
            avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  // Helper functions
  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const generateAvatar = (firstName: string, lastName: string): string => {
    const first = firstName?.charAt(0).toUpperCase() || '';
    const last = lastName?.charAt(0).toUpperCase() || '';
    return `${first}${last}`;
  };

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    setLoading(true);
    setMetricsLoading(true);
    try {
      // Re-fetch dashboard data
      const [goalsResponse, progressResponse, gamificationResponse, performanceResponse] = await Promise.all([
        fetch('/api/goals'),
        fetch('/api/progress/stats'),
        fetch('/api/gamification'),
        fetch('/api/dashboard/performance')
      ]);

      const [goalsData, progressData, gamificationData, performanceData] = await Promise.all([
        goalsResponse.ok ? goalsResponse.json() : { data: null },
        progressResponse.ok ? progressResponse.json() : { data: null },
        gamificationResponse.ok ? gamificationResponse.json() : { data: null },
        performanceResponse.ok ? performanceResponse.json() : { metrics: null }
      ]);

      // Update performance metrics
      if (performanceData.metrics) {
        setPerformanceMetrics(performanceData.metrics);
      }
      setMetricsLoading(false);

      // Calculate stats
      const totalGoals = goalsData.data?.length || 0;
      const completedGoals = goalsData.data?.filter((goal: any) => goal.status === 'completed').length || 0;
      const totalSessions = progressData.data?.totalSessions || 0;
      const avgProgress = progressData.data?.averageProgress || 0;

      setDashboardStats({
        totalUsers: 1,
        completedGoals,
        totalSessions,
        avgProgress
      });

      // Update activities
      const activities: Activity[] = [];
      
      if (goalsData.data?.slice(0, 3)) {
        goalsData.data.slice(0, 3).forEach((goal: any) => {
          activities.push({
            id: goal.id,
            user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
            action: goal.status === 'completed' ? 'completed goal' : 'updated goal',
            target: goal.title,
            time: formatTimeAgo(goal.updated_at || goal.created_at),
            avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
          });
        });
      }

      if (gamificationData.data?.recentAchievements) {
        gamificationData.data.recentAchievements
          .slice(0, 2)
          .forEach((achievement: any) => {
            activities.push({
              id: `achievement-${achievement.id}`,
              user: `${profile?.first_name || 'User'} ${profile?.last_name || ''}`,
              action: 'earned achievement',
              target: achievement.title,
              time: formatTimeAgo(achievement.earned_at),
              avatar: generateAvatar(profile?.first_name || 'U', profile?.last_name || 'U')
            });
          });
      }

      const sortedActivities = activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);

      setRecentActivities(sortedActivities);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Welcome back, {profile?.first_name}!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
                              Here's what's happening with {tenant?.name || 'MindShifting'} today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">Current Plan:</span>
            <span className="px-2 sm:px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs sm:text-sm font-medium capitalize">
              {profile?.subscription_tier === 'level_1' ? 'Problem Shifting' : 
               profile?.subscription_tier === 'level_2' ? 'Complete Access' : 
               profile?.subscription_tier || 'Trial'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 min-w-0">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg shadow-sm border border-border p-4 sm:p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-secondary rounded animate-pulse mb-2"></div>
                  <div className="h-8 bg-secondary rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-secondary rounded animate-pulse"></div>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="h-6 w-6 bg-secondary rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))
        ) : (
          // Real stats
          [
            {
              name: 'Total Users',
              value: dashboardStats?.totalUsers?.toString() || '1',
              change: '+0%',
              changeType: 'positive' as const,
              icon: Users,
            },
            {
              name: 'Goals Completed',
              value: dashboardStats?.completedGoals?.toString() || '0',
              change: '+0%',
              changeType: 'positive' as const,
              icon: Target,
            },
            {
              name: 'Treatment Sessions',
              value: dashboardStats?.totalSessions?.toString() || '0',
              change: '+0%',
              changeType: 'positive' as const,
              icon: Calendar,
            },
            {
              name: 'Avg. Progress Score',
              value: `${dashboardStats?.avgProgress || 0}%`,
              change: '+0%',
              changeType: 'positive' as const,
              icon: TrendingUp,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.name} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardDescription>{stat.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground truncate">{stat.value}</p>
                      <p className={`text-xs mt-2 font-medium ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change} from last month
                      </p>
                    </div>
                    <div className="p-2 sm:p-3 bg-indigo-50 rounded-lg flex-shrink-0">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 min-w-0">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-base sm:text-lg">
              <Brain className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-indigo-600" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/goals" className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors block min-w-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Create New Goal</p>
                  <p className="text-sm text-muted-foreground">Set up a new mindset goal for users</p>
                </div>
              </div>
            </Link>
            
            <Link href="/dashboard/sessions" className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors block">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Schedule Session</p>
                  <p className="text-sm text-muted-foreground">Book a coaching session</p>
                </div>
              </div>
            </Link>
            

            
            <FeatureGuard 
              featureKey="advanced_analytics"
              fallback={
                <div className="w-full p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Activity className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">Advanced Analytics</p>
                      <p className="text-sm text-amber-700">Requires Level 2 subscription</p>
                    </div>
                    <a 
                      href="/dashboard/subscription" 
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Upgrade
                    </a>
                  </div>
                </div>
              }
            >
              <Link href="/dashboard/sessions/analytics" className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors block">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Activity className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">View Analytics</p>
                    <p className="text-sm text-muted-foreground">Check detailed progress reports</p>
                  </div>
                </div>
              </Link>
            </FeatureGuard>
            
            <FeatureGuard 
              featureKey="team_management"
              fallback={
                <div className="w-full p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Users className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-amber-900">Team Management</p>
                      <p className="text-sm text-amber-700">Requires Level 2 subscription</p>
                    </div>
                    <a 
                      href="/dashboard/subscription" 
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Upgrade
                    </a>
                  </div>
                </div>
              }
            >
              <Link href="/dashboard/team/message" className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors block">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Message a Client</p>
                    <p className="text-sm text-muted-foreground">Send a message to your clients</p>
                  </div>
                </div>
              </Link>
            </FeatureGuard>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-indigo-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              // Loading skeleton
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-secondary rounded-full animate-pulse"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-secondary rounded animate-pulse mb-2"></div>
                      <div className="h-3 bg-secondary rounded animate-pulse w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-indigo-600">
                        {activity.avatar}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{activity.user}</span>
                        {' '}{activity.action}{' '}
                        <span className="font-medium">{activity.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start using the platform to see your activities here!
                </p>
              </div>
            )}
            {!loading && recentActivities.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link 
                  href="/dashboard/progress" 
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View all activity →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="h-5 w-5 mr-2 text-indigo-600" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : performanceMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">
                  {performanceMetrics.userSatisfaction}%
                </div>
                <div className="text-sm text-muted-foreground">User Satisfaction</div>
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all" 
                    style={{ width: `${performanceMetrics.userSatisfaction}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Based on mood & confidence scores
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-accent mb-2">
                  {performanceMetrics.goalCompletionRate}%
                </div>
                <div className="text-sm text-muted-foreground">Goal Completion Rate</div>
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all" 
                    style={{ width: `${performanceMetrics.goalCompletionRate}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Completed vs total goals
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">
                  {performanceMetrics.sessionAttendance}%
                </div>
                <div className="text-sm text-muted-foreground">Session Attendance</div>
                <div className="w-full bg-secondary rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all" 
                    style={{ width: `${performanceMetrics.sessionAttendance}%` }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Completed vs scheduled sessions
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No performance data available yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start tracking goals and progress to see your performance metrics
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PullToRefresh>
  );
} 