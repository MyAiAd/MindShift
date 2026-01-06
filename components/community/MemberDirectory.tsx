'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, MessageCircle, Ban, X, Loader2, Users as UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  community_joined_at: string;
  last_active_at: string;
  stats: {
    post_count: number;
    comment_count: number;
    like_count: number;
  };
  is_blocked?: boolean;
}

interface MemberDirectoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MemberDirectory({ isOpen, onClose }: MemberDirectoryProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocking, setBlocking] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredMembers(
        members.filter(member =>
          `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/community/members');
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      } else {
        console.error('Failed to fetch members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = (memberId: string) => {
    router.push(`/dashboard/team/message?to=${memberId}`);
    onClose();
  };

  const handleBlock = async (memberId: string) => {
    if (!confirm('Are you sure you want to block this member? You will no longer see their posts or comments.')) {
      return;
    }

    try {
      setBlocking(memberId);
      const response = await fetch('/api/community/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: memberId }),
      });

      if (response.ok) {
        // Update local state
        setMembers(members.map(m =>
          m.id === memberId ? { ...m, is_blocked: true } : m
        ));
      } else {
        const errorData = await response.json();
        alert(`Failed to block user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Failed to block user. Please try again.');
    } finally {
      setBlocking(null);
    }
  };

  const handleUnblock = async (memberId: string) => {
    try {
      setBlocking(memberId);
      const response = await fetch(`/api/community/blocks/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Update local state
        setMembers(members.map(m =>
          m.id === memberId ? { ...m, is_blocked: false } : m
        ));
      } else {
        const errorData = await response.json();
        alert(`Failed to unblock user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Failed to unblock user. Please try again.');
    } finally {
      setBlocking(null);
    }
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 5) return 'Online';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getActivityStatus = (lastActive: string) => {
    const diffInMinutes = Math.floor((new Date().getTime() - new Date(lastActive).getTime()) / (1000 * 60));
    if (diffInMinutes < 5) return { color: 'bg-green-500', label: 'Online' };
    if (diffInMinutes < 60) return { color: 'bg-yellow-500', label: 'Recently active' };
    return { color: 'bg-gray-400', label: 'Offline' };
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700';
      case 'tenant_admin':
        return 'bg-blue-100 text-blue-700';
      case 'manager':
        return 'bg-green-100 text-green-700';
      case 'coach':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Members ({members.length})
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Loading members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No members found' : 'No members in community yet'}
              </p>
            </div>
          ) : (
            filteredMembers.map(member => {
              const activityStatus = getActivityStatus(member.last_active_at);
              const isCurrentUser = member.id === user?.id;

              return (
                <div
                  key={member.id}
                  className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={`${member.first_name} ${member.last_name}`}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 font-medium text-lg">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </span>
                        </div>
                      )}
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${activityStatus.color}`}
                        title={activityStatus.label}
                      />
                    </div>

                    {/* Member Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium text-foreground">
                          {member.first_name} {member.last_name}
                        </h4>
                        {member.role !== 'user' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${getRoleBadgeColor(member.role)}`}>
                            {member.role.replace('_', ' ')}
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                            You
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        Member since {formatJoinedDate(member.community_joined_at)}
                      </p>

                      {member.bio && (
                        <p className="text-sm text-foreground mb-2 line-clamp-2">
                          {member.bio}
                        </p>
                      )}

                      {member.location && (
                        <p className="text-xs text-muted-foreground mb-2">
                          📍 {member.location}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{member.stats.post_count} posts</span>
                        <span>·</span>
                        <span>{member.stats.comment_count} comments</span>
                        <span>·</span>
                        <span>Last active {formatLastActive(member.last_active_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isCurrentUser && (
                      <div className="flex flex-col gap-2">
                        {!member.is_blocked ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMessage(member.id)}
                              className="whitespace-nowrap"
                            >
                              <MessageCircle className="h-4 w-4 mr-1" />
                              Message
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleBlock(member.id)}
                              disabled={blocking === member.id}
                              className="text-muted-foreground hover:text-red-600"
                            >
                              {blocking === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Ban className="h-4 w-4 mr-1" />
                                  Block
                                </>
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnblock(member.id)}
                            disabled={blocking === member.id}
                          >
                            {blocking === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Unblock'
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

