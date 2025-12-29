'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/database';
import { useAuth } from '@/lib/auth';
import { Brain, Mail, Lock, User, Building2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    tenantName: '',
    tenantSlug: '',
  });
  
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
    
    // Auto-generate tenant slug from tenant name
    if (field === 'tenantName' && value) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      setFormData(prev => ({ ...prev, tenantSlug: slug }));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        console.log('Auth: User created successfully');
        
        // Check if email confirmation is required
        if (authData.session) {
          console.log('Auth: User is automatically signed in');
          
          // Check if this is the first user and handle super admin setup
          try {
            console.log('Auth: Checking for first user super admin setup...');
            const { data: superAdminResult, error: superAdminError } = await supabase
              .rpc('handle_new_user_registration', {
                user_id: authData.user.id,
                user_email: formData.email,
                user_first_name: formData.firstName,
                user_last_name: formData.lastName,
              });

            if (superAdminError) {
              console.error('Auth: Super admin setup error:', superAdminError);
            } else if (superAdminResult) {
              console.log('Auth: Super admin setup result:', superAdminResult);
              
              // If user became super admin, skip tenant creation
              if (superAdminResult.is_super_admin) {
                console.log('Auth: First user became super admin, skipping tenant creation');
                
                // Show success message
                setError(null);
                setSuccess('🎉 Welcome! You are now the Super Admin of this system.');
                
                // Redirect to dashboard after showing success message
                setTimeout(() => {
                  router.push('/dashboard');
                }, 2000);
                return;
              }
            }
          } catch (superAdminError) {
            console.error('Auth: Super admin setup failed:', superAdminError);
            // Continue with normal tenant creation if super admin setup fails
          }
          
          // User is already signed in, create tenant and profile (for regular users)
          const response = await fetch('/api/tenants', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.tenantName,
              slug: formData.tenantSlug,
              adminEmail: formData.email,
              adminFirstName: formData.firstName,
              adminLastName: formData.lastName,
            }),
          });

          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Failed to create organization');
          }

          console.log('Auth: Tenant created successfully, redirecting...');
          
          // Redirect to dashboard
          router.push('/dashboard');
        } else {
          // Email confirmation required
          console.log('Auth: Email confirmation required');
          setError('Please check your email and click the confirmation link to complete your registration.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Brain className="h-12 w-12 text-primary" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
                          {isSignUp ? 'Start your mindset transformation journey' : 'Welcome back to MindShifting'}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-accent/10 border border-accent text-accent px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={isSignUp ? handleSignUp : handleSignIn}>
          <div className="space-y-4">
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
                      First Name
                    </label>
                    <div className="mt-1 relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        id="firstName"
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="appearance-none rounded-md relative block w-full px-10 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                        placeholder="John"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
                      Last Name
                    </label>
                    <div className="mt-1 relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        id="lastName"
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="appearance-none rounded-md relative block w-full px-10 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="tenantName" className="block text-sm font-medium text-foreground">
                    Organization Name
                  </label>
                  <div className="mt-1 relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="tenantName"
                      type="text"
                      required
                      value={formData.tenantName}
                      onChange={(e) => handleInputChange('tenantName', e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-10 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                      placeholder="Acme Corporation"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tenantSlug" className="block text-sm font-medium text-foreground">
                    Organization URL
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-secondary/20 text-muted-foreground text-sm">
                      myai.app/
                    </span>
                    <input
                      id="tenantSlug"
                      type="text"
                      required
                      value={formData.tenantSlug}
                      onChange={(e) => handleInputChange('tenantSlug', e.target.value)}
                      className="appearance-none rounded-none rounded-r-md relative block w-full px-3 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                      placeholder="acme-corp"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email Address
              </label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-10 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="john@acme.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-10 py-3 bg-background border border-border placeholder-muted-foreground text-foreground focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:text-primary/90 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 