'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserTable from '@/components/admin/UserTable';
import UserFilters from '@/components/admin/UserFilters';
import RoleSelector from '@/components/admin/RoleSelector';
import { Search, Loader2, Users as UsersIcon, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  subscription_tier?: string;
  created_at: string;
  last_sign_in_at?: string;
  is_active: boolean;
}

export default function UsersAdminPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    role?: string;
    subscription?: string;
    status?: string;
  }>({});
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    admins: 0,
  });

  // Role change dialog
  const [roleChangeUser, setRoleChangeUser] = useState<User | null>(null);
  
  // Status change dialog
  const [statusChangeUser, setStatusChangeUser] = useState<User | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (profile && !['tenant_admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard');
    }
  }, [profile, router]);

  useEffect(() => {
    if (profile && ['tenant_admin', 'super_admin'].includes(profile.role)) {
      fetchUsers();
    }
  }, [profile, searchQuery, filters]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.role) params.append('role', filters.role);
      if (filters.subscription) params.append('subscription', filters.subscription);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        
        // Calculate stats
        const total = data.users.length;
        const active = data.users.filter((u: User) => u.is_active).length;
        const admins = data.users.filter((u: User) => 
          ['tenant_admin', 'super_admin'].includes(u.role)
        ).length;
        
        setStats({ total, active, admins });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleEditUser = (user: User) => {
    router.push(`/dashboard/admin/users/${user.id}`);
  };

  const handleToggleStatus = (user: User) => {
    setStatusChangeUser(user);
  };

  const confirmToggleStatus = async () => {
    if (!statusChangeUser) return;

    try {
      const response = await fetch(`/api/admin/users/${statusChangeUser.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !statusChangeUser.is_active }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `User ${!statusChangeUser.is_active ? 'activated' : 'deactivated'} successfully`,
        });
        fetchUsers();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update user status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user status',
        variant: 'destructive',
      });
    } finally {
      setStatusChangeUser(null);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!roleChangeUser) return;

    try {
      const response = await fetch(`/api/admin/users/${roleChangeUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User role updated successfully',
        });
        fetchUsers();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update user role',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    // Simple CSV export
    const headers = ['Name', 'Email', 'Role', 'Subscription', 'Status', 'Joined'];
    const rows = users.map(u => [
      u.full_name || 'N/A',
      u.email,
      u.role,
      u.subscription_tier || 'free',
      u.is_active ? 'Active' : 'Inactive',
      new Date(u.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'Users exported to CSV',
    });
  };

  if (!profile || !['tenant_admin', 'super_admin'].includes(profile.role)) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage users, roles, and permissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <UsersIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <UserFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearFilters}
      />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {loading ? 'Loading users...' : `Showing ${users.length} users`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserTable
            users={users}
            onEdit={handleEditUser}
            onToggleStatus={handleToggleStatus}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      {roleChangeUser && (
        <RoleSelector
          isOpen={!!roleChangeUser}
          onClose={() => setRoleChangeUser(null)}
          currentRole={roleChangeUser.role}
          userName={roleChangeUser.full_name || roleChangeUser.email}
          onConfirm={handleRoleChange}
        />
      )}

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={!!statusChangeUser} onOpenChange={() => setStatusChangeUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChangeUser?.is_active ? 'Deactivate User?' : 'Activate User?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeUser?.is_active ? (
                <>
                  Are you sure you want to deactivate <strong>{statusChangeUser.full_name || statusChangeUser.email}</strong>?
                  They will no longer be able to access the platform.
                </>
              ) : (
                <>
                  Are you sure you want to activate <strong>{statusChangeUser?.full_name || statusChangeUser?.email}</strong>?
                  They will regain access to the platform.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
