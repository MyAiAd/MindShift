import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const days = parseInt(searchParams.get('days') || '30'); // Number of days to look ahead

    // Generate available time slots
    const generateTimeSlots = (startDate: Date, numDays: number) => {
      const slots = [];
      const now = new Date();
      
      for (let day = 0; day < numDays; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + day);
        
        // Skip weekends for business hours
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // Generate slots from 9 AM to 5 PM (business hours)
        for (let hour = 9; hour <= 17; hour++) {
          const slotDate = new Date(date);
          slotDate.setHours(hour, 0, 0, 0);
          
          // Only show future slots
          if (slotDate > now) {
            slots.push({
              datetime: slotDate.toISOString(),
              date: slotDate.toISOString().split('T')[0],
              time: slotDate.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              }),
              available: true // Will be updated based on existing bookings
            });
          }
        }
      }
      
      return slots;
    };

    const startDate = date ? new Date(date) : new Date();
    let timeSlots = generateTimeSlots(startDate, days);

    // If coachId is provided, check their existing bookings
    if (coachId) {
      const { data: existingBookings } = await supabase
        .from('coaching_sessions')
        .select('scheduled_at, duration_minutes')
        .eq('coach_id', coachId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', startDate.toISOString())
        .order('scheduled_at');

      // Mark slots as unavailable if they conflict with existing bookings
      if (existingBookings) {
        timeSlots = timeSlots.map(slot => {
          const slotStart = new Date(slot.datetime);
          const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // Assume 1-hour slots
          
          const hasConflict = existingBookings.some(booking => {
            const bookingStart = new Date(booking.scheduled_at);
            const bookingEnd = new Date(bookingStart.getTime() + booking.duration_minutes * 60 * 1000);
            
            // Check for overlap
            return (slotStart < bookingEnd && slotEnd > bookingStart);
          });
          
          return {
            ...slot,
            available: !hasConflict
          };
        });
      }
    }

    // Filter to only available slots or include all if no coach specified
    const availableSlots = coachId ? timeSlots.filter(slot => slot.available) : timeSlots;

    return NextResponse.json({ 
      timeSlots: availableSlots.slice(0, 50), // Limit to 50 slots
      totalSlots: availableSlots.length
    });
  } catch (error) {
    console.error('Error in availability fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 