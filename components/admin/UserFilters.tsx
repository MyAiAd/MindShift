'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface UserFiltersProps {
  filters: {
    role?: string;
    subscription?: string;
    status?: string;
  };
  onFilterChange: (key: string, value: string | undefined) => void;
  onClearAll: () => void;
}

export default function UserFilters({ filters, onFilterChange, onClearAll }: UserFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(v => v && v !== 'all');

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Role Filter */}
        <div className="space-y-2">
          <Label htmlFor="role-filter" className="text-sm">Role</Label>
          <Select
            value={filters.role || 'all'}
            onValueChange={(value) => onFilterChange('role', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="role-filter">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subscription Filter */}
        <div className="space-y-2">
          <Label htmlFor="subscription-filter" className="text-sm">Subscription</Label>
          <Select
            value={filters.subscription || 'all'}
            onValueChange={(value) => onFilterChange('subscription', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="subscription-filter">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="status-filter" className="text-sm">Status</Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={(value) => onFilterChange('status', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {filters.role && filters.role !== 'all' && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onFilterChange('role', undefined)}
            >
              Role: {filters.role.replace('_', ' ')}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          {filters.subscription && filters.subscription !== 'all' && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onFilterChange('subscription', undefined)}
            >
              Tier: {filters.subscription}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          {filters.status && filters.status !== 'all' && (
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onFilterChange('status', undefined)}
            >
              Status: {filters.status}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
