'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, CheckCircle, Clock, TrendingUp, Users, Play } from 'lucide-react';

interface VideoAnalyticsProps {
  videoId: string;
  analytics: {
    view_count: number;
    completion_count: number;
    average_watch_percentage: number;
    unique_viewers?: number;
    total_watch_time_minutes?: number;
  };
}

export default function VideoAnalytics({ videoId, analytics }: VideoAnalyticsProps) {
  const completionRate = analytics.view_count > 0
    ? ((analytics.completion_count / analytics.view_count) * 100).toFixed(1)
    : '0';

  const stats = [
    {
      label: 'Total Views',
      value: analytics.view_count.toLocaleString(),
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Completions',
      value: analytics.completion_count.toLocaleString(),
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Avg Watch %',
      value: `${analytics.average_watch_percentage.toFixed(0)}%`,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  if (analytics.unique_viewers !== undefined) {
    stats.push({
      label: 'Unique Viewers',
      value: analytics.unique_viewers.toLocaleString(),
      icon: Users,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    });
  }

  if (analytics.total_watch_time_minutes !== undefined) {
    const hours = Math.floor(analytics.total_watch_time_minutes / 60);
    const minutes = Math.round(analytics.total_watch_time_minutes % 60);
    stats.push({
      label: 'Total Watch Time',
      value: `${hours}h ${minutes}m`,
      icon: Play,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Analytics</CardTitle>
        <CardDescription>Performance metrics for this video</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Watch Percentage Progress Bar */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Average Watch Percentage</span>
            <span className="text-sm text-muted-foreground">
              {analytics.average_watch_percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
              style={{ width: `${Math.min(analytics.average_watch_percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Completion Rate Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Completion Rate</span>
            <span className="text-sm text-muted-foreground">{completionRate}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(parseFloat(completionRate), 100)}%` }}
            />
          </div>
        </div>

        {/* Insights */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-semibold mb-3">Insights</h4>
          <div className="space-y-2">
            {analytics.average_watch_percentage >= 75 && (
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Great engagement! Users are watching most of this video.</span>
              </div>
            )}
            {analytics.average_watch_percentage < 50 && (
              <div className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg">
                <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Consider reviewing the video content or thumbnail to improve engagement.</span>
              </div>
            )}
            {parseFloat(completionRate) >= 60 && (
              <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>High completion rate indicates valuable content.</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
