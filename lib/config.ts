// ===============================================
// REUSABLE MYAI TEMPLATE - CONFIGURATION SYSTEM
// ===============================================
// Centralized configuration with feature flags and environment-based settings

interface AppConfig {
  site: {
    name: string;
    url: string;
    description: string;
  };
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    faviconUrl: string;
  };
  features: {
    treatmentSessions: boolean;
    communityPosts: boolean;
    gamification: boolean;
    notifications: boolean;
    teamManagement: boolean;
    dataManagement: boolean;
    analytics: boolean;
    accessibilityCompliance: boolean;
    gdprCompliance: boolean;
  };
  database: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
    jwtSecret: string;
    projectId: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    publishableKey: string;
  };
  ai: {
    openaiApiKey: string;
  };
  notifications: {
    vapidPublicKey: string;
    vapidPrivateKey: string;
    vapidSubject: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
  };
  deployment: {
    nodeEnv: string;
    vercelUrl: string;
  };
  accessibility: {
    skipNavigation: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
    screenReaderOptimized: boolean;
    keyboardNavigation: boolean;
  };
  gdpr: {
    cookieConsentRequired: boolean;
    privacyPolicyUrl: string;
    dataRetentionDays: number;
    consentManagerEnabled: boolean;
    dataProcessingRecords: boolean;
  };
}

// Default configuration with environment variable fallbacks
const config: AppConfig = {
  site: {
    name: process.env.NEXT_PUBLIC_SITE_NAME || 'MyAi',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'A revolutionary AI-powered platform for mindset transformation',
  },
  branding: {
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#4F46E5',
    secondaryColor: process.env.NEXT_PUBLIC_BRAND_SECONDARY_COLOR || '#10B981',
    logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || '/logo.png',
    faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL || '/favicon.svg',
  },
  features: {
    treatmentSessions: process.env.NEXT_PUBLIC_FEATURE_TREATMENT_SESSIONS === 'true',
    communityPosts: process.env.NEXT_PUBLIC_FEATURE_COMMUNITY_POSTS === 'true',
    gamification: process.env.NEXT_PUBLIC_FEATURE_GAMIFICATION === 'true',
    notifications: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === 'true',
    teamManagement: process.env.NEXT_PUBLIC_FEATURE_TEAM_MANAGEMENT === 'true',
    dataManagement: process.env.NEXT_PUBLIC_FEATURE_DATA_MANAGEMENT === 'true',
    analytics: process.env.NEXT_PUBLIC_FEATURE_ANALYTICS === 'true',
    accessibilityCompliance: process.env.NEXT_PUBLIC_FEATURE_ACCESSIBILITY_COMPLIANCE !== 'false',
    gdprCompliance: process.env.NEXT_PUBLIC_FEATURE_GDPR_COMPLIANCE !== 'false',
  },
  database: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
    projectId: process.env.SUPABASE_PROJECT_ID || '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },
  notifications: {
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || '',
  },
  email: {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
    fromEmail: process.env.FROM_EMAIL || '',
  },
  deployment: {
    nodeEnv: process.env.NODE_ENV || 'development',
    vercelUrl: process.env.VERCEL_URL || '',
  },
  accessibility: {
    skipNavigation: process.env.NEXT_PUBLIC_ACCESSIBILITY_SKIP_NAV !== 'false',
    highContrast: process.env.NEXT_PUBLIC_ACCESSIBILITY_HIGH_CONTRAST === 'true',
    reducedMotion: process.env.NEXT_PUBLIC_ACCESSIBILITY_REDUCED_MOTION === 'true',
    screenReaderOptimized: process.env.NEXT_PUBLIC_ACCESSIBILITY_SCREEN_READER !== 'false',
    keyboardNavigation: process.env.NEXT_PUBLIC_ACCESSIBILITY_KEYBOARD_NAV !== 'false',
  },
  gdpr: {
    cookieConsentRequired: process.env.NEXT_PUBLIC_GDPR_COOKIE_CONSENT !== 'false',
    privacyPolicyUrl: process.env.NEXT_PUBLIC_GDPR_PRIVACY_POLICY_URL || '/privacy',
    dataRetentionDays: parseInt(process.env.GDPR_DATA_RETENTION_DAYS || '2555'), // 7 years default
    consentManagerEnabled: process.env.NEXT_PUBLIC_GDPR_CONSENT_MANAGER !== 'false',
    dataProcessingRecords: process.env.GDPR_DATA_PROCESSING_RECORDS !== 'false',
  },
};

// Feature flag checker
export function isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
  return config.features[feature] === true;
}

// Environment checker
export function isDevelopment(): boolean {
  return config.deployment.nodeEnv === 'development';
}

export function isProduction(): boolean {
  return config.deployment.nodeEnv === 'production';
}

// Configuration validation
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required environment variables
  if (!config.database.url) {
    errors.push('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  
  if (!config.database.anonKey) {
    errors.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  if (!config.database.serviceRoleKey) {
    errors.push('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  
  // Only validate AI key if treatment sessions are enabled
  if (config.features.treatmentSessions && !config.ai.openaiApiKey) {
    errors.push('Missing OPENAI_API_KEY (required for treatment sessions)');
  }
  
  // Only validate Stripe keys if subscriptions are being used
  if (!config.stripe.secretKey && process.env.NODE_ENV === 'production') {
    errors.push('Missing STRIPE_SECRET_KEY (required for production)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Export the config object
export default config;

// Utility functions for common config access
export const getApiUrl = () => config.site.url;
export const getDatabaseUrl = () => config.database.url;
export const getStripePublishableKey = () => config.stripe.publishableKey;

// =========================
// WHISPER TRANSCRIPTION
// =========================

/**
 * Get the configured transcription provider from environment.
 * 
 * @returns "whisper" | "webspeech" - The transcription provider to use
 * @default "webspeech" - Safe fallback to browser-native API
 */
export function getTranscriptionProvider(): "whisper" | "webspeech" {
  const provider = process.env.NEXT_PUBLIC_TRANSCRIPTION_PROVIDER;
  
  // Validate and default to webspeech for safety
  if (provider === "whisper") {
    return "whisper";
  }
  
  // Default to webspeech (safe fallback)
  return "webspeech";
}
