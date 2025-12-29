'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { MobileNav } from '@/components/layout/MobileNav';
import { 
  Brain, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar, 
  Settings, 
  LogOut,
  Menu,
  X,
  CreditCard,
  Database,
  Shield,
  UserCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Dynamic import for heavy audio preloader component
const V4AudioPreloader = dynamic(() => import('@/components/treatment/v4/V4AudioPreloader'), {
  ssr: false,
  loading: () => null,
});

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
  
  // Initialize sidebar state from localStorage or screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarOpen');
      if (saved !== null) return saved === 'true';
      // Default based on screen size: open on desktop, closed on mobile
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return false;
  });
  
  const router = useRouter();

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);

  // Handle screen size changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-adjust if user hasn't manually set a preference
      const saved = localStorage.getItem('sidebarOpen');
      if (saved === null) {
        setSidebarOpen(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
            <p className="text-muted-foreground">Please sign in to access the dashboard.</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {/* V4 Audio Preloader - starts loading intro audio in background */}
      <V4AudioPreloader />
      
      <div className="h-screen flex overflow-hidden bg-secondary/20 relative overflow-x-hidden">
        {/* Hamburger menu button - fixed in top-left corner */}
        <button
          className="fixed top-4 left-4 z-50 h-10 w-10 inline-flex items-center justify-center rounded-md bg-primary hover:bg-primary/90 text-primary-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring transition-colors shadow-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Mobile sidebar */}
        <div
          className={`fixed inset-0 flex z-40 md:hidden ${
            sidebarOpen ? 'block' : 'hidden'
          }`}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full h-full bg-card">
            <SidebarContent tenant={tenant} profile={profile} signOut={handleSignOut} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>

        {/* Desktop sidebar (toggleable) */}
        <div 
          className={`hidden md:flex md:flex-shrink-0 z-40 transition-all duration-300 ease-in-out bg-card ${
            sidebarOpen ? 'md:w-64' : 'md:w-0'
          }`}
        >
          <div 
            className={`flex flex-col w-64 h-full transition-transform duration-300 ease-in-out bg-card ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <SidebarContent tenant={tenant} profile={profile} signOut={handleSignOut} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col w-0 flex-1 overflow-hidden min-w-0">
          <main className="flex-1 relative z-0 overflow-y-auto overflow-x-hidden focus:outline-none bg-background pb-16 md:pb-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <MobileNav />
      </div>
    </ThemeProvider>
  );
}

function SidebarContent({ 
  tenant, 
  profile, 
  signOut,
  onNavigate
}: { 
  tenant: any; 
  profile: any; 
  signOut: () => Promise<void>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const handleSignOutClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await signOut();
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo and tenant info */}
      <div className="flex items-center h-16 flex-shrink-0 pl-16 pr-4 bg-primary">
        <div className="flex items-center space-x-3">
          <Image src="/logo.jpg" alt="MindShifting Logo" width={32} height={32} className="h-8 w-8 rounded" />
          <div>
            <h1 className="text-primary-foreground font-semibold">
                              {tenant ? tenant.name : 'MindShifting Admin'}
            </h1>
            <p className="text-primary-foreground/70 text-sm pl-4 pr-4 mt-1 mb-1 whitespace-nowrap">{profile.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation - Made scrollable with flex-1 and overflow-y-auto */}
      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 py-4 bg-card space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-r-2 border-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  isActive ? 'text-primary' : ''
                }`} />
                {item.label}
              </Link>
            );
          })}

          {/* Coach Navigation */}
          {profile?.role && ['coach', 'manager', 'tenant_admin', 'super_admin'].includes(profile.role) && (
            <div className="pt-6">
              <div className="px-3 pb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Coaching
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/dashboard/coach/profile"
                  onClick={handleNavClick}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === '/dashboard/coach/profile'
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <UserCheck className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    pathname === '/dashboard/coach/profile' ? 'text-primary' : ''
                  }`} />
                  Coach Profile
                </Link>
              </div>
            </div>
          )}

          {/* Admin Navigation */}
          {profile?.role && ['tenant_admin', 'super_admin'].includes(profile.role) && (
            <div className="pt-6">
              <div className="px-3 pb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administration
                </p>
              </div>
              <div className="space-y-1">
                <Link
                  href="/dashboard/admin/data-management"
                  onClick={handleNavClick}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === '/dashboard/admin/data-management'
                      ? 'bg-primary/10 text-primary border-r-2 border-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Database className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    pathname === '/dashboard/admin/data-management' ? 'text-primary' : ''
                  }`} />
                  Data Management
                </Link>
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* User info and sign out - Fixed at bottom, always visible */}
      <div className="flex-shrink-0 flex border-t border-border p-4 bg-card">
        <div className="flex items-center space-x-3 w-full">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium">
                {profile.first_name?.[0] || profile.email[0].toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOutClick}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
} 