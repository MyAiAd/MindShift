'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Calendar, Target, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: Home,
  },
  {
    label: 'Sessions',
    href: '/dashboard/sessions',
    icon: Calendar,
  },
  {
    label: 'Goals',
    href: '/dashboard/goals',
    icon: Target,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#002b36] border-t border-gray-200 dark:border-[#073642] pb-safe"
      role="navigation"
      aria-label="Mobile bottom navigation"
    >
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 touch-target transition-colors',
                'active:scale-95 active:opacity-80',
                isActive
                  ? 'text-primary dark:text-primary'
                  : 'text-gray-600 dark:text-[#839496] hover:text-gray-900 dark:hover:text-gray-200'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
