'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AnalyticsCard from '@/components/admin/AnalyticsCard';
import AnalyticsChart from '@/components/admin/AnalyticsChart';
import DateRangePicker from '@/components/admin/DateRangePicker';
import { Users, Video, MessageSquare, BookOpen, Loader2, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  overview: {
    total_users: number;
    total_videos: number;
    total_posts: number;
    total_sessions: number;
    new_users_30_days: number;
    total_video_views: number;
  };
  growth: {
    users: number;
    videos: number;
    posts: number;
    sessions: number;
  };
  top_videos: Array<{
    id: string;
    title: string;
    view_count: number;
  }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchAnalytics();
    }
  }, [profile, dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/analytics');
      
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load analytics',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  if (loading || !data) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor platform performance and user engagement
          </p>
        </div>
        <DateRangePicker onRangeChange={setDateRange} defaultRange={dateRange} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsCard
          title="Total Users"
          value={data.overview.total_users.toLocaleString()}
          change={data.growth.users}
          trend={data.growth.users > 0 ? 'up' : 'neutral'}
          icon={Users}
          description={`${data.overview.new_users_30_days} new in last 30 days`}
        />
        <AnalyticsCard
          title="Total Videos"
          value={data.overview.total_videos.toLocaleString()}
          change={data.growth.videos}
          trend={data.growth.videos > 0 ? 'up' : 'neutral'}
          icon={Video}
          description={`${data.overview.total_video_views.toLocaleString()} total views`}
        />
        <AnalyticsCard
          title="Community Posts"
          value={data.overview.total_posts.toLocaleString()}
          change={data.growth.posts}
          trend={data.growth.posts > 0 ? 'up' : 'neutral'}
          icon={MessageSquare}
        />
        <AnalyticsCard
          title="Total Sessions"
          value={data.overview.total_sessions.toLocaleString()}
          change={data.growth.sessions}
          trend={data.growth.sessions > 0 ? 'up' : 'neutral'}
          icon={BookOpen}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Videos */}
        <AnalyticsChart
          title="Most Viewed Videos"
          description="Top 5 videos by view count"
          data={data.top_videos.map(v => ({
            label: v.title.length > 30 ? v.title.substring(0, 30) + '...' : v.title,
            value: v.view_count || 0,
          }))}
        />

        {/* Engagement Overview */}
        <AnalyticsChart
          title="Engagement Overview"
          description="Platform activity breakdown"
          data={[
            { label: 'Video Views', value: data.overview.total_video_views },
            { label: 'Community Posts', value: data.overview.total_posts },
            { label: 'Sessions Completed', value: data.overview.total_sessions },
            { label: 'Active Users', value: data.overview.total_users },
          ]}
        />
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">User Growth</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.overview.new_users_30_days > 0
              ? `${data.overview.new_users_30_days} new users joined in the last 30 days, representing ${Math.round((data.overview.new_users_30_days / data.overview.total_users) * 100)}% growth.`
              : 'No new users in the last 30 days. Consider marketing initiatives.'}
          </p>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Video Engagement</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.overview.total_video_views > 0 && data.overview.total_users > 0
              ? `Average ${Math.round(data.overview.total_video_views / data.overview.total_users)} views per user. ${data.overview.total_video_views > data.overview.total_users * 5 ? 'Excellent engagement!' : 'Good start!'}`
              : 'Start tracking when users watch videos.'}
          </p>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold">Community Activity</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.overview.total_posts > 0
              ? `${data.overview.total_posts} posts created. ${Math.round((data.overview.total_posts / data.overview.total_users) * 100)}% of users have posted.`
              : 'Encourage users to start discussions in the community.'}
          </p>
        </div>
      </div>
    </div>
  );
}
