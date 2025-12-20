'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { createClient } from '@/lib/database';
import { useNotifications } from '@/services/notification/notification.service';
import { AccessibilityService } from '@/services/accessibility/accessibility.service';
import { GDPRService } from '@/services/gdpr/gdpr.service';
import TwoFactorAuth from '@/components/auth/TwoFactorAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, User, Bell, Shield, CreditCard, Globe, Moon, Sun, Check, X, AlertCircle, Eye, Type, Contrast, MousePointer, Download, Trash2, Lock, Cookie, Beaker, Brain } from 'lucide-react';
import RealityShiftingDemo from '@/components/labs/RealityShiftingDemo';
import BeliefShiftingDemo from '@/components/labs/BeliefShiftingDemo';
import IdentityShiftingDemo from '@/components/labs/IdentityShiftingDemo';
import BlockageShiftingDemo from '@/components/labs/BlockageShiftingDemo';
import TraumaShiftingDemo from '@/components/labs/TraumaShiftingDemo';

interface FormState {
  loading: boolean;
  success: boolean;
  error: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
}

interface AccessibilitySettings {
  highContrast: boolean;
  fontSize: string;
  reducedMotion: boolean;
  keyboardNavigation: boolean;
  screenReaderMode: boolean;
  loading: boolean;
}

interface GDPRSettings {
  cookiesAccepted: boolean;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  functionalConsent: boolean;
  dataRetention: string;
  loading: boolean;
}

export default function SettingsPage() {
  const { profile, user, loading } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const supabase = createClient();
  
  // Services
  const accessibilityService = AccessibilityService.getInstance();
  const gdprService = GDPRService.getInstance();
  
  // Notifications integration
  const {
    isSupported,
    permission,
    subscribe,
    unsubscribe,
    getPreferences,
    updatePreferences
  } = useNotifications();

  // Form states
  const [profileState, setProfileState] = useState<FormState>({ loading: false, success: false, error: '' });
  const [passwordState, setPasswordState] = useState<FormState>({ loading: false, success: false, error: '' });
  const [notificationState, setNotificationState] = useState<FormState>({ loading: false, success: false, error: '' });
  
  // Form data
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    bio: (profile as any)?.bio || ''
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notification preferences - now connected to backend
  const [notifications, setNotifications] = useState({
    email: false,
    push: false,
    sms: false,
    loading: true
  });

  // Accessibility state
  const [accessibilitySettings, setAccessibilitySettings] = useState<AccessibilitySettings>({
    highContrast: false,
    fontSize: 'medium',
    reducedMotion: false,
    keyboardNavigation: false,
    screenReaderMode: false,
    loading: true
  });

  // GDPR state
  const [gdprSettings, setGDPRSettings] = useState<GDPRSettings>({
    cookiesAccepted: false,
    analyticsConsent: false,
    marketingConsent: false,
    functionalConsent: false,
    dataRetention: '2-years',
    loading: true
  });

  // Labs toggle states
  const [labsToggles, setLabsToggles] = useState({
    v3TreatmentDemo: true,
    v4TreatmentDemo: true
  });

  // Load notification preferences on component mount
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | undefined;

    const loadNotificationPreferences = async () => {
      try {
        console.log('Loading notification preferences for user:', user?.id);
        console.log('Auth loading state:', loading);
        console.log('User object:', user);
        
        // Wait longer to ensure authentication is fully established
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if component is still mounted
        if (!isMounted) return;
        
        const preferences = await getPreferences();
        console.log('Received preferences:', preferences);
        
        // Only update state if component is still mounted
        if (isMounted) {
          setNotifications({
            email: preferences.email_notifications_enabled || false,
            push: preferences.browser_notifications_enabled || false,
            sms: preferences.sms_notifications_enabled || false,
            loading: false
          });
        }
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        // Only update state if component is still mounted
        if (isMounted) {
          setNotifications(prev => ({ ...prev, loading: false }));
        }
      }
    };

    // Only load preferences when user is available and auth is not loading
    // Add debouncing to prevent rapid successive calls
    if (user && !loading) {
      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Debounce the API call
      timeoutId = setTimeout(() => {
        if (isMounted) {
          loadNotificationPreferences();
        }
      }, 100);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, loading]); // Removed getPreferences from dependencies to prevent infinite loop

  // Load accessibility settings
  useEffect(() => {
    const loadAccessibilitySettings = () => {
      try {
        const settings = accessibilityService.getPreferences();
        setAccessibilitySettings({
          highContrast: settings.highContrast,
          fontSize: settings.fontSize,
          reducedMotion: settings.reducedMotion,
          keyboardNavigation: settings.keyboardNavigation,
          screenReaderMode: settings.screenReaderOptimized,
          loading: false
        });
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
        setAccessibilitySettings(prev => ({ ...prev, loading: false }));
      }
    };

    if (user) {
      loadAccessibilitySettings();
    }
  }, [user]);

  // Re-sync accessibility settings when they change
  useEffect(() => {
    const syncAccessibilitySettings = () => {
      try {
        const settings = accessibilityService.getPreferences();
        setAccessibilitySettings(prev => ({
          ...prev,
          highContrast: settings.highContrast,
          fontSize: settings.fontSize,
          reducedMotion: settings.reducedMotion,
          keyboardNavigation: settings.keyboardNavigation,
          screenReaderMode: settings.screenReaderOptimized,
        }));
      } catch (error) {
        console.error('Failed to sync accessibility settings:', error);
      }
    };

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessibility-preferences') {
        syncAccessibilitySettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load GDPR settings
  useEffect(() => {
    const loadGDPRSettings = () => {
      try {
        const consent = gdprService.getCookieConsent();
        setGDPRSettings({
          cookiesAccepted: consent?.essential || false,
          analyticsConsent: consent?.analytics || false,
          marketingConsent: consent?.marketing || false,
          functionalConsent: consent?.functional || false,
          dataRetention: '2-years', // Default value
          loading: false
        });
      } catch (error) {
        console.error('Failed to load GDPR settings:', error);
        setGDPRSettings(prev => ({ ...prev, loading: false }));
      }
    };

    if (user) {
      loadGDPRSettings();
    }
  }, [user]);

  // Handle notification toggle changes
  const handleNotificationToggle = async (type: 'email' | 'push' | 'sms', enabled: boolean) => {
    console.log(`Toggling ${type} notification to ${enabled}`);
    setNotificationState({ loading: true, success: false, error: '' });
    
    try {
      if (type === 'push') {
        if (enabled) {
          // Check browser support
          if (!isSupported) {
            throw new Error('Push notifications are not supported in this browser');
          }
          
          console.log('Requesting push notification permission and subscription...');
          
          // Request permission and subscribe
          try {
            await subscribe();
            console.log('Push subscription successful');
          } catch (subscribeError: any) {
            console.error('Push subscription failed:', subscribeError);
            
            // If permission was denied, don't enable the toggle
            if (permission === 'denied') {
              throw new Error('Push notifications were blocked. Please enable them in your browser settings and refresh the page.');
            }
            
            throw subscribeError;
          }
        } else {
          console.log('Unsubscribing from push notifications...');
          // Unsubscribe from push notifications
          await unsubscribe();
        }
      }

      console.log('Updating preferences in backend...');
      
      // Update preferences in backend
      const updateData: any = {};
      if (type === 'email') updateData.email_notifications_enabled = enabled;
      if (type === 'push') updateData.browser_notifications_enabled = enabled;
      if (type === 'sms') updateData.sms_notifications_enabled = enabled;
      
      await updatePreferences(updateData);

      // Update local state
      setNotifications(prev => ({ ...prev, [type]: enabled }));
      setNotificationState({ loading: false, success: true, error: '' });
      
      console.log(`${type} notification toggle updated successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => setNotificationState(prev => ({ ...prev, success: false })), 3000);
    } catch (error: any) {
      console.error(`Failed to update ${type} notification preferences:`, error);
      setNotificationState({ 
        loading: false, 
        success: false, 
        error: error.message || 'Failed to update notification preferences' 
      });
      
      // Reset the toggle state on error
      setNotifications(prev => ({ ...prev, [type]: !enabled }));
    }
  };

  // Handle test notification
  const handleTestNotification = async () => {
    setNotificationState({ loading: true, success: false, error: '' });
    
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Test Notification',
          body: 'This is a test notification from MyAi. Your notifications are working!'
        })
      });

      const data = await response.json();

      if (response.ok) {
        setNotificationState({ 
          loading: false, 
          success: true, 
          error: '' 
        });
        setTimeout(() => setNotificationState(prev => ({ ...prev, success: false })), 5000);
      } else {
        throw new Error(data.error || 'Failed to send test notification');
      }
    } catch (error: any) {
      setNotificationState({ 
        loading: false, 
        success: false, 
        error: error.message || 'Failed to send test notification' 
      });
    }
  };

  // Handle accessibility setting changes
  const handleAccessibilityChange = (setting: keyof AccessibilitySettings, value: any) => {
    const originalValue = accessibilitySettings[setting];
    
    try {
      // Update local state first
      setAccessibilitySettings(prev => ({ ...prev, [setting]: value }));
      
      // Build new preferences object with updated value
      const newPreferences = {
        highContrast: setting === 'highContrast' ? value : accessibilitySettings.highContrast,
        fontSize: setting === 'fontSize' ? value : accessibilitySettings.fontSize as 'small' | 'medium' | 'large' | 'xlarge',
        reducedMotion: setting === 'reducedMotion' ? value : accessibilitySettings.reducedMotion,
        keyboardNavigation: setting === 'keyboardNavigation' ? value : accessibilitySettings.keyboardNavigation,
        screenReaderOptimized: setting === 'screenReaderMode' ? value : accessibilitySettings.screenReaderMode,
      };
      
      // Update the accessibility service
      accessibilityService.updatePreferences(newPreferences);
    } catch (error) {
      console.error('Failed to update accessibility setting:', error);
      // Revert the change to original value
      setAccessibilitySettings(prev => ({ ...prev, [setting]: originalValue }));
    }
  };

  // Handle GDPR consent changes
  const handleGDPRConsentChange = async (consentType: string, value: boolean) => {
    try {
      setGDPRSettings(prev => ({ ...prev, [`${consentType}Consent`]: value }));
      
      // Get current consent state and update the specific type
      const currentConsent = gdprService.getCookieConsent() || {};
      const newConsent = {
        ...currentConsent,
        [consentType]: value
      };
      
      await gdprService.setCookieConsent(newConsent);
    } catch (error) {
      console.error('Failed to update GDPR consent:', error);
      // Revert the change
      setGDPRSettings(prev => ({ ...prev, [`${consentType}Consent`]: !value }));
    }
  };

  // Handle data export
  const handleDataExport = async () => {
    try {
      const response = await fetch('/api/gdpr/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-data-export.json';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  // Handle data deletion
  const handleDataDeletion = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/gdpr/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        alert('Data deletion request submitted. Your data will be deleted within 30 days.');
      }
    } catch (error) {
      console.error('Failed to request data deletion:', error);
      alert('Failed to request data deletion. Please try again.');
    }
  };

  // Handle labs toggle changes
  const handleLabsToggle = (demoKey: keyof typeof labsToggles) => {
    setLabsToggles(prev => ({
      ...prev,
      [demoKey]: !prev[demoKey]
    }));
  };

  // Update profile data
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileState({ loading: true, success: false, error: '' });

    try {
      // Update Supabase auth user
      const { error: authError } = await supabase.auth.updateUser({
        email: profileData.email,
        data: {
          first_name: profileData.firstName,
          last_name: profileData.lastName
        }
      });

      if (authError) throw authError;

      // Update profile in database
      const updateData: any = {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        email: profileData.email
      };
      
      // Only include bio if it's not empty
      if (profileData.bio.trim()) {
        updateData.bio = profileData.bio;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user?.id);

      if (profileError) throw profileError;

      setProfileState({ loading: false, success: true, error: '' });
      setTimeout(() => setProfileState(prev => ({ ...prev, success: false })), 3000);
    } catch (error: any) {
      setProfileState({ loading: false, success: false, error: error.message });
    }
  };

  // Update password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordState({ loading: true, success: false, error: '' });

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordState({ loading: false, success: false, error: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordState({ loading: false, success: false, error: 'Password must be at least 6 characters long' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordState({ loading: false, success: true, error: '' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordState(prev => ({ ...prev, success: false })), 3000);
    } catch (error: any) {
      setPasswordState({ loading: false, success: false, error: error.message });
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    const doubleConfirm = prompt('Type "DELETE" to confirm account deletion:');
    if (doubleConfirm !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      // This would typically involve a server-side process
      alert('Account deletion requested. Please contact support to complete this process.');
    } catch (error: any) {
      alert('Error requesting account deletion: ' + error.message);
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-[#002b36] p-4 sm:p-6 lg:p-8">
        {/* Header with Dark Mode Toggle */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-[#fdf6e3]">Settings</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-[#839496] mt-1">Manage your account settings and preferences.</p>
          </div>
          
          {/* Quick Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg bg-white dark:bg-[#073642] border border-gray-200 dark:border-[#586e75] shadow-sm hover:shadow-md transition-all touch-target"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? (
              <>
                <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline text-sm font-medium text-gray-900 dark:text-[#fdf6e3]">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-5 w-5 text-amber-500" />
                <span className="hidden sm:inline text-sm font-medium text-gray-900">Light</span>
              </>
            )}
          </button>
        </div>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border border-gray-200 dark:border-[#586e75] p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-4">Settings</h2>
            <nav className="space-y-2">
              <a href="#profile" className="flex items-center space-x-3 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 touch-target text-sm sm:text-base">
                <User className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Profile</span>
              </a>
              <a href="#notifications" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] touch-target">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Notifications</span>
              </a>
              <a href="#security" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] touch-target">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Security</span>
              </a>
              <a href="#accessibility" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] touch-target">
                <Eye className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Accessibility</span>
              </a>
              <a href="#privacy" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] touch-target">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Privacy & Data</span>
              </a>
              <a href="#preferences" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] touch-target">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="text-sm sm:text-base">Preferences</span>
              </a>
              <a href="#labs" className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-[#93a1a1] hover:bg-gray-50 dark:hover:bg-[#586e75] ml-4 sm:ml-8 touch-target">
                <Beaker className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">Labs</span>
              </a>
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
            
              {/* Profile Status Messages */}
              {profileState.success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm text-green-800 dark:text-green-200">Profile updated successfully!</span>
                </div>
              )}
              
              {profileState.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm text-red-800 dark:text-red-200">{profileState.error}</span>
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName"
                      type="text" 
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName"
                      type="text" 
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Your last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email"
                    type="email" 
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea 
                    id="bio"
                    rows={3} 
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#586e75] dark:text-[#fdf6e3] dark:border-[#657b83]"
                    placeholder="Tell us about yourself..."
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={profileState.loading}
                  className="w-full md:w-auto"
                >
                  {profileState.loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <div id="notifications" className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border border-gray-200 dark:border-[#586e75] p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-4">Notification Preferences</h3>
            
            {/* Notification Status Messages */}
            {notificationState.success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <span className="text-sm text-green-800 dark:text-green-200">Notification preferences updated successfully!</span>
              </div>
            )}

            {notificationState.error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                <span className="text-sm text-red-800 dark:text-red-200">{notificationState.error}</span>
              </div>
            )}

            {notifications.loading && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <span className="text-sm text-blue-800 dark:text-blue-200">Loading notification preferences...</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Email Notifications</h4>
                  <p className="text-sm text-gray-600 dark:text-[#839496]">Receive notifications via email</p>
                </div>
                <label className={`relative inline-flex items-center ${notifications.loading || notificationState.loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.email}
                    disabled={notifications.loading || notificationState.loading}
                    onChange={(e) => handleNotificationToggle('email', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Push Notifications</h4>
                  <p className="text-sm text-gray-600 dark:text-[#839496]">
                    Receive push notifications in your browser
                    {!isSupported && <span className="text-red-500 ml-1">(Not supported in this browser)</span>}
                    {isSupported && permission === 'denied' && <span className="text-orange-500 ml-1">(Permission denied)</span>}
                  </p>
                </div>
                <label className={`relative inline-flex items-center ${notifications.loading || notificationState.loading || !isSupported ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.push}
                    disabled={notifications.loading || notificationState.loading || !isSupported}
                    onChange={(e) => handleNotificationToggle('push', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">SMS Notifications</h4>
                  <p className="text-sm text-gray-600 dark:text-[#839496]">Receive text message notifications (Coming soon)</p>
                </div>
                <label className={`relative inline-flex items-center ${notifications.loading || notificationState.loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={notifications.sms}
                    disabled={notifications.loading || notificationState.loading}
                    onChange={(e) => handleNotificationToggle('sms', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Test Notification Button */}
              {notifications.push && isSupported && permission === 'granted' && (
                <div className="pt-4 border-t border-gray-200 dark:border-[#586e75]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Test Notifications</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Send a test notification to verify everything is working</p>
                    </div>
                    <button
                      onClick={handleTestNotification}
                      disabled={notifications.loading || notificationState.loading}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {notificationState.loading ? 'Sending...' : 'Send Test'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
            
              {/* Password Status Messages */}
              {passwordState.success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md flex items-center">
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  <span className="text-sm text-green-800 dark:text-green-200">Password updated successfully!</span>
                </div>
              )}
              
              {passwordState.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  <span className="text-sm text-red-800 dark:text-red-200">{passwordState.error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3] mb-4">Change Password</h4>
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword"
                        type="password" 
                        placeholder="Enter your current password" 
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword"
                        type="password" 
                        placeholder="Enter your new password" 
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword"
                        type="password" 
                        placeholder="Confirm your new password" 
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                    </div>
                    <Button 
                      type="submit"
                      disabled={passwordState.loading || !passwordData.newPassword || !passwordData.confirmPassword}
                      className="w-full md:w-auto"
                    >
                      {passwordState.loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </div>

                <div className="border-t border-gray-200 dark:border-[#586e75] pt-4">
                  <TwoFactorAuth />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accessibility Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Settings</CardTitle>
              <CardDescription>Customize your experience for better accessibility and usability.</CardDescription>
            </CardHeader>
            <CardContent>
            {accessibilitySettings.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* High Contrast */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Contrast className="h-5 w-5 text-gray-600 dark:text-[#839496]" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">High Contrast Mode</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Increase contrast for better visibility</p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={accessibilitySettings.highContrast}
                      onChange={(e) => handleAccessibilityChange('highContrast', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Makes text and UI elements easier to see for people with low vision</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Font Size */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Type className="h-5 w-5 text-gray-600 dark:text-[#839496]" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Font Size</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Adjust text size for better readability</p>
                    </div>
                  </div>
                  <Select 
                    value={accessibilitySettings.fontSize}
                    onValueChange={(value) => handleAccessibilityChange('fontSize', value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xlarge">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <MousePointer className="h-5 w-5 text-gray-600 dark:text-[#839496]" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Reduced Motion</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Minimize animations and motion effects</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={accessibilitySettings.reducedMotion}
                      onChange={(e) => handleAccessibilityChange('reducedMotion', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Keyboard Navigation */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-gray-600 dark:text-[#839496]" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Enhanced Keyboard Navigation</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Show focus indicators and enable keyboard shortcuts</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={accessibilitySettings.keyboardNavigation}
                      onChange={(e) => handleAccessibilityChange('keyboardNavigation', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Screen Reader Mode */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Eye className="h-5 w-5 text-gray-600 dark:text-[#839496]" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Screen Reader Optimization</h4>
                      <p className="text-sm text-gray-600 dark:text-[#839496]">Optimize interface for screen readers</p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={accessibilitySettings.screenReaderMode}
                      onChange={(e) => handleAccessibilityChange('screenReaderMode', e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Adds ARIA labels and improves keyboard navigation for screen reader users</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            </CardContent>
          </Card>

          {/* Privacy & Data Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy & Data Settings</CardTitle>
              <CardDescription>Manage your privacy preferences and data according to GDPR requirements.</CardDescription>
            </CardHeader>
            <CardContent>
            {gdprSettings.loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cookie Consent Management */}
                <div className="border-b border-gray-200 dark:border-[#586e75] pb-4">
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3] mb-3 flex items-center">
                    <Cookie className="h-5 w-5 text-gray-600 dark:text-[#839496] mr-2" />
                    Cookie Preferences
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-[#fdf6e3]">Essential Cookies</p>
                        <p className="text-sm text-gray-600 dark:text-[#839496]">Required for basic site functionality</p>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-[#839496]">Always Active</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-[#fdf6e3]">Functional Cookies</p>
                        <p className="text-sm text-gray-600 dark:text-[#839496]">Enable enhanced features and functionality</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={gdprSettings.functionalConsent}
                          onChange={(e) => handleGDPRConsentChange('functional', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-[#fdf6e3]">Analytics Cookies</p>
                        <p className="text-sm text-gray-600 dark:text-[#839496]">Help us understand how you use our site</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={gdprSettings.analyticsConsent}
                          onChange={(e) => handleGDPRConsentChange('analytics', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-[#fdf6e3]">Marketing Cookies</p>
                        <p className="text-sm text-gray-600 dark:text-[#839496]">Used for personalized advertising</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={gdprSettings.marketingConsent}
                          onChange={(e) => handleGDPRConsentChange('marketing', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Data Rights */}
                <div className="border-b border-gray-200 dark:border-[#586e75] pb-4">
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3] mb-3">Your Data Rights</h4>
                  <p className="text-sm text-gray-600 dark:text-[#839496] mb-4">
                    Under GDPR, you have the right to access, correct, or delete your personal data.
                  </p>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <button
                      onClick={handleDataExport}
                      className="flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 dark:border-[#657b83] rounded-lg hover:bg-gray-50 dark:hover:bg-[#586e75] transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export My Data</span>
                    </button>
                    
                    <button
                      onClick={handleDataDeletion}
                      className="flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete My Data</span>
                    </button>
                  </div>
                </div>

                {/* Privacy Information */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3] mb-3">Privacy Information</h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-[#839496]">
                    <p>• We process your data based on your consent and legitimate interests</p>
                    <p>• Your data is stored securely and only shared with necessary service providers</p>
                    <p>• You can withdraw consent at any time</p>
                    <p>• Data is retained according to legal requirements and your preferences</p>
                  </div>
                  <div className="mt-4">
                    <a 
                      href="/privacy" 
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                    >
                      Read Full Privacy Policy →
                    </a>
                  </div>
                </div>
              </div>
            )}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDarkMode ? <Moon className="h-5 w-5 text-gray-600 dark:text-[#839496]" /> : <Sun className="h-5 w-5 text-gray-600 dark:text-[#839496]" />}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-[#fdf6e3]">Dark Mode</h4>
                    <p className="text-sm text-gray-600 dark:text-[#839496]">Switch to {isDarkMode ? 'light' : 'dark'} theme</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isDarkMode}
                    onChange={toggleDarkMode}
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-[#657b83] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div>
                <Label htmlFor="language">Language</Label>
                <Select defaultValue="english">
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue="et">
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Pacific Time (PT)</SelectItem>
                    <SelectItem value="mt">Mountain Time (MT)</SelectItem>
                    <SelectItem value="ct">Central Time (CT)</SelectItem>
                    <SelectItem value="et">Eastern Time (ET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            </CardContent>
          </Card>

          {/* Labs Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Beaker className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2" />
                Labs
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-full">
                  Experimental
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
            <p className="text-sm text-gray-600 dark:text-[#839496] mb-6">
              Experimental features and demos. These features are in development and may change or be removed.
            </p>
            
            <div className="space-y-6">
              {/* V3 Treatment Demo with Toggle - HIDDEN FOR LABS FOCUS */}
              {/* 
              <div className="border border-gray-200 dark:border-[#586e75] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-900 dark:text-[#fdf6e3]">V3 Treatment Demo</h4>
                    <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 rounded-full">
                      Latest
                    </span>
                  </div>
                  <button
                    onClick={() => handleLabsToggle('v3TreatmentDemo')}
                    aria-label={`${labsToggles.v3TreatmentDemo ? 'Disable' : 'Enable'} V3 Treatment Demo`}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      labsToggles.v3TreatmentDemo
                        ? 'bg-indigo-600'
                        : 'bg-gray-200 dark:bg-[#586e75]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        labsToggles.v3TreatmentDemo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {labsToggles.v3TreatmentDemo && (
                  <div className="bg-gray-50 dark:bg-[#002b36]/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      <h5 className="font-medium text-gray-900 dark:text-[#fdf6e3]">V3 Treatment System</h5>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-[#839496] mb-3">
                      Next-generation treatment engine with enhanced state management and improved therapeutic protocols.
                    </p>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-[#839496] mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Enhanced state machine architecture</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Improved validation and text processing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Advanced integration capabilities</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>All 6 treatment modalities available</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <a
                        href="/dashboard/sessions/treatment-v3"
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                      >
                        Try V3 Treatment
                      </a>
                      <a
                        href="https://github.com/yourusername/mindshifting/tree/main/lib/v3"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
                      >
                        View V3 Code
                      </a>
                    </div>
                  </div>
                )}
              </div>
              */}

              {/* V4 Treatment Demo with Toggle */}
              <div className="border border-gray-200 dark:border-[#586e75] rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-900 dark:text-[#fdf6e3]">V4 Treatment (Labs)</h4>
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full">
                      Experimental
                    </span>
                  </div>
                  <button
                    onClick={() => handleLabsToggle('v4TreatmentDemo')}
                    aria-label={`${labsToggles.v4TreatmentDemo ? 'Disable' : 'Enable'} V4 Treatment Demo`}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      labsToggles.v4TreatmentDemo
                        ? 'bg-indigo-600'
                        : 'bg-gray-200 dark:bg-[#586e75]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        labsToggles.v4TreatmentDemo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {labsToggles.v4TreatmentDemo && (
                  <div className="bg-gray-50 dark:bg-[#002b36]/50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h5 className="font-medium text-gray-900 dark:text-[#fdf6e3]">V4 Treatment System (Labs)</h5>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-[#839496] mb-3">
                      Experimental copy of V3 for testing new features (voice integration, etc). Based on the latest stable V3 codebase with bug fixes.
                    </p>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-[#839496] mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>Based on latest V3 with all bug fixes</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>Isolated environment for experimentation</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>Voice module integration testing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span>All 6 treatment modalities available</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <a
                        href="/dashboard/sessions/treatment-v4"
                        className="flex-1 px-4 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                      >
                        Try V4 Treatment (Labs)
                      </a>
                      <a
                        href="https://github.com/yourusername/mindshifting/tree/main/lib/v4"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
                      >
                        View V4 Code
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Individual treatment modality demos - temporarily hidden for company review */}
              {/* 
              <RealityShiftingDemo />
              <BeliefShiftingDemo />
              <IdentityShiftingDemo />
              <BlockageShiftingDemo />
              <TraumaShiftingDemo />
              */}
            </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-900 dark:text-red-400">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-[#839496]">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button 
                  onClick={handleDeleteAccount}
                  variant="destructive"
                  className="w-full md:w-auto"
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
} 