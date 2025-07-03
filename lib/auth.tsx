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
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  
  const supabase = createClient();

  const refreshProfile = async () => {
    if (!user) return;

    try {
      // Get user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setSubscriptionTier(profileData.subscription_tier || 'trial');

        // Get tenant information
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profileData.tenant_id)
          .single();

        if (tenantData) {
          setTenant(tenantData);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const hasFeatureAccess = (featureKey: string): boolean => {
    if (!profile || !subscriptionTier) return false;
    
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
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await refreshProfile();
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await refreshProfile();
        } else {
          setUser(null);
          setProfile(null);
          setTenant(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      refreshProfile();
    }
  }, [user?.id]);

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