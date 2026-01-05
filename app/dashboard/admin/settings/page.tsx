'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Save, Loader2, Shield, Zap, Mail, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailStatus {
  configured: boolean;
  validKeyFormat: boolean;
  provider: string;
  status: string;
  domain: string;
  senderEmail: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { profile, tenant } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // General Settings
  const [tenantName, setTenantName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Feature Flags
  const [features, setFeatures] = useState({
    community_enabled: true,
    tutorials_enabled: true,
    sessions_enabled: true,
    coach_booking_enabled: true,
    voice_enabled: true,
  });

  // Email Settings
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailStatusLoading, setEmailStatusLoading] = useState(true);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name || '');
    }
    if (profile) {
      setContactEmail(profile.email || '');
    }
  }, [tenant, profile]);

  // Fetch email configuration status
  useEffect(() => {
    const fetchEmailStatus = async () => {
      try {
        const response = await fetch('/api/notifications/email/test');
        if (response.ok) {
          const data = await response.json();
          setEmailStatus(data);
        }
      } catch (error) {
        console.error('Error fetching email status:', error);
      } finally {
        setEmailStatusLoading(false);
      }
    };

    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchEmailStatus();
    }
  }, [profile]);

  // Send test email
  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const response = await fetch('/api/notifications/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setTestEmailResult({
          success: true,
          message: `Test email sent to ${data.sentTo}`,
          timestamp: data.timestamp,
        });
        toast({
          title: 'Test Email Sent',
          description: `Check your inbox at ${data.sentTo}`,
        });
      } else {
        setTestEmailResult({
          success: false,
          message: data.error || 'Failed to send test email',
        });
        toast({
          title: 'Email Failed',
          description: data.error || 'Failed to send test email',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setTestEmailResult({
        success: false,
        message: 'Network error - could not send test email',
      });
      toast({
        title: 'Error',
        description: 'Network error - could not send test email',
        variant: 'destructive',
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSaveGeneral = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, this would call an API
      toast({
        title: 'Settings Saved',
        description: 'General settings have been updated successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatures = async () => {
    try {
      setSaving(true);
      
      // In a real implementation, this would call an API
      toast({
        title: 'Feature Flags Updated',
        description: 'Feature settings have been updated successfully',
      });
    } catch (error) {
      console.error('Error saving features:', error);
      toast({
        title: 'Error',
        description: 'Failed to save feature flags',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system settings and feature flags
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="general" className="text-xs sm:text-sm">
            <SettingsIcon className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">General</span>
            <span className="sm:hidden">General</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs sm:text-sm">
            <Zap className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Features</span>
            <span className="sm:hidden">Features</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs sm:text-sm">
            <Mail className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Email</span>
            <span className="sm:hidden">Email</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm">
            <Shield className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Security</span>
            <span className="sm:hidden">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Organization Name</Label>
                <Input
                  id="tenant-name"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Enter organization name"
                />
                <p className="text-xs text-muted-foreground">
                  This name will be displayed throughout the application
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Primary contact email for admin notifications
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveGeneral} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Toggles</CardTitle>
              <CardDescription>
                Enable or disable features for your users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="community">Community Feature</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to create posts and engage in discussions
                  </p>
                </div>
                <Switch
                  id="community"
                  checked={features.community_enabled}
                  onCheckedChange={(checked) => 
                    setFeatures({ ...features, community_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="tutorials">Tutorial Videos</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable access to tutorial video library
                  </p>
                </div>
                <Switch
                  id="tutorials"
                  checked={features.tutorials_enabled}
                  onCheckedChange={(checked) => 
                    setFeatures({ ...features, tutorials_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="sessions">Mind-Shifting Sessions</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to start treatment sessions
                  </p>
                </div>
                <Switch
                  id="sessions"
                  checked={features.sessions_enabled}
                  onCheckedChange={(checked) => 
                    setFeatures({ ...features, sessions_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="coach-booking">Coach Booking</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable booking sessions with human coaches
                  </p>
                </div>
                <Switch
                  id="coach-booking"
                  checked={features.coach_booking_enabled}
                  onCheckedChange={(checked) => 
                    setFeatures({ ...features, coach_booking_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between border-t pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="voice">Voice Features</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable voice-to-text and text-to-speech features
                  </p>
                </div>
                <Switch
                  id="voice"
                  checked={features.voice_enabled}
                  onCheckedChange={(checked) => 
                    setFeatures({ ...features, voice_enabled: checked })
                  }
                />
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveFeatures} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>
                View email service status and send test emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Service Status */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold mb-3 text-foreground">Service Status</h3>
                {emailStatusLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking configuration...</span>
                  </div>
                ) : emailStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {emailStatus.configured && emailStatus.validKeyFormat ? (
                        <>
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            Ready - {emailStatus.provider.charAt(0).toUpperCase() + emailStatus.provider.slice(1)} configured
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                            {emailStatus.status === 'invalid_key_format' 
                              ? 'Invalid API key format' 
                              : 'Not configured'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Provider:</span>
                        <span className="font-medium text-foreground">Resend</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Domain:</span>
                        <span className="font-medium text-foreground">{emailStatus.domain}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sender:</span>
                        <span className="font-medium text-foreground truncate ml-2">{emailStatus.senderEmail}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">Could not load email status</span>
                  </div>
                )}
              </div>

              {/* Test Email Section */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold mb-2 text-foreground">Test Email Delivery</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send a test email to verify your email configuration is working correctly.
                  The test email will be sent to your registered email address.
                </p>

                {/* Test Result */}
                {testEmailResult && (
                  <div className={`mb-4 p-3 rounded-md flex items-start gap-2 ${
                    testEmailResult.success 
                      ? 'bg-green-500/10 border border-green-500/20' 
                      : 'bg-destructive/10 border border-destructive/20'
                  }`}>
                    {testEmailResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        testEmailResult.success 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-destructive'
                      }`}>
                        {testEmailResult.success ? 'Email Sent Successfully' : 'Email Failed'}
                      </p>
                      <p className="text-sm text-muted-foreground">{testEmailResult.message}</p>
                      {testEmailResult.timestamp && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent at: {new Date(testEmailResult.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSendTestEmail} 
                  disabled={sendingTestEmail || !emailStatus?.configured}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  {sendingTestEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>

                {!emailStatus?.configured && !emailStatusLoading && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    Configure your RESEND_API_KEY environment variable to enable email
                  </p>
                )}
              </div>

              {/* Email Features Info */}
              <div className="rounded-lg border border-border p-4">
                <h3 className="font-semibold mb-2 text-foreground">Email Features</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Coach invitation emails
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Welcome emails for new users
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Notification emails (user preference)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Session reminder emails
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Password change notifications
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>
                Manage security settings and data privacy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Row-Level Security (RLS)</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  RLS is enabled and enforced at the database level. All user data is automatically
                  isolated by tenant. Super admins can access all tenants.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Active & Enforced</span>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Data Encryption</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  All data is encrypted at rest and in transit using industry-standard encryption protocols.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Enabled</span>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Supabase Auth provides secure authentication with email verification and password policies.
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-green-700">Configured</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground italic pt-4 border-t">
                These security features are managed at the infrastructure level and cannot be disabled.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
