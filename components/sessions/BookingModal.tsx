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

    // Meeting type selection - no link generation needed (coach provides links)
    if (field === 'meetingType') {
      // Just update the meeting type, coach will provide the link later
      setFormData(prev => ({ ...prev, meetingType: value }));
    }

    // Reset coach selection when session type changes
    if (field === 'title' && sessionTypes.includes(value)) {
      // Clear coach selection to force user to select from filtered list
      setFormData(prev => ({ 
        ...prev, 
        coachId: '',
        meetingType: 'video', // Reset to default meeting type
        meetingLink: '', // Coach will provide link later
        description: `${value} session` 
      }));
    }

    // Reset meeting type when coach changes to match their preferences
    if (field === 'coachId' && value) {
      const selectedCoach = coaches.find(coach => coach.id === value);
      if (selectedCoach) {
        try {
          let settings: any = {};
          if (selectedCoach.settings) {
            if (typeof selectedCoach.settings === 'string') {
              settings = JSON.parse(selectedCoach.settings);
            } else if (typeof selectedCoach.settings === 'object') {
              settings = selectedCoach.settings;
            }
          }
          
          const preferredMeetingTypes = settings?.preferred_meeting_types || [];
          
          // Set to coach's first preferred meeting type if available
          if (Array.isArray(preferredMeetingTypes) && preferredMeetingTypes.length > 0) {
            // Check if current meeting type is still valid for this coach
            const currentMeetingTypeValid = preferredMeetingTypes.includes(formData.meetingType);
            const newMeetingType = currentMeetingTypeValid ? formData.meetingType : preferredMeetingTypes[0];
            
            setFormData(prev => ({ 
              ...prev, 
              meetingType: newMeetingType,
              meetingLink: '', // Coach will provide the link later
              description: formData.title ? `${formData.title} session with ${selectedCoach.first_name} ${selectedCoach.last_name}` : formData.description
            }));
          }
        } catch (error) {
          console.error('Error parsing coach preferences for meeting type reset:', error);
        }
      }
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

  // Filter meeting types based on selected coach's preferences
  const getFilteredMeetingTypes = () => {
    if (!formData.coachId) {
      // If no coach selected, show all meeting types
      return meetingTypes;
    }

    const selectedCoach = coaches.find(coach => coach.id === formData.coachId);
    if (!selectedCoach) {
      return meetingTypes;
    }

    try {
      // Handle both string and object settings
      let settings: any = {};
      if (selectedCoach.settings) {
        if (typeof selectedCoach.settings === 'string') {
          settings = JSON.parse(selectedCoach.settings);
        } else if (typeof selectedCoach.settings === 'object') {
          settings = selectedCoach.settings;
        }
      }
      
      const preferredMeetingTypes = settings?.preferred_meeting_types || [];
      
      // Filter meeting types to only show coach's preferences
      if (Array.isArray(preferredMeetingTypes) && preferredMeetingTypes.length > 0) {
        const filtered = meetingTypes.filter(type => preferredMeetingTypes.includes(type.value));
        console.log('Filtering meeting types for coach:', selectedCoach.first_name, {
          preferredMeetingTypes,
          filteredCount: filtered.length,
          allCount: meetingTypes.length
        });
        return filtered;
      }
      
      // If no preferences set, show all meeting types
      console.log('No meeting type preferences for coach, showing all types');
      return meetingTypes;
    } catch (error) {
      console.error('Error parsing coach meeting preferences:', error, selectedCoach);
      // If parsing fails, show all meeting types to be safe
      return meetingTypes;
    }
  };

  const filteredMeetingTypes = getFilteredMeetingTypes();

  // Ensure current meeting type is valid for filtered options
  useEffect(() => {
    if (formData.coachId && filteredMeetingTypes.length > 0) {
      const currentTypeValid = filteredMeetingTypes.some(type => type.value === formData.meetingType);
      if (!currentTypeValid) {
        // Current meeting type not available for this coach, switch to first available
        const firstAvailable = filteredMeetingTypes[0];
        if (firstAvailable) {
                   setFormData(prev => ({
           ...prev,
           meetingType: firstAvailable.value as BookingForm['meetingType']
         }));
        }
      }
    }
  }, [formData.coachId, filteredMeetingTypes.length]);

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Session title is required';
    if (!formData.coachId) return 'Please select a coach';
    if (!formData.scheduledAt) return 'Please select a date and time';
    if (formData.durationMinutes < 15) return 'Session must be at least 15 minutes';
    
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
          meetingLink: null, // Coach will provide the meeting link later
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
      <div className="bg-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-foreground">Book a Coaching Session</h3>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-muted-foreground"
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
              <label className="block text-sm font-medium text-foreground mb-2">
                Session Type *
              </label>
              <select
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Custom Session Title *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter custom session title..."
                  required
                  disabled={submitting}
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Session Description
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe what you'd like to focus on in this session..."
                disabled={submitting}
              />
            </div>

            {/* Coach Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Preferred Coach *
                {formData.title && formData.title !== 'Custom Session' && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                    (Showing {formData.title} specialists)
                  </span>
                )}
              </label>
              {loading ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading coaches...</span>
                </div>
              ) : (
                <select
                  value={formData.coachId}
                  onChange={(e) => handleInputChange('coachId', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date & Time *
                </label>
                <select
                  value={formData.scheduledAt}
                  onChange={(e) => handleInputChange('scheduledAt', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
                <label className="block text-sm font-medium text-foreground mb-2">
                  Duration *
                </label>
                <select
                  value={formData.durationMinutes}
                  onChange={(e) => handleInputChange('durationMinutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="block text-sm font-medium text-foreground mb-2">
                Meeting Type *
                {formData.coachId && filteredMeetingTypes.length < meetingTypes.length && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                    (Coach's preferred options)
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredMeetingTypes.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInputChange('meetingType', type.value)}
                      className={`p-3 border rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                        formData.meetingType === type.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'border-border hover:border-primary'
                      }`}
                      disabled={submitting}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs text-center">{type.label}</span>
                    </button>
                  );
                })}
              </div>
              {formData.coachId && filteredMeetingTypes.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  This coach has no meeting type preferences set. Please contact support.
                </p>
              )}
            </div>

            {/* Meeting Connection Info */}
            {['video', 'zoom', 'google_meet', 'teams'].includes(formData.meetingType) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Video className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Online Meeting Setup
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      We will send you the connection details as soon as they are ready.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6 border-t border-border">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary/20 transition-colors"
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