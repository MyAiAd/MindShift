'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  User as UserIcon, 
  Mail, 
  Calendar, 
  Shield, 
  CreditCard, 
  Activity,
  Video,
  MessageSquare,
  BookOpen
} from 'lucide-react';
import { format } from 'date-fns';

interface UserDetailsProps {
  user: {
    id: string;
    email: string;
    full_name?: string;
    role: string;
    subscription_tier?: string;
    created_at: string;
    last_sign_in_at?: string;
    is_active: boolean;
  };
  stats?: {
    total_videos_watched?: number;
    total_sessions?: number;
    total_posts?: number;
    total_comments?: number;
  };
}

export default function UserDetails({ user, stats }: UserDetailsProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'tenant_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'user':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierBadgeColor = (tier?: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pro':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'basic':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'free':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatRoleName = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
          <CardDescription>Basic account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-semibold">{user.full_name || 'No Name Set'}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Role</div>
              <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                <Shield className="h-3 w-3 mr-1" />
                {formatRoleName(user.role)}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Subscription</div>
              <Badge variant="outline" className={getTierBadgeColor(user.subscription_tier)}>
                <CreditCard className="h-3 w-3 mr-1" />
                {user.subscription_tier?.toUpperCase() || 'FREE'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              {user.is_active ? (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  <Activity className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                  <Activity className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">User ID</div>
              <div className="text-sm font-mono truncate">{user.id.slice(0, 20)}...</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Joined
              </div>
              <div className="text-sm font-medium">
                {format(new Date(user.created_at), 'PPP')}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last Sign In
              </div>
              <div className="text-sm font-medium">
                {user.last_sign_in_at
                  ? format(new Date(user.last_sign_in_at), 'PPP')
                  : 'Never'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Stats Card */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Statistics</CardTitle>
            <CardDescription>User engagement metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Video className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stats.total_videos_watched || 0}</div>
                <div className="text-sm text-muted-foreground">Videos Watched</div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stats.total_sessions || 0}</div>
                <div className="text-sm text-muted-foreground">Sessions</div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stats.total_posts || 0}</div>
                <div className="text-sm text-muted-foreground">Posts</div>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stats.total_comments || 0}</div>
                <div className="text-sm text-muted-foreground">Comments</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
