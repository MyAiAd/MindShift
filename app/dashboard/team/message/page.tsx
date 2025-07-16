'use client';

import React, { useState, useEffect } from 'react';
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
  User,
  Loader2
} from 'lucide-react';

// Types
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  tenant_id: string;
  created_at: string;
  name?: string;
  lastActive?: string;
  avatar?: string;
  status?: string;
}

interface RecentMessage {
  message_id: string;
  sender_name: string;
  receiver_name: string;
  message_preview: string;
  message_type: string;
  status: string;
  created_at: string;
  is_sender: boolean;
}

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
  const [clients, setClients] = useState<Client[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients and recent messages
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch clients (profiles that are not the current user)
        const clientsResponse = await fetch('/api/admin/customers');
        if (!clientsResponse.ok) {
          throw new Error('Failed to fetch clients');
        }
        const clientsData = await clientsResponse.json();
        
        // Filter out current user and format data
        const formattedClients = clientsData.customers
          .filter((client: any) => client.id !== profile?.id)
          .map((client: any) => ({
            ...client,
            name: `${client.first_name} ${client.last_name}`,
            avatar: `${client.first_name[0]}${client.last_name[0]}`,
            status: client.role === 'user' ? 'active' : 'admin',
            lastActive: new Date(client.created_at).toLocaleDateString()
          }));
        
        setClients(formattedClients);
        
        // Fetch recent messages
        const messagesResponse = await fetch('/api/messages/recent?limit=10');
        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setRecentMessages(messagesData.messages || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchData();
    }
  }, [profile]);

  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!selectedClient || !message.trim()) return;
    
    setSending(true);
    setError(null);
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver_id: selectedClient.id,
          message_content: message.trim(),
          message_type: 'direct_message',
          template_used: selectedTemplate || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      console.log('Message sent:', data);
      
      // Clear form and refresh recent messages
      setMessage('');
      setSelectedClient(null);
      setSelectedTemplate('');
      
      // Refresh recent messages
      const messagesResponse = await fetch('/api/messages/recent?limit=10');
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        setRecentMessages(messagesData.messages || []);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSelect = (templateContent: string) => {
    setMessage(templateContent);
    setSelectedTemplate('');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return `${Math.floor(diffInHours / 24)} days ago`;
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600 dark:text-gray-300">Loading messaging interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <FeatureBanner 
        featureKey="team_management"
        message="Client messaging requires team management permissions and proper subscription access."
      />

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Message a Client</h1>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-300">Send messages and check-ins to your clients.</p>
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
              {filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No clients found matching your search.' : 'No clients available.'}
                  </p>
                </div>
              ) : (
                filteredClients.map((client) => (
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
                            client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {client.status}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{client.lastActive}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
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
                      <p className="font-medium text-gray-900 dark:text-white">{selectedClient.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{selectedClient.email}</p>
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
                    disabled={!message.trim() || sending}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Select a client to compose a message</p>
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
          {recentMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No recent messages yet.</p>
              <p className="text-sm text-gray-400 mt-1">Your sent and received messages will appear here.</p>
            </div>
          ) : (
            recentMessages.map((message) => (
              <div key={message.message_id} className={`border-l-4 pl-4 py-2 ${
                message.is_sender ? 'border-indigo-500' : 'border-green-500'
              }`}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {message.is_sender ? message.receiver_name : message.sender_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(message.created_at)}
                  </span>
                  {message.status === 'read' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    message.is_sender 
                      ? 'bg-indigo-100 text-indigo-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {message.is_sender ? 'Sent' : 'Received'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{message.message_preview}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 