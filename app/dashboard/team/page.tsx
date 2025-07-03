'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import FeatureGuard, { FeatureBanner } from '@/components/auth/FeatureGuard';
import { Users, Plus, Search, UserPlus, Mail, Shield, User, Crown, Clock } from 'lucide-react';

const teamMembers = [
  {
    id: 1,
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'Team Lead',
    status: 'active',
    lastActive: '2 hours ago',
    avatar: 'SJ',
    progress: 87
  },
  {
    id: 2,
    name: 'Mike Chen',
    email: 'mike@company.com',
    role: 'Member',
    status: 'active',
    lastActive: '1 day ago',
    avatar: 'MC',
    progress: 72
  }
];

export default function TeamPage() {
  const { hasFeatureAccess } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="p-8">
      <FeatureBanner 
        featureKey="team_management"
        message="Team management requires a Complete MindShift subscription. Upgrade to invite team members and collaborate on goals."
      />

      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
            <p className="text-gray-600 mt-1">Manage your team members, invite new users, and track progress together.</p>
          </div>
          
          <FeatureGuard 
            featureKey="team_management"
            fallback={
              <button disabled className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Invite Member
              </button>
            }
          >
            <button 
              onClick={() => setShowInviteModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Invite Member
            </button>
          </FeatureGuard>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">4</p>
              <p className="text-gray-600">Total Members</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">3</p>
              <p className="text-gray-600">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Mail className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">1</p>
              <p className="text-gray-600">Pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900">84%</p>
              <p className="text-gray-600">Avg Progress</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <FeatureGuard 
        featureKey="team_management"
        fallback={
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Management Not Available</h3>
            <p className="text-gray-600 mb-4">Upgrade to Complete MindShift to manage team members and collaborate on goals.</p>
            <a href="/dashboard/subscription" className="inline-flex items-center bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
              Upgrade Now
            </a>
          </div>
        }
      >
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {teamMembers.map((member) => (
              <div key={member.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center">
                          {member.role === 'Team Lead' ? <Crown className="h-4 w-4 mr-1 text-yellow-500" /> : <User className="h-4 w-4 mr-1" />}
                          {member.role}
                        </span>
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {member.lastActive}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${member.progress}%` }}></div>
                      </div>
                      <span className="text-sm text-gray-600">{member.progress}%</span>
                    </div>
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FeatureGuard>

      {/* Invite Modal */}
      {showInviteModal && hasFeatureAccess('team_management') && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="colleague@company.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
                  <option>Member</option>
                  <option>Coach</option>
                  <option>Team Lead</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 