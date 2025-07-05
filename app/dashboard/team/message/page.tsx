'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import FeatureGuard, { FeatureBanner } from '@/components/auth/FeatureGuard';
import { 
  ArrowLeft, 
  MessageCircle, 
  Send, 
  Users, 
  Search,
  Clock,
  CheckCircle,
  User
} from 'lucide-react';

// Types
interface Client {
  id: number;
  name: string;
  email: string;
  lastActive: string;
  avatar: string;
  status: string;
}

// Sample clients data
const sampleClients: Client[] = [
  {
    id: 1,
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    lastActive: '2 hours ago',
    avatar: 'SJ',
    status: 'active'
  },
  {
    id: 2,
    name: 'Mike Chen',
    email: 'mike.chen@email.com',
    lastActive: '1 day ago',
    avatar: 'MC',
    status: 'active'
  },
  {
    id: 3,
    name: 'Emma Davis',
    email: 'emma.davis@email.com',
    lastActive: '3 days ago',
    avatar: 'ED',
    status: 'pending'
  },
  {
    id: 4,
    name: 'Alex Rodriguez',
    email: 'alex.rodriguez@email.com',
    lastActive: '1 week ago',
    avatar: 'AR',
    status: 'active'
  }
];

const messageTemplates = [
  {
    id: 1,
    title: 'Goal Check-in',
    content: 'Hi! I wanted to check in on your progress with your current goals. How are things going?'
  },
  {
    id: 2,
    title: 'Weekly Encouragement',
    content: 'Hope you\'re having a great week! Remember, every small step counts towards your bigger goals.'
  },
  {
    id: 3,
    title: 'Session Reminder',
    content: 'Just a friendly reminder about your upcoming session. Looking forward to our conversation!'
  },
  {
    id: 4,
    title: 'Resource Sharing',
    content: 'I found some resources that might be helpful for your current mindset work. Would you like me to share them?'
  }
];

export default function MessageClientPage() {
  const { profile } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const filteredClients = sampleClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!selectedClient || !message.trim()) return;
    
    // This would integrate with your actual messaging system
    alert(`Message sent to ${selectedClient.name}: ${message}`);
    setMessage('');
    setSelectedClient(null);
  };

  const handleTemplateSelect = (templateContent: string) => {
    setMessage(templateContent);
    setSelectedTemplate('');
  };

  return (
    <div className="p-8">
      <FeatureBanner 
        featureKey="team_management"
        message="Client messaging requires team management permissions and proper subscription access."
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link 
            href="/dashboard/team"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Message a Client</h1>
          </div>
        </div>
        <p className="text-gray-600">Send messages and check-ins to your clients.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Client List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-indigo-600" />
              Select Client
            </h2>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Client List */}
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedClient?.id === client.id
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-indigo-600">
                        {client.avatar}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{client.name}</p>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {client.status}
                        </span>
                        <p className="text-xs text-gray-500">{client.lastActive}</p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message Composer */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Send className="h-5 w-5 mr-2 text-indigo-600" />
              Compose Message
            </h2>

            {selectedClient ? (
              <div className="space-y-4">
                {/* Selected Client Info */}
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {selectedClient.avatar}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedClient.name}</p>
                      <p className="text-sm text-gray-600">{selectedClient.email}</p>
                    </div>
                  </div>
                </div>

                {/* Message Templates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Templates
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      const template = messageTemplates.find(t => t.id === parseInt(e.target.value));
                      if (template) {
                        handleTemplateSelect(template.content);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a template...</option>
                    {messageTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Type your message here..."
                  />
                </div>

                {/* Send Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a client to compose a message</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-indigo-600" />
          Recent Messages
        </h2>
        
        <div className="space-y-4">
          {/* Sample recent messages */}
          <div className="border-l-4 border-indigo-500 pl-4 py-2">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-gray-900">Sarah Johnson</span>
              <span className="text-xs text-gray-500">2 hours ago</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-gray-600">Weekly check-in sent</p>
          </div>
          
          <div className="border-l-4 border-green-500 pl-4 py-2">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-gray-900">Mike Chen</span>
              <span className="text-xs text-gray-500">1 day ago</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-gray-600">Goal progress encouragement sent</p>
          </div>
          
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium text-gray-900">Emma Davis</span>
              <span className="text-xs text-gray-500">3 days ago</span>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-gray-600">Session reminder sent</p>
          </div>
        </div>
      </div>
    </div>
  );
} 