'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import V5TestRunner from '@/components/labs/V5TestRunner';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export default function V5TestsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const isLabsAdmin = ['super_admin', 'tenant_admin', 'manager'].includes(profile?.role || '');

  useEffect(() => {
    if (!loading && profile && !isLabsAdmin) {
      toast({
        title: 'Access restricted',
        description: 'V5 Tests are available to admins only.',
        variant: 'destructive',
      });
      router.replace('/dashboard/settings#labs');
    }
  }, [isLabsAdmin, loading, profile, router, toast]);

  if (!loading && profile && !isLabsAdmin) {
    return null;
  }

  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-1">
        <a href="/dashboard/settings" className="hover:text-foreground transition-colors">Settings</a>
        <span>›</span>
        <span>Labs</span>
        <span>›</span>
        <span className="text-foreground font-medium">V5 Tests</span>
      </nav>

      <V5TestRunner />
    </div>
  );
}
