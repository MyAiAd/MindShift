'use client';

import React, { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';

interface TenantFormData {
  name: string;
  slug: string;
  domain: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

interface TenantCreateFormProps {
  onSuccess?: (tenantId: string) => void;
  onCancel?: () => void;
}

export default function TenantCreateForm({ onSuccess, onCancel }: TenantCreateFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    slug: '',
    domain: '',
    adminEmail: '',
    adminFirstName: '',
    adminLastName: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TenantFormData, string>>>({});

  const validateForm = () => {
    const newErrors: Partial<Record<keyof TenantFormData, string>> = {};
    
    if (!formData.name.trim()) newErrors.name = 'Organization name is required';
    if (!formData.slug.trim()) newErrors.slug = 'Slug is required';
    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    }
    if (!formData.adminEmail.trim()) newErrors.adminEmail = 'Admin email is required';
    if (!formData.adminFirstName.trim()) newErrors.adminFirstName = 'First name is required';
    if (!formData.adminLastName.trim()) newErrors.adminLastName = 'Last name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof TenantFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate slug from name
    if (field === 'name' && value) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      setFormData(prev => ({ ...prev, slug }));
    }
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create tenant');
      }

      onSuccess?.(result.tenantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-card rounded-lg shadow-sm border p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Building2 className="h-8 w-8 text-indigo-600" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Create New Organization</h2>
                        <p className="text-muted-foreground">Set up your organization to get started with MyAi</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Acme Corporation"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-foreground mb-2">
              URL Slug *
            </label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-secondary/20 text-muted-foreground text-sm">
                                    myai.app/
              </span>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-r-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="acme-corp"
              />
            </div>
            {errors.slug && (
              <p className="mt-1 text-sm text-red-600">{errors.slug}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="domain" className="block text-sm font-medium text-foreground mb-2">
            Custom Domain (Optional)
          </label>
          <input
            type="text"
            id="domain"
            value={formData.domain}
            onChange={(e) => handleInputChange('domain', e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="myai.acme.com"
          />
          {errors.domain && (
            <p className="mt-1 text-sm text-red-600">{errors.domain}</p>
          )}
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Administrator Details</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="adminFirstName" className="block text-sm font-medium text-foreground mb-2">
                First Name *
              </label>
              <input
                type="text"
                id="adminFirstName"
                value={formData.adminFirstName}
                onChange={(e) => handleInputChange('adminFirstName', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="John"
              />
              {errors.adminFirstName && (
                <p className="mt-1 text-sm text-red-600">{errors.adminFirstName}</p>
              )}
            </div>

            <div>
              <label htmlFor="adminLastName" className="block text-sm font-medium text-foreground mb-2">
                Last Name *
              </label>
              <input
                type="text"
                id="adminLastName"
                value={formData.adminLastName}
                onChange={(e) => handleInputChange('adminLastName', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Doe"
              />
              {errors.adminLastName && (
                <p className="mt-1 text-sm text-red-600">{errors.adminLastName}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="adminEmail" className="block text-sm font-medium text-foreground mb-2">
              Admin Email *
            </label>
            <input
              type="email"
              id="adminEmail"
              value={formData.adminEmail}
              onChange={(e) => handleInputChange('adminEmail', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="john@acme.com"
            />
            {errors.adminEmail && (
              <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-border text-foreground rounded-md hover:bg-secondary/20 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isSubmitting ? 'Creating...' : 'Create Organization'}</span>
          </button>
        </div>
      </form>
    </div>
  );
} 