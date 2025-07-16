'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Goal, ProgressEntry, GamificationData, UserAchievement, UserStreak, AchievementRarity } from '@/types/database';
import { 
  TrendingUp, 
  Calendar, 
  Target, 
  Award, 
  Activity, 
  BarChart3, 
  Plus,
  Loader2,
  Heart,
  Zap,
  Shield,
  X,
  Star,
  Trophy,
  Flame,
  Crown,
  Medal,
  Users,
  CheckCircle,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ProgressStats {
  overview: {
    totalGoals: number;
    completedGoals: number;
    inProgressGoals: number;
    totalProgressEntries: number;
    completedMilestones: number;
    totalMilestones: number;
    overallProgress: number;
    avgMoodScore: number;
    avgEnergyLevel: number;
    avgConfidenceLevel: number;
  };
  recentAchievements: {
    completedGoals: Array<{
      id: string;
      title: string;
      completedAt: string;
      type: 'goal';
    }>;
    completedMilestones: Array<{
      id: string;
      title: string;
      completedAt: string;
      type: 'milestone';
    }>;
  };
  progressByGoalStatus: Record<string, number>;
  recentProgressEntries: ProgressEntry[];
  progressTrends: ProgressEntry[];
}

interface NewProgressEntry {
  goalId: string;
  entryDate: string;
  moodScore: number;
  energyLevel: number;
  confidenceLevel: number;
  notes: string;
}

export default function ProgressPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [gamificationData, setGamificationData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [gamificationLoading, setGamificationLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeRange, setTimeRange] = useState('30');
  const [newEntry, setNewEntry] = useState<NewProgressEntry>({
    goalId: '',
    entryDate: new Date().toISOString().split('T')[0],
    moodScore: 5,
    energyLevel: 5,
    confidenceLevel: 5,
    notes: ''
  });

  useEffect(() => {
    Promise.all([
      fetchProgressStats(),
      fetchGoals(),
      fetchGamificationData()
    ]);
  }, [timeRange]);

  const fetchProgressStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/progress/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch progress statistics');
      }
      
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals');
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }
      
      const data = await response.json();
      setGoals(data.goals || []);
    } catch (err) {
      console.error('Error fetching goals:', err);
    }
  };

  const fetchGamificationData = async () => {
    try {
      setGamificationLoading(true);
      
      const response = await fetch('/api/gamification');
      if (!response.ok) {
        throw new Error('Failed to fetch gamification data');
      }
      
      const data = await response.json();
      setGamificationData(data.data);
    } catch (err) {
      console.error('Error fetching gamification data:', err);
      // Don't set error for gamification data, just log it
    } finally {
      setGamificationLoading(false);
    }
  };

  const handleCreateProgressEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEntry),
      });

      if (!response.ok) {
        throw new Error('Failed to create progress entry');
      }

      setShowNewEntryModal(false);
      setNewEntry({
        goalId: '',
        entryDate: new Date().toISOString().split('T')[0],
        moodScore: 5,
        energyLevel: 5,
        confidenceLevel: 5,
        notes: ''
      });
      
      // Refresh stats
      await fetchProgressStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create progress entry');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getScoreColor = (score: number, maxScore: number = 10) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number, maxScore: number = 10) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-green-50';
    if (percentage >= 60) return 'bg-yellow-50';
    if (percentage >= 40) return 'bg-orange-50';
    return 'bg-red-50';
  };

  const formatChartData = () => {
    if (!stats?.progressTrends) return [];
    
    // Group entries by date and calculate averages
    const groupedData = stats.progressTrends.reduce((acc, entry) => {
      const date = new Date(entry.entry_date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      if (!acc[date]) {
        acc[date] = {
          date,
          mood: [],
          energy: [],
          confidence: [],
          count: 0
        };
      }
      
      if (entry.mood_score) acc[date].mood.push(entry.mood_score);
      if (entry.energy_level) acc[date].energy.push(entry.energy_level);
      if (entry.confidence_level) acc[date].confidence.push(entry.confidence_level);
      acc[date].count++;
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages and format for chart
    return Object.values(groupedData).map((day: any) => ({
      date: day.date,
      mood: day.mood.length > 0 ? Math.round(day.mood.reduce((a: number, b: number) => a + b, 0) / day.mood.length) : 0,
      energy: day.energy.length > 0 ? Math.round(day.energy.reduce((a: number, b: number) => a + b, 0) / day.energy.length) : 0,
      confidence: day.confidence.length > 0 ? Math.round(day.confidence.reduce((a: number, b: number) => a + b, 0) / day.confidence.length) : 0,
      entries: day.count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '30': return 'Last 30 days';
      case '90': return 'Last 3 months';
      case '180': return 'Last 6 months';
      case '365': return 'Last year';
      default: return 'Last 30 days';
    }
  };

  // Gamification helper functions
  const getRarityColor = (rarity: AchievementRarity) => {
    switch (rarity) {
      case 'common': return 'text-gray-600 bg-gray-100';
      case 'uncommon': return 'text-green-600 bg-green-100';
      case 'rare': return 'text-blue-600 bg-blue-100';
      case 'epic': return 'text-purple-600 bg-purple-100';
      case 'legendary': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRarityIcon = (rarity: AchievementRarity) => {
    switch (rarity) {
      case 'common': return Medal;
      case 'uncommon': return Trophy;
      case 'rare': return Star;
      case 'epic': return Crown;
      case 'legendary': return Flame;
      default: return Medal;
    }
  };

  const getStreakIcon = (streakType: string) => {
    switch (streakType) {
      case 'daily_progress': return Calendar;
      case 'weekly_goal_progress': return Target;
      case 'treatment_sessions': return Activity;
      default: return Flame;
    }
  };

  const formatStreakType = (streakType: string) => {
    switch (streakType) {
      case 'daily_progress': return 'Daily Progress';
      case 'weekly_goal_progress': return 'Weekly Goals';
      case 'treatment_sessions': return 'Treatment Sessions';
      default: return streakType;
    }
  };

  const getLevelColor = (level: number) => {
    if (level >= 20) return 'text-yellow-600 bg-yellow-100';
    if (level >= 15) return 'text-purple-600 bg-purple-100';
    if (level >= 10) return 'text-blue-600 bg-blue-100';
    if (level >= 5) return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Progress</h1>
            <p className="text-gray-600 mt-1">Track your mindset transformation journey and celebrate your achievements.</p>
          </div>
          <button 
            onClick={() => setShowNewEntryModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Log Progress
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.overallProgress || 0}%</p>
              <p className="text-gray-600 dark:text-gray-300">Overall Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.completedGoals || 0}</p>
              <p className="text-gray-600 dark:text-gray-300">Goals Achieved</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.totalProgressEntries || 0}</p>
              <p className="text-gray-600 dark:text-gray-300">Progress Entries</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Award className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.completedMilestones || 0}</p>
              <p className="text-gray-600 dark:text-gray-300">Milestones</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wellbeing Scores */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Average Wellbeing Scores</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-4 rounded-lg ${getScoreBackground(stats?.overview.avgMoodScore || 0)}`}>
            <div className="flex items-center">
              <Heart className={`h-6 w-6 ${getScoreColor(stats?.overview.avgMoodScore || 0)} mr-3`} />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.avgMoodScore || 0}/10</p>
                <p className="text-gray-600 dark:text-gray-300">Mood Score</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-lg ${getScoreBackground(stats?.overview.avgEnergyLevel || 0)}`}>
            <div className="flex items-center">
              <Zap className={`h-6 w-6 ${getScoreColor(stats?.overview.avgEnergyLevel || 0)} mr-3`} />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.avgEnergyLevel || 0}/10</p>
                <p className="text-gray-600 dark:text-gray-300">Energy Level</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-lg ${getScoreBackground(stats?.overview.avgConfidenceLevel || 0)}`}>
            <div className="flex items-center">
              <Shield className={`h-6 w-6 ${getScoreColor(stats?.overview.avgConfidenceLevel || 0)} mr-3`} />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats?.overview.avgConfidenceLevel || 0}/10</p>
                <p className="text-gray-600 dark:text-gray-300">Confidence Level</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Gamification Hub - 3 Column Layout */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Column 1: Level Progress & Recent Achievements */}
        <div className="space-y-6">
          {/* Level Progress */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Level Progress</h2>
              {gamificationData?.levelProgress && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(gamificationData.levelProgress.currentLevel)}`}>
                  Level {gamificationData.levelProgress.currentLevel}
                </div>
              )}
            </div>
            
            {gamificationLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : gamificationData?.levelProgress ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">
                    {gamificationData.levelProgress.levelProgress} / {gamificationData.levelProgress.levelProgressMax} XP
                  </span>
                  <span className="font-medium text-indigo-600">
                    {gamificationData.levelProgress.pointsForNextLevel} XP to next level
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${gamificationData.levelProgress.levelProgressPercentage}%` }}
                  ></div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{gamificationData.userStats.total_points} Total XP</span>
                  <span>{gamificationData.userStats.achievements_earned} Achievements</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Start your journey to earn XP and level up!</p>
              </div>
            )}
          </div>

          {/* Recent Achievements */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h2>
            
            {gamificationLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : gamificationData?.recentAchievements && gamificationData.recentAchievements.length > 0 ? (
              <div className="space-y-4">
                {gamificationData.recentAchievements.map((achievement) => {
                  const RarityIcon = getRarityIcon(achievement.rarity as AchievementRarity);
                  return (
                    <div key={achievement.id} className={`flex items-center space-x-3 p-4 rounded-lg border ${getRarityColor(achievement.rarity as AchievementRarity)}`}>
                      <div className="flex-shrink-0">
                        <RarityIcon className="h-8 w-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900 dark:text-white">{achievement.title}</p>
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white bg-opacity-50">
                            +{achievement.points} XP
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{achievement.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(achievement.earned_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No recent achievements</p>
                <p className="text-sm text-gray-400">Complete goals and log progress to earn achievements!</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Progress Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Progress Over Time</h2>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="30">30d</option>
              <option value="90">3m</option>
              <option value="180">6m</option>
              <option value="365">1y</option>
            </select>
          </div>
          
          {formatChartData().length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formatChartData()}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    stroke="#666"
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fontSize: 12 }}
                    stroke="#666"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="mood" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    name="Mood Score"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="energy" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                    name="Energy Level"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="confidence" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    name="Confidence Level"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No progress data yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Start logging progress entries to see your trends over time
                </p>
              </div>
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-500 text-center">
            Showing {stats?.progressTrends.length || 0} entries in the {getTimeRangeLabel(timeRange).toLowerCase()}
          </div>
        </div>

        {/* Column 3: Streaks & Quick Stats */}
        <div className="space-y-6">
          {/* Current Streaks */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Streaks</h2>
            
            {gamificationLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : gamificationData?.streaks && gamificationData.streaks.length > 0 ? (
              <div className="space-y-4">
                {gamificationData.streaks.map((streak) => {
                  const StreakIcon = getStreakIcon(streak.streak_type);
                  return (
                    <div key={streak.id} className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg">
                      <StreakIcon className="h-6 w-6 text-orange-600" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 dark:text-white">{formatStreakType(streak.streak_type)}</p>
                          <div className="flex items-center space-x-1">
                            <Flame className="h-4 w-4 text-orange-500" />
                            <span className="font-bold text-orange-600">{streak.current_count}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Best: {streak.best_count} days</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Flame className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No active streaks</p>
                <p className="text-sm text-gray-400">Stay consistent to build streaks!</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            
            {gamificationLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : gamificationData?.userStats ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Goals Completed</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{gamificationData.userStats.goals_completed}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Progress Entries</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{gamificationData.userStats.progress_entries_count}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Treatment Sessions</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{gamificationData.userStats.treatment_sessions_count}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Best Streak</span>
                  <div className="flex items-center space-x-1">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">{gamificationData.userStats.best_streak_days} days</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">No stats yet</p>
                <p className="text-sm text-gray-400">Start your journey to see stats!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Progress Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Log Progress Entry</h3>
              <button
                onClick={() => setShowNewEntryModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProgressEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal *</label>
                <select
                  required
                  value={newEntry.goalId}
                  onChange={(e) => setNewEntry({ ...newEntry, goalId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a goal...</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  required
                  value={newEntry.entryDate}
                  onChange={(e) => setNewEntry({ ...newEntry, entryDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mood Score: {newEntry.moodScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newEntry.moodScore}
                  onChange={(e) => setNewEntry({ ...newEntry, moodScore: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Energy Level: {newEntry.energyLevel}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newEntry.energyLevel}
                  onChange={(e) => setNewEntry({ ...newEntry, energyLevel: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confidence Level: {newEntry.confidenceLevel}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={newEntry.confidenceLevel}
                  onChange={(e) => setNewEntry({ ...newEntry, confidenceLevel: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  rows={3}
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="How are you feeling today? Any insights or challenges?"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Entry'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 