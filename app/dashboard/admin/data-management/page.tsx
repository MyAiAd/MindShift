'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { 
  Upload, 
  Download, 
  Database, 
  Users, 
  Trash2, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader,
  Settings,
  BarChart3,
  RefreshCw,
  Eye,
  Shield
} from 'lucide-react';

interface OperationResult {
  imported?: number;
  skipped?: number;
  created?: number;
  updated?: number;
  deleted_count?: number;
  customers_created?: number;
  subscriptions_created?: number;
  notes_created?: number;
  errors?: Array<{ email?: string; tier?: string; index?: number; error: string }>;
}

export default function DataManagementPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('import_export');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OperationResult | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Import/Export states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [exportType, setExportType] = useState('customers');

  // Test data generation states
  const [testDataCount, setTestDataCount] = useState(50);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    if (user && profile && ['tenant_admin', 'super_admin'].includes(profile.role || '')) {
      fetchTenants();
    }
  }, [user, profile]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
        // Set default tenant for tenant admins
        if (profile?.role === 'tenant_admin') {
          setSelectedTenant(profile.tenant_id);
        }
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.type === 'text/csv' || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        setImportFile(file);
      } else {
        showMessage('Please select a JSON or CSV file', 'error');
      }
    }
  };

  const handleImportCustomers = async () => {
    if (!importFile) {
      showMessage('Please select a file to import', 'error');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const text = await importFile.text();
      let customers;

      if (importFile.name.endsWith('.json')) {
        customers = JSON.parse(text);
      } else if (importFile.name.endsWith('.csv')) {
        // Simple CSV parsing - in production, you'd want a more robust parser
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        customers = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const customer: any = {};
          headers.forEach((header, index) => {
            customer[header.toLowerCase().replace(' ', '_')] = values[index];
          });
          return customer;
        }).filter(c => c.email); // Filter out empty rows
      } else {
        showMessage('Unsupported file format', 'error');
        return;
      }

      const response = await fetch('/api/admin/data-management?action=import_customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customers: Array.isArray(customers) ? customers : [customers],
          tenant_id: selectedTenant
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        showMessage(`Import completed: ${data.results.imported} imported, ${data.results.skipped} skipped`, 'success');
      } else {
        showMessage(data.error || 'Import failed', 'error');
      }

    } catch (error) {
      console.error('Error importing customers:', error);
      showMessage('Error importing customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCustomers = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        type: exportType,
        format: exportFormat,
        ...(selectedTenant && { tenant_id: selectedTenant })
      });

      const response = await fetch(`/api/admin/data-management?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        if (exportFormat === 'csv') {
          // Download CSV file
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${exportType}-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          // Download JSON file
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${exportType}-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
        showMessage('Export completed successfully', 'success');
      } else {
        const data = await response.json();
        showMessage(data.error || 'Export failed', 'error');
      }

    } catch (error) {
      console.error('Error exporting data:', error);
      showMessage('Error exporting data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedSubscriptionPlans = async () => {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/admin/data-management?action=seed_subscription_plans', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        showMessage(`Seeding completed: ${data.results.created} created, ${data.results.updated} updated`, 'success');
      } else {
        showMessage(data.error || 'Seeding failed', 'error');
      }

    } catch (error) {
      console.error('Error seeding subscription plans:', error);
      showMessage('Error seeding subscription plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTestData = async () => {
    if (!selectedTenant && profile?.role !== 'tenant_admin') {
      showMessage('Please select a tenant', 'error');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/admin/data-management?action=generate_test_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          count: testDataCount,
          tenant_id: selectedTenant
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults(data.results);
        showMessage(`Test data generated: ${data.results.customers_created} customers, ${data.results.subscriptions_created} subscriptions`, 'success');
      } else {
        showMessage(data.error || 'Test data generation failed', 'error');
      }

    } catch (error) {
      console.error('Error generating test data:', error);
      showMessage('Error generating test data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupTestData = async () => {
    if (!selectedTenant && profile?.role !== 'tenant_admin') {
      showMessage('Please select a tenant', 'error');
      return;
    }

    if (!confirm('Are you sure you want to delete all test customers with @example.com emails? This action cannot be undone.\n\nNOTE: This will NEVER delete super admin accounts or real customers - only test data with @example.com emails.')) {
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/admin/data-management?action=cleanup_test_data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tenant_id: selectedTenant
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResults({ deleted_count: data.deleted_count });
        showMessage(`Cleanup completed: ${data.deleted_count} test customers deleted`, 'success');
      } else {
        showMessage(data.error || 'Cleanup failed', 'error');
      }

    } catch (error) {
      console.error('Error cleaning up test data:', error);
      showMessage('Error cleaning up test data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role || '')) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 border border-destructive rounded-lg p-8 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-destructive">You need admin permissions to access data management tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Data Management</h1>
        <p className="text-muted-foreground mt-1">
          Import, export, and manage customer data and system configuration.
          {profile?.role === 'super_admin' ? ' (Super Admin - All Tenants)' : ' (Tenant Admin)'}
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          messageType === 'success' ? 'bg-accent/10 border-accent text-accent' :
          messageType === 'error' ? 'bg-destructive/10 border-destructive text-destructive' :
          'bg-primary/10 border-primary text-primary'
        }`}>
          <div className="flex items-center">
            {messageType === 'success' && <CheckCircle className="h-5 w-5 mr-2" />}
            {messageType === 'error' && <XCircle className="h-5 w-5 mr-2" />}
            {messageType === 'info' && <AlertCircle className="h-5 w-5 mr-2" />}
            {message}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          {['import_export', 'subscription_plans', 'test_data'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab === 'import_export' ? 'Import/Export' : 
               tab === 'subscription_plans' ? 'Subscription Plans' : 
               'Test Data'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'import_export' && (
          <>
            {/* Tenant Selection */}
            {profile?.role === 'super_admin' && (
              <div className="bg-card rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Tenant Selection</h3>
                <div className="max-w-md">
                  <label className="block text-sm font-medium text-foreground mb-2">Target Tenant</label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-primary focus:border-primary"
                  >
                    <option value="">All Tenants</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} {tenant.subscription_tier && `(${tenant.subscription_tier})`}
                      </option>
                    ))}
                    {/* Add subscription tier options for filtering */}
                    <optgroup label="By Subscription Tier">
                      <option value="filter:trial">Free Trial Users ($0)</option>
                      <option value="filter:level_1">Essential MyAi Users ($29)</option>
                      <option value="filter:level_2">Complete MyAi Users ($49)</option>
                      <option value="filter:super_admin">Super Admin Accounts</option>
                    </optgroup>
                  </select>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a specific tenant or filter by subscription tier
                  </p>
                </div>
              </div>
            )}

            {/* Import Section */}
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <Upload className="h-6 w-6 text-primary mr-3" />
                <h3 className="text-lg font-semibold text-foreground">Import Customer Data</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground text-foreground mb-2">
                    Select File (JSON or CSV)
                  </label>
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                  />
                  {importFile && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
                
                <div className="bg-primary/5 p-4 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Import Format Requirements:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>JSON:</strong> Array of customer objects with email, first_name, last_name, subscription_tier</li>
                    <li>• <strong>CSV:</strong> Headers: Email, First Name, Last Name, Subscription Tier</li>
                    <li>• Email is required for all customers</li>
                    <li>• Existing customers (same email) will be skipped</li>
                  </ul>
                </div>

                <button
                  onClick={handleImportCustomers}
                  disabled={!importFile || loading}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Import Customers
                </button>
              </div>
            </div>

            {/* Export Section */}
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <Download className="h-6 w-6 text-accent mr-3" />
                <h3 className="text-lg font-semibold text-foreground">Export Data</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-foreground text-foreground mb-2">Export Type</label>
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                    className="w-full px-3 py-2 border border-border border-border bg-background text-foreground rounded-lg focus:ring-primary focus:border-primary"
                  >
                    <option value="customers">Customer Data</option>
                    <option value="subscription_plans">Subscription Plans</option>
                    <option value="analytics_summary">Analytics Summary</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground text-foreground mb-2">Format</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-full px-3 py-2 border border-border border-border bg-background text-foreground rounded-lg focus:ring-primary focus:border-primary"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleExportCustomers}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-accent text-primary-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'subscription_plans' && (
          <div className="bg-card rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-4">
              <Settings className="h-6 w-6 text-accent mr-3" />
              <h3 className="text-lg font-semibold text-foreground">Subscription Plan Management</h3>
            </div>

            {profile?.role !== 'super_admin' && (
              <div className="bg-secondary/20 border border-border rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-muted-foreground mr-2" />
                  <p className="text-foreground">Super admin access required for subscription plan management.</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
                              <div className="bg-accent/5 p-4 rounded-lg">
                <h4 className="font-medium text-foreground mb-2">Default Subscription Plans:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Trial Plan:</strong> Free trial with basic features</li>
                                  <li>• <strong>Essential MyAi:</strong> $29.00/month - Individual plan with core features</li>
                <li>• <strong>Complete MyAi:</strong> $49.00/month - Full featured plan with team management</li>
                </ul>
              </div>

              <button
                onClick={handleSeedSubscriptionPlans}
                disabled={loading || profile?.role !== 'super_admin'}
                className="flex items-center px-4 py-2 bg-accent text-primary-foreground rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                Seed Subscription Plans
              </button>
            </div>
          </div>
        )}

        {activeTab === 'test_data' && (
          <>
            {/* Generate Test Data */}
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-primary mr-3" />
                <h3 className="text-lg font-semibold text-foreground">Generate Test Data</h3>
              </div>
              
              <div className="space-y-4">
                {profile?.role === 'super_admin' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground text-foreground mb-2">Target Tenant</label>
                    <select
                      value={selectedTenant}
                      onChange={(e) => setSelectedTenant(e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-border border-border bg-background text-foreground rounded-lg focus:ring-primary focus:border-primary"
                      required
                    >
                      <option value="">Select Tenant</option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground text-foreground mb-2">
                    Number of Test Customers (Max 200)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={testDataCount}
                    onChange={(e) => setTestDataCount(parseInt(e.target.value))}
                    className="w-full max-w-md px-3 py-2 border border-border border-border bg-background text-foreground rounded-lg focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="bg-primary/5 p-4 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Test Data Includes:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Realistic customer names and email addresses (@example.com)</li>
                    <li>• Random subscription tiers (trial, level_1, level_2)</li>
                    <li>• Active subscriptions for paid tiers (70% chance)</li>
                    <li>• Sample customer notes and communication history (30% chance)</li>
                    <li>• Random creation dates within the past year</li>
                  </ul>
                </div>

                <button
                  onClick={handleGenerateTestData}
                  disabled={loading || (!selectedTenant && profile?.role !== 'tenant_admin')}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Generate Test Data
                </button>
              </div>
            </div>

            {/* Cleanup Test Data */}
            <div className="bg-card rounded-lg shadow-sm border p-6">
              <div className="flex items-center mb-4">
                <Trash2 className="h-6 w-6 text-destructive mr-3" />
                <h3 className="text-lg font-semibold text-foreground">Cleanup Test Data</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-destructive/5 p-4 rounded-lg">
                  <div className="flex items-center mb-3">
                    <AlertCircle className="h-5 w-5 text-destructive mr-2" />
                    <p className="text-foreground">
                      <strong>Warning:</strong> This will permanently delete all customers with @example.com email addresses. This action cannot be undone.
                    </p>
                  </div>
                  <div className="bg-accent/10 p-3 rounded-md mt-2">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 text-accent mr-2" />
                      <p className="text-accent text-sm">
                        <strong>Safe:</strong> Super admin accounts (like admin@yourdomain.com) and real customers will NEVER be deleted. Only test data with @example.com emails is affected.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCleanupTestData}
                  disabled={loading || (!selectedTenant && profile?.role !== 'tenant_admin')}
                  className="flex items-center px-4 py-2 bg-destructive text-primary-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Cleanup Test Data
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Results Display */}
      {results && (
        <div className="mt-8 bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <BarChart3 className="h-6 w-6 text-muted-foreground mr-3" />
            <h3 className="text-lg font-semibold text-foreground">Operation Results</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {results.imported !== undefined && (
              <div className="bg-accent/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-accent mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.imported}</p>
                    <p className="text-sm text-accent">Imported</p>
                  </div>
                </div>
              </div>
            )}

            {results.created !== undefined && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-primary mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.created}</p>
                    <p className="text-sm text-primary">Created</p>
                  </div>
                </div>
              </div>
            )}

            {results.customers_created !== undefined && (
              <div className="bg-primary/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-primary mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.customers_created}</p>
                    <p className="text-sm text-primary">Customers Created</p>
                  </div>
                </div>
              </div>
            )}

            {results.subscriptions_created !== undefined && (
              <div className="bg-accent/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <Settings className="h-5 w-5 text-accent mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.subscriptions_created}</p>
                    <p className="text-sm text-accent">Subscriptions Created</p>
                  </div>
                </div>
              </div>
            )}

            {results.notes_created !== undefined && (
              <div className="bg-accent/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-accent mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.notes_created}</p>
                    <p className="text-sm text-accent">Notes Created</p>
                  </div>
                </div>
              </div>
            )}

            {results.skipped !== undefined && results.skipped > 0 && (
              <div className="bg-secondary/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.skipped}</p>
                    <p className="text-sm text-muted-foreground">Skipped</p>
                  </div>
                </div>
              </div>
            )}

            {results.deleted_count !== undefined && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <div className="flex items-center">
                  <Trash2 className="h-5 w-5 text-destructive mr-2" />
                  <div>
                    <p className="font-semibold text-foreground">{results.deleted_count}</p>
                    <p className="text-sm text-destructive">Deleted</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Errors Display */}
          {results.errors && results.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-foreground mb-2">Errors ({results.errors.length}):</h4>
              <div className="bg-destructive/10 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="space-y-2">
                  {results.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm text-destructive">
                      {error.email && <span className="font-medium">{error.email}:</span>}
                      {error.tier && <span className="font-medium">{error.tier}:</span>}
                      {error.index !== undefined && <span className="font-medium">Row {error.index}:</span>}
                      <span className="ml-1">{error.error}</span>
                    </div>
                  ))}
                  {results.errors.length > 10 && (
                    <p className="text-sm text-destructive font-medium">
                      ... and {results.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 