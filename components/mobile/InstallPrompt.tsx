'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { impactFeedback } from '@/lib/haptics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isInStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isInStandalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Don't show if already installed
    if (isInStandalone) {
      return;
    }

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    
    // Don't show if dismissed within last 3 days
    if (dismissedTime && Date.now() - dismissedTime < threeDays) {
      return;
    }

    // Android/Desktop: Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 5 seconds (let user explore first)
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS: Show manual instructions after 5 seconds
    if (iOS) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    impactFeedback('medium');

    if (deferredPrompt) {
      // Android/Desktop: Use native prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted installation');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } else if (isIOS) {
      // iOS: Prompt stays open to show instructions
      // User will manually close after following steps
    }
  };

  const handleDismiss = () => {
    impactFeedback('light');
    setShowPrompt(false);
    localStorage.setItem('install-prompt-dismissed', Date.now().toString());
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-card rounded-2xl shadow-2xl border border-border p-4">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X size={16} className="text-muted-foreground dark:text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Download size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Install MindShifting
            </h3>
            <p className="text-sm text-muted-foreground">
              {isIOS 
                ? 'Add to your home screen for a better experience!'
                : 'Install our app for offline access and faster loading!'
              }
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-4 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>Works offline</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Faster loading</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Native app experience</span>
          </div>
        </div>

        {/* iOS Instructions */}
        {isIOS && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              How to install on iOS:
            </p>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0">1.</span>
                <span className="flex-1">
                  Tap the <Share size={14} className="inline mx-1" /> <strong>Share</strong> button below
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0">2.</span>
                <span className="flex-1">
                  Scroll down and tap <Plus size={14} className="inline mx-1" /> <strong>"Add to Home Screen"</strong>
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="flex-shrink-0">3.</span>
                <span className="flex-1">
                  Tap <strong>"Add"</strong> in the top right
                </span>
              </li>
            </ol>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex space-x-2">
          {!isIOS && (
            <Button
              onClick={handleInstall}
              className="flex-1"
              size="lg"
            >
              <Download size={18} className="mr-2" />
              Install App
            </Button>
          )}
          {isIOS && (
            <Button
              onClick={handleDismiss}
              className="flex-1"
              size="lg"
            >
              Got it!
            </Button>
          )}
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="lg"
            className={isIOS ? 'hidden' : ''}
          >
            Later
          </Button>
        </div>

        {/* Android/Desktop hint */}
        {!isIOS && (
          <p className="mt-3 text-xs text-center text-muted-foreground dark:text-muted-foreground">
            You can also click the <Plus size={12} className="inline mx-1" /> icon in your browser's address bar
          </p>
        )}
      </div>
    </div>
  );
}
