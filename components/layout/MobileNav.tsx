'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  Sparkles,
  Users,
  Settings,
  MoreHorizontal,
  UserCheck,
  BarChart3,
  PlayCircle,
  Shield,
  UserPlus,
  Flag,
  Database,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: Home,
  },
  {
    // Route the primary "Shifting" entry to v9 (voice clone of v2,
    // byte-parity enforced in CI). The v9 page auto-generates a fresh
    // session id on mount when none is provided. v7 remains reachable
    // via its labs demo section in /dashboard/settings for regression
    // comparison, but it is no longer the default.
    label: 'Shifting',
    href: '/dashboard/sessions/treatment-v9',
    icon: Sparkles,
  },
  {
    label: 'Connect',
    href: '/dashboard/community',
    icon: Users,
  },
];

const ADMIN_ROLES = ['tenant_admin', 'super_admin'];
const COACH_ROLES = ['coach', 'manager', 'tenant_admin', 'super_admin'];

interface MobileNavProps {
  onNavigate?: () => void;
  profile?: { role?: string } | null;
  onSignOut?: () => Promise<void>;
}

export function MobileNav({ onNavigate, profile, onSignOut }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isCoachOrAdmin = profile?.role && COACH_ROLES.includes(profile.role);
  const isAdmin = profile?.role && ADMIN_ROLES.includes(profile.role);

  const handleNavClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const handleMoreItemClick = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    if (onSignOut) {
      await onSignOut();
    }
  };

  // Profile tab active state (settings page)
  const isProfileActive =
    pathname === '/dashboard/settings' ||
    pathname?.startsWith('/dashboard/settings/');

  // "More" button active: any coach/admin route is active
  const isMoreActive =
    isProfileActive ||
    pathname?.startsWith('/dashboard/coach/') ||
    pathname?.startsWith('/dashboard/admin/');

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe"
        role="navigation"
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname?.startsWith(item.href + '/'));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 touch-target transition-colors',
                  'active:scale-95 active:opacity-80',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* 4th tab: "More" for coach/admin, "Profile" for regular users */}
          {isCoachOrAdmin ? (
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 touch-target transition-colors',
                'active:scale-95 active:opacity-80',
                isMoreActive || moreOpen
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="More"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">More</span>
            </button>
          ) : (
            <Link
              href="/dashboard/settings"
              onClick={handleNavClick}
              className={cn(
                'flex flex-col items-center justify-center gap-1 touch-target transition-colors',
                'active:scale-95 active:opacity-80',
                isProfileActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label="Profile"
              aria-current={isProfileActive ? 'page' : undefined}
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">Profile</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom sheet overlay for "More" menu */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/50 transition-opacity"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-2xl shadow-lg animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <h2 className="text-lg font-semibold text-foreground">More</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-2 pb-safe">
              {/* Profile */}
              <MoreMenuItem
                icon={Settings}
                label="Profile"
                active={pathname === '/dashboard/settings'}
                onClick={() => handleMoreItemClick('/dashboard/settings')}
              />

              {/* Coach Profile */}
              <MoreMenuItem
                icon={UserCheck}
                label="Coach Profile"
                active={pathname === '/dashboard/coach/profile'}
                onClick={() => handleMoreItemClick('/dashboard/coach/profile')}
              />

              {/* Admin links */}
              {isAdmin && (
                <>
                  <div className="my-2 mx-2 border-t border-border" />
                  <MoreMenuItem
                    icon={BarChart3}
                    label="Analytics"
                    active={pathname?.startsWith('/dashboard/admin/analytics') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/analytics')}
                  />
                  <MoreMenuItem
                    icon={PlayCircle}
                    label="Videos"
                    active={pathname?.startsWith('/dashboard/admin/videos') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/videos')}
                  />
                  <MoreMenuItem
                    icon={Shield}
                    label="Users"
                    active={pathname?.startsWith('/dashboard/admin/users') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/users')}
                  />
                  <MoreMenuItem
                    icon={UserPlus}
                    label="Coaches"
                    active={pathname?.startsWith('/dashboard/admin/coaches') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/coaches')}
                  />
                  <MoreMenuItem
                    icon={Flag}
                    label="Community"
                    active={pathname?.startsWith('/dashboard/admin/community-moderation') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/community-moderation/posts')}
                  />
                  <MoreMenuItem
                    icon={Settings}
                    label="Admin Settings"
                    active={pathname?.startsWith('/dashboard/admin/settings') ?? false}
                    onClick={() => handleMoreItemClick('/dashboard/admin/settings')}
                  />
                  <MoreMenuItem
                    icon={Database}
                    label="Data Management"
                    active={pathname === '/dashboard/admin/data-management'}
                    onClick={() => handleMoreItemClick('/dashboard/admin/data-management')}
                  />
                </>
              )}

              {/* Sign Out */}
              <div className="my-2 mx-2 border-t border-border" />
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3 flex-shrink-0" />
                Sign Out
              </button>

              {/* Extra padding for safe area */}
              <div className="h-4" />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MoreMenuItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-foreground hover:bg-accent'
      )}
    >
      <Icon className={cn('h-5 w-5 mr-3 flex-shrink-0', active && 'text-primary')} />
      {label}
    </button>
  );
}
