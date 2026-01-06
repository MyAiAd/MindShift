'use client';

import { Calendar, Clock, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function BookCoachPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard/more"
              className="text-muted-foreground hover:text-foreground transition-colors md:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Book with Coach</h1>
              <p className="text-muted-foreground mt-1">Schedule a session with a certified Mind Shifting coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Coming Soon Card */}
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coach Booking Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We're working on bringing you the ability to book one-on-one sessions with certified Mind Shifting coaches. 
            Stay tuned for updates!
          </p>
          
          {/* Preview Features */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8 text-left">
            <div className="p-4 bg-secondary/30 rounded-lg">
              <User className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-medium text-foreground text-sm">Certified Coaches</h3>
              <p className="text-xs text-muted-foreground mt-1">Work with trained Mind Shifting practitioners</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <Calendar className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-medium text-foreground text-sm">Flexible Scheduling</h3>
              <p className="text-xs text-muted-foreground mt-1">Book sessions that fit your schedule</p>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg">
              <Clock className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-medium text-foreground text-sm">Session Options</h3>
              <p className="text-xs text-muted-foreground mt-1">Choose from various session lengths</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

