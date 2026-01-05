'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Clock, Check, X, RefreshCw, Loader2, User, Calendar, AlertCircle } from 'lucide-react';

export interface CoachInvitation {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  invited_by: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

interface CoachInvitationCardProps {
  invitation: CoachInvitation;
  onResend?: () => void;
  onRevoke?: () => void;
  loading?: boolean;
}

export default function CoachInvitationCard({
  invitation,
  onResend,
  onRevoke,
  loading = false,
}: CoachInvitationCardProps) {
  const getStatusBadge = (status: CoachInvitation['status']) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <Check className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
            <AlertCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <X className="h-3 w-3 mr-1" />
            Revoked
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const isExpiringSoon = () => {
    if (invitation.status !== 'pending') return false;
    const expiresAt = new Date(invitation.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 48 && hoursUntilExpiry > 0;
  };

  const getInviterName = () => {
    if (invitation.invited_by.first_name || invitation.invited_by.last_name) {
      return `${invitation.invited_by.first_name || ''} ${invitation.invited_by.last_name || ''}`.trim();
    }
    return invitation.invited_by.email;
  };

  const getInviteeName = () => {
    if (invitation.first_name || invitation.last_name) {
      return `${invitation.first_name || ''} ${invitation.last_name || ''}`.trim();
    }
    return null;
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        {/* Header with status badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {getInviteeName() && (
                <p className="font-medium text-foreground truncate">{getInviteeName()}</p>
              )}
              <p className={`text-sm truncate ${getInviteeName() ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                {invitation.email}
              </p>
            </div>
          </div>
          {getStatusBadge(invitation.status)}
        </div>

        {/* Info rows */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">Invited by {getInviterName()}</span>
          </div>
          
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>Sent {formatDate(invitation.created_at)}</span>
          </div>

          {invitation.status === 'pending' && (
            <div className={`flex items-center gap-2 ${isExpiringSoon() ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>Expires {formatDateTime(invitation.expires_at)}</span>
              {isExpiringSoon() && <span className="text-xs">(soon!)</span>}
            </div>
          )}

          {invitation.status === 'accepted' && invitation.accepted_at && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4 flex-shrink-0" />
              <span>Accepted {formatDateTime(invitation.accepted_at)}</span>
            </div>
          )}
        </div>

        {/* Actions for pending invitations */}
        {invitation.status === 'pending' && (onResend || onRevoke) && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            {onResend && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResend}
                disabled={loading}
                className="flex-1 min-h-[44px]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Resend
              </Button>
            )}
            {onRevoke && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRevoke}
                disabled={loading}
                className="flex-1 min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Revoke
              </Button>
            )}
          </div>
        )}

        {/* Expired invitation - resend option */}
        {invitation.status === 'expired' && onResend && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={onResend}
              disabled={loading}
              className="w-full min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Resend Invitation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

