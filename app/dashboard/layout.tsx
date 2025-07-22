'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { 
  Brain, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar, 
  Settings, 
  Building2,
  LogOut,
  Menu,
  X,
  CreditCard,
  Database,
  Shield
} from 'lucide-react';
import { useState } from 'react';

const sidebarItems = [
  { icon: Brain, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Clients', href: '/dashboard/team' },
  { icon: Target, label: 'Goals', href: '/dashboard/goals' },
  { icon: TrendingUp, label: 'Progress', href: '/dashboard/progress' },
  { icon: Calendar, label: 'Sessions', href: '/dashboard/sessions' },
  { icon: CreditCard, label: 'Subscription', href: '/dashboard/subscription' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, tenant, signOut, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

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
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </ThemeProvider>
    );
  }

  // Allow super admins to access dashboard without tenant
  if (!user || !profile || (!tenant && profile?.role !== 'super_admin')) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">Please sign in to access the dashboard.</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 flex z-50 md:hidden ${
            sidebarOpen ? 'block' : 'hidden'
          }`}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent tenant={tenant} profile={profile} signOut={handleSignOut} />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex md:flex-shrink-0 z-40">
          <div className="flex flex-col w-64">
            <SidebarContent tenant={tenant} profile={profile} signOut={handleSignOut} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden">
          <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
            <button
              className="h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
          <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-white dark:bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

function SidebarContent({ 
  tenant, 
  profile, 
  signOut 
}: { 
  tenant: any; 
  profile: any; 
  signOut: () => Promise<void>; 
}) {
  const pathname = usePathname();

  const handleSignOutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await signOut();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo and tenant info */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-indigo-600 dark:bg-indigo-700">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-white" />
          <div>
            <h1 className="text-white font-semibold">
                              {tenant ? tenant.name : 'MindShifting Admin'}
            </h1>
            <p className="text-indigo-200 text-sm pl-4 pr-4 mt-1 mb-1 whitespace-nowrap">{profile.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 py-4 bg-white dark:bg-gray-800 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-r-2 border-indigo-700 dark:border-indigo-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive ? 'text-indigo-700 dark:text-indigo-300' : ''
                }`} />
                {item.label}
              </Link>
            );
          })}

          {/* Admin Navigation */}
          {profile?.role && ['tenant_admin', 'super_admin'].includes(profile.role) && (
            <div className="pt-6">
              <div className="px-3 pb-2">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/dashboard/admin/data-management"
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === '/dashboard/admin/data-management'
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-r-2 border-indigo-700 dark:border-indigo-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Database className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    pathname === '/dashboard/admin/data-management' ? 'text-indigo-700 dark:text-indigo-300' : ''
                  }`} />
                  Data Management
                </Link>
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* User info and sign out */}
      <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-3 w-full">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-300 font-medium">
                {profile.first_name?.[0] || profile.email[0].toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOutClick}
            className="flex-shrink-0 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
} 