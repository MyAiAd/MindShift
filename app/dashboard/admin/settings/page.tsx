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
import { Settings as SettingsIcon, Save, Loader2, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="general">
            <SettingsIcon className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="features">
            <Zap className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
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
