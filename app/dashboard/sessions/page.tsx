'use client';

import React, { useState } from 'react';
import { Calendar, Clock, Video, Plus, User, CheckCircle, AlertCircle } from 'lucide-react';

const sessions = [
  {
    id: 1,
    title: 'Confidence Building Session',
    coach: 'Dr. Sarah Miller',
    date: '2024-03-25',
    time: '2:00 PM',
    duration: 60,
    type: 'video',
    status: 'upcoming'
  },
  {
    id: 2,
    title: 'Goal Setting Workshop',
    coach: 'Michael Chen',
    date: '2024-03-20',
    time: '10:00 AM',
    duration: 45,
    type: 'video',
    status: 'completed'
  },
  {
    id: 3,
    title: 'Mindfulness Practice',
    coach: 'AI Coach',
    date: '2024-03-18',
    time: '3:30 PM',
    duration: 30,
    type: 'ai',
    status: 'completed'
  }
];

export default function SessionsPage() {
  const [showBookModal, setShowBookModal] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Upcoming</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Cancelled</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coaching Sessions</h1>
            <p className="text-gray-600 mt-1">Manage your coaching sessions and track your progress with AI and human coaches.</p>
          </div>
          <button 
            onClick={() => setShowBookModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Book Session
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">1</p>
              <p className="text-gray-600">Upcoming</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">15</p>
              <p className="text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">12.5</p>
              <p className="text-gray-600">Hours This Month</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Video className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">8</p>
              <p className="text-gray-600">Available Slots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {sessions.map((session) => (
            <div key={session.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    {session.type === 'ai' ? (
                      <Video className="h-6 w-6 text-indigo-600" />
                    ) : (
                      <User className="h-6 w-6 text-indigo-600" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{session.title}</h3>
                    <p className="text-sm text-gray-600">with {session.coach}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {session.date}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {session.time} ({session.duration} min)
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {getStatusBadge(session.status)}
                  {session.status === 'upcoming' && (
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                      Join Session
                    </button>
                  )}
                  {session.status === 'completed' && (
                    <button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                      View Notes
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Video className="h-8 w-8 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Coaching</h3>
          </div>
          <p className="text-gray-600 mb-4">Get instant coaching sessions with our AI coach available 24/7.</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Start AI Session
          </button>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-8 w-8 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Human Coach</h3>
          </div>
          <p className="text-gray-600 mb-4">Book a session with one of our certified human coaches.</p>
          <button 
            onClick={() => setShowBookModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Book with Coach
          </button>
        </div>
      </div>

      {/* Book Session Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Book a Session</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>Goal Setting</option>
                  <option>Confidence Building</option>
                  <option>Stress Management</option>
                  <option>Career Development</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Coach</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>Any Available</option>
                  <option>Dr. Sarah Miller</option>
                  <option>Michael Chen</option>
                  <option>AI Coach</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>9:00 AM</option>
                  <option>10:00 AM</option>
                  <option>2:00 PM</option>
                  <option>3:00 PM</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Book Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 