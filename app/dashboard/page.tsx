'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import FeatureGuard, { FeatureBanner } from '@/components/auth/FeatureGuard';
import { 
  Brain, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Award,
  Clock,
  Activity,
  MessageCircle
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

export default function DashboardPage() {
  const { profile, tenant } = useAuth();
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch real data from existing APIs
        const [goalsResponse, progressResponse, gamificationResponse] = await Promise.all([
          fetch('/api/goals'),
          fetch('/api/progress/stats'),
          fetch('/api/gamification')
        ]);

        const [goalsData, progressData, gamificationData] = await Promise.all([
          goalsResponse.json(),
          progressResponse.json(),
          gamificationResponse.json()
        ]);

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {profile?.first_name}!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
                              Here's what's happening with {tenant?.name || 'MindShifting'} today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Current Plan:</span>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium capitalize">
              {profile?.subscription_tier === 'level_1' ? 'Problem Shifting' : 
               profile?.subscription_tier === 'level_2' ? 'Complete Access' : 
               profile?.subscription_tier || 'Trial'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <div className="h-6 w-6 bg-gray-200 rounded animate-pulse"></div>
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
              <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</p>
                    <p className={`text-sm mt-2 ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change} from last month
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <Icon className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link href="/dashboard/goals" className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors block">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Create New Goal</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Set up a new mindset goal for users</p>
                </div>
              </div>
            </Link>
            
            <Link href="/dashboard/sessions" className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors block">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Schedule Session</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Book a coaching session</p>
                </div>
              </div>
            </Link>
            
            <Link href="/dashboard/sessions/treatment-v2" className="w-full text-left p-3 rounded-lg border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 transition-colors block">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Brain className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-orange-900">🧪 Treatment V2 (TEST)</p>
                  <p className="text-sm text-orange-700">Test the new modular treatment system</p>
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
              <Link href="/dashboard/sessions/analytics" className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors block">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Activity className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">View Analytics</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Check detailed progress reports</p>
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
              <Link href="/dashboard/team/message" className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors block">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Message a Client</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Send a message to your clients</p>
                  </div>
                </div>
              </Link>
            </FeatureGuard>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-indigo-600" />
            Recent Activity
          </h2>
          {loading ? (
            // Loading skeleton
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2"></div>
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
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-medium">{activity.user}</span>
                      {' '}{activity.action}{' '}
                      <span className="font-medium">{activity.target}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
              <p className="text-sm text-gray-400 mt-1">
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
        </div>
      </div>

      {/* Performance Overview */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Award className="h-5 w-5 mr-2 text-indigo-600" />
          Performance Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600 mb-2">92%</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">User Satisfaction</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">78%</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Goal Completion Rate</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">85%</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Session Attendance</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 