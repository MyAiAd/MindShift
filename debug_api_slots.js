// Add this to the beginning of your slots API route for debugging
console.log('Slots API called with params:', {
  coachId: searchParams.get('coachId'),
  date: searchParams.get('date'),
  duration: searchParams.get('duration'),
  timezone: searchParams.get('timezone')
});

console.log('User profile:', profile);

// Add this after the RPC call
console.log('RPC call result:', { slotsData, slotsError });
