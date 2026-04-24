'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Save, Loader2, Shield, Zap, Mail, Send, CheckCircle, XCircle, AlertCircle, Beaker, Mic, Volume2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailStatus {
  configured: boolean;
  validKeyFormat: boolean;
  provider: string;
  status: string;
  domain: string;
  senderEmail: string;
}

type SttProviderId = 'openai' | 'whisper-local';
type TtsProviderId = 'openai' | 'elevenlabs' | 'kokoro';

interface VoiceProviderReport {
  id: string;
  displayName: string;
  available: boolean;
  reason?: string;
}

interface VoiceSettingsResponse {
  current: {
    stt: SttProviderId;
    tts: TtsProviderId;
    source: 'database' | 'environment';
    updatedAt: string | null;
    updatedBy: string | null;
  };
  providers: {
    stt: VoiceProviderReport[];
    tts: VoiceProviderReport[];
  };
}

interface VoiceTestResult {
  kind: 'stt' | 'tts';
  provider: string;
  roundTripMs?: number;
  cost?: {
    estimatedUsd?: number;
    characters?: number;
    audioSeconds?: number;
    latencyMs?: number;
  };
  text?: string;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
}

const OPENAI_STT_USD_PER_MINUTE = 0.003;
const OPENAI_TTS_USD_PER_CHARACTER = 0.000015;
const ELEVENLABS_TTS_USD_PER_CHARACTER = 0.00044;
const SAMPLE_INPUT_MINUTES = 10;
const SAMPLE_OUTPUT_CHARACTERS = 12000;

function formatUsd(value: number): string {
  if (value === 0) return '$0.0000';
  return `$${value.toFixed(4)}`;
}

function estimateSttCost(provider: SttProviderId, minutes: number): number {
  return provider === 'openai' ? minutes * OPENAI_STT_USD_PER_MINUTE : 0;
}

function estimateTtsCost(provider: TtsProviderId, characters: number): number {
  if (provider === 'openai') return characters * OPENAI_TTS_USD_PER_CHARACTER;
  if (provider === 'elevenlabs') return characters * ELEVENLABS_TTS_USD_PER_CHARACTER;
  return 0;
}

function describeMeterBasis(stt: SttProviderId, tts: TtsProviderId): string {
  const input =
    stt === 'openai'
      ? '$0.003/min input audio'
      : 'self-hosted input, no per-call API cost';
  const output =
    tts === 'openai'
      ? '$0.000015/output char'
      : tts === 'elevenlabs'
        ? '$0.00044/output char'
        : 'self-hosted output, no per-call API cost';
  return `${input} · ${output}`;
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

  // Voice pipeline settings (V9). Super-admin only; tenant_admin can
  // view but not edit. The selection applies only to NEW sessions —
  // in-flight patient sessions are pinned at start.
  const isSuperAdmin = profile?.role === 'super_admin';
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceData, setVoiceData] = useState<VoiceSettingsResponse | null>(null);
  const [selectedStt, setSelectedStt] = useState<SttProviderId>('openai');
  const [selectedTts, setSelectedTts] = useState<TtsProviderId>('openai');
  const [voiceSaving, setVoiceSaving] = useState(false);
  const [ttsTestLoading, setTtsTestLoading] = useState(false);
  const [sttTestLoading, setSttTestLoading] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<VoiceTestResult | null>(null);
  const [sttTestResult, setSttTestResult] = useState<VoiceTestResult | null>(null);
  const estimatedInputCost = estimateSttCost(selectedStt, SAMPLE_INPUT_MINUTES);
  const estimatedOutputCost = estimateTtsCost(selectedTts, SAMPLE_OUTPUT_CHARACTERS);
  const estimatedSessionCost = estimatedInputCost + estimatedOutputCost;

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

  // Fetch current voice pipeline settings + provider availability.
  useEffect(() => {
    const fetchVoiceSettings = async () => {
      try {
        setVoiceLoading(true);
        const response = await fetch('/api/admin/voice-settings');
        if (response.ok) {
          const data = (await response.json()) as VoiceSettingsResponse;
          setVoiceData(data);
          setSelectedStt(data.current.stt);
          setSelectedTts(data.current.tts);
        }
      } catch (error) {
        console.error('Error fetching voice settings:', error);
      } finally {
        setVoiceLoading(false);
      }
    };

    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchVoiceSettings();
    }
  }, [profile]);

  const handleSaveVoiceSettings = async () => {
    if (!isSuperAdmin) return;
    try {
      setVoiceSaving(true);
      const response = await fetch('/api/admin/voice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stt: selectedStt, tts: selectedTts }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({
          title: 'Could not save voice settings',
          description: payload?.error || 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      setVoiceData((prev) =>
        prev
          ? {
              ...prev,
              current: payload.current,
            }
          : prev,
      );
      toast({
        title: 'Voice pipeline updated',
        description:
          'Applies to new sessions only. Existing sessions keep their current voice.',
      });
    } catch (err) {
      toast({
        title: 'Voice settings save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setVoiceSaving(false);
    }
  };

  const handleTestTts = async () => {
    try {
      setTtsTestLoading(true);
      setTtsTestResult(null);
      const response = await fetch('/api/admin/voice-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'tts', provider: selectedTts }),
      });
      const payload = (await response.json()) as VoiceTestResult;
      setTtsTestResult(payload);
      if (payload.audioBase64 && payload.mimeType) {
        try {
          const audio = new Audio(
            `data:${payload.mimeType};base64,${payload.audioBase64}`,
          );
          await audio.play();
        } catch (playErr) {
          console.warn('TTS test playback failed:', playErr);
        }
      }
    } catch (err) {
      setTtsTestResult({
        kind: 'tts',
        provider: selectedTts,
        error: err instanceof Error ? err.message : 'TTS test failed',
      });
    } finally {
      setTtsTestLoading(false);
    }
  };

  const handleTestStt = async () => {
    try {
      setSttTestLoading(true);
      setSttTestResult(null);

      // Record a short audio clip via MediaRecorder so we can send a
      // real sample through the selected STT provider. We ask for 3s
      // of speech from the admin; if no recording API is available
      // (e.g. non-HTTPS), fall through to a helpful error.
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        setSttTestResult({
          kind: 'stt',
          provider: selectedStt,
          error:
            'Browser does not support microphone recording in this context (needs HTTPS).',
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      toast({
        title: 'Recording… speak for up to 4 seconds',
        description: 'Say a short sentence to test transcription.',
      });
      await new Promise((r) => setTimeout(r, 4000));
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      await stopped;

      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      const form = new FormData();
      form.append('kind', 'stt');
      form.append('provider', selectedStt);
      form.append('audio', blob, 'test.webm');
      const response = await fetch('/api/admin/voice-settings/test', {
        method: 'POST',
        body: form,
      });
      const payload = (await response.json()) as VoiceTestResult;
      setSttTestResult(payload);
    } catch (err) {
      setSttTestResult({
        kind: 'stt',
        provider: selectedStt,
        error: err instanceof Error ? err.message : 'STT test failed',
      });
    } finally {
      setSttTestLoading(false);
    }
  };

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
        <TabsList
          className={
            isSuperAdmin
              ? 'grid w-full grid-cols-2 sm:grid-cols-3 lg:w-[760px] lg:grid-cols-6'
              : 'grid w-full grid-cols-2 sm:grid-cols-3 lg:w-[640px] lg:grid-cols-5'
          }
        >
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
          {isSuperAdmin && (
            <TabsTrigger value="voice" className="text-xs sm:text-sm">
              <Mic className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Voice</span>
              <span className="sm:hidden">Voice</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="labs" className="text-xs sm:text-sm">
            <Beaker className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Labs</span>
            <span className="sm:hidden">Labs</span>
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

        {isSuperAdmin && (
          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" /> Voice Pipeline (V9)
                </CardTitle>
                <CardDescription>
                  Choose which provider handles speech-to-text (what the patient
                  says) and text-to-speech (what the app speaks back) for V9
                  sessions. Each side can be configured independently.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">
                        Changes apply to new sessions only
                      </div>
                      <div className="mt-1">
                        In-flight patient sessions keep whatever STT + TTS pair
                        they started with. The setting here writes the default
                        for every session that begins after you save.
                      </div>
                    </div>
                  </div>
                </div>

                {voiceLoading || !voiceData ? (
                  <div className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading voice settings…</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Currently active
                      </div>
                      <div className="mt-1 font-medium text-foreground">
                        STT:{' '}
                        <span className="font-mono text-sm">
                          {voiceData.current.stt}
                        </span>
                        {'  ·  '}TTS:{' '}
                        <span className="font-mono text-sm">
                          {voiceData.current.tts}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Source: {voiceData.current.source}
                        {voiceData.current.updatedAt
                          ? `  ·  last saved ${new Date(voiceData.current.updatedAt).toLocaleString()}`
                          : ''}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Estimated variable cost
                          </div>
                          <div className="mt-1 text-2xl font-semibold text-foreground">
                            {formatUsd(estimatedSessionCost)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sample session: {SAMPLE_INPUT_MINUTES} min speech input +{' '}
                            {SAMPLE_OUTPUT_CHARACTERS.toLocaleString()} spoken output chars
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>
                            Input: <span className="font-mono text-foreground">{formatUsd(estimatedInputCost)}</span>
                          </div>
                          <div>
                            Output: <span className="font-mono text-foreground">{formatUsd(estimatedOutputCost)}</span>
                          </div>
                        </div>
                      </div>
                      <progress
                        value={Math.min(estimatedSessionCost, 5.5)}
                        max={5.5}
                        className="mt-3 h-2 w-full overflow-hidden rounded-full accent-primary"
                        aria-label="Estimated variable cost meter"
                      />
                      <div className="mt-2 text-xs text-muted-foreground">
                        {describeMeterBasis(selectedStt, selectedTts)}. Fixed server or
                        subscription costs are not included.
                      </div>
                    </div>

                    <div className="space-y-3 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="flex items-center gap-2 text-base">
                            <Mic className="h-4 w-4" /> Speech-to-Text
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            How the app transcribes what the patient says.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleTestStt}
                          disabled={sttTestLoading}
                        >
                          {sttTestLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Recording…
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" /> Test with my mic
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {voiceData.providers.stt.map((p) => (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 rounded-md border px-3 py-3 ${
                              !p.available
                                ? 'border-muted bg-muted/40 opacity-60'
                                : selectedStt === p.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:bg-muted/40'
                            } cursor-pointer`}
                          >
                            <input
                              type="radio"
                              name="stt-provider"
                              value={p.id}
                              checked={selectedStt === p.id}
                              disabled={!p.available}
                              onChange={() =>
                                setSelectedStt(p.id as SttProviderId)
                              }
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                {p.displayName}
                                <span className="ml-2 font-mono text-xs text-muted-foreground">
                                  {p.id}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.id === 'openai'
                                  ? 'OpenAI hosted transcription (~$0.003/min). Best accuracy on short utterances.'
                                  : 'Self-hosted Whisper service. No per-call API cost; compute is billed hourly regardless of volume.'}
                              </div>
                              {!p.available && p.reason ? (
                                <div className="text-xs text-destructive mt-1">
                                  Unavailable: {p.reason}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>

                      {sttTestResult ? (
                        <div className="rounded-md border px-3 py-2 text-sm">
                          <div className="font-mono text-xs text-muted-foreground">
                            STT test · {sttTestResult.provider}
                          </div>
                          {sttTestResult.error ? (
                            <div className="text-destructive mt-1">
                              {sttTestResult.error}
                            </div>
                          ) : (
                            <>
                              <div className="mt-1">
                                <span className="text-muted-foreground">Heard: </span>
                                <span className="font-medium">
                                  “{sttTestResult.text || '(empty)'}”
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {sttTestResult.cost?.audioSeconds != null
                                  ? `${sttTestResult.cost.audioSeconds.toFixed(2)}s audio · `
                                  : ''}
                                {sttTestResult.roundTripMs != null
                                  ? `${sttTestResult.roundTripMs}ms round-trip`
                                  : ''}
                                {sttTestResult.cost?.estimatedUsd != null
                                  ? ` · $${sttTestResult.cost.estimatedUsd.toFixed(4)} est.`
                                  : ''}
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3 border-t pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="flex items-center gap-2 text-base">
                            <Volume2 className="h-4 w-4" /> Text-to-Speech
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            The voice the app uses when speaking scripted
                            responses.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleTestTts}
                          disabled={ttsTestLoading}
                        >
                          {ttsTestLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Synthesising…
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" /> Play sample
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {voiceData.providers.tts.map((p) => (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 rounded-md border px-3 py-3 ${
                              !p.available
                                ? 'border-muted bg-muted/40 opacity-60'
                                : selectedTts === p.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:bg-muted/40'
                            } cursor-pointer`}
                          >
                            <input
                              type="radio"
                              name="tts-provider"
                              value={p.id}
                              checked={selectedTts === p.id}
                              disabled={!p.available}
                              onChange={() =>
                                setSelectedTts(p.id as TtsProviderId)
                              }
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                {p.displayName}
                                <span className="ml-2 font-mono text-xs text-muted-foreground">
                                  {p.id}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.id === 'openai'
                                  ? 'OpenAI TTS — the V9 default. Predictable cost, good quality.'
                                  : p.id === 'elevenlabs'
                                    ? 'ElevenLabs — premium voice quality; higher per-character cost.'
                                    : 'Kokoro — self-hosted TTS. No per-call API cost; hourly compute.'}
                              </div>
                              {!p.available && p.reason ? (
                                <div className="text-xs text-destructive mt-1">
                                  Unavailable: {p.reason}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>

                      {ttsTestResult ? (
                        <div className="rounded-md border px-3 py-2 text-sm">
                          <div className="font-mono text-xs text-muted-foreground">
                            TTS test · {ttsTestResult.provider}
                          </div>
                          {ttsTestResult.error ? (
                            <div className="text-destructive mt-1">
                              {ttsTestResult.error}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">
                              {ttsTestResult.cost?.characters != null
                                ? `${ttsTestResult.cost.characters} chars · `
                                : ''}
                              {ttsTestResult.roundTripMs != null
                                ? `${ttsTestResult.roundTripMs}ms round-trip`
                                : ''}
                              {ttsTestResult.cost?.estimatedUsd != null
                                ? ` · $${ttsTestResult.cost.estimatedUsd.toFixed(4)} est.`
                                : ''}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="pt-4 border-t">
                      <Button
                        onClick={handleSaveVoiceSettings}
                        disabled={
                          voiceSaving ||
                          (selectedStt === voiceData.current.stt &&
                            selectedTts === voiceData.current.tts)
                        }
                      >
                        {voiceSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Voice Pipeline
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="labs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Labs</CardTitle>
              <CardDescription>
                Open the existing Labs controls and testing tools without duplicating their configuration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">Labs Settings</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Labs API keys and treatment demo toggles already live in the main settings experience.
                </p>
                <Button asChild>
                  <Link href="/dashboard/settings#labs">
                    <Beaker className="h-4 w-4 mr-2" />
                    Open Labs Settings
                  </Link>
                </Button>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">V5 Test Runner</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Launch the existing Labs test runner for V5 treatment validation and QA workflows.
                </p>
                <Button asChild variant="outline">
                  <Link href="/dashboard/labs/v5-tests">
                    Run V5 Tests
                  </Link>
                </Button>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold mb-2">What Lives In Labs</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Labs OpenRouter key management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Treatment demo toggles for newer session versions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Admin test access for the V5 runner
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
