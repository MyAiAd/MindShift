'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  User, 
  Save, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  Video, 
  Phone, 
  MapPin,
  Award
} from 'lucide-react';
import AvailabilityCalendar from '@/components/coach/AvailabilityCalendar';

interface CoachProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  specialties: string[];
  preferredMeetingTypes: string[];
  bio: string;
  credentials: string;
  availabilityNotes: string;
}

interface FormState {
  loading: boolean;
  success: boolean;
  error: string;
}

const availableSpecialties = [
  'Goal Setting',
  'Confidence Building',
  'Stress Management',
  'Career Development',
  'Relationship Coaching',
  'Performance Coaching',
  'Life Transition Support',
  'Mindfulness Training',
  'General Coaching',
  'Custom Session'
];

const meetingTypeOptions = [
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'zoom', label: 'Zoom Meeting', icon: Video },
  { value: 'google_meet', label: 'Google Meet', icon: Video },
  { value: 'teams', label: 'Microsoft Teams', icon: Video },
  { value: 'in_person', label: 'In Person', icon: MapPin }
];

export default function CoachProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [formState, setFormState] = useState<FormState>({ 
    loading: false, 
    success: false, 
    error: '' 
  });
  const [initialLoading, setInitialLoading] = useState(true);

  // Form data state
  const [formData, setFormData] = useState({
    specialties: [] as string[],
    preferredMeetingTypes: [] as string[],
    bio: '',
    credentials: '',
    availabilityNotes: ''
  });

  // Check if user has coach permissions
  const hasCoachPermissions = profile && ['coach', 'manager', 'tenant_admin', 'super_admin'].includes(profile.role || '');

  useEffect(() => {
    if (user && hasCoachPermissions) {
      fetchCoachProfile();
    } else if (!authLoading && !hasCoachPermissions) {
      setFormState({ loading: false, success: false, error: 'Coach permissions required' });
      setInitialLoading(false);
    }
  }, [user, hasCoachPermissions, authLoading]);

  const fetchCoachProfile = async () => {
    try {
      setInitialLoading(true);
      const response = await fetch('/api/coaches/profile');
      
      if (response.ok) {
        const data = await response.json();
        setCoachProfile(data.profile);
        setFormData({
          specialties: data.profile.specialties || [],
          preferredMeetingTypes: data.profile.preferredMeetingTypes || [],
          bio: data.profile.bio || '',
          credentials: data.profile.credentials || '',
          availabilityNotes: data.profile.availabilityNotes || ''
        });
      } else {
        const errorData = await response.json();
        setFormState({ loading: false, success: false, error: errorData.error || 'Failed to load profile' });
      }
    } catch (error) {
      console.error('Error fetching coach profile:', error);
      setFormState({ loading: false, success: false, error: 'Failed to load profile' });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
    setFormState(prev => ({ ...prev, success: false, error: '' }));
  };

  const handleMeetingTypeToggle = (meetingType: string) => {
    setFormData(prev => ({
      ...prev,
      preferredMeetingTypes: prev.preferredMeetingTypes.includes(meetingType)
        ? prev.preferredMeetingTypes.filter(t => t !== meetingType)
        : [...prev.preferredMeetingTypes, meetingType]
    }));
    setFormState(prev => ({ ...prev, success: false, error: '' }));
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormState(prev => ({ ...prev, success: false, error: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.specialties.length === 0) {
      setFormState({ loading: false, success: false, error: 'Please select at least one specialty' });
      return;
    }

    if (formData.preferredMeetingTypes.length === 0) {
      setFormState({ loading: false, success: false, error: 'Please select at least one preferred meeting type' });
      return;
    }

    setFormState({ loading: true, success: false, error: '' });

    try {
      const response = await fetch('/api/coaches/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialties: formData.specialties,
          preferredMeetingTypes: formData.preferredMeetingTypes,
          bio: formData.bio.trim(),
          credentials: formData.credentials.trim(),
          availabilityNotes: formData.availabilityNotes.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCoachProfile(data.profile);
        setFormState({ loading: false, success: true, error: '' });
      } else {
        const errorData = await response.json();
        setFormState({ loading: false, success: false, error: errorData.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Error updating coach profile:', error);
      setFormState({ loading: false, success: false, error: 'Failed to update profile. Please try again.' });
    }
  };

  if (authLoading || initialLoading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading coach profile...</p>
        </div>
      </div>
    );
  }

  if (!hasCoachPermissions) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h3>
          <p className="text-red-700">You need coach permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3">
          <User className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Coach Profile</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage your coaching specialties, preferences, and professional information
            </p>
          </div>
        </div>
      </div>

      {formState.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{formState.error}</p>
          </div>
        </div>
      )}

      {formState.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-green-700">Coach profile updated successfully!</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={coachProfile?.firstName || ''}
                disabled
                aria-label="First Name (read-only)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Update in main settings</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={coachProfile?.lastName || ''}
                disabled
                aria-label="Last Name (read-only)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Update in main settings</p>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Star className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Coaching Specialties</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Select the areas you specialize in. Clients will see coaches filtered by these specialties when booking sessions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableSpecialties.map(specialty => (
              <label
                key={specialty}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.specialties.includes(specialty)
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.specialties.includes(specialty)}
                  onChange={() => handleSpecialtyToggle(specialty)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${
                  formData.specialties.includes(specialty)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-300'
                }`}>
                  {formData.specialties.includes(specialty) && (
                    <CheckCircle className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {specialty}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Meeting Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Video className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Preferred Meeting Types</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Select your preferred meeting formats. Clients will only see these options when booking with you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {meetingTypeOptions.map(type => {
              const Icon = type.icon;
              return (
                <label
                  key={type.value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.preferredMeetingTypes.includes(type.value)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.preferredMeetingTypes.includes(type.value)}
                    onChange={() => handleMeetingTypeToggle(type.value)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${
                    formData.preferredMeetingTypes.includes(type.value)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300'
                  }`}>
                    {formData.preferredMeetingTypes.includes(type.value) && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <Icon className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {type.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Professional Bio</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Write a brief description of your coaching background and approach. This will be shown to clients.
          </p>
          <textarea
            rows={4}
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            placeholder="Tell clients about your coaching experience, approach, and what makes you unique..."
            maxLength={500}
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {formData.bio.length}/500 characters
          </div>
        </div>

        {/* Credentials */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Award className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Credentials & Certifications</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            List your relevant certifications, degrees, or professional qualifications.
          </p>
          <textarea
            rows={3}
            value={formData.credentials}
            onChange={(e) => handleInputChange('credentials', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            placeholder="e.g., Certified Life Coach (ICF), Master's in Psychology, 10+ years experience..."
            maxLength={300}
          />
          <div className="text-right text-xs text-gray-500 mt-1">
            {formData.credentials.length}/300 characters
          </div>
        </div>

        {/* Availability Calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
          <AvailabilityCalendar 
            coachId={coachProfile?.id} 
            readOnly={!hasCoachPermissions}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={formState.loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
          >
            {formState.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 