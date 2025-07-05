'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Goal, ProgressEntry } from '@/types/database';
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
  X
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
  const [loading, setLoading] = useState(true);
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
      fetchGoals()
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
            <h1 className="text-3xl font-bold text-gray-900">Progress</h1>
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
              <p className="text-2xl font-semibold text-gray-900">{stats?.overview.overallProgress || 0}%</p>
              <p className="text-gray-600">Overall Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">{stats?.overview.completedGoals || 0}</p>
              <p className="text-gray-600">Goals Achieved</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">{stats?.overview.totalProgressEntries || 0}</p>
              <p className="text-gray-600">Progress Entries</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Award className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">{stats?.overview.completedMilestones || 0}</p>
              <p className="text-gray-600">Milestones</p>
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
                <p className="text-2xl font-semibold text-gray-900">{stats?.overview.avgMoodScore || 0}/10</p>
                <p className="text-gray-600">Mood Score</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-lg ${getScoreBackground(stats?.overview.avgEnergyLevel || 0)}`}>
            <div className="flex items-center">
              <Zap className={`h-6 w-6 ${getScoreColor(stats?.overview.avgEnergyLevel || 0)} mr-3`} />
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats?.overview.avgEnergyLevel || 0}/10</p>
                <p className="text-gray-600">Energy Level</p>
              </div>
            </div>
          </div>
          
          <div className={`p-4 rounded-lg ${getScoreBackground(stats?.overview.avgConfidenceLevel || 0)}`}>
            <div className="flex items-center">
              <Shield className={`h-6 w-6 ${getScoreColor(stats?.overview.avgConfidenceLevel || 0)} mr-3`} />
              <div>
                <p className="text-2xl font-semibold text-gray-900">{stats?.overview.avgConfidenceLevel || 0}/10</p>
                <p className="text-gray-600">Confidence Level</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Progress Over Time</h2>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
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
              <p className="text-gray-500">No progress data yet</p>
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

      {/* Recent Achievements & Progress Breakdown */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h2>
          <div className="space-y-4">
            {stats?.recentAchievements.completedGoals.length === 0 && 
             stats?.recentAchievements.completedMilestones.length === 0 ? (
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No recent achievements</p>
                <p className="text-sm text-gray-400">Complete goals to see achievements here</p>
              </div>
            ) : (
              <>
                {stats?.recentAchievements.completedGoals.map((achievement) => (
                  <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Target className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-gray-900">{achievement.title}</p>
                      <p className="text-sm text-gray-600">Goal completed</p>
                      <p className="text-xs text-gray-500">{formatDate(achievement.completedAt)}</p>
                    </div>
                  </div>
                ))}
                
                {stats?.recentAchievements.completedMilestones.map((achievement) => (
                  <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Award className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{achievement.title}</p>
                      <p className="text-sm text-gray-600">Milestone reached</p>
                      <p className="text-xs text-gray-500">{formatDate(achievement.completedAt)}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Progress by Goal Status */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Goals by Status</h2>
          <div className="space-y-4">
            {Object.entries(stats?.progressByGoalStatus || {}).map(([status, count]) => {
              const statusLabels = {
                'completed': 'Completed',
                'in_progress': 'In Progress',
                'not_started': 'Not Started',
                'paused': 'Paused'
              };
              
              const statusColors = {
                'completed': 'bg-green-600',
                'in_progress': 'bg-blue-600',
                'not_started': 'bg-gray-600',
                'paused': 'bg-yellow-600'
              };
              
              const totalGoals = stats?.overview.totalGoals || 1;
              const percentage = Math.round((count / totalGoals) * 100);
              
              return (
                <div key={status}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {statusLabels[status as keyof typeof statusLabels] || status}
                    </span>
                    <span className="text-sm text-gray-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${statusColors[status as keyof typeof statusColors] || 'bg-gray-600'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            
            {Object.keys(stats?.progressByGoalStatus || {}).length === 0 && (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No goals yet</p>
                <p className="text-sm text-gray-400">Create your first goal to see progress</p>
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
              <h3 className="text-lg font-semibold text-gray-900">Log Progress Entry</h3>
              <button
                onClick={() => setShowNewEntryModal(false)}
                className="text-gray-400 hover:text-gray-600"
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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