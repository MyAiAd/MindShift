'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/database';
import { 
  Brain, 
  Mail, 
  Lock, 
  User, 
  Building2, 
  Loader2, 
  CheckCircle,
  AlertCircle,
  UserCheck
} from 'lucide-react';

interface InvitationDetails {
  email: string;
  first_name?: string;
  last_name?: string;
  tenant_name: string;
  expires_at: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function CoachSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setInvitationToken(token);
      validateInvitation(token);
    } else {
      setError('Invalid invitation link. Please check your email for the correct link.');
      setLoading(false);
    }
  }, [searchParams]);

  const validateInvitation = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/coach-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'validate' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInvitation(data.invitation);
          setFormData(prev => ({
            ...prev,
            email: data.invitation.email,
            firstName: data.invitation.first_name || '',
            lastName: data.invitation.last_name || ''
          }));
        } else {
          setError(data.error || 'Invalid invitation');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to validate invitation');
      }
    } catch (error) {
      console.error('Error validating invitation:', error);
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const validateForm = (): string | null => {
    if (!formData.firstName.trim()) return 'First name is required';
    if (!formData.lastName.trim()) return 'Last name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!formData.password) return 'Password is required';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    
    // Basic password strength check
    const hasUpperCase = /[A-Z]/.test(formData.password);
    const hasLowerCase = /[a-z]/.test(formData.password);
    const hasNumbers = /\d/.test(formData.password);
    const hasNonalphas = /\W/.test(formData.password);
    
    if (!(hasUpperCase && hasLowerCase && hasNumbers && hasNonalphas)) {
      return 'Password must contain uppercase, lowercase, number, and special character';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!invitationToken) {
      setError('Invalid invitation token');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            invitation_token: invitationToken
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Accept the invitation and create coach profile
        const response = await fetch('/api/auth/coach-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            token: invitationToken, 
            action: 'accept',
            userId: authData.user.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSuccess('Coach account created successfully! Please check your email to verify your account, then you can sign in.');
            
            // Clear form
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              password: '',
              confirmPassword: ''
            });
            
            // Redirect to sign in after a delay
            setTimeout(() => {
              router.push('/auth?message=Coach account created successfully. Please sign in.');
            }, 3000);
          } else {
            throw new Error(data.error || 'Failed to complete coach registration');
          }
        } else {
          throw new Error('Failed to complete coach registration');
        }
      }
    } catch (error: any) {
      console.error('Error creating coach account:', error);
      setError(error.message || 'Failed to create coach account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Validating invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Invalid Invitation
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => router.push('/auth')}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <UserCheck className="h-8 w-8 text-indigo-600" />
              <Brain className="h-8 w-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Complete Your Coach Registration
            </h1>
            {invitation && (
              <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                    {invitation.tenant_name}
                  </span>
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  You've been invited to join as a coach
                </p>
              </div>
            )}
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <p className="text-green-700">{success}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name *
                </label>
                <div className="relative">
                  <User className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="First name"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name *
                </label>
                <div className="relative">
                  <User className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Last name"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white bg-gray-50"
                  placeholder="your@email.com"
                  required
                  disabled={true} // Email is pre-filled from invitation
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email is pre-filled from your invitation</p>
            </div>

            {/* Password Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password *
              </label>
              <div className="relative">
                <Lock className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Create a strong password"
                  required
                  disabled={submitting}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be 8+ characters with uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Confirm your password"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Account...
                </>
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/auth')}
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 