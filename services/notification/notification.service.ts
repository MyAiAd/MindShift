// Browser Notifications Utility Library
// Handles permission requests, subscriptions, and API integration

export interface NotificationPreferences {
  browser_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  new_messages: boolean;
  community_posts: boolean;
  community_comments: boolean;
  community_likes: boolean;
  community_events: boolean;
  progress_milestones: boolean;
  weekly_reports: boolean;
  goal_reminders: boolean;
  security_alerts: boolean;
  account_updates: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  max_daily_notifications: number;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class NotificationManager {
  private static instance: NotificationManager;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private lastPreferencesCall: number = 0;
  private preferencesCache: NotificationPreferences | null = null;
  private cacheExpiry: number = 5000; // 5 seconds cache
  
  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  // Check if browser supports notifications
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Browser notifications are not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  // Register service worker for push notifications
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported()) {
      throw new Error('Service Workers are not supported');
    }

    if (this.serviceWorkerRegistration) {
      return this.serviceWorkerRegistration;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      this.serviceWorkerRegistration = registration;
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  // Subscribe to push notifications
  async subscribeToPush(): Promise<PushSubscriptionData> {
    try {
      // Ensure we have permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Register service worker
      const registration = await this.registerServiceWorker();

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
      });

      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
        }
      };

      // Save subscription to backend
      await this.savePushSubscription(subscriptionData);

      return subscriptionData;
    } catch (error) {
      console.error('Push subscription failed:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(): Promise<void> {
    try {
      if (!this.serviceWorkerRegistration) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          this.serviceWorkerRegistration = registration;
        }
      }

      if (this.serviceWorkerRegistration) {
        const subscription = await this.serviceWorkerRegistration.pushManager.getSubscription();
        if (subscription) {
          // Remove from backend first
          await this.removePushSubscription(subscription.endpoint);
          
          // Then unsubscribe locally
          await subscription.unsubscribe();
        }
      }
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      throw error;
    }
  }

  // API: Get user's notification preferences
  async getPreferences(): Promise<NotificationPreferences> {
    const now = Date.now();
    
    // Return cached preferences if they're fresh (within 5 seconds)
    if (this.preferencesCache && (now - this.lastPreferencesCall) < this.cacheExpiry) {
      console.log('Returning cached preferences');
      return this.preferencesCache;
    }
    
    // Prevent rapid successive calls
    if ((now - this.lastPreferencesCall) < 1000) {
      console.log('Debouncing preferences call');
      await new Promise(resolve => setTimeout(resolve, 1000 - (now - this.lastPreferencesCall)));
    }
    
    this.lastPreferencesCall = Date.now();
    
    console.log('Fetching notification preferences from API...');
    console.log('Current document cookies:', document.cookie);
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error:', errorData);
        
        // Handle session establishing case - retry after delay
        if (response.status === 202 && errorData.code === 'SESSION_ESTABLISHING') {
          console.log('Session still establishing, retrying in 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Recursive retry (only once)
          const retryResponse = await fetch('/api/notifications/preferences', {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache',
            },
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            this.preferencesCache = retryData.preferences;
            return retryData.preferences;
          }
        }
        
        // Handle migration required case
        if (response.status === 503 && errorData.code === 'MIGRATION_REQUIRED') {
          console.error('Database migration required:', errorData.details);
          throw new Error('Notification system is initializing. Please try again in a few minutes.');
        }
        
        throw new Error(`Failed to fetch notification preferences: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      // Cache the successful response
      this.preferencesCache = data.preferences;
      
      return data.preferences;
    } catch (error) {
      console.error('Error fetching preferences:', error);
      
      // Return cached preferences if available, even if expired
      if (this.preferencesCache) {
        console.log('Returning stale cached preferences due to error');
        return this.preferencesCache;
      }
      
      throw error;
    }
  }

  // API: Update user's notification preferences
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      throw new Error('Failed to update notification preferences');
    }

    const data = await response.json();
    
    // Update cache with new preferences
    this.preferencesCache = data.preferences;
    this.lastPreferencesCall = Date.now();
    
    return data.preferences;
  }

  // API: Save push subscription to backend
  private async savePushSubscription(subscription: PushSubscriptionData): Promise<void> {
    const response = await fetch('/api/notifications/subscriptions', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle migration required case
      if (response.status === 503 && errorData.code === 'MIGRATION_REQUIRED') {
        console.error('Database migration required for push subscriptions:', errorData.details);
        throw new Error('Notification system is initializing. Please try again in a few minutes.');
      }
      
      throw new Error(errorData.error || 'Failed to save push subscription');
    }
  }

  // API: Remove push subscription from backend
  private async removePushSubscription(endpoint: string): Promise<void> {
    const response = await fetch('/api/notifications/subscriptions', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint }),
    });

    if (!response.ok) {
      throw new Error('Failed to remove push subscription');
    }
  }

  // API: Send test notification
  async sendTestNotification(title?: string, body?: string): Promise<void> {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send test notification');
    }
  }

  // API: Get notification test status
  async getTestStatus(): Promise<any> {
    const response = await fetch('/api/notifications/test', {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to get test status');
    }
    return response.json();
  }

  // Utility: Convert VAPID key to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Utility: Convert ArrayBuffer to Base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

// Hook for React components
export function useNotifications() {
  const manager = NotificationManager.getInstance();

  return {
    isSupported: manager.isSupported(),
    permission: manager.getPermissionStatus(),
    requestPermission: () => manager.requestPermission(),
    subscribe: () => manager.subscribeToPush(),
    unsubscribe: () => manager.unsubscribeFromPush(),
    getPreferences: () => manager.getPreferences(),
    updatePreferences: (prefs: Partial<NotificationPreferences>) => manager.updatePreferences(prefs),
    sendTest: (title?: string, body?: string) => manager.sendTestNotification(title, body),
    getTestStatus: () => manager.getTestStatus(),
  };
} 