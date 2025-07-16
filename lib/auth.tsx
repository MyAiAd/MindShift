'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from './database';
import { Profile, Tenant } from './database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  loading: boolean;
  signOut: () => Promise<void>;
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
            
            // Try to get current session to see if it's really gone
            const { data: currentSession } = await supabase.auth.getSession();
            console.log('Auth: Current session after SIGNED_OUT:', {
              hasSession: !!currentSession.session,
              hasUser: !!currentSession.session?.user,
              userEmail: currentSession.session?.user?.email,
              expiresAt: currentSession.session?.expires_at,
              accessToken: currentSession.session?.access_token ? 'present' : 'missing'
            });
            
            flushSync(() => {
              setUser(null);
              setProfile(null);
              setTenant(null);
              setSubscriptionTier(null);
              setLoading(false);
            });
            profileLoadingRef.current = false;
            profileLoadedRef.current = false;
            currentUserIdRef.current = null;
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
            
            // Update user state immediately
            console.log(`Auth: [${timestamp}] Setting user state directly`);
            flushSync(() => {
              setUser(session.user);
            });
            
            // Validate session immediately after setting user state
            console.log('Auth: Validating session after setting user state:', {
              sessionValid: !!session,
              tokenPresent: !!session.access_token,
              tokenExpiry: session.expires_at,
              currentTime: Math.floor(Date.now() / 1000),
              tokenExpired: session.expires_at ? session.expires_at < Math.floor(Date.now() / 1000) : 'unknown'
            });
            
            // Only refresh profile if it's a different user or if we don't have a profile yet
            if (currentUserIdRef.current !== session.user.id || !profileLoadedRef.current) {
              console.log(`Auth: [${timestamp}] Need to load profile for user`);
              currentUserIdRef.current = session.user.id;
              
              // Load profile directly in the event handler to avoid stale closures
              try {
                console.log('Auth: Fetching profile from database...');
                
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();

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
                  
                  // If profile doesn't exist, check if this is the first user for super admin setup
                  if (profileError.code === 'PGRST116') { // No rows returned
                    console.log('Auth: No profile found, checking for first user super admin setup...');
                    try {
                      const { data: superAdminResult, error: superAdminError } = await supabase
                        .rpc('handle_new_user_registration', {
                          user_id: session.user.id,
                          user_email: session.user.email,
                          user_first_name: session.user.user_metadata?.first_name,
                          user_last_name: session.user.user_metadata?.last_name,
                        });

                      if (superAdminError) {
                        console.error('Auth: Super admin setup error:', superAdminError);
                      } else if (superAdminResult) {
                        console.log('Auth: Super admin setup result:', superAdminResult);
                        
                        // Refetch profile after super admin setup
                        const { data: newProfileData, error: newProfileError } = await supabase
                          .from('profiles')
                          .select('*')
                          .eq('id', session.user.id)
                          .single();
                          
                        if (newProfileData) {
                          console.log('Auth: Profile created after super admin setup:', {
                            email: newProfileData.email,
                            role: newProfileData.role,
                            is_super_admin: newProfileData.role === 'super_admin'
                          });
                          
                          flushSync(() => {
                            setProfile(newProfileData);
                            setSubscriptionTier(newProfileData.subscription_tier || 'trial');
                          });
                          profileLoadedRef.current = true;
                        }
                      }
                    } catch (setupError) {
                      console.error('Auth: Super admin setup failed:', setupError);
                    }
                  }
                } else if (profileData) {
                  console.log('Auth: Profile loaded:', { 
                    email: profileData.email, 
                    role: profileData.role, 
                    tenant_id: profileData.tenant_id 
                  });
                  
                  // Set profile state directly
                  console.log(`Auth: [${timestamp}] Setting profile state directly`);
                  flushSync(() => {
                    setProfile(profileData);
                    setSubscriptionTier(profileData.subscription_tier || 'trial');
                  });
                  profileLoadedRef.current = true;

                  // Handle tenant
                  if (profileData.tenant_id) {
                    console.log('Auth: Fetching tenant data...');
                    try {
                      const { data: tenantData, error: tenantError } = await supabase
                        .from('tenants')
                        .select('*')
                        .eq('id', profileData.tenant_id)
                        .single();

                      if (tenantError) {
                        console.error('Auth: Error fetching tenant:', tenantError);
                      } else if (tenantData) {
                        console.log('Auth: Tenant loaded:', tenantData.name);
                        flushSync(() => {
                          setTenant(tenantData);
                        });
                      }
                    } catch (error) {
                      console.error('Auth: Tenant fetch failed:', error);
                    }
                  } else if (profileData.role === 'super_admin') {
                    console.log('Auth: Super admin detected, no tenant needed');
                    flushSync(() => {
                      setTenant(null);
                    });
                  }
                  
                  console.log(`Auth: [${timestamp}] Profile and tenant setup completed`);
                  
                  // Set loading to false after all state is set
                  flushSync(() => {
                    setLoading(false);
                  });
                  
                  console.log(`Auth: [${timestamp}] Authentication completed successfully!`);
                }
              } catch (error) {
                console.error('Auth: Unexpected error fetching profile:', error);
                flushSync(() => {
                  setLoading(false);
                });
              }
            } else {
              console.log('Auth: Same user, skipping profile refresh');
              flushSync(() => {
                setLoading(false);
              });
            }
          } else {
            console.log(`Auth: [${timestamp}] No user in session for event:`, event);
            if (event === 'INITIAL_SESSION') {
              // For INITIAL_SESSION with no user, check if we have any stored auth
              const storageKeys = Object.keys(localStorage).filter(key => 
                key.includes('myai-auth') || key.includes('supabase')
              );
              console.log('Auth: No initial session, storage keys found:', storageKeys);
              
              flushSync(() => {
                setUser(null);
                setProfile(null);
                setTenant(null);
                setSubscriptionTier(null);
                setLoading(false);
              });
              profileLoadedRef.current = false;
              currentUserIdRef.current = null;
            }
          }
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