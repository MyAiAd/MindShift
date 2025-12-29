'use client';

import React from 'react';
import { XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <XCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold text-foreground dark:text-white mb-4">
          Checkout Cancelled
        </h1>
        
        <p className="text-muted-foreground mb-8">
          No payment was processed. You can return to the subscription page to choose a different plan or try again.
        </p>
        
        <div className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground dark:text-white mb-4">
            Why Choose a Subscription?
          </h2>
          <ul className="text-left space-y-2 text-muted-foreground">
            <li>• Access to proven transformation methodologies</li>
            <li>• AI-powered insights and recommendations</li>
            <li>• Track your progress and breakthroughs</li>
            <li>• Priority support from our team</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            href="/dashboard/subscription" 
            className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plans
          </Link>
          <Link 
            href="/dashboard" 
            className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-border text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          Have questions? <Link href="/contact" className="text-indigo-600 hover:text-indigo-700">Contact our support team</Link>
        </p>
      </div>
    </div>
  );
} 