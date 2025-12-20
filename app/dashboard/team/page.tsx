'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import FeatureGuard, { FeatureBanner } from '@/components/auth/FeatureGuard';
import { 
  Users, 
  Search, 
  Filter, 
  ChevronDown, 
  Eye, 
  MessageSquare, 
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Crown,
  Zap,
  Star,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  subscription_tier: string;
  is_active: boolean;
  created_at: string;
  tenants?: {
    name: string;
    slug: string;
  };
  user_subscriptions?: Array<{
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    subscription_plans: {
      name: string;
      tier: string;
      price_monthly: number;
    };
  }>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CustomerManagementPage() {
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0
  });
  
  // Filter and search states
  const [search, setSearch] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (user && profile && ['tenant_admin', 'super_admin'].includes(profile.role || '')) {
      fetchCustomers();
      fetchAnalytics();
    }
  }, [user, profile, pagination.page, search, subscriptionTier, sortBy, sortOrder]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (search) params.set('search', search);
      if (subscriptionTier) params.set('subscription_tier', subscriptionTier);

      const response = await fetch(`/api/admin/customers?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
        setPagination(data.pagination || pagination);
      } else {
        console.error('Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/analytics?type=dashboard&days=30', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCustomers();
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const getSubscriptionIcon = (tier: string) => {
    switch (tier) {
      case 'level_2': return <Crown className="h-4 w-4 text-purple-500" />;
      case 'level_1': return <Zap className="h-4 w-4 text-blue-500" />;
      default: return <Star className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (customer: Customer) => {
    if (!customer.is_active) {
      return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Inactive</span>;
    }
    
    const subscription = customer.user_subscriptions?.[0];
    if (!subscription) {
      return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">No Subscription</span>;
    }

    if (subscription.cancel_at_period_end) {
      return <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">Cancelling</span>;
    }

    switch (subscription.status) {
      case 'active':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>;
      case 'trialing':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Trial</span>;
      case 'past_due':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Past Due</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{subscription.status}</span>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role || '')) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h3>
          <p className="text-red-700">You need admin permissions to access customer management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <FeatureBanner 
        featureKey="team_management"
        message="Customer management requires admin permissions and proper subscription access."
      />

      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-[#fdf6e3]">Customer Management</h1>
            <p className="text-gray-600 dark:text-[#93a1a1] mt-1">
              Manage your customers, subscriptions, and billing. 
              {profile?.role === 'super_admin' ? ' (Super Admin - All Tenants)' : ' (Tenant Admin)'}
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Analytics Dashboard */}
      {analytics && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.total_customers || 0}</p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Total Customers</p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">+{analytics.new_customers_this_month || 0} this month</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.active_subscriptions || 0}</p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Active Subscriptions</p>
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-600 dark:text-[#93a1a1]">
                      {((analytics.active_subscriptions || 0) / (analytics.total_customers || 1) * 100).toFixed(1)}% conversion rate
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">
                    {formatCurrency(analytics.monthly_recurring_revenue_cents || 0)}
                  </p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Monthly Revenue</p>
                  <div className="flex items-center mt-1">
                    <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600">
                      {formatCurrency(analytics.revenue_growth_cents || 0)} growth
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.trial_users || 0}</p>
                  <p className="text-gray-600 dark:text-[#93a1a1]">Trial Users</p>
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-600 dark:text-[#93a1a1]">
                      {analytics.trial_conversion_rate || 0}% convert to paid
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Revenue Trend Chart */}
            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">Revenue Trends</h3>
                <div className="text-sm text-gray-500 dark:text-[#839496] bg-gray-50 dark:bg-[#586e75] px-3 py-1 rounded-lg">
                  Current Period
                </div>
              </div>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-[#657b83] rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-[#839496]">Historical trend tracking coming soon</p>
                  <p className="text-sm text-gray-400">We're building comprehensive revenue analytics</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{formatCurrency(analytics.total_revenue_cents || 0)}</p>
                  <p className="text-sm text-gray-600 dark:text-[#93a1a1]">Total Revenue</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{formatCurrency(analytics.average_revenue_per_user_cents || 0)}</p>
                  <p className="text-sm text-gray-600 dark:text-[#93a1a1]">ARPU</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.churn_rate || 0}%</p>
                  <p className="text-sm text-gray-600 dark:text-[#93a1a1]">Churn Rate</p>
                </div>
              </div>
            </div>

            {/* Customer Lifecycle Chart */}
            <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-6">Customer Lifecycle</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                  <span className="text-gray-700 dark:text-[#93a1a1]">New Signups</span>
                </div>
                <div className="flex items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mr-2">{analytics.new_signups || 0}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: '80%'}}></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
                    <span className="text-gray-700 dark:text-[#93a1a1]">Trial Users</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mr-2">{analytics.trial_users || 0}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{width: '60%'}}></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-gray-700 dark:text-[#93a1a1]">Paid Customers</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mr-2">{analytics.active_subscriptions || 0}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '90%'}}></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
                    <span className="text-gray-700 dark:text-[#93a1a1]">Churned</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mr-2">{analytics.churned_customers || 0}</span>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{width: '20%'}}></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-[#586e75]">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.customer_lifetime_value_cents ? formatCurrency(analytics.customer_lifetime_value_cents) : '$0'}</p>
                    <p className="text-sm text-gray-600 dark:text-[#93a1a1]">Avg. CLV</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.average_subscription_length_days || 0} days</p>
                    <p className="text-sm text-gray-600 dark:text-[#93a1a1]">Avg. Subscription</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Tier Breakdown */}
          <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6 mb-8">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-6">Subscription Tier Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 border rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Star className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.trial_customers || 0}</p>
                <p className="text-gray-600 dark:text-[#93a1a1]">Trial Customers</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(0)}/month each</p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-400 h-2 rounded-full" 
                    style={{width: `${((analytics.trial_customers || 0) / (analytics.total_customers || 1)) * 100}%`}}
                  ></div>
                </div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="h-8 w-8 text-blue-500" />
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.level_1_customers || 0}</p>
                <p className="text-gray-600 dark:text-[#93a1a1]">Level 1 Customers</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(2999)}/month each</p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{width: `${((analytics.level_1_customers || 0) / (analytics.total_customers || 1)) * 100}%`}}
                  ></div>
                </div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Crown className="h-8 w-8 text-purple-500" />
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-[#fdf6e3]">{analytics.level_2_customers || 0}</p>
                <p className="text-gray-600 dark:text-[#93a1a1]">Level 2 Customers</p>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(4999)}/month each</p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full" 
                    style={{width: `${((analytics.level_2_customers || 0) / (analytics.total_customers || 1)) * 100}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-6 mb-6">
        <form onSubmit={handleSearch} className="flex items-center space-x-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-[#002b36]"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </form>

        {showFilters && (
          <div className="border-t pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                <select
                  value={subscriptionTier}
                  onChange={(e) => setSubscriptionTier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Tiers</option>
                  <option value="trial">Trial</option>
                  <option value="level_1">Level 1</option>
                  <option value="level_2">Level 2</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="created_at">Join Date</option>
                  <option value="email">Email</option>
                  <option value="first_name">First Name</option>
                  <option value="last_name">Last Name</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-[#002b36]"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Customer List */}
      <FeatureGuard 
        featureKey="team_management"
        fallback={
          <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-2">Customer Management Not Available</h3>
            <p className="text-gray-600 mb-4">Upgrade your subscription to access customer management features.</p>
          </div>
        }
      >
        <div className="bg-white dark:bg-[#073642] rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3]">
              Customers ({pagination.total})
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading customers...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-[#fdf6e3] mb-2">No customers found</h3>
              <p className="text-gray-600 dark:text-[#93a1a1]">Try adjusting your search or filter criteria.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <div key={customer.id} className="p-6 hover:bg-gray-50 dark:bg-[#002b36]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold">
                          {(customer.first_name?.[0] || '') + (customer.last_name?.[0] || customer.email[0].toUpperCase())}
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-[#fdf6e3]">
                            {customer.first_name && customer.last_name 
                              ? `${customer.first_name} ${customer.last_name}`
                              : customer.email
                            }
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-[#93a1a1]">{customer.email}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-[#839496]">
                            <span className="flex items-center">
                              {getSubscriptionIcon(customer.subscription_tier)}
                              <span className="ml-1">
                                {customer.user_subscriptions?.[0]?.subscription_plans?.name || 'No Plan'}
                              </span>
                            </span>
                            <span className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              Joined {new Date(customer.created_at).toLocaleDateString()}
                            </span>
                            {profile?.role === 'super_admin' && customer.tenants && (
                              <span className="text-purple-600">
                                {customer.tenants.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          {getStatusBadge(customer)}
                          {customer.user_subscriptions?.[0] && (
                            <div className="text-sm text-gray-600 mt-1">
                              {formatCurrency(customer.user_subscriptions[0].subscription_plans?.price_monthly * 100 || 0)}/month
                            </div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => window.location.href = `/dashboard/team/customer/${customer.id}`}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Add Note"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-[#93a1a1]">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-2 text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </FeatureGuard>
    </div>
  );
} 