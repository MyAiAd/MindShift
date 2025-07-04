'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from './database';
import { Profile, Tenant } from './database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasFeatureAccess: (featureKey: string) => boolean;
  subscriptionTier: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  
  // Use refs to track state and prevent duplicate calls
  const profileLoadingRef = useRef(false);
  const profileLoadedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  
  // Get the singleton client once and store in ref to prevent recreation
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Debug: Track AuthProvider instances
  useEffect(() => {
    const instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`Auth: AuthProvider instance created [${instanceId}]`);
    
    return () => {
      console.log(`Auth: AuthProvider instance destroyed [${instanceId}]`);
    };
  }, []);

  const refreshProfile = async (currentUser?: User) => {
    const userToUse = currentUser || user;
    
    if (!userToUse) {
      console.log('Auth: No user found, skipping profile refresh');
      return;
    }

    // Prevent duplicate calls for the same user
    if (profileLoadingRef.current) {
      console.log('Auth: Profile refresh already in progress, skipping');
      return;
    }

    // Skip if we already have a profile for this user
    if (profileLoadedRef.current && currentUserIdRef.current === userToUse.id && !currentUser) {
      console.log('Auth: Profile already loaded for this user, skipping');
      return;
    }

    console.log('Auth: Starting profile refresh for user:', userToUse.email);
    profileLoadingRef.current = true;
    currentUserIdRef.current = userToUse.id;

    try {
      // Shorter timeout to fail faster
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      console.log('Auth: Fetching profile from database...');
      
      // Get user profile with timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userToUse.id)
        .single();

      const { data: profileData, error: profileError } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      console.log('Auth: Profile query completed', {
        hasData: !!profileData,
        hasError: !!profileError,
        errorCode: profileError?.code,
        errorMessage: profileError?.message
      });

      if (profileError) {
        console.error('Auth: Error fetching profile:', profileError);
        console.log('Auth: Profile error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        return;
      }

      if (profileData) {
        console.log('Auth: Profile loaded:', { 
          email: profileData.email, 
          role: profileData.role, 
          tenant_id: profileData.tenant_id 
        });
        
        // Use functional updates to ensure state is set correctly
        setProfile(prevProfile => {
          console.log('Auth: Setting profile state - previous:', !!prevProfile, 'new:', !!profileData);
          return profileData;
        });
        
        setSubscriptionTier(profileData.subscription_tier || 'trial');
        profileLoadedRef.current = true;

        // Immediate verification that state update was queued
        setTimeout(() => {
          console.log('Auth: Immediate profile state check after setProfile:', {
            profileSet: !!profile,
            profileEmail: profile?.email,
            expectedEmail: profileData.email
          });
        }, 1);

        // Get tenant information (skip for super admins)
        if (profileData.tenant_id) {
          console.log('Auth: Fetching tenant data...');
          try {
            const { data: tenantData, error: tenantError } = await Promise.race([
              supabase
                .from('tenants')
                .select('*')
                .eq('id', profileData.tenant_id)
                .single(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tenant fetch timeout')), 3000)
              )
            ]) as any;

            console.log('Auth: Tenant query completed', {
              hasData: !!tenantData,
              hasError: !!tenantError
            });

            if (tenantError) {
              console.error('Auth: Error fetching tenant:', tenantError);
            } else if (tenantData) {
              console.log('Auth: Tenant loaded:', tenantData.name);
              setTenant(prevTenant => {
                console.log('Auth: Setting tenant state - previous:', !!prevTenant, 'new:', !!tenantData);
                return tenantData;
              });
            }
          } catch (error) {
            console.error('Auth: Tenant fetch failed:', error);
          }
        } else if (profileData.role === 'super_admin') {
          console.log('Auth: Super admin detected, no tenant needed');
          setTenant(prevTenant => {
            console.log('Auth: Setting tenant to null - previous:', !!prevTenant);
            return null;
          });
        }
        console.log('Auth: Profile refresh completed successfully');
      } else {
        console.log('Auth: No profile data found');
      }
    } catch (error) {
      console.error('Auth: Unexpected error fetching profile:', error);
      console.log('Auth: Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      profileLoadingRef.current = false;
      console.log('Auth: Profile refresh finished - checking auth state...');
      
      // Check if we're still authenticated after the profile refresh
      // Use longer delay to allow React state updates to process
      setTimeout(() => {
        console.log('Auth: Post-refresh check - current user state:', {
          hasUser: !!user,
          hasProfile: !!profile,
          userEmail: user?.email,
          profileEmail: profile?.email,
          currentUserId: currentUserIdRef.current,
          profileLoaded: profileLoadedRef.current
        });
        
        // Additional check - verify state consistency
        if (currentUserIdRef.current && (!user || !profile)) {
          console.warn('Auth: STATE INCONSISTENCY DETECTED!', {
            refHasUserId: !!currentUserIdRef.current,
            stateHasUser: !!user,
            stateHasProfile: !!profile,
            refProfileLoaded: profileLoadedRef.current
          });
        }
      }, 500); // Longer delay to ensure state updates have processed
    }
  };

  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!profile || !subscriptionTier) return false;
    
    // Super admins have access to all features
    if (profile.role === 'super_admin') return true;
    
    // Define feature access rules
    const featureRules: Record<string, string[]> = {
      'problem_shifting': ['trial', 'level_1', 'level_2'],
      'advanced_methods': ['level_2'],
      'ai_insights': ['level_2'],
      'unlimited_sessions': ['level_2'],
      'priority_support': ['level_2'],
      'advanced_analytics': ['level_2'],
      'team_management': ['level_2'],
    };

    const allowedTiers = featureRules[featureKey];
    if (!allowedTiers) return false;

    return allowedTiers.includes(subscriptionTier);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setTenant(null);
    setSubscriptionTier(null);
    profileLoadedRef.current = false;
    currentUserIdRef.current = null;
  };

  useEffect(() => {
    let mounted = true;

    console.log('Auth: Setting up auth state listener (no manual session check)');

    // Listen for auth changes - let Supabase handle session detection
    let debounceTimer: NodeJS.Timeout;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        
        // Clear previous timer
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        // Debounce rapid auth events
        debounceTimer = setTimeout(async () => {
          const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
          console.log(`Auth: [${timestamp}] State change event:`, event, session?.user?.email || 'no user');
          
          // Handle different auth events
          if (event === 'SIGNED_OUT') {
            console.log(`Auth: [${timestamp}] Handling SIGNED_OUT event`);
            console.log('Auth: SIGNED_OUT triggered - checking what might have caused it');
            setUser(null);
            setProfile(null);
            setTenant(null);
            setSubscriptionTier(null);
            profileLoadedRef.current = false;
            currentUserIdRef.current = null;
            setLoading(false);
            return;
          }
          
          if (session?.user) {
            if (event === 'INITIAL_SESSION') {
              console.log(`Auth: [${timestamp}] Handling INITIAL_SESSION with user:`, session.user.email);
              console.log('Auth: Session details:', {
                access_token: session.access_token ? 'present' : 'missing',
                refresh_token: session.refresh_token ? 'present' : 'missing',
                expires_at: session.expires_at,
                user_id: session.user.id
              });
            } else {
              console.log(`Auth: [${timestamp}] Handling`, event, 'with user:', session.user.email);
            }
            
            // Only refresh if it's a different user or if we don't have a profile yet
            if (currentUserIdRef.current !== session.user.id || !profileLoadedRef.current) {
              console.log(`Auth: [${timestamp}] About to start profile refresh...`);
              
              // Update user state immediately and synchronously
              setUser(session.user);
              
              // Force a small delay to ensure state update takes effect
              await new Promise(resolve => setTimeout(resolve, 10));
              
              await refreshProfile(session.user);
              console.log(`Auth: [${timestamp}] Profile refresh completed`);
            } else {
              console.log('Auth: Same user, skipping profile refresh');
              // Ensure user state is set even if skipping profile refresh
              setUser(session.user);
            }
          } else {
            console.log(`Auth: [${timestamp}] No user in session for event:`, event);
            if (event === 'INITIAL_SESSION') {
              // For INITIAL_SESSION with no user, check if we have any stored auth
              const storageKeys = Object.keys(localStorage).filter(key => 
                key.includes('mindshift-auth') || key.includes('supabase')
              );
              console.log('Auth: No initial session, storage keys found:', storageKeys);
              
              setUser(null);
              setProfile(null);
              setTenant(null);
              setSubscriptionTier(null);
              profileLoadedRef.current = false;
              currentUserIdRef.current = null;
            }
          }
          setLoading(false);
        }, 50); // Reduced debounce time for faster response
      }
    );

    return () => {
      mounted = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - run once on mount

  const value = {
    user,
    profile,
    tenant,
    loading,
    signOut,
    refreshProfile,
    hasFeatureAccess,
    subscriptionTier,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useTenant() {
  const { tenant } = useAuth();
  return tenant;
}

export function useProfile() {
  const { profile } = useAuth();
  return profile;
}

export function useRole() {
  const { profile } = useAuth();
  return profile?.role || 'user';
}

export function hasRole(role: string | string[], userRole?: string) {
  if (!userRole) return false;
  
  if (Array.isArray(role)) {
    return role.includes(userRole);
  }
  
  return userRole === role;
}

export function isTenantAdmin(userRole?: string) {
  return hasRole(['tenant_admin', 'super_admin'], userRole);
}

export function isCoach(userRole?: string) {
  return hasRole(['coach', 'manager', 'tenant_admin', 'super_admin'], userRole);
}

export function isManager(userRole?: string) {
  return hasRole(['manager', 'tenant_admin', 'super_admin'], userRole);
} 