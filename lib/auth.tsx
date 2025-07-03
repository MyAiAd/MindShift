'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  
  const supabase = createClient();

  const refreshProfile = async (currentUser?: User) => {
    console.log('Auth: refreshProfile called with currentUser:', !!currentUser, 'state user:', !!user);
    console.log('Auth: currentUser details:', currentUser ? { id: currentUser.id, email: currentUser.email } : 'null');
    console.log('Auth: state user details:', user ? { id: user.id, email: user.email } : 'null');
    
    const userToUse = currentUser || user;
    
    if (!userToUse) {
      console.log('Auth: No user found, skipping profile refresh (currentUser:', !!currentUser, 'user:', !!user, ')');
      return;
    }

    if (profileLoading) {
      console.log('Auth: Profile refresh already in progress, skipping');
      return;
    }

    // Skip if we already have a profile for this user (unless explicitly called with a user parameter)
    if (profileLoaded && profile?.id === userToUse.id && !currentUser) {
      console.log('Auth: Profile already loaded for this user, skipping');
      return;
    }

    console.log('Auth: Starting profile refresh for user:', userToUse.id, 'passed user:', !!currentUser, 'state user:', !!user);
    setProfileLoading(true);

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );

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

      if (profileError) {
        console.error('Auth: Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        console.log('Auth: Profile loaded:', { 
          email: profileData.email, 
          role: profileData.role, 
          tenant_id: profileData.tenant_id 
        });
        
        setProfile(profileData);
        setSubscriptionTier(profileData.subscription_tier || 'trial');
        setProfileLoaded(true);

        // Get tenant information (skip for super admins)
        if (profileData.tenant_id) {
          const tenantPromise = supabase
            .from('tenants')
            .select('*')
            .eq('id', profileData.tenant_id)
            .single();

          const { data: tenantData, error: tenantError } = await Promise.race([
            tenantPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Tenant fetch timeout')), 5000)
            )
          ]) as any;

          if (tenantError) {
            console.error('Auth: Error fetching tenant:', tenantError);
          } else if (tenantData) {
            console.log('Auth: Tenant loaded:', tenantData.name);
            setTenant(tenantData);
          }
        } else if (profileData.role === 'super_admin') {
          // Super admins don't have a tenant, set to null explicitly
          console.log('Auth: Super admin detected, no tenant needed');
          setTenant(null);
        }
        console.log('Auth: Profile refresh completed successfully');
      } else {
        console.log('Auth: No profile data found');
      }
    } catch (error) {
      console.error('Auth: Unexpected error fetching profile:', error);
      // Don't retry immediately to prevent loops
    } finally {
      setProfileLoading(false);
      console.log('Auth: Profile refresh finished');
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
    setProfileLoaded(false);
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('Auth: Getting initial session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth: Error getting session:', error);
      }
      
      if (session?.user) {
        console.log('Auth: Initial session found for user:', session.user.email);
        setUser(session.user);
        await refreshProfile(session.user);
      } else {
        console.log('Auth: No initial session found');
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth: State change event:', event, session?.user?.email || 'no user');
        
        if (session?.user) {
          setUser(session.user);
          await refreshProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
          setSubscriptionTier(null);
          setProfileLoaded(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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