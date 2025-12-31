'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Ban, CheckCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';

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

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onToggleStatus: (user: User) => void;
  loading?: boolean;
}

export default function UserTable({ users, onEdit, onToggleStatus, loading }: UserTableProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'tenant_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'user':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierBadgeColor = (tier?: string) => {
    switch (tier) {
      case 'premium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'pro':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'basic':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'free':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatRoleName = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 bg-gray-200 rounded w-32 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-48 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-20 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-16 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></TableCell>
                <TableCell><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></TableCell>
                <TableCell><div className="h-8 bg-gray-200 rounded w-8 animate-pulse" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-md border p-12 text-center">
        <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No users found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.full_name || 'N/A'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.email}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                  {formatRoleName(user.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={getTierBadgeColor(user.subscription_tier)}>
                  {user.subscription_tier?.toUpperCase() || 'FREE'}
                </Badge>
              </TableCell>
              <TableCell>
                {user.is_active ? (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                    Inactive
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(user.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {user.last_sign_in_at
                  ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy')
                  : 'Never'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit User
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onToggleStatus(user)}>
                      {user.is_active ? (
                        <>
                          <Ban className="mr-2 h-4 w-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Activate
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
