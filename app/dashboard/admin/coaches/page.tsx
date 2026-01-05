'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CoachInvitationCard, { CoachInvitation } from '@/components/admin/CoachInvitationCard';
import { useToast } from '@/hooks/use-toast';
import {
  UserPlus,
  Send,
  Loader2,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function CoachesAdminPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  // Form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
  });
  const [sending, setSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    success: boolean;
    message: string;
    emailSent?: boolean;
  } | null>(null);

  // Invitations state
  const [invitations, setInvitations] = useState<CoachInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<CoachInvitation | null>(null);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    total: 0,
  });

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    try {
      setLoadingInvitations(true);
      const response = await fetch('/api/coaches/invitations?status=all');
      
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
        
        // Calculate stats
        const invites = data.invitations || [];
        setStats({
          pending: invites.filter((i: CoachInvitation) => i.status === 'pending').length,
          accepted: invites.filter((i: CoachInvitation) => i.status === 'accepted').length,
          total: invites.length,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load invitations',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoadingInvitations(false);
    }
  }, [toast]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchInvitations();
    }
  }, [profile, fetchInvitations]);

  // Handle invite form submission
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteResult(null);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.email.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      const response = await fetch('/api/coaches/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          firstName: inviteForm.firstName.trim() || undefined,
          lastName: inviteForm.lastName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const emailSent = data.emailSent !== false;
        setInviteResult({
          success: true,
          message: emailSent 
            ? `Invitation sent to ${inviteForm.email}` 
            : 'Invitation created but email delivery failed',
          emailSent,
        });
        
        toast({
          title: emailSent ? 'Invitation Sent!' : 'Invitation Created',
          description: emailSent 
            ? `Coach invitation email sent to ${inviteForm.email}`
            : 'Invitation created, but email delivery failed. You can resend it.',
        });

        // Reset form
        setInviteForm({ email: '', firstName: '', lastName: '' });
        
        // Refresh invitations list
        fetchInvitations();
      } else {
        setInviteResult({
          success: false,
          message: data.error || 'Failed to create invitation',
        });
        toast({
          title: 'Error',
          description: data.error || 'Failed to create invitation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setInviteResult({
        success: false,
        message: 'Network error - could not send invitation',
      });
      toast({
        title: 'Error',
        description: 'Network error - could not send invitation',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Handle resend invitation
  const handleResend = async (invitation: CoachInvitation) => {
    setActionLoading(invitation.id);

    try {
      const response = await fetch('/api/coaches/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation.email,
          firstName: invitation.first_name,
          lastName: invitation.last_name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Invitation Resent',
          description: `A new invitation has been sent to ${invitation.email}`,
        });
        fetchInvitations();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to resend invitation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle revoke invitation
  const handleRevoke = async () => {
    if (!revokeTarget) return;

    setActionLoading(revokeTarget.id);

    try {
      const response = await fetch(`/api/coaches/invitations?id=${revokeTarget.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Invitation Revoked',
          description: `The invitation for ${revokeTarget.email} has been revoked`,
        });
        fetchInvitations();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to revoke invitation',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
      setRevokeTarget(null);
    }
  };

  // Filter invitations by status
  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  const acceptedInvitations = invitations.filter(i => i.status === 'accepted');
  const expiredOrRevokedInvitations = invitations.filter(i => 
    i.status === 'expired' || i.status === 'revoked'
  );

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Coach Management</h1>
        <p className="text-muted-foreground mt-2">
          Invite and manage coaches for your organization
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.accepted}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Form Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="h-5 w-5" />
            Invite Coach
          </CardTitle>
          <CardDescription>
            Send an invitation email to add a new coach to your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="coach@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
                className="min-h-[44px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                  className="min-h-[44px]"
                />
              </div>
            </div>

            {/* Invite Result */}
            {inviteResult && (
              <div className={`p-3 rounded-md flex items-start gap-2 ${
                inviteResult.success 
                  ? inviteResult.emailSent 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-yellow-500/10 border border-yellow-500/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}>
                {inviteResult.success ? (
                  inviteResult.emailSent ? (
                    <Mail className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  )
                ) : (
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    inviteResult.success 
                      ? inviteResult.emailSent 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-yellow-600 dark:text-yellow-400'
                      : 'text-destructive'
                  }`}>
                    {inviteResult.success 
                      ? inviteResult.emailSent ? 'Invitation Sent!' : 'Invitation Created'
                      : 'Failed'}
                  </p>
                  <p className="text-sm text-muted-foreground">{inviteResult.message}</p>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={sending || !inviteForm.email.trim()}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Invitations</CardTitle>
            <CardDescription>
              View and manage coach invitations
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchInvitations}
            disabled={loadingInvitations}
            className="min-h-[44px]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingInvitations ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="pending" className="text-xs sm:text-sm">
                Pending ({pendingInvitations.length})
              </TabsTrigger>
              <TabsTrigger value="accepted" className="text-xs sm:text-sm">
                Accepted ({acceptedInvitations.length})
              </TabsTrigger>
              <TabsTrigger value="other" className="text-xs sm:text-sm">
                Other ({expiredOrRevokedInvitations.length})
              </TabsTrigger>
            </TabsList>

            {/* Pending Invitations */}
            <TabsContent value="pending" className="space-y-3">
              {loadingInvitations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No pending invitations</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use the form above to invite a new coach
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingInvitations.map((invitation) => (
                    <CoachInvitationCard
                      key={invitation.id}
                      invitation={invitation}
                      onResend={() => handleResend(invitation)}
                      onRevoke={() => setRevokeTarget(invitation)}
                      loading={actionLoading === invitation.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Accepted Invitations */}
            <TabsContent value="accepted" className="space-y-3">
              {loadingInvitations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : acceptedInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No accepted invitations yet</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {acceptedInvitations.map((invitation) => (
                    <CoachInvitationCard
                      key={invitation.id}
                      invitation={invitation}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Expired/Revoked Invitations */}
            <TabsContent value="other" className="space-y-3">
              {loadingInvitations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : expiredOrRevokedInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <XCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No expired or revoked invitations</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {expiredOrRevokedInvitations.map((invitation) => (
                    <CoachInvitationCard
                      key={invitation.id}
                      invitation={invitation}
                      onResend={invitation.status === 'expired' ? () => handleResend(invitation) : undefined}
                      loading={actionLoading === invitation.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{' '}
              <strong>{revokeTarget?.email}</strong>?
              They will no longer be able to use this invitation to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRevoke}
              className="min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

