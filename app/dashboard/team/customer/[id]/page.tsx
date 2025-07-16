'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Calendar, 
  CreditCard, 
  MessageSquare,
  Edit,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Crown,
  Zap,
  Star,
  Plus,
  FileText,
  Building,
  Shield
} from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenants?: {
    id: string;
    name: string;
    slug: string;
  };
  user_subscriptions?: Array<{
    id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    created_at: string;
    subscription_plans: {
      id: string;
      name: string;
      tier: string;
      price_monthly: number;
      price_yearly: number;
    };
  }>;
  billing_info?: {
    id: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    payment_method_last4: string;
    payment_method_type: string;
  };
  notes?: Array<{
    id: string;
    content: string;
    priority: string;
    note_type?: string;
    tags: string[];
    created_at: string;
    created_by: string;
    follow_up_date: string;
    resolved_at?: string;
    profiles: {
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
  transactions?: Array<{
    id: string;
    amount_cents: number;
    currency: string;
    status: string;
    transaction_type: string;
    processor: string;
    created_at: string;
    description: string;
  }>;
  analytics?: {
    lifetime_value_cents: number;
    total_transactions: number;
    average_transaction_cents: number;
    days_since_last_payment: number;
    subscription_length_days: number;
  };
}

export default function CustomerDetailPage() {
  const { user, profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [notePriority, setNotePriority] = useState('medium');
  const [noteFollowUp, setNoteFollowUp] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Subscription management modal states
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState('');
  const [trialDays, setTrialDays] = useState(30);
  const [newStatus, setNewStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  
  // Admin logs state
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Permissions state
  const [permissions, setPermissions] = useState<any>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsUpdating, setPermissionsUpdating] = useState(false);
  
  // Communication enhancement state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [communicationFilter, setCommunicationFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (user && profile && ['tenant_admin', 'super_admin'].includes(profile.role || '')) {
      fetchCustomerDetails();
    }
  }, [user, profile, customerId]);

  useEffect(() => {
    if (activeTab === 'admin_logs' && user && profile && ['tenant_admin', 'super_admin'].includes(profile.role || '')) {
      fetchAdminLogs();
    }
  }, [activeTab, user, profile, customerId]);

  useEffect(() => {
    if (activeTab === 'permissions' && user && profile && ['tenant_admin', 'super_admin'].includes(profile.role || '')) {
      fetchPermissions();
    }
  }, [activeTab, user, profile, customerId]);

  const fetchCustomerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setCustomer(data.customer);
      } else {
        setError('Failed to fetch customer details');
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setError('Error loading customer details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminLogs = async () => {
    try {
      setLogsLoading(true);
      
      // Fetch admin logs from audit_logs table
      const response = await fetch(`/api/admin/customers/${customerId}?include_logs=true`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAdminLogs(data.admin_logs || []);
      } else {
        console.error('Failed to fetch admin logs');
      }
    } catch (error) {
      console.error('Error fetching admin logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      setPermissionsLoading(true);
      
      // Fetch current permissions from feature_access table
      const response = await fetch(`/api/admin/customers/${customerId}/permissions`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || {});
      } else {
        console.error('Failed to fetch permissions');
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handlePermissionToggle = async (featureKey: string, enabled: boolean) => {
    setPermissionsUpdating(true);
    
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          feature_key: featureKey,
          enabled: enabled
        })
      });

      if (response.ok) {
        setPermissions((prev: any) => ({
          ...prev,
          [featureKey]: enabled
        }));
        fetchCustomerDetails(); // Refresh customer data
      } else {
        console.error('Failed to update permissions');
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
    } finally {
      setPermissionsUpdating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add_note',
          customer_id: customerId,
          content: newNote,
          priority: notePriority,
          follow_up_date: noteFollowUp || null
        })
      });

      if (response.ok) {
        setNewNote('');
        setNotePriority('medium');
        setNoteFollowUp('');
        setShowNoteModal(false);
        fetchCustomerDetails(); // Refresh data
      } else {
        setError('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      setError('Error adding note');
    }
  };

  const handleSubscriptionAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriptionAction) return;

    setActionLoading(true);
    setActionMessage('');

    try {
      const payload: any = {
        action: subscriptionAction,
        customer_id: customerId
      };

      // Add specific parameters based on action
      if (subscriptionAction === 'extend_trial') {
        payload.trial_days = trialDays;
      } else if (subscriptionAction === 'manual_status_change') {
        payload.new_status = newStatus;
      }

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setActionMessage(`Success: ${data.message}`);
        setSubscriptionAction('');
        setTrialDays(30);
        setNewStatus('');
        setTimeout(() => {
          setShowSubscriptionModal(false);
          setActionMessage('');
          fetchCustomerDetails(); // Refresh data
        }, 2000);
      } else {
        setActionMessage(`Error: ${data.error || 'Failed to perform action'}`);
      }
    } catch (error) {
      console.error('Error performing subscription action:', error);
      setActionMessage('Error performing action');
    } finally {
      setActionLoading(false);
    }
  };

  const getSubscriptionIcon = (tier: string) => {
    switch (tier) {
      case 'level_2': return <Crown className="h-5 w-5 text-purple-500" />;
      case 'level_1': return <Zap className="h-5 w-5 text-blue-500" />;
      default: return <Star className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">Active</span>;
      case 'trialing':
        return <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">Trial</span>;
      case 'past_due':
        return <span className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">Past Due</span>;
      case 'cancelled':
        return <span className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">Cancelled</span>;
      default:
        return <span className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">High</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Medium</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Low</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{priority}</span>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Communication helper functions
  const getCommunicationTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-green-50 text-green-600';
      case 'call': return 'bg-blue-50 text-blue-600';
      case 'meeting': return 'bg-purple-50 text-purple-600';
      case 'note': 
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getCommunicationTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'call': return <Calendar className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'note':
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getCommunicationTypeLabel = (type: string) => {
    switch (type) {
      case 'email': return 'Email';
      case 'call': return 'Phone Call';
      case 'meeting': return 'Meeting';
      case 'note':
      default: return 'Note';
    }
  };

  const markFollowUpComplete = async (noteId: string) => {
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'resolve_note',
          note_id: noteId
        })
      });

      if (response.ok) {
        fetchCustomerDetails(); // Refresh data
      } else {
        console.error('Failed to mark follow-up complete');
      }
    } catch (error) {
      console.error('Error marking follow-up complete:', error);
    }
  };

  const markNoteResolved = async (noteId: string) => {
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'resolve_note',
          note_id: noteId
        })
      });

      if (response.ok) {
        fetchCustomerDetails(); // Refresh data
      } else {
        console.error('Failed to resolve note');
      }
    } catch (error) {
      console.error('Error resolving note:', error);
    }
  };

  const handleLogEmail = async (emailData: {
    subject: string;
    content: string;
    direction: string;
    priority: string;
    follow_up_date: string | null;
  }) => {
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add_note',
          customer_id: customerId,
          content: `${emailData.direction === 'sent' ? 'Sent' : 'Received'} Email: ${emailData.subject}\n\n${emailData.content}`,
          note_type: 'email',
          priority: emailData.priority,
          follow_up_date: emailData.follow_up_date,
          tags: [emailData.direction]
        })
      });

      if (response.ok) {
        setShowEmailModal(false);
        fetchCustomerDetails(); // Refresh data
      } else {
        setError('Failed to log email');
      }
    } catch (error) {
      console.error('Error logging email:', error);
      setError('Error logging email');
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role || '')) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h3>
          <p className="text-red-700">You need admin permissions to access customer details.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Customer</h3>
          <p className="text-red-700">{error || 'Customer not found'}</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const subscription = customer.user_subscriptions?.[0];
  const analytics = customer.analytics;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Customer Management
        </button>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl">
              {(customer.first_name?.[0] || '') + (customer.last_name?.[0] || customer.email[0].toUpperCase())}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {customer.first_name && customer.last_name 
                  ? `${customer.first_name} ${customer.last_name}`
                  : customer.email
                }
              </h1>
              <p className="text-gray-600 dark:text-gray-300">{customer.email}</p>
              <div className="flex items-center space-x-4 mt-2">
                {subscription && getStatusBadge(subscription.status)}
                {profile?.role === 'super_admin' && customer.tenants && (
                  <span className="flex items-center text-purple-600">
                    <Building className="h-4 w-4 mr-1" />
                    {customer.tenants.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowNoteModal(true)}
              className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </button>
            {subscription && (
              <button
                onClick={() => setShowSubscriptionModal(true)}
                className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-2" />
                Manage Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {analytics?.subscription_length_days || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-300">Days as Customer</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(analytics?.lifetime_value_cents || 0)}
              </p>
              <p className="text-gray-600 dark:text-gray-300">Lifetime Value</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {analytics?.total_transactions || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-300">Total Transactions</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {analytics?.days_since_last_payment || 0}
              </p>
              <p className="text-gray-600 dark:text-gray-300">Days Since Last Payment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {['overview', 'subscription', 'billing', 'notes', 'transactions', 'admin_logs', 'permissions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'admin_logs' ? 'Admin Logs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {customer.first_name && customer.last_name 
                      ? `${customer.first_name} ${customer.last_name}`
                      : 'Not provided'
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{customer.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Status</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {customer.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Join Date</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(customer.created_at)}</p>
                </div>
              </div>
            </div>

            {subscription && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    {getSubscriptionIcon(subscription.subscription_plans.tier)}
                    <span className="font-medium">{subscription.subscription_plans.name}</span>
                    {getStatusBadge(subscription.status)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Monthly Price:</span>
                      <span className="ml-2 font-medium">{formatCurrency(subscription.subscription_plans.price_monthly * 100)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Current Period:</span>
                      <span className="ml-2 font-medium">
                        {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'subscription' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription History</h3>
            {customer.user_subscriptions?.length ? (
              <div className="space-y-4">
                {customer.user_subscriptions.map((sub) => (
                  <div key={sub.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getSubscriptionIcon(sub.subscription_plans.tier)}
                        <span className="font-medium">{sub.subscription_plans.name}</span>
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <div>
                        <span className="font-medium">Period:</span> {formatDate(sub.current_period_start)} - {formatDate(sub.current_period_end)}
                      </div>
                      <div>
                        <span className="font-medium">Price:</span> {formatCurrency(sub.subscription_plans.price_monthly * 100)}/month
                      </div>
                      <div>
                        <span className="font-medium">Started:</span> {formatDate(sub.created_at)}
                      </div>
                    </div>
                    {sub.cancel_at_period_end && (
                      <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                        <p className="text-sm text-orange-800">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          This subscription will cancel at the end of the current period.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No subscription history found.</p>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Information</h3>
            {customer.billing_info ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Billing Address</h4>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <p>{customer.billing_info.address_line1}</p>
                    {customer.billing_info.address_line2 && <p>{customer.billing_info.address_line2}</p>}
                    <p>{customer.billing_info.city}, {customer.billing_info.state} {customer.billing_info.postal_code}</p>
                    <p>{customer.billing_info.country}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Payment Method</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                    <CreditCard className="h-4 w-4" />
                    <span>{customer.billing_info.payment_method_type} ending in {customer.billing_info.payment_method_last4}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No billing information on file.</p>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Communication</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Add Note
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Mail className="h-4 w-4 inline mr-1" />
                  Log Email
                </button>
              </div>
            </div>

            {/* Communication Filter */}
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
                  <select
                    value={communicationFilter}
                    onChange={(e) => setCommunicationFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Communications</option>
                    <option value="note">Notes Only</option>
                    <option value="email">Emails Only</option>
                    <option value="call">Calls Only</option>
                    <option value="meeting">Meetings Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="pending_followup">Pending Follow-up</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Follow-up Reminders */}
            {customer.notes?.some(note => note.follow_up_date && new Date(note.follow_up_date) <= new Date() && !note.resolved_at) && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-yellow-600 mr-2" />
                  <h4 className="font-medium text-yellow-800">Pending Follow-ups</h4>
                </div>
                <div className="mt-2 space-y-2">
                  {customer.notes
                    ?.filter(note => note.follow_up_date && new Date(note.follow_up_date) <= new Date() && !note.resolved_at)
                    .map(note => (
                      <div key={note.id} className="flex items-center justify-between bg-white p-3 rounded border">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{note.content.substring(0, 100)}...</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Due: {formatDate(note.follow_up_date)}</p>
                        </div>
                        <button
                          onClick={() => markFollowUpComplete(note.id)}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Mark Complete
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Communication Timeline */}
            {customer.notes?.length ? (
              <div className="space-y-4">
                {customer.notes
                  .filter(note => {
                    if (communicationFilter !== 'all' && note.note_type !== communicationFilter) return false;
                    if (priorityFilter !== 'all' && note.priority !== priorityFilter) return false;
                    if (statusFilter === 'open' && note.resolved_at) return false;
                    if (statusFilter === 'resolved' && !note.resolved_at) return false;
                    if (statusFilter === 'pending_followup' && (!note.follow_up_date || note.resolved_at)) return false;
                    return true;
                  })
                  .map((note) => (
                    <div key={note.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${getCommunicationTypeColor(note.note_type || 'note')}`}>
                            {getCommunicationTypeIcon(note.note_type || 'note')}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {getCommunicationTypeLabel(note.note_type || 'note')}
                              </span>
                              {getPriorityBadge(note.priority)}
                              {note.tags && note.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              By {note.profiles.first_name} {note.profiles.last_name} • {formatDateTime(note.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {note.resolved_at ? (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              Resolved
                            </span>
                          ) : note.follow_up_date && new Date(note.follow_up_date) <= new Date() ? (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                              Follow-up Due
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              Open
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-gray-900 dark:text-white">{note.content}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          {note.follow_up_date && !note.resolved_at && (
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Follow-up: {formatDate(note.follow_up_date)}
                            </span>
                          )}
                          {note.resolved_at && (
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolved: {formatDate(note.resolved_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {!note.resolved_at && (
                            <button
                              onClick={() => markNoteResolved(note.id)}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Communication History</h3>
                <p className="text-gray-600 mb-4">Start building a communication history with this customer.</p>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add First Note
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h3>
            {customer.transactions?.length ? (
              <div className="space-y-4">
                {customer.transactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${
                          transaction.status === 'succeeded' ? 'bg-green-50' : 
                          transaction.status === 'failed' ? 'bg-red-50' : 'bg-yellow-50'
                        }`}>
                          {transaction.status === 'succeeded' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : transaction.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{formatCurrency(transaction.amount_cents)}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{transaction.description || transaction.transaction_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(transaction.created_at)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.processor}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No transactions found for this customer.</p>
            )}
          </div>
        )}

        {activeTab === 'admin_logs' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Action Logs</h3>
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading admin logs...</span>
              </div>
            ) : adminLogs.length ? (
              <div className="space-y-4">
                {adminLogs.map((log, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                          <Shield className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{log.action}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{log.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-900 dark:text-white">{formatDateTime(log.created_at)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{log.performed_by}</p>
                      </div>
                    </div>
                    {log.details && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{log.details}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No admin actions recorded for this customer.</p>
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Permissions</h3>
            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading permissions...</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Shield className="h-5 w-5 text-blue-600 mr-2" />
                    <p className="text-sm text-blue-800">
                      Manage feature-level access for this customer. Changes take effect immediately.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Core Features */}
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Core Features</h4>
                    <div className="space-y-3">
                      {[
                        { key: 'goal_setting', name: 'Goal Setting', description: 'Create and manage personal goals' },
                        { key: 'progress_tracking', name: 'Progress Tracking', description: 'View progress charts and analytics' },
                        { key: 'treatment_sessions', name: 'Treatment Sessions', description: 'Access therapy sessions' },
                        { key: 'ai_assistance', name: 'AI Assistance', description: 'Get AI-powered insights and recommendations' }
                      ].map((feature) => (
                        <div key={feature.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{feature.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
                          </div>
                          <button
                            onClick={() => handlePermissionToggle(feature.key, !permissions[feature.key])}
                            disabled={permissionsUpdating}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              permissions[feature.key] ? 'bg-indigo-600' : 'bg-gray-200'
                            } ${permissionsUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                permissions[feature.key] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advanced Features */}
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Advanced Features</h4>
                    <div className="space-y-3">
                      {[
                        { key: 'team_management', name: 'Team Management', description: 'Manage team members and collaboration' },
                        { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed reports and insights' },
                        { key: 'custom_treatments', name: 'Custom Treatments', description: 'Create personalized treatment plans' },
                        { key: 'data_export', name: 'Data Export', description: 'Export personal data and reports' }
                      ].map((feature) => (
                        <div key={feature.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{feature.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
                          </div>
                          <button
                            onClick={() => handlePermissionToggle(feature.key, !permissions[feature.key])}
                            disabled={permissionsUpdating}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              permissions[feature.key] ? 'bg-indigo-600' : 'bg-gray-200'
                            } ${permissionsUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                permissions[feature.key] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Role & Subscription Override */}
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Role & Subscription Override</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Customer Role</label>
                      <select
                        value={customer.role || 'user'}
                        onChange={(e) => {
                          // Handle role change
                          console.log('Role change:', e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="user">User</option>
                        <option value="coach">Coach</option>
                        <option value="manager">Manager</option>
                        <option value="tenant_admin">Tenant Admin</option>
                        {profile?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier Override</label>
                      <select
                        value={customer.subscription_tier || 'trial'}
                        onChange={(e) => {
                          // Handle tier change
                          console.log('Tier change:', e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="trial">Trial</option>
                        <option value="level_1">Level 1</option>
                        <option value="level_2">Level 2</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Role and subscription changes affect system-wide access and should be used carefully.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Customer Note</h3>
            <form onSubmit={handleAddNote} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Note Content</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  rows={4}
                  placeholder="Enter your note here..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={notePriority}
                    onChange={(e) => setNotePriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                  <input
                    type="date"
                    value={noteFollowUp}
                    onChange={(e) => setNoteFollowUp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowNoteModal(false)} 
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-gray-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Log Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Email Communication</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              handleLogEmail({
                subject: formData.get('subject') as string,
                content: formData.get('content') as string,
                direction: formData.get('direction') as string,
                priority: formData.get('priority') as string,
                follow_up_date: formData.get('follow_up_date') as string || null
              });
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
                <input
                  type="text"
                  name="subject"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Email subject line..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
                <select
                  name="direction"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="sent">Sent to Customer</option>
                  <option value="received">Received from Customer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Content/Summary</label>
                <textarea
                  name="content"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  rows={4}
                  placeholder="Summarize the email content or key points discussed..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    name="priority"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                  <input
                    type="date"
                    name="follow_up_date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowEmailModal(false)} 
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-gray-900"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Log Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subscription Management Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Subscription</h3>
            
            {actionMessage && (
              <div className={`mb-4 p-3 rounded-lg ${
                actionMessage.startsWith('Success') 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {actionMessage}
              </div>
            )}

            <form onSubmit={handleSubscriptionAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <select
                  value={subscriptionAction}
                  onChange={(e) => setSubscriptionAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select an action...</option>
                  <option value="extend_trial">Extend Trial Period</option>
                  <option value="pause_subscription">Pause Subscription</option>
                  <option value="reactivate_subscription">Reactivate Subscription</option>
                  <option value="manual_status_change">Change Status Manually</option>
                </select>
              </div>

              {subscriptionAction === 'extend_trial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extend Trial by (days)
                  </label>
                  <input
                    type="number"
                    value={trialDays}
                    onChange={(e) => setTrialDays(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    min="1"
                    max="365"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Current trial will be extended by this many days
                  </p>
                </div>
              )}

              {subscriptionAction === 'manual_status_change' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select new status...</option>
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past Due</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="paused">Paused</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Manually override the subscription status
                  </p>
                </div>
              )}

              {subscriptionAction === 'pause_subscription' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    This will pause the current subscription. The customer will retain access until the current period ends.
                  </p>
                </div>
              )}

              {subscriptionAction === 'reactivate_subscription' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    This will reactivate a paused subscription and resume billing.
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    setSubscriptionAction('');
                    setActionMessage('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:bg-gray-900"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={actionLoading || !subscriptionAction}
                >
                  {actionLoading ? 'Processing...' : 'Apply Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 