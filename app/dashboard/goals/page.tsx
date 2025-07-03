'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Target, 
  Plus, 
  Calendar, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Filter,
  MoreVertical,
  Flag,
  PlayCircle
} from 'lucide-react';

const goals = [
  {
    id: 1,
    title: 'Improve Public Speaking Confidence',
    description: 'Overcome fear of speaking in front of large groups and deliver compelling presentations.',
    category: 'Professional Development',
    priority: 'high',
    status: 'in_progress',
    progress: 65,
    startDate: '2024-01-15',
    targetDate: '2024-04-15',
    milestones: 8,
    completedMilestones: 5
  },
  {
    id: 2,
    title: 'Develop Growth Mindset',
    description: 'Shift from fixed mindset to growth mindset in challenging situations.',
    category: 'Personal Growth',
    priority: 'medium',
    status: 'in_progress',
    progress: 40,
    startDate: '2024-02-01',
    targetDate: '2024-06-01',
    milestones: 6,
    completedMilestones: 2
  },
  {
    id: 3,
    title: 'Work-Life Balance',
    description: 'Establish healthy boundaries between work and personal life.',
    category: 'Wellness',
    priority: 'high',
    status: 'completed',
    progress: 100,
    startDate: '2023-12-01',
    targetDate: '2024-03-01',
    milestones: 5,
    completedMilestones: 5
  },
  {
    id: 4,
    title: 'Leadership Skills',
    description: 'Develop emotional intelligence and team leadership capabilities.',
    category: 'Professional Development',
    priority: 'medium',
    status: 'not_started',
    progress: 0,
    startDate: '2024-04-01',
    targetDate: '2024-08-01',
    milestones: 10,
    completedMilestones: 0
  }
];

export default function GoalsPage() {
  const { profile } = useAuth();
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredGoals = goals.filter(goal => 
    filterStatus === 'all' || goal.status === filterStatus
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">In Progress</span>;
      case 'not_started':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">Not Started</span>;
      case 'paused':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Paused</span>;
      default:
        return null;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Goals</h1>
            <p className="text-gray-600 mt-1">
              Track your personal growth journey and achieve your mindset transformation goals.
            </p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Goal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">4</p>
              <p className="text-gray-600">Total Goals</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">1</p>
              <p className="text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">2</p>
              <p className="text-gray-600">In Progress</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">51%</p>
              <p className="text-gray-600">Avg Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filter by status:</span>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filterStatus === 'all' 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filterStatus === 'in_progress' 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filterStatus === 'completed' 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilterStatus('not_started')}
              className={`px-3 py-1 rounded-lg text-sm ${
                filterStatus === 'not_started' 
                  ? 'bg-indigo-100 text-indigo-800' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Not Started
            </button>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid gap-6">
        {filteredGoals.map((goal) => (
          <div key={goal.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{goal.title}</h3>
                  <Flag className={`h-4 w-4 ${getPriorityColor(goal.priority)}`} />
                  {getStatusBadge(goal.status)}
                </div>
                <p className="text-gray-600 mb-3">{goal.description}</p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="bg-gray-100 px-2 py-1 rounded-full">{goal.category}</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {goal.startDate} - {goal.targetDate}
                  </div>
                  <span>{goal.completedMilestones}/{goal.milestones} milestones</span>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-500">{goal.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${goal.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {goal.status === 'not_started' && (
                <button className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Goal
                </button>
              )}
              {goal.status === 'in_progress' && (
                <button className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Update Progress
                </button>
              )}
              <button className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredGoals.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No goals found</h3>
          <p className="text-gray-600 mb-6">
            {filterStatus === 'all' 
              ? "You haven't created any goals yet. Start your transformation journey by setting your first goal."
              : `No goals with status "${filterStatus.replace('_', ' ')}" found.`
            }
          </p>
          {filterStatus === 'all' && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Your First Goal
            </button>
          )}
        </div>
      )}

      {/* Create Goal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Goal</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Improve public speaking confidence"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Describe what you want to achieve and why it's important to you..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                    <option>Personal Growth</option>
                    <option>Professional Development</option>
                    <option>Wellness</option>
                    <option>Relationships</option>
                    <option>Financial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                    <option>Medium</option>
                    <option>High</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 