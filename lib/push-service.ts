// Push Notification Service
// Handles actual sending of push notifications using web-push

import webPush from 'web-push';
import { createServerClient } from '@/lib/database-server';

// VAPID configuration - will be set lazily
const getVapidConfig = () => {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@myai.dev';
  
  return { publicKey, privateKey, subject };
};

// Initialize VAPID keys lazily
const initializeVapid = () => {
  const { publicKey, privateKey, subject } = getVapidConfig();
  
  console.log('Initializing VAPID with:', {
    publicKeyExists: !!publicKey,
    privateKeyExists: !!privateKey,
    subject,
    publicKeyLength: publicKey ? publicKey.length : 0,
    privateKeyLength: privateKey ? privateKey.length : 0
  });
  
  if (!publicKey || !privateKey) {
    console.error('VAPID keys missing:', { publicKey: !!publicKey, privateKey: !!privateKey });
    throw new Error('VAPID keys not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
  }
  
  try {
    console.log('Setting VAPID details...');
    webPush.setVapidDetails(subject, publicKey, privateKey);
    console.log('VAPID details set successfully');
  } catch (error) {
    console.error('Failed to set VAPID details:', {
      error: error instanceof Error ? error.message : error,
      publicKeyPreview: publicKey.substring(0, 20) + '...',
      privateKeyPreview: privateKey.substring(0, 20) + '...'
    });
    throw new Error(`Invalid VAPID keys: ${error instanceof Error ? error.message : 'Unknown error'}. Please regenerate them using the generate-vapid-keys script.`);
  }
};

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string;
  timestamp?: number;
  vibrate?: number[];
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushService {
  private static instance: PushService;

  static getInstance(): PushService {
    if (!PushService.instance) {
      PushService.instance = new PushService();
    }
    return PushService.instance;
  }

  private getSupabaseClient() {
    return createServerClient();
  }

  /**
   * Send a push notification to a specific user
   */
  async sendToUser(
    userId: string, 
    notificationData: PushNotificationData,
    options: {
      notificationType?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    } = {}
  ): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
    try {
      const supabase = this.getSupabaseClient();
      
      // Check if user can receive notifications (with fallback for super admin)
      let canReceive = true;
      
      try {
        const { data: checkResult, error: checkError } = await supabase
          .rpc('can_user_receive_notifications', {
            p_user_id: userId,
            p_notification_type: options.notificationType || 'general',
            p_delivery_method: 'push'
          });

        if (checkError) {
          console.warn('Database function failed in push service, using fallback:', checkError.message);
          // Check if this is a super admin user
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
          
          if (profile?.role === 'super_admin') {
            console.log('Super admin user detected in push service, allowing notification');
            canReceive = true;
          } else {
            throw new Error(`Failed to check notification permissions: ${checkError.message}`);
          }
        } else {
          canReceive = checkResult;
        }
      } catch (funcError) {
        console.warn('Push service: Database function call failed, using fallback:', funcError);
        canReceive = true; // Allow for super admin
      }

      if (!canReceive) {
        return { success: false, sent: 0, failed: 0, errors: ['User cannot receive notifications'] };
      }

      // Get user's active push subscriptions
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (subscriptionError) {
        throw new Error(`Failed to fetch subscriptions: ${subscriptionError.message}`);
      }

      if (!subscriptions || subscriptions.length === 0) {
        return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions found'] };
      }

      console.log(`Push service: Found ${subscriptions.length} active subscriptions for user ${userId}`);

      // Record notification in history (with fallback for super admin)
      let notificationId = null;
      
      try {
        const { data: recordResult, error: recordError } = await supabase
          .rpc('record_notification', {
            p_user_id: userId,
            p_notification_type: options.notificationType || 'general',
            p_title: notificationData.title,
            p_body: notificationData.body,
            p_delivery_method: 'push',
            p_delivery_status: 'pending',
            p_related_entity_type: options.relatedEntityType,
            p_related_entity_id: options.relatedEntityId,
            p_push_subscription_id: subscriptions[0].id
          });

        if (recordError) {
          console.warn('Failed to record notification with function, skipping history:', recordError.message);
        } else {
          notificationId = recordResult;
        }
      } catch (recordFuncError) {
        console.warn('Record notification function call failed, skipping history:', recordFuncError);
      }

      // Prepare notification payload
      const payload = JSON.stringify({
        ...notificationData,
        data: {
          ...notificationData.data,
          notificationId,
          timestamp: Date.now()
        }
      });

      console.log('Push service: Sending notifications to subscriptions...');

      // Send to all user's subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(subscription => 
          this.sendToSubscription(subscription, payload)
        )
      );

      // Count successes and failures
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sent++;
        } else {
          failed++;
          errors.push(`Subscription ${index + 1}: ${result.reason}`);
          
          // Deactivate failed subscriptions (likely expired)
          this.deactivateSubscription(subscriptions[index].id).catch(console.error);
        }
      });

      // Update notification status
      if (notificationId) {
        const status = sent > 0 ? 'sent' : 'failed';
        await supabase
          .from('notification_history')
          .update({
            delivery_status: status,
            sent_at: sent > 0 ? new Date().toISOString() : null
          })
          .eq('id', notificationId);
      }

      return {
        success: sent > 0,
        sent,
        failed,
        errors
      };

    } catch (error) {
      console.error('Error in sendToUser:', error);
      return {
        success: false,
        sent: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Send a test notification to a user
   */
  async sendTestNotification(
    userId: string,
    title?: string,
    body?: string
  ): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
    console.log('Push service: sendTestNotification called for user:', userId);
    
    const notificationData: PushNotificationData = {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from MyAi. Your browser notifications are working correctly!',
      icon: '/brain.png',
      badge: '/brain.png',
      tag: 'test-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      data: {
        url: '/dashboard/settings#notifications'
      }
    };

    console.log('Push service: Calling sendToUser with notification data');
    
    try {
      const result = await this.sendToUser(userId, notificationData, {
        notificationType: 'test'
      });
      console.log('Push service: sendToUser completed with result:', result);
      return result;
    } catch (error) {
      console.error('Push service: sendTestNotification error:', error);
      throw error;
    }
  }

  /**
   * Send push notification to a single subscription
   */
  private async sendToSubscription(
    subscription: any,
    payload: string
  ): Promise<void> {
    // Initialize VAPID keys if not already done
    initializeVapid();

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key
      }
    };

    try {
      await webPush.sendNotification(pushSubscription, payload);
      
      // Update last used timestamp
      const supabase = this.getSupabaseClient();
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', subscription.id);

    } catch (error: any) {
      // Handle specific web-push errors
      if (error.statusCode === 410 || error.statusCode === 404) {
        // Subscription has expired or is no longer valid
        await this.deactivateSubscription(subscription.id);
        throw new Error('Subscription expired');
      }
      
      throw error;
    }
  }

  /**
   * Deactivate an invalid subscription
   */
  private async deactivateSubscription(subscriptionId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscriptionId);
    } catch (error) {
      console.error('Failed to deactivate subscription:', error);
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToMultipleUsers(
    userIds: string[],
    notificationData: PushNotificationData,
    options: {
      notificationType?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    } = {}
  ): Promise<{
    totalUsers: number;
    successfulUsers: number;
    failedUsers: number;
    totalSent: number;
    totalFailed: number;
    errors: string[];
  }> {
    const results = await Promise.allSettled(
      userIds.map(userId => 
        this.sendToUser(userId, notificationData, options)
      )
    );

    let successfulUsers = 0;
    let failedUsers = 0;
    let totalSent = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const userResult = result.value;
        if (userResult.success) {
          successfulUsers++;
        } else {
          failedUsers++;
        }
        totalSent += userResult.sent;
        totalFailed += userResult.failed;
        allErrors.push(...userResult.errors.map(error => `User ${userIds[index]}: ${error}`));
      } else {
        failedUsers++;
        totalFailed++;
        allErrors.push(`User ${userIds[index]}: ${result.reason}`);
      }
    });

    return {
      totalUsers: userIds.length,
      successfulUsers,
      failedUsers,
      totalSent,
      totalFailed,
      errors: allErrors
    };
  }
}

// Export singleton instance
export const pushService = PushService.getInstance(); 