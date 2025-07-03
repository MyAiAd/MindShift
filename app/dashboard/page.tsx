'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Brain, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Award,
  Clock,
  Activity
} from 'lucide-react';

const stats = [
  {
    name: 'Active Users',
    value: '127',
    change: '+12%',
    changeType: 'positive',
    icon: Users,
  },
  {
    name: 'Goals Completed',
    value: '89',
    change: '+23%',
    changeType: 'positive',
    icon: Target,
  },
  {
    name: 'Coaching Sessions',
    value: '45',
    change: '+8%',
    changeType: 'positive',
    icon: Calendar,
  },
  {
    name: 'Avg. Progress Score',
    value: '87%',
    change: '+5%',
    changeType: 'positive',
    icon: TrendingUp,
  },
];

const recentActivities = [
  {
    id: 1,
    user: 'Sarah Johnson',
    action: 'completed assessment',
    target: 'Mindset Evaluation',
    time: '2 hours ago',
    avatar: 'SJ',
  },
  {
    id: 2,
    user: 'Mike Chen',
    action: 'scheduled session',
    target: 'Goal Setting Workshop',
    time: '4 hours ago',
    avatar: 'MC',
  },
  {
    id: 3,
    user: 'Emma Davis',
    action: 'achieved milestone',
    target: 'Confidence Building',
    time: '6 hours ago',
    avatar: 'ED',
  },
  {
    id: 4,
    user: 'Alex Rodriguez',
    action: 'updated progress',
    target: 'Career Development',
    time: '8 hours ago',
    avatar: 'AR',
  },
];

export default function DashboardPage() {
  const { profile, tenant } = useAuth();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {profile?.first_name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with {tenant?.name} today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
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
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Create New Goal</p>
                  <p className="text-sm text-gray-600">Set up a new mindset goal for users</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Schedule Session</p>
                  <p className="text-sm text-gray-600">Book a coaching session</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Activity className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">View Analytics</p>
                  <p className="text-sm text-gray-600">Check detailed progress reports</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Invite Team Member</p>
                  <p className="text-sm text-gray-600">Add a new user to your organization</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-indigo-600" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-indigo-600">
                    {activity.avatar}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.user}</span>
                    {' '}{activity.action}{' '}
                    <span className="font-medium">{activity.target}</span>
                  </p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View all activity →
            </button>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Award className="h-5 w-5 mr-2 text-indigo-600" />
          Performance Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-indigo-600 mb-2">92%</div>
            <div className="text-sm text-gray-600">User Satisfaction</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">78%</div>
            <div className="text-sm text-gray-600">Goal Completion Rate</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">85%</div>
            <div className="text-sm text-gray-600">Session Attendance</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 