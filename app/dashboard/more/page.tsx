'use client';

import Link from 'next/link';
import { Video, Calendar, Settings, ChevronRight } from 'lucide-react';

const moreItems = [
  {
    title: 'Tutorials',
    description: 'Learn Mind Shifting techniques with guided video tutorials',
    href: '/dashboard/tutorials',
    icon: Video,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  {
    title: 'Book with Coach',
    description: 'Schedule a session with a certified Mind Shifting coach',
    href: '/dashboard/book-coach',
    icon: Calendar,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    title: 'Settings',
    description: 'Manage your account, preferences, and subscription',
    href: '/dashboard/settings',
    icon: Settings,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
];

export default function MorePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">More</h1>
          <p className="text-muted-foreground mt-1">Access additional features and settings</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {moreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center p-4 bg-card rounded-xl border border-border hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className={`p-3 rounded-xl ${item.bgColor} mr-4`}>
                  <Icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors ml-2" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

