'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, Loader2, AlertCircle, Calendar } from 'lucide-react';

interface TimeSlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  buffer_minutes: number;
}

interface AvailabilityException {
  id: string;
  exception_date: string;
  start_time?: string;
  end_time?: string;
  is_available: boolean;
  reason?: string;
  all_day: boolean;
}

interface AvailabilityData {
  weekly_schedule: TimeSlot[];
  exceptions: AvailabilityException[];
}

interface AvailabilityCalendarProps {
  coachId?: string;
  onSave?: (availability: AvailabilityData) => void;
  readOnly?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'GMT' },
  { value: 'Europe/Paris', label: 'Central European Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time' }
];

export default function AvailabilityCalendar({ 
  coachId, 
  onSave, 
  readOnly = false 
}: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<AvailabilityData>({
    weekly_schedule: [],
    exceptions: []
  });
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load availability data
  useEffect(() => {
    if (coachId) {
      fetchAvailability();
    } else {
      setLoading(false);
    }
  }, [coachId]);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (coachId) params.append('coachId', coachId);

      const response = await fetch(`/api/availability?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setAvailability(data.availability);
        // Try to detect timezone from first slot
        if (data.availability.weekly_schedule.length > 0) {
          const firstSlot = data.availability.weekly_schedule[0];
          if (firstSlot.timezone) {
            setTimezone(firstSlot.timezone);
          }
        }
      } else {
        setError(data.error || 'Failed to load availability');
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        times.push({ value: timeString, label: displayTime });
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const addTimeSlot = (dayOfWeek: number) => {
    const newSlot: TimeSlot = {
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true,
      buffer_minutes: 15
    };

    setAvailability(prev => ({
      ...prev,
      weekly_schedule: [...prev.weekly_schedule, newSlot]
    }));
  };

  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: any) => {
    setAvailability(prev => ({
      ...prev,
      weekly_schedule: prev.weekly_schedule.map((slot, i) => 
        i === index ? { ...slot, [field]: value } : slot
      )
    }));
  };

  const removeTimeSlot = (index: number) => {
    setAvailability(prev => ({
      ...prev,
      weekly_schedule: prev.weekly_schedule.filter((_, i) => i !== index)
    }));
  };

  const getSlotsByDay = (dayOfWeek: number) => {
    return availability.weekly_schedule
      .map((slot, index) => ({ ...slot, index }))
      .filter(slot => slot.day_of_week === dayOfWeek)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const handleSave = async () => {
    if (readOnly) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate slots
      for (const slot of availability.weekly_schedule) {
        if (slot.start_time >= slot.end_time) {
          setError('End time must be after start time for all slots');
          return;
        }
      }

      const response = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          weeklySchedule: availability.weekly_schedule,
          timezone
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Availability updated successfully!');
        if (onSave) {
          onSave(availability);
        }
        // Refresh data
        await fetchAvailability();
      } else {
        setError(data.error || 'Failed to update availability');
      }
    } catch (err) {
      console.error('Error saving availability:', err);
      setError('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading availability...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Weekly Availability
          </h3>
        </div>
        
        {!readOnly && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Timezone:
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                aria-label="Select timezone"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Availability
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center">
          <Clock className="h-4 w-4 mr-2" />
          {success}
        </div>
      )}

      {/* Weekly Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DAYS_OF_WEEK.map(day => {
          const daySlots = getSlotsByDay(day.value);
          
          return (
            <div key={day.value} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {day.label}
                </h4>
                {!readOnly && (
                  <button
                    onClick={() => addTimeSlot(day.value)}
                    className="text-indigo-600 hover:text-indigo-700 p-1 rounded"
                    title="Add time slot"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {daySlots.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No availability set
                  </p>
                ) : (
                  daySlots.map(slot => (
                    <div key={slot.index} className="border border-gray-200 dark:border-gray-600 rounded p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Start
                          </label>
                                                     <select
                             value={slot.start_time}
                             onChange={(e) => updateTimeSlot(slot.index, 'start_time', e.target.value)}
                             disabled={readOnly}
                             className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                             aria-label={`Start time for ${DAYS_OF_WEEK[slot.day_of_week]?.label}`}
                           >
                            {timeOptions.map(time => (
                              <option key={time.value} value={time.value}>
                                {time.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            End
                          </label>
                          <select
                            value={slot.end_time}
                            onChange={(e) => updateTimeSlot(slot.index, 'end_time', e.target.value)}
                            disabled={readOnly}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            aria-label={`End time for ${DAYS_OF_WEEK[slot.day_of_week]?.label}`}
                          >
                            {timeOptions.map(time => (
                              <option key={time.value} value={time.value}>
                                {time.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Buffer (min)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={slot.buffer_minutes}
                            onChange={(e) => updateTimeSlot(slot.index, 'buffer_minutes', parseInt(e.target.value) || 0)}
                            disabled={readOnly}
                            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            aria-label={`Buffer minutes for ${DAYS_OF_WEEK[slot.day_of_week]?.label}`}
                          />
                        </div>
                        
                        {!readOnly && (
                          <div className="flex items-end">
                            <button
                              onClick={() => removeTimeSlot(slot.index)}
                              className="text-red-600 hover:text-red-700 p-1 rounded"
                              title="Remove time slot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
          How to set your availability:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Click the + button to add time slots for each day</li>
          <li>• Set your start and end times for each available period</li>
          <li>• Buffer time is added between sessions to prevent back-to-back bookings</li>
          <li>• You can have multiple time slots per day (e.g., morning and afternoon)</li>
          <li>• Don't forget to save your changes!</li>
        </ul>
      </div>
    </div>
  );
} 