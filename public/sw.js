// Service Worker for MyAi Push Notifications
// Handles background notifications and user interactions

const CACHE_NAME = 'myai-v1';
const API_BASE = '/api';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only cache resources that we know exist
      return cache.addAll([
        '/',
        '/brain.png',
        '/favicon.svg'
        // Removed '/dashboard' and '/manifest.json' as they may not exist or need different handling
      ]);
    }).catch((error) => {
      console.error('Cache installation failed:', error);
      // Continue even if caching fails
      return Promise.resolve();
    })
  );
  
  // Take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages
      return self.clients.claim();
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'MyAi',
    body: 'You have a new notification',
    icon: '/brain.png',
    badge: '/brain.png',
          tag: 'myai-notification',
    requireInteraction: false,
    data: {
      url: '/dashboard',
      timestamp: Date.now()
    }
  };

  // Parse notification data if provided
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: {
          ...notificationData.data,
          ...data.data
        }
      };
    } catch (error) {
      console.error('Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Enhance notification based on type
  if (notificationData.type) {
    switch (notificationData.type) {
      case 'new_message':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'message';
        notificationData.data.url = '/dashboard/team/message';
        notificationData.actions = [
          { action: 'reply', title: 'Reply', icon: '/brain.png' },
          { action: 'mark_read', title: 'Mark as Read', icon: '/brain.png' }
        ];
        break;
        
      case 'community_post':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'community';
        notificationData.data.url = `/dashboard/community`;
        notificationData.actions = [
          { action: 'view', title: 'View Post', icon: '/brain.png' },
          { action: 'dismiss', title: 'Dismiss', icon: '/brain.png' }
        ];
        break;
        
      case 'community_comment':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'community';
        notificationData.data.url = `/dashboard/community`;
        notificationData.actions = [
          { action: 'view', title: 'View Comment', icon: '/brain.png' },
          { action: 'reply', title: 'Reply', icon: '/brain.png' }
        ];
        break;
        
      case 'community_event':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'event';
        notificationData.data.url = `/dashboard/community/events`;
        notificationData.actions = [
          { action: 'rsvp', title: 'RSVP', icon: '/brain.png' },
          { action: 'view', title: 'View Event', icon: '/brain.png' }
        ];
        break;
        
      case 'progress_milestone':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'progress';
        notificationData.data.url = '/dashboard/progress';
        notificationData.requireInteraction = true;
        break;
        
      case 'goal_reminder':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'goal';
        notificationData.data.url = '/dashboard/goals';
        break;
        
      case 'security_alert':
        notificationData.icon = '/brain.png';
        notificationData.tag = 'security';
        notificationData.requireInteraction = true;
        notificationData.data.url = '/dashboard/settings';
        break;
    }
  }

  // Show the notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions || [],
      data: notificationData.data,
      timestamp: notificationData.data.timestamp,
      vibrate: [200, 100, 200],
      silent: false
    }).then(() => {
      // Record notification delivery
      return recordNotificationDelivery(notificationData.data.notificationId);
    })
  );
});

// Notification click event - handle user interactions
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Close the notification
  notification.close();
  
  // Record the click
  recordNotificationClick(data.notificationId, action);
  
  // Handle different actions
  if (action === 'dismiss') {
    // Just close the notification
    return;
  }
  
  let targetUrl = data.url || '/dashboard';
  
  // Handle specific actions
  switch (action) {
    case 'reply':
      targetUrl = data.replyUrl || targetUrl;
      break;
    case 'mark_read':
      // Mark as read via API call
      markAsRead(data.messageId);
      return;
    case 'rsvp':
      targetUrl = data.rsvpUrl || targetUrl;
      break;
    case 'view':
      targetUrl = data.viewUrl || targetUrl;
      break;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL and focus
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      
      // No window open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification close event - handle when user dismisses notification
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  const data = event.notification.data || {};
  recordNotificationDismissal(data.notificationId);
});

// Background sync for offline notification interactions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'notification-interactions') {
    event.waitUntil(syncNotificationInteractions());
  }
});

// Utility functions for API calls
async function recordNotificationDelivery(notificationId) {
  if (!notificationId) return;
  
  try {
    await fetch(`${API_BASE}/notifications/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        action: 'delivered',
        timestamp: new Date().toISOString()
      }),
    });
  } catch (error) {
    console.error('Failed to record notification delivery:', error);
  }
}

async function recordNotificationClick(notificationId, action = 'click') {
  if (!notificationId) return;
  
  try {
    await fetch(`${API_BASE}/notifications/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        action: 'clicked',
        timestamp: new Date().toISOString()
      }),
    });
  } catch (error) {
    console.error('Failed to record notification click:', error);
    // Queue for background sync
    queueNotificationInteraction(notificationId, 'clicked');
  }
}

async function recordNotificationDismissal(notificationId) {
  if (!notificationId) return;
  
  try {
    await fetch(`${API_BASE}/notifications/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        action: 'dismissed',
        timestamp: new Date().toISOString()
      }),
    });
  } catch (error) {
    console.error('Failed to record notification dismissal:', error);
    queueNotificationInteraction(notificationId, 'dismissed');
  }
}

async function markAsRead(messageId) {
  if (!messageId) return;
  
  try {
    await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'read'
      }),
    });
  } catch (error) {
    console.error('Failed to mark message as read:', error);
  }
}

// Queue interactions for background sync when offline
function queueNotificationInteraction(notificationId, action) {
  // Store in IndexedDB for offline sync
  const interaction = {
    notificationId,
    action,
    timestamp: new Date().toISOString()
  };
  
  // Simple localStorage fallback for demo
  const queued = JSON.parse(localStorage.getItem('queuedInteractions') || '[]');
  queued.push(interaction);
  localStorage.setItem('queuedInteractions', JSON.stringify(queued));
}

async function syncNotificationInteractions() {
  try {
    const queued = JSON.parse(localStorage.getItem('queuedInteractions') || '[]');
    
    for (const interaction of queued) {
      await fetch(`${API_BASE}/notifications/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interaction),
      });
    }
    
    // Clear the queue
    localStorage.setItem('queuedInteractions', '[]');
  } catch (error) {
    console.error('Failed to sync notification interactions:', error);
  }
}

// Fetch event - handle offline requests
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for now
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
}); 