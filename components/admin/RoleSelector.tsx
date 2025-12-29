'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Shield } from 'lucide-react';

interface RoleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: string;
  userName: string;
  onConfirm: (newRole: string) => Promise<void>;
}

export default function RoleSelector({
  isOpen,
  onClose,
  currentRole,
  userName,
  onConfirm,
}: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);

  const roles = [
    {
      value: 'user',
      label: 'User',
      description: 'Standard user with basic access',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      value: 'tenant_admin',
      label: 'Tenant Admin',
      description: 'Admin access for their tenant/organization',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      value: 'super_admin',
      label: 'Super Admin',
      description: 'Full system access across all tenants',
      color: 'bg-red-100 text-red-800 border-red-200',
    },
  ];

  const handleConfirm = async () => {
    if (selectedRole === currentRole) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      await onConfirm(selectedRole);
      onClose();
    } catch (error) {
      console.error('Error changing role:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedRoleData = roles.find(r => r.value === selectedRole);
  const isDowngrade = 
    (currentRole === 'super_admin' && selectedRole !== 'super_admin') ||
    (currentRole === 'tenant_admin' && selectedRole === 'user');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change User Role
          </DialogTitle>
          <DialogDescription>
            Change the role for <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Role */}
          <div className="space-y-2">
            <Label>Current Role</Label>
            <div>
              <Badge
                variant="outline"
                className={roles.find(r => r.value === currentRole)?.color}
              >
                {roles.find(r => r.value === currentRole)?.label}
              </Badge>
            </div>
          </div>

          {/* New Role Selector */}
          <div className="space-y-2">
            <Label htmlFor="role-select">New Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{role.label}</span>
                      {role.value === currentRole && (
                        <span className="text-xs text-muted-foreground">(current)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoleData && (
              <p className="text-sm text-muted-foreground">
                {selectedRoleData.description}
              </p>
            )}
          </div>

          {/* Warning for Downgrades */}
          {isDowngrade && (
            <div className="flex gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
              <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <strong>Warning:</strong> You are downgrading this user's permissions. They will lose access to admin features.
              </div>
            </div>
          )}

          {/* Info for Super Admin */}
          {selectedRole === 'super_admin' && currentRole !== 'super_admin' && (
            <div className="flex gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <strong>Caution:</strong> Super Admins have full access to all tenants and system settings. Only grant this role to trusted individuals.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || selectedRole === currentRole}
          >
            {loading ? 'Changing...' : 'Confirm Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
