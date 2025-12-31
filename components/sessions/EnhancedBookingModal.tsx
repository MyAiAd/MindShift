'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Video, Phone, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Coach {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  settings?: string | Record<string, any>; // JSON string or object containing specialties and preferences
}

interface AvailableSlot {
  start_time: string;
  end_time: string;
  datetime: string;
  duration_minutes: number;
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
  selectedDate: string;
  selectedSlot: string;
  durationMinutes: number;
  meetingType: 'video' | 'phone' | 'in_person' | 'zoom' | 'google_meet' | 'teams';
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
  'General Coaching',
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

export default function EnhancedBookingModal({ isOpen, onClose, onBookingComplete }: BookingModalProps) {
  const { user } = useAuth();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<BookingForm>({
    title: '',
    description: '',
    coachId: '',
    selectedDate: '',
    selectedSlot: '',
    durationMinutes: 60,
    meetingType: 'video'
  });

  // Generate next 30 days for date selection
  const generateDateOptions = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      dates.push({
        value: date.toISOString().split('T')[0], // YYYY-MM-DD
        label: date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        })
      });
    }
    
    return dates;
  };

  const dateOptions = generateDateOptions();

  useEffect(() => {
    if (isOpen) {
      fetchCoaches();
    }
  }, [isOpen]);

  // Fetch available slots when coach, date, or duration changes
  useEffect(() => {
    if (formData.coachId && formData.selectedDate && formData.durationMinutes) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [formData.coachId, formData.selectedDate, formData.durationMinutes]);

  const fetchCoaches = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/coaches');
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Booking Modal: Raw coaches data:', data.coaches);
        
        // Debug each coach's settings
        data.coaches?.forEach((coach: Coach, index: number) => {
          console.log(`🔍 Coach ${index + 1} (${coach.first_name} ${coach.last_name}):`, {
            id: coach.id,
            role: coach.role,
            settings: coach.settings,
            settingsType: typeof coach.settings,
            settingsLength: coach.settings?.length
          });
          
          if (coach.settings) {
            try {
              // Handle both JSON string and object formats
              const parsed = typeof coach.settings === 'string' 
                ? JSON.parse(coach.settings) 
                : coach.settings;
              console.log(`✅ Parsed settings for ${coach.first_name}:`, parsed);
            } catch (e) {
              console.error(`❌ Failed to parse settings for ${coach.first_name}:`, e);
            }
          }
        });
        
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

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        coachId: formData.coachId,
        date: formData.selectedDate,
        duration: formData.durationMinutes.toString()
      });

      const response = await fetch(`/api/availability/slots?${params}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAvailableSlots(data.slots || []);
        // Clear selected slot if it's no longer available
        if (formData.selectedSlot && !data.slots.some((slot: AvailableSlot) => slot.datetime === formData.selectedSlot)) {
          setFormData(prev => ({ ...prev, selectedSlot: '' }));
        }
      } else {
        setError(data.error || 'Failed to fetch available slots');
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setError('Failed to load available slots');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const getFilteredCoaches = () => {
    console.log('🔍 Filtering coaches with title:', formData.title);
    
    if (!formData.title || formData.title === 'Custom Session') {
      console.log('🔍 No title or Custom Session - returning all coaches');
      return coaches;
    }

    const filtered = coaches.filter(coach => {
      console.log(`🔍 Checking coach ${coach.first_name} ${coach.last_name}:`, {
        hasSettings: !!coach.settings,
        settings: coach.settings,
        settingsType: typeof coach.settings
      });
      
      if (!coach.settings) {
        console.log(`✅ Coach ${coach.first_name} has no settings - including`);
        return true; // Include coaches without settings
      }
      
      try {
        // Handle both JSON string and object formats
        const settings = typeof coach.settings === 'string' 
          ? JSON.parse(coach.settings) 
          : coach.settings;
          
        const specialties = settings.specialties || [];
        const matches = specialties.includes(formData.title);
        
        console.log(`🔍 Coach ${coach.first_name} specialties:`, specialties);
        console.log(`🔍 Looking for "${formData.title}" - matches: ${matches}`);
        
        return matches;
      } catch (e) {
        console.error(`❌ Failed to parse settings for ${coach.first_name}:`, e);
        return true; // Include coaches with malformed settings as fallback
      }
    });

    console.log('🔍 Filtered coaches result:', {
      originalCount: coaches.length,
      filteredCount: filtered.length,
      filteredCoaches: filtered.map(c => `${c.first_name} ${c.last_name}`)
    });

    // Ensure we always have at least some coaches available
    return filtered.length > 0 ? filtered : coaches;
  };

  const getFilteredMeetingTypes = () => {
    if (!formData.coachId) return meetingTypes;

    const selectedCoach = coaches.find(c => c.id === formData.coachId);
    if (!selectedCoach?.settings) return meetingTypes;

    try {
      // Handle both JSON string and object formats
      const settings = typeof selectedCoach.settings === 'string' 
        ? JSON.parse(selectedCoach.settings) 
        : selectedCoach.settings;
        
      const preferredTypes = settings.preferred_meeting_types || [];
      
      if (preferredTypes.length === 0) return meetingTypes;
      
      // Filter meeting types and ensure we have at least one valid option
      const filtered = meetingTypes.filter(type => preferredTypes.includes(type.value));
      return filtered.length > 0 ? filtered : meetingTypes;
    } catch {
      // If JSON parsing fails, return all meeting types as fallback
      return meetingTypes;
    }
  };

  const filteredCoaches = getFilteredCoaches();
  const filteredMeetingTypes = getFilteredMeetingTypes();

  const handleInputChange = (field: keyof BookingForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);

    // Reset dependent fields when parent selections change
    if (field === 'title') {
      // When session type changes, reset coach and dependent fields if current coach doesn't support new type
      const currentCoach = coaches.find(c => c.id === formData.coachId);
      if (currentCoach && value && value !== 'Custom Session') {
        try {
          // Handle both JSON string and object formats
          const settings = typeof currentCoach.settings === 'string' 
            ? JSON.parse(currentCoach.settings || '{}') 
            : (currentCoach.settings || {});
            
          const specialties = settings.specialties || [];
          if (!specialties.includes(value)) {
            // Current coach doesn't support new session type, reset coach and dependent fields
            setFormData(prev => ({ 
              ...prev, 
              [field]: value,
              coachId: '',
              selectedSlot: '',
              meetingType: 'video'
            }));
            return;
          }
        } catch {
          // If settings parsing fails, keep current coach but reset meeting type
          setFormData(prev => ({ 
            ...prev, 
            [field]: value,
            meetingType: 'video'
          }));
          return;
        }
      }
    }
    
    if (field === 'coachId') {
      // When coach changes, reset time slot and potentially meeting type
      const selectedCoach = coaches.find(c => c.id === value);
      let newMeetingType = formData.meetingType;
      
      if (selectedCoach?.settings) {
        try {
          // Handle both JSON string and object formats
          const settings = typeof selectedCoach.settings === 'string' 
            ? JSON.parse(selectedCoach.settings) 
            : selectedCoach.settings;
            
          const preferredTypes = settings.preferred_meeting_types || [];
          
          // If coach has preferred meeting types and current selection isn't in them
          if (preferredTypes.length > 0 && !preferredTypes.includes(formData.meetingType)) {
            // Auto-select the first preferred meeting type
            newMeetingType = preferredTypes[0];
          }
        } catch {
          // If settings parsing fails, keep current meeting type
        }
      }
      
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        selectedSlot: '', 
        meetingType: newMeetingType
      }));
      return;
    }
    
    if (field === 'selectedDate') {
      setFormData(prev => ({ ...prev, selectedSlot: '' }));
    }
    if (field === 'durationMinutes') {
      setFormData(prev => ({ ...prev, selectedSlot: '' }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Session title is required';
    if (!formData.coachId) return 'Please select a coach';
    if (!formData.selectedDate) return 'Please select a date';
    if (!formData.selectedSlot) return 'Please select a time slot';
    if (formData.durationMinutes < 15) return 'Session must be at least 15 minutes';
    
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
          clientId: user?.id,
          scheduledAt: formData.selectedSlot,
          durationMinutes: formData.durationMinutes,
          meetingLink: null,
          meetingType: formData.meetingType
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('Session booked successfully!');
        onBookingComplete(data.session);
        
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
      selectedDate: '',
      selectedSlot: '',
      durationMinutes: 60,
      meetingType: 'video'
    });
    setAvailableSlots([]);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const formatSlotTime = (slot: AvailableSlot) => {
    const start = new Date(`2000-01-01T${slot.start_time}`);
    const end = new Date(`2000-01-01T${slot.end_time}`);
    
    return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
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
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
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
                  <option value="">Select a coach...</option>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date *
                </label>
                <select
                  value={formData.selectedDate}
                  onChange={(e) => handleInputChange('selectedDate', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  disabled={submitting || !formData.coachId}
                >
                  <option value="">Select date...</option>
                  {dateOptions.map(date => (
                    <option key={date.value} value={date.value}>
                      {date.label}
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

              {/* Time Slot */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time *
                </label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">Loading slots...</span>
                  </div>
                ) : (
                  <select
                    value={formData.selectedSlot}
                    onChange={(e) => handleInputChange('selectedSlot', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    required
                    disabled={submitting || !formData.selectedDate || availableSlots.length === 0}
                  >
                    <option value="">
                      {availableSlots.length === 0 ? 'No slots available' : 'Select time...'}
                    </option>
                    {availableSlots.map(slot => (
                      <option key={slot.datetime} value={slot.datetime}>
                        {formatSlotTime(slot)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

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
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-foreground hover:text-foreground dark:hover:text-white"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.selectedSlot}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 