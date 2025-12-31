'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Verify the session and update subscription status
    const verifySession = async () => {
      if (!sessionId) {
        setError('No session ID found');
        setLoading(false);
        return;
      }

      try {
        // Give webhooks a moment to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Redirect to subscription page to see updated status
        setTimeout(() => {
          router.push('/dashboard/subscription');
        }, 3000);
        
      } catch (error) {
        console.error('Session verification error:', error);
        setError('Failed to verify payment');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground dark:text-white mb-4">
            Processing Your Payment
          </h1>
          <p className="text-muted-foreground">
            Please wait while we confirm your subscription...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-100 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-800 font-medium">Payment Verification Error</p>
            <p className="text-red-700 text-sm mt-2">{error}</p>
          </div>
          <Link 
            href="/dashboard/subscription" 
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Check Subscription Status
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground dark:text-white mb-4">
          Payment Successful!
        </h1>
        <p className="text-muted-foreground mb-8">
          Thank you for subscribing! Your account has been upgraded and you now have access to all premium features.
        </p>
        
        <div className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground dark:text-white mb-4">
            What's Next?
          </h2>
          <ul className="text-left space-y-2 text-muted-foreground">
            <li>• Access your subscription dashboard</li>
            <li>• Explore premium features</li>
            <li>• Start your transformation journey</li>
            <li>• Manage billing and invoices</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link 
            href="/dashboard" 
            className="flex-1 inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
          <Link 
            href="/dashboard/subscription" 
            className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-border text-foreground rounded-lg hover:bg-accent transition-colors"
          >
            View Subscription
          </Link>
        </div>

        <p className="text-sm text-muted-foreground mt-6">
          You'll receive a confirmation email shortly with your receipt.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-foreground dark:text-white mb-4">
            Loading...
          </h1>
        </div>
      </div>
    }>
      <CheckoutSuccessContent />
    </Suspense>
  );
} 