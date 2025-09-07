'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Video, Phone, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  settings?: string; // JSON string containing specialties and preferences
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingComplete: (booking: any) => void;
}

interface BookingForm {
  title: string;
  description: string;
  coachId: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingType: 'video' | 'phone' | 'in_person' | 'zoom' | 'google_meet' | 'teams';
  meetingLink: string;
}

const sessionTypes = [
  'Goal Setting',
  'Confidence Building', 
  'Stress Management',
  'Career Development',
  'Relationship Coaching',
  'Performance Coaching',
  'Life Transition Support',
  'Mindfulness Training',
  'Custom Session'
];

const meetingTypes = [
  { value: 'video', label: 'Video Call', icon: Video },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'zoom', label: 'Zoom Meeting', icon: Video },
  { value: 'google_meet', label: 'Google Meet', icon: Video },
  { value: 'teams', label: 'Microsoft Teams', icon: Video },
  { value: 'in_person', label: 'In Person', icon: MapPin }
];

const durations = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' }
];

export default function BookingModal({ isOpen, onClose, onBookingComplete }: BookingModalProps) {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<BookingForm>({
    title: '',
    description: '',
    coachId: '',
    scheduledAt: '',
    durationMinutes: 60,
    meetingType: 'video',
    meetingLink: ''
  });

  // Generate time slots for the next 30 days
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    
    for (let day = 1; day <= 30; day++) {
      const date = new Date(now);
      date.setDate(now.getDate() + day);
      
      // Skip weekends for business hours
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // Generate slots from 9 AM to 5 PM
      for (let hour = 9; hour <= 17; hour++) {
        const slotDate = new Date(date);
        slotDate.setHours(hour, 0, 0, 0);
        
        // Only show future slots
        if (slotDate > now) {
          slots.push({
            value: slotDate.toISOString(),
            label: slotDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })
          });
        }
      }
    }
    
    return slots.slice(0, 50); // Limit to 50 slots
  };

  const timeSlots = generateTimeSlots();

  useEffect(() => {
    if (isOpen) {
      fetchCoaches();
    }
  }, [isOpen]);

  const fetchCoaches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/coaches');
      
      if (response.ok) {
        const data = await response.json();
        setCoaches(data.coaches || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch coaches');
      }
    } catch (error) {
      console.error('Error fetching coaches:', error);
      setError('Failed to load coaches');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BookingForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);

    // Auto-generate meeting link for certain meeting types
    if (field === 'meetingType') {
      let meetingLink = '';
      if (value === 'zoom') {
        meetingLink = 'https://zoom.us/j/'; // Placeholder - would integrate with Zoom API
      } else if (value === 'google_meet') {
        meetingLink = 'https://meet.google.com/'; // Placeholder - would integrate with Google Meet API
      } else if (value === 'teams') {
        meetingLink = 'https://teams.microsoft.com/'; // Placeholder - would integrate with Teams API
      }
      setFormData(prev => ({ ...prev, meetingLink }));
    }

    // Reset coach selection when session type changes
    if (field === 'title' && sessionTypes.includes(value)) {
      // Clear coach selection to force user to select from filtered list
      setFormData(prev => ({ 
        ...prev, 
        coachId: '',
        description: `${value} session` 
      }));
    }
  };

  // Filter coaches based on selected session type
  const getFilteredCoaches = () => {
    if (!formData.title || formData.title === 'Custom Session') {
      // For custom sessions or no selection, show all coaches
      return coaches;
    }

    // Filter coaches by their specialties
    return coaches.filter(coach => {
      try {
        // Handle both string and object settings
        let settings: any = {};
        if (coach.settings) {
          if (typeof coach.settings === 'string') {
            settings = JSON.parse(coach.settings);
          } else if (typeof coach.settings === 'object') {
            settings = coach.settings;
          }
        }
        
        const specialties = settings?.specialties || [];
        
        // Check if coach specializes in the selected session type
        return Array.isArray(specialties) && specialties.includes(formData.title);
      } catch (error) {
        console.error('Error parsing coach settings:', error, coach);
        // If parsing fails, include the coach to be safe
        return true;
      }
    });
  };

  const filteredCoaches = getFilteredCoaches();

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Session title is required';
    if (!formData.coachId) return 'Please select a coach';
    if (!formData.scheduledAt) return 'Please select a date and time';
    if (formData.durationMinutes < 15) return 'Session must be at least 15 minutes';
    if (['video', 'zoom', 'google_meet', 'teams'].includes(formData.meetingType) && !formData.meetingLink.trim()) {
      return 'Meeting link is required for online sessions';
    }
    
    // Check if scheduled time is in the future
    const scheduledDate = new Date(formData.scheduledAt);
    if (scheduledDate <= new Date()) {
      return 'Scheduled time must be in the future';
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

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          coachId: formData.coachId,
          clientId: user?.id, // Current user is the client
          scheduledAt: formData.scheduledAt,
          durationMinutes: formData.durationMinutes,
          meetingLink: formData.meetingLink || null,
          meetingType: formData.meetingType
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('Session booked successfully!');
        onBookingComplete(data.session);
        
        // Reset form and close modal after a delay
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to book session');
      }
    } catch (error) {
      console.error('Error booking session:', error);
      setError('Failed to book session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      coachId: '',
      scheduledAt: '',
      durationMinutes: 60,
      meetingType: 'video',
      meetingLink: ''
    });
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Book a Coaching Session</h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={submitting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Session Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Type *
              </label>
              <select
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
                disabled={submitting}
              >
                <option value="">Select a session type...</option>
                {sessionTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Custom title if "Custom Session" is selected */}
            {formData.title === 'Custom Session' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Session Title *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter custom session title..."
                  required
                  disabled={submitting}
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Session Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                placeholder="Describe what you'd like to focus on in this session..."
                disabled={submitting}
              />
            </div>

            {/* Coach Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preferred Coach *
                {formData.title && formData.title !== 'Custom Session' && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                    (Showing {formData.title} specialists)
                  </span>
                )}
              </label>
              {loading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading coaches...</span>
                </div>
              ) : (
                <select
                  value={formData.coachId}
                  onChange={(e) => handleInputChange('coachId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={submitting}
                >
                  <option value="">
                    {formData.title && formData.title !== 'Custom Session' 
                      ? `Select a ${formData.title} coach...` 
                      : 'Select a coach...'
                    }
                  </option>
                  {filteredCoaches.map(coach => (
                    <option key={coach.id} value={coach.id}>
                      {coach.first_name} {coach.last_name} ({coach.role})
                    </option>
                  ))}
                  {formData.title && formData.title !== 'Custom Session' && filteredCoaches.length === 0 && (
                    <option value="" disabled>
                      No coaches available for {formData.title}
                    </option>
                  )}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date & Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date & Time *
                </label>
                <select
                  value={formData.scheduledAt}
                  onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={submitting}
                >
                  <option value="">Select date & time...</option>
                  {timeSlots.map(slot => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duration *
                </label>
                <select
                  value={formData.durationMinutes}
                  onChange={(e) => handleInputChange('durationMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={submitting}
                >
                  {durations.map(duration => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meeting Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meeting Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {meetingTypes.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInputChange('meetingType', type.value)}
                      className={`p-3 border rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                        formData.meetingType === type.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                      disabled={submitting}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs text-center">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meeting Link */}
            {['video', 'zoom', 'google_meet', 'teams'].includes(formData.meetingType) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meeting Link *
                </label>
                <input
                  type="url"
                  value={formData.meetingLink}
                  onChange={(e) => handleInputChange('meetingLink', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="https://..."
                  required
                  disabled={submitting}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the meeting link or we'll help generate one for you
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                disabled={submitting || loading}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Booking...
                  </>
                ) : (
                  'Book Session'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 