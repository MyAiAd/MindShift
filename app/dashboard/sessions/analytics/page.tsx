'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Brain,
  Activity,
  Users,
  Calendar
} from 'lucide-react';

export default function SessionAnalyticsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link 
            href="/dashboard/sessions"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            <h1 className="text-3xl font-bold text-foreground dark:text-[#fdf6e3]">Session Analytics</h1>
          </div>
        </div>
        <p className="text-muted-foreground dark:text-[#93a1a1]">Analyze your treatment session performance and outcomes.</p>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-foreground dark:text-[#fdf6e3]">98.2%</p>
              <p className="text-muted-foreground dark:text-[#93a1a1]">Automation Rate</p>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-foreground dark:text-[#fdf6e3]">145ms</p>
              <p className="text-muted-foreground dark:text-[#93a1a1]">Avg Response Time</p>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-foreground dark:text-[#fdf6e3]">$0.03</p>
              <p className="text-muted-foreground dark:text-[#93a1a1]">Avg Session Cost</p>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Brain className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-foreground dark:text-[#fdf6e3]">2.1%</p>
              <p className="text-muted-foreground dark:text-[#93a1a1]">AI Usage Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Session Performance Chart */}
        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
                      <h3 className="text-lg font-semibold text-foreground dark:text-[#fdf6e3] mb-4">Session Performance</h3>
          <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground dark:text-[#839496]">Chart visualization coming soon</p>
            </div>
          </div>
        </div>

        {/* Treatment Outcomes */}
        <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border p-6">
                      <h3 className="text-lg font-semibold text-foreground dark:text-[#fdf6e3] mb-4">Treatment Outcomes</h3>
          <div className="h-64 flex items-center justify-center bg-secondary/20 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground dark:text-[#839496]">Outcome tracking coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-card dark:bg-[#073642] rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-border dark:border-[#586e75]">
          <h2 className="text-lg font-semibold text-foreground dark:text-[#fdf6e3]">Recent Treatment Sessions</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((session) => (
            <div key={session} className="p-6 hover:bg-secondary/20 dark:bg-[#002b36]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Brain className="h-5 w-5 text-indigo-600" />
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-foreground dark:text-[#fdf6e3]">
                      Session #{session}234
                    </h4>
                    <p className="text-sm text-muted-foreground dark:text-[#839496]">
                      {session === 1 ? '2 hours ago' : 
                       session === 2 ? 'Yesterday' : '3 days ago'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm text-muted-foreground dark:text-[#839496]">
                  <div className="text-center">
                    <p className="font-medium text-foreground dark:text-[#fdf6e3]">{120 + session * 25}ms</p>
                    <p>Response Time</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground dark:text-[#fdf6e3]">${(0.02 + session * 0.01).toFixed(2)}</p>
                    <p>Cost</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground dark:text-[#fdf6e3]">{98 - session}%</p>
                    <p>Automation</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 