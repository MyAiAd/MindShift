// ===============================================
// REUSABLE MYAI TEMPLATE - GDPR COMPLIANCE SERVICE
// ===============================================
// Comprehensive GDPR compliance utilities for EU/German markets

import config from '@/lib/config';
import { createClient } from '@/lib/database';

export type ConsentType = 
  | 'essential'
  | 'functional' 
  | 'analytics'
  | 'marketing'
  | 'personalization'
  | 'advertising'
  | 'social_media';

export type DataProcessingPurpose = 
  | 'service_provision'
  | 'legal_obligation'
  | 'legitimate_interest'
  | 'consent'
  | 'contract_performance'
  | 'vital_interests';

export type LegalBasis = 
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export type DataCategory = 
  | 'personal_identity'
  | 'contact_info'
  | 'demographic'
  | 'behavioral'
  | 'technical'
  | 'financial'
  | 'health'
  | 'biometric'
  | 'location';

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  version: string;
  method: 'web' | 'api' | 'admin' | 'import';
  ipAddress: string;
  userAgent: string;
  metadata: any;
}

export interface DataProcessingRecord {
  id: string;
  purpose: DataProcessingPurpose;
  legalBasis: LegalBasis;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  retention: {
    period: number; // in days
    criteria: string;
  };
  safeguards: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSubjectRequest {
  id: string;
  userId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  notes?: string;
  metadata: any;
}

export interface CookieInfo {
  name: string;
  category: ConsentType;
  purpose: string;
  duration: string;
  thirdParty: boolean;
  essential: boolean;
}

export interface GDPRCompliance {
  consentManagement: boolean;
  dataMinimization: boolean;
  rightToAccess: boolean;
  rightToRectification: boolean;
  rightToErasure: boolean;
  rightToPortability: boolean;
  rightToRestriction: boolean;
  rightToObject: boolean;
  dataProtectionByDesign: boolean;
  privacyNotice: boolean;
  consentWithdrawal: boolean;
  lawfulBasis: boolean;
  dataRetention: boolean;
  dataBreachNotification: boolean;
  privacyImpactAssessment: boolean;
}

export class GDPRService {
  private static instance: GDPRService;
  private supabase: any;
  
  private constructor() {
    this.supabase = createClient();
  }

  public static getInstance(): GDPRService {
    if (!GDPRService.instance) {
      GDPRService.instance = new GDPRService();
    }
    return GDPRService.instance;
  }

  // ===============================================
  // CONSENT MANAGEMENT
  // ===============================================

  public async getConsentStatus(userId: string): Promise<ConsentRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map(this.mapToConsentRecord);
    } catch (error) {
      console.error('Error fetching consent status:', error);
      throw new Error('Failed to fetch consent status');
    }
  }

  public async updateConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    metadata: any = {}
  ): Promise<ConsentRecord> {
    try {
      const now = new Date();
      const request = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          consentType,
          granted,
          metadata: {
            ...metadata,
            timestamp: now.toISOString(),
            userAgent: navigator.userAgent,
          },
        }),
      });

      if (!request.ok) {
        throw new Error('Failed to update consent');
      }

      const response = await request.json();
      return this.mapToConsentRecord(response.consent);
    } catch (error) {
      console.error('Error updating consent:', error);
      throw new Error('Failed to update consent');
    }
  }

  public async bulkUpdateConsent(
    userId: string,
    consents: Array<{ type: ConsentType; granted: boolean }>
  ): Promise<ConsentRecord[]> {
    try {
      const promises = consents.map(({ type, granted }) =>
        this.updateConsent(userId, type, granted)
      );

      return await Promise.all(promises);
    } catch (error) {
      console.error('Error bulk updating consent:', error);
      throw new Error('Failed to bulk update consent');
    }
  }

  private mapToConsentRecord(data: any): ConsentRecord {
    return {
      id: data.id,
      userId: data.user_id,
      consentType: data.consent_type,
      granted: data.granted,
      grantedAt: data.granted_at ? new Date(data.granted_at) : null,
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : null,
      version: data.version,
      method: data.method,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      metadata: data.metadata,
    };
  }

  // ===============================================
  // COOKIE MANAGEMENT
  // ===============================================

  public getCookieCategories(): CookieInfo[] {
    return [
      {
        name: 'sb-*',
        category: 'essential',
        purpose: 'User authentication and session management',
        duration: '1 year',
        thirdParty: false,
        essential: true,
      },
      {
        name: 'myai-session',
        category: 'essential',
        purpose: 'Application session management',
        duration: '1 day',
        thirdParty: false,
        essential: true,
      },
      {
        name: 'accessibility-preferences',
        category: 'functional',
        purpose: 'Store user accessibility preferences',
        duration: '1 year',
        thirdParty: false,
        essential: false,
      },
      {
        name: 'theme-preference',
        category: 'functional',
        purpose: 'Store user theme preferences',
        duration: '1 year',
        thirdParty: false,
        essential: false,
      },
      {
        name: '_ga',
        category: 'analytics',
        purpose: 'Used to distinguish users',
        duration: '2 years',
        thirdParty: true,
        essential: false,
      },
      {
        name: '_gid',
        category: 'analytics',
        purpose: 'Used to distinguish users',
        duration: '24 hours',
        thirdParty: true,
        essential: false,
      },
      {
        name: 'fbp',
        category: 'marketing',
        purpose: 'Used for targeted advertising',
        duration: '3 months',
        thirdParty: true,
        essential: false,
      },
    ];
  }

  public async setCookieConsent(consents: Record<string, boolean>): Promise<void> {
    try {
      localStorage.setItem('cookie-consent', JSON.stringify({
        consents,
        timestamp: new Date().toISOString(),
        version: '1.0',
      }));

      // Apply cookie preferences
      this.applyCookiePreferences(consents);
    } catch (error) {
      console.error('Error setting cookie consent:', error);
      throw new Error('Failed to set cookie consent');
    }
  }

  public getCookieConsent(): Record<string, boolean> | null {
    try {
      const stored = localStorage.getItem('cookie-consent');
      if (!stored) return null;

      const data = JSON.parse(stored);
      return data.consents;
    } catch (error) {
      console.error('Error getting cookie consent:', error);
      return null;
    }
  }

  private applyCookiePreferences(consents: Record<string, boolean>): void {
    // Remove non-essential cookies if consent is revoked
    if (!consents.analytics) {
      this.clearCookiesByCategory('analytics');
    }

    if (!consents.marketing) {
      this.clearCookiesByCategory('marketing');
    }

    if (!consents.functional) {
      this.clearCookiesByCategory('functional');
    }
  }

  private clearCookiesByCategory(category: string): void {
    const categories = this.getCookieCategories();
    const categoryData = categories.find(cat => cat.category === category);

    if (categoryData) {
      // For HTTP cookies, we can't remove them directly from document.cookie
      // This is a client-side only operation.
      // For JavaScript cookies/localStorage, we can remove them.
      if (categoryData.thirdParty) {
        localStorage.removeItem(categoryData.name);
      }
    }
  }

  // ===============================================
  // DATA SUBJECT RIGHTS
  // ===============================================

  public async requestDataExport(userId: string): Promise<string> {
    try {
      const response = await fetch('/api/gdpr/data-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data export');
      }

      const result = await response.json();
      return result.requestId;
    } catch (error) {
      console.error('Error requesting data export:', error);
      throw new Error('Failed to request data export');
    }
  }

  public async requestDataDeletion(
    userId: string,
    reason: string,
    retainSubscriptionHistory: boolean = false
  ): Promise<string> {
    try {
      const response = await fetch('/api/gdpr/data-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          reason,
          retainSubscriptionHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data deletion');
      }

      const result = await response.json();
      return result.requestId;
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw new Error('Failed to request data deletion');
    }
  }

  public async requestDataRectification(
    userId: string,
    corrections: Record<string, any>
  ): Promise<string> {
    try {
      const response = await fetch('/api/gdpr/data-rectification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          corrections,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to request data rectification');
      }

      const result = await response.json();
      return result.requestId;
    } catch (error) {
      console.error('Error requesting data rectification:', error);
      throw new Error('Failed to request data rectification');
    }
  }

  // ===============================================
  // PRIVACY IMPACT ASSESSMENT
  // ===============================================

  public async generatePrivacyImpactAssessment(
    processing: DataProcessingRecord
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
    requiredMeasures: string[];
  }> {
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const recommendations: string[] = [];
    const requiredMeasures: string[] = [];

    // Assess risk level based on data categories
    const sensitiveData = processing.dataCategories.filter(cat => 
      ['biometric', 'health', 'genetic'].includes(cat)
    );

    if (sensitiveData.length > 0) {
      riskLevel = 'high';
      recommendations.push('Implement enhanced security measures for special category data');
      requiredMeasures.push('Data Protection Impact Assessment (DPIA) required');
    }

    // Check for automated decision making
    if (processing.purpose === 'consent' && processing.dataSubjects.includes('profiling')) {
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      recommendations.push('Implement right to explanation for automated decisions');
      requiredMeasures.push('Obtain explicit consent for profiling');
    }

    // Check for international transfers
    if (processing.safeguards.length > 0) {
      const nonEUCountries = processing.safeguards.filter(safeguard => 
        !['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'].includes(safeguard)
      );

      if (nonEUCountries.length > 0) {
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        recommendations.push('Implement appropriate safeguards for international transfers');
        requiredMeasures.push('Standard Contractual Clauses (SCCs) or adequacy decision required');
      }
    }

    // Check retention period
    if (processing.retention.period > 2555) { // 7 years
      recommendations.push('Review data retention period for necessity');
    }

    return {
      riskLevel,
      recommendations,
      requiredMeasures,
    };
  }

  // ===============================================
  // UTILITY FUNCTIONS
  // ===============================================

  public isGDPREnabled(): boolean {
    return config.gdpr.consentManagerEnabled;
  }

  public getPrivacyPolicyUrl(): string {
    return config.gdpr.privacyPolicyUrl;
  }

  public getDataRetentionPeriod(): number {
    return config.gdpr.dataRetentionDays;
  }

  public async checkUserLocation(): Promise<{ isEU: boolean; country: string }> {
    try {
      // Simple geo-location check (in production, use a proper service)
      const response = await fetch('/api/geo-location');
      const data = await response.json();
      
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
      
      return {
        isEU: euCountries.includes(data.country),
        country: data.country,
      };
    } catch (error) {
      console.error('Error checking user location:', error);
      // Default to EU for safety
      return { isEU: true, country: 'DE' };
    }
  }
}

// Export singleton instance
export const gdprService = GDPRService.getInstance();

// React hook for GDPR functionality
export const useGDPR = () => {
  const service = GDPRService.getInstance();
  
  return {
    getConsentStatus: service.getConsentStatus.bind(service),
    updateConsent: service.updateConsent.bind(service),
    bulkUpdateConsent: service.bulkUpdateConsent.bind(service),
    getCookieCategories: service.getCookieCategories.bind(service),
    setCookieConsent: service.setCookieConsent.bind(service),
    getCookieConsent: service.getCookieConsent.bind(service),
    requestDataExport: service.requestDataExport.bind(service),
    requestDataDeletion: service.requestDataDeletion.bind(service),
    requestDataRectification: service.requestDataRectification.bind(service),
    generatePrivacyImpactAssessment: service.generatePrivacyImpactAssessment.bind(service),
    isGDPREnabled: service.isGDPREnabled.bind(service),
    getPrivacyPolicyUrl: service.getPrivacyPolicyUrl.bind(service),
    getDataRetentionPeriod: service.getDataRetentionPeriod.bind(service),
    checkUserLocation: service.checkUserLocation.bind(service),
  };
}; 