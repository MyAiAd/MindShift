# Mind Shifting Metrics Implementation Roadmap

This document outlines the comprehensive changes needed to fully implement all Mind Shifting metrics tracking, including user-facing stats and admin/backend averages across all users.

---

## Current State

### Metrics Currently Working ✅
| Metric | Source | Notes |
|--------|--------|-------|
| Active Sessions | `treatment_sessions` table | Filter by `status = 'active' OR status = 'paused'` |
| Mind Shifting Sessions | `treatment_sessions` table | Count of all sessions in time period |
| Days Active | `treatment_sessions` table | Count distinct `DATE(created_at)` |
| Problems Cleared | `treatment_sessions` table | Count where `status = 'completed'` |
| Total Time | `treatment_sessions` table | Sum of `duration_minutes` |
| Avg per Problem | Calculated | `total_minutes / problems_cleared` |

### Metrics Needing Implementation ⚠️
| Metric | Current State | What's Needed |
|--------|--------------|---------------|
| Goals Optimised | Shows 0 | Track goal optimization sessions |
| Negative Experiences Cleared | Shows 0 | Track trauma/experience clearing sessions |
| Admin Averages | Not implemented | New API endpoint for aggregate stats |

---

## Phase 1: Database Schema Changes

### 1.1 Add Tracking Fields to `treatment_sessions` Table

```sql
-- Migration: Add metrics tracking fields to treatment_sessions
ALTER TABLE treatment_sessions
ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'problem_shifting',
ADD COLUMN IF NOT EXISTS problems_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS goals_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS experiences_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS method_used VARCHAR(50);

-- Session types will be:
-- 'problem_shifting' - Standard problem clearing (Mind Shifting)
-- 'goal_optimization' - Goal Optimization sessions
-- 'experience_clearing' - Trauma/Negative Experience clearing
-- 'belief_shifting' - Belief transformation
-- 'identity_shifting' - Identity work
-- 'reality_shifting' - Reality perception work
-- 'blockage_shifting' - Subconscious blockage clearing

COMMENT ON COLUMN treatment_sessions.session_type IS 'Type of Mind Shifting session conducted';
COMMENT ON COLUMN treatment_sessions.problems_count IS 'Number of problems cleared in this session';
COMMENT ON COLUMN treatment_sessions.goals_count IS 'Number of goals optimized in this session';
COMMENT ON COLUMN treatment_sessions.experiences_count IS 'Number of negative experiences cleared in this session';
COMMENT ON COLUMN treatment_sessions.method_used IS 'The specific method/modality used';
```

### 1.2 Create Metrics Summary Table (Optional - for Performance)

```sql
-- Migration: Create daily metrics summary table for faster aggregation
CREATE TABLE IF NOT EXISTS user_metrics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sessions_count INTEGER DEFAULT 0,
  problems_cleared INTEGER DEFAULT 0,
  goals_optimized INTEGER DEFAULT 0,
  experiences_cleared INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

CREATE INDEX idx_user_metrics_daily_user_date ON user_metrics_daily(user_id, date);
CREATE INDEX idx_user_metrics_daily_date ON user_metrics_daily(date);

-- Enable RLS
ALTER TABLE user_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own metrics
CREATE POLICY "Users can view own metrics" ON user_metrics_daily
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: System can insert/update metrics
CREATE POLICY "System can manage metrics" ON user_metrics_daily
  FOR ALL USING (true);
```

### 1.3 Create Admin Aggregate View

```sql
-- Migration: Create view for admin aggregate statistics
CREATE OR REPLACE VIEW admin_metrics_aggregate AS
SELECT 
  COUNT(DISTINCT ts.user_id) as total_users,
  COUNT(ts.id) as total_sessions,
  COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_sessions,
  COUNT(CASE WHEN ts.status = 'active' THEN 1 END) as active_sessions,
  COALESCE(SUM(ts.problems_count), 0) as total_problems_cleared,
  COALESCE(SUM(ts.goals_count), 0) as total_goals_optimized,
  COALESCE(SUM(ts.experiences_count), 0) as total_experiences_cleared,
  COALESCE(SUM(ts.duration_minutes), 0) as total_minutes,
  COALESCE(AVG(ts.duration_minutes), 0) as avg_session_duration,
  COALESCE(
    SUM(ts.duration_minutes)::FLOAT / NULLIF(SUM(ts.problems_count), 0), 
    0
  ) as avg_minutes_per_problem,
  COUNT(DISTINCT DATE(ts.created_at)) as total_active_days
FROM treatment_sessions ts;

-- Grant access to the view
GRANT SELECT ON admin_metrics_aggregate TO authenticated;
```

---

## Phase 2: API Changes

### 2.1 Update Treatment Session Creation/Completion

**File: `/app/api/treatment-v4/route.ts`**

When a session is created or completed, we need to:
1. Track the session type based on the method selected
2. Increment counters when problems/goals/experiences are cleared

```typescript
// Add to session creation
const sessionData = {
  // ... existing fields
  session_type: getSessionType(metadata.selectedMethod),
  method_used: metadata.selectedMethod,
  problems_count: 0,
  goals_count: 0,
  experiences_count: 0
};

// Helper function
function getSessionType(method: string): string {
  const typeMap: Record<string, string> = {
    'mind_shifting': 'problem_shifting',
    'goal_optimization': 'goal_optimization',
    'trauma_shifting': 'experience_clearing',
    'belief_shifting': 'belief_shifting',
    'identity_shifting': 'identity_shifting',
    'reality_shifting': 'reality_shifting',
    'blockage_shifting': 'blockage_shifting'
  };
  return typeMap[method] || 'problem_shifting';
}
```

### 2.2 Update Session Completion Logic

When a session completes, increment the appropriate counter:

```typescript
// On session completion
const updates: any = {
  status: 'completed',
  completed_at: new Date().toISOString(),
  duration_minutes: calculatedDuration
};

// Increment based on session type
switch (session.session_type) {
  case 'problem_shifting':
    updates.problems_count = 1;
    break;
  case 'goal_optimization':
    updates.goals_count = 1;
    break;
  case 'experience_clearing':
    updates.experiences_count = 1;
    break;
}
```

### 2.3 Create Admin Metrics API

**New File: `/app/api/admin/metrics/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/database-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get aggregate stats
    const { data: sessions } = await supabase
      .from('treatment_sessions')
      .select('*')
      .gte('created_at', cutoffDate.toISOString());

    if (!sessions) {
      return NextResponse.json({ stats: getEmptyStats() });
    }

    // Calculate aggregates
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;
    const uniqueDays = new Set(sessions.map(s => 
      new Date(s.created_at).toDateString()
    )).size;

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const problemsCleared = sessions.reduce((sum, s) => sum + (s.problems_count || 0), 0) || completedSessions.length;
    const goalsOptimized = sessions.reduce((sum, s) => sum + (s.goals_count || 0), 0);
    const experiencesCleared = sessions.reduce((sum, s) => sum + (s.experiences_count || 0), 0);

    const stats = {
      // Totals
      totalUsers: uniqueUsers,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      
      // Outcomes
      problemsCleared,
      goalsOptimized,
      experiencesCleared,
      
      // Time
      totalMinutes,
      avgSessionDuration: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      avgMinutesPerProblem: problemsCleared > 0 ? Math.round(totalMinutes / problemsCleared) : 0,
      
      // Engagement
      totalActiveDays: uniqueDays,
      avgSessionsPerUser: uniqueUsers > 0 ? Math.round(sessions.length / uniqueUsers * 10) / 10 : 0,
      
      // Period
      periodDays: days,
      startDate: cutoffDate.toISOString(),
      endDate: new Date().toISOString()
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getEmptyStats() {
  return {
    totalUsers: 0,
    totalSessions: 0,
    completedSessions: 0,
    activeSessions: 0,
    problemsCleared: 0,
    goalsOptimized: 0,
    experiencesCleared: 0,
    totalMinutes: 0,
    avgSessionDuration: 0,
    avgMinutesPerProblem: 0,
    totalActiveDays: 0,
    avgSessionsPerUser: 0
  };
}
```

### 2.4 Update User Stats API

**File: `/app/api/sessions/stats/route.ts`**

Add the new metrics to the response:

```typescript
// Update the stats calculation to include:
const stats = {
  // ... existing fields
  problems_cleared: sessions.reduce((sum, s) => sum + (s.problems_count || 0), 0),
  goals_optimized: sessions.reduce((sum, s) => sum + (s.goals_count || 0), 0),
  experiences_cleared: sessions.reduce((sum, s) => sum + (s.experiences_count || 0), 0),
};
```

---

## Phase 3: Frontend Changes

### 3.1 Update Dashboard Stats Fetching

**File: `/app/dashboard/page.tsx`**

Update the stats interface and fetching logic to use the new fields:

```typescript
interface MindShiftingStats {
  activeSessionsCount: number;
  totalSessionsCount: number;
  daysActive: number;
  problemsCleared: number;
  goalsOptimised: number;
  negativeExperiencesCleared: number;
  totalMinutes: number;
  avgMinutesPerProblem: number;
}

// In fetchStats function, update to use API data:
setStats({
  activeSessionsCount: activeCount,
  totalSessionsCount: filteredSessions.length,
  daysActive: uniqueDays,
  problemsCleared: filteredSessions.reduce((sum, s) => sum + (s.problems_count || 0), 0) || completedSessions.length,
  goalsOptimised: filteredSessions.reduce((sum, s) => sum + (s.goals_count || 0), 0),
  negativeExperiencesCleared: filteredSessions.reduce((sum, s) => sum + (s.experiences_count || 0), 0),
  totalMinutes: totalMinutes,
  avgMinutesPerProblem: avgMinutes
});
```

### 3.2 Update Treatment Session UI

When starting a session, ensure the method selection properly maps to session types:

```typescript
// When user selects a method
const methodToSessionType = {
  'Mind Shifting': 'problem_shifting',
  'Goal Optimization': 'goal_optimization', 
  'Trauma Shifting': 'experience_clearing',
  'Belief Shifting': 'belief_shifting',
  'Identity Shifting': 'identity_shifting',
  'Reality Shifting': 'reality_shifting',
  'Blockage Shifting': 'blockage_shifting'
};
```

### 3.3 Create Admin Dashboard Component (Optional)

**New File: `/app/dashboard/admin/metrics/page.tsx`**

Create an admin-only page to view aggregate metrics across all users.

---

## Phase 4: Treatment Flow Integration

### 4.1 Track Method Selection

In the treatment session flow, when the user selects their method/modality, store it:

```typescript
// In TreatmentSession.tsx or treatment API
const startSession = async (method: string) => {
  const response = await fetch('/api/treatment-v4', {
    method: 'POST',
    body: JSON.stringify({
      action: 'start',
      sessionId,
      metadata: {
        selectedMethod: method,
        // This will be used to set session_type
      }
    })
  });
};
```

### 4.2 Increment Counters on Completion

When a session completes successfully:

```typescript
// In treatment completion logic
const completeSession = async () => {
  const response = await fetch('/api/treatment-v4', {
    method: 'POST',
    body: JSON.stringify({
      action: 'complete',
      sessionId,
      // The API will increment the appropriate counter based on session_type
    })
  });
};
```

---

## Phase 5: Database Function Updates

### 5.1 Update `get_session_stats` Function

```sql
-- Update the existing function to include new metrics
CREATE OR REPLACE FUNCTION get_session_stats(
  p_user_id UUID,
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_sessions BIGINT,
  upcoming_sessions BIGINT,
  completed_sessions BIGINT,
  cancelled_sessions BIGINT,
  total_hours_this_month NUMERIC,
  available_slots BIGINT,
  treatment_sessions BIGINT,
  active_treatment_sessions BIGINT,
  completed_treatment_sessions BIGINT,
  total_treatment_hours_this_month NUMERIC,
  -- New fields
  problems_cleared BIGINT,
  goals_optimized BIGINT,
  experiences_cleared BIGINT,
  avg_minutes_per_problem NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    -- ... existing calculations ...
    
    -- New metrics
    COALESCE(SUM(ts.problems_count), 0)::BIGINT as problems_cleared,
    COALESCE(SUM(ts.goals_count), 0)::BIGINT as goals_optimized,
    COALESCE(SUM(ts.experiences_count), 0)::BIGINT as experiences_cleared,
    CASE 
      WHEN SUM(ts.problems_count) > 0 
      THEN ROUND(SUM(ts.duration_minutes)::NUMERIC / SUM(ts.problems_count), 1)
      ELSE 0
    END as avg_minutes_per_problem
  FROM treatment_sessions ts
  WHERE ts.user_id = p_user_id
    AND ts.created_at >= cutoff_date;
END;
$$;
```

---

## Implementation Checklist

### Database
- [ ] Create migration for `treatment_sessions` new columns
- [ ] Create `user_metrics_daily` table (optional)
- [ ] Create `admin_metrics_aggregate` view
- [ ] Update `get_session_stats` function

### Backend API
- [ ] Update `/api/treatment-v4` to track session types
- [ ] Update session completion to increment counters
- [ ] Create `/api/admin/metrics` endpoint
- [ ] Update `/api/sessions/stats` to return new fields

### Frontend
- [ ] Update dashboard to use new API fields when available
- [ ] Ensure treatment flow captures method selection
- [ ] Create admin metrics dashboard (optional)

### Testing
- [ ] Test session creation with different methods
- [ ] Test counter incrementing on completion
- [ ] Test stats API with time period filtering
- [ ] Test admin metrics endpoint (admin only)

---

## Migration Order

1. **Run database migrations first** (schema changes)
2. **Deploy API changes** (backend endpoints)
3. **Update frontend** (dashboard and treatment flow)
4. **Backfill existing data** (optional - set historical sessions to `problems_count = 1` where `status = 'completed'`)

---

## Backfill Script (Optional)

To populate metrics for existing completed sessions:

```sql
-- Backfill problems_count for existing completed sessions
UPDATE treatment_sessions
SET 
  problems_count = 1,
  session_type = COALESCE(
    CASE metadata->>'selectedMethod'
      WHEN 'mind_shifting' THEN 'problem_shifting'
      WHEN 'goal_optimization' THEN 'goal_optimization'
      WHEN 'trauma_shifting' THEN 'experience_clearing'
      ELSE 'problem_shifting'
    END,
    'problem_shifting'
  ),
  method_used = COALESCE(metadata->>'selectedMethod', 'mind_shifting')
WHERE status = 'completed'
  AND problems_count IS NULL OR problems_count = 0;
```

---

## Future Enhancements

1. **Multi-problem sessions**: Allow tracking multiple problems cleared in a single session
2. **Session quality metrics**: Add rating/feedback after sessions
3. **Streak tracking**: Track consecutive days of Mind Shifting
4. **Achievement system**: Award badges based on metrics milestones
5. **Comparative analytics**: Show user stats vs. average across all users
6. **Export functionality**: Allow users to export their metrics data

---

*Document created: January 6, 2026*
*Last updated: January 6, 2026*

