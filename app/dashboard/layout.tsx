'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { MobileNav } from '@/components/layout/MobileNav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, tenant, signOut, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Determine if we should hide the mobile nav (orb mode on mobile)
  const isTreatmentRoute =
    pathname?.startsWith('/dashboard/sessions/treatment-v9') ||
    pathname?.startsWith('/dashboard/sessions/treatment-v7') ||
    pathname?.startsWith('/dashboard/sessions/treatment-v6') ||
    pathname?.startsWith('/dashboard/sessions/treatment-v5') ||
    pathname?.startsWith('/dashboard/sessions/treatment-v4');

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ThemeProvider>
    );
  }

  // Allow super admins to access dashboard without tenant
  if (!user || !profile || (!tenant && profile?.role !== 'super_admin')) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
            <p className="text-muted-foreground">
              Please <Link href="/auth" className="text-primary hover:underline">sign in</Link> to access the dashboard.
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="h-dvh flex overflow-hidden bg-secondary/20 relative overflow-x-hidden">
        {/* Main content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden min-w-0">
          <main className="flex-1 relative z-0 overflow-y-auto overflow-x-hidden focus:outline-none bg-background pb-16">
            {children}
          </main>
        </div>

        {/* Bottom navigation - Hidden on treatment routes */}
        {!isTreatmentRoute && (
          <MobileNav profile={profile} onSignOut={handleSignOut} />
        )}
      </div>
    </ThemeProvider>
  );
}
