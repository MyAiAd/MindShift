// ===============================================
// REUSABLE MYAI TEMPLATE - 2FA SERVICE
// ===============================================
// Complete Two-Factor Authentication service using Supabase MFA

import { createClient } from '@/lib/database';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface MFASetupData {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
  factorId?: string;
}

export interface MFAVerificationResult {
  success: boolean;
  token?: string;
  error?: string;
  factorId?: string;
}

export interface MFAStatus {
  isEnabled: boolean;
  factors: MFAFactor[];
  hasBackupCodes: boolean;
  lastUsed?: Date;
}

export interface MFAFactor {
  id: string;
  type: 'totp' | 'phone';
  friendlyName: string;
  status: 'unverified' | 'verified';
  createdAt: Date;
  lastUsed?: Date;
}

export interface BackupCode {
  id: string;
  code: string;
  used: boolean;
  usedAt?: Date;
}

export class MFAService {
  private static instance: MFAService;
  private supabase: any;

  private constructor() {
    this.supabase = createClient();
  }

  public static getInstance(): MFAService {
    if (!MFAService.instance) {
      MFAService.instance = new MFAService();
    }
    return MFAService.instance;
  }

  /**
   * Get current MFA status for user
   */
  public async getMFAStatus(): Promise<MFAStatus> {
    try {
      const { data: factors, error } = await this.supabase.auth.mfa.listFactors();
      
      if (error) throw error;

      const hasBackupCodes = await this.hasBackupCodes();
      
      return {
        isEnabled: factors.totp.length > 0,
        factors: factors.totp.map((factor: any) => ({
          id: factor.id,
          type: 'totp',
          friendlyName: factor.friendly_name || 'Authenticator App',
          status: factor.status,
          createdAt: new Date(factor.created_at),
          lastUsed: factor.last_used ? new Date(factor.last_used) : undefined
        })),
        hasBackupCodes,
        lastUsed: factors.totp.length > 0 ? new Date(factors.totp[0].last_used) : undefined
      };
    } catch (error) {
      console.error('Error getting MFA status:', error);
      return {
        isEnabled: false,
        factors: [],
        hasBackupCodes: false
      };
    }
  }

  /**
   * Initiate 2FA setup process
   */
  public async setupMFA(friendlyName: string = 'Authenticator App'): Promise<MFASetupData> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Enroll a new TOTP factor
      const { data: factor, error: enrollError } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName
      });

      if (enrollError) throw enrollError;

      // Generate QR code
      const qrCodeData = factor.totp.qr_code;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData);

      // Request backup codes from API
      const backupCodes = await this.requestBackupCodes();

      return {
        secret: factor.totp.secret,
        qrCodeDataUrl,
        backupCodes,
        factorId: factor.id
      };
    } catch (error) {
      console.error('Error setting up MFA:', error);
      throw new Error('Failed to setup 2FA');
    }
  }

  /**
   * Verify 2FA setup with user's code
   */
  public async verifyMFASetup(factorId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const { data, error } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId: '', // Will be provided by Supabase
        code
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Invalid verification code'
        };
      }

      return {
        success: true,
        factorId,
        token: data.access_token
      };
    } catch (error) {
      console.error('Error verifying MFA setup:', error);
      return {
        success: false,
        error: 'Failed to verify setup code'
      };
    }
  }

  /**
   * Challenge user for 2FA during login
   */
  public async challengeMFA(factorId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.auth.mfa.challenge({
        factorId
      });

      if (error) throw error;

      return data.id; // Challenge ID
    } catch (error) {
      console.error('Error creating MFA challenge:', error);
      throw new Error('Failed to create 2FA challenge');
    }
  }

  /**
   * Verify MFA code during login
   */
  public async verifyMFA(factorId: string, challengeId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const { data, error } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Invalid verification code'
        };
      }

      return {
        success: true,
        token: data.access_token,
        factorId
      };
    } catch (error) {
      console.error('Error verifying MFA:', error);
      return {
        success: false,
        error: 'Failed to verify code'
      };
    }
  }

  /**
   * Disable 2FA for user
   */
  public async disableMFA(factorId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.auth.mfa.unenroll({
        factorId
      });

      if (error) throw error;

      // Remove backup codes via API
      await this.removeBackupCodes();

      return true;
    } catch (error) {
      console.error('Error disabling MFA:', error);
      return false;
    }
  }

  /**
   * Request backup codes from API
   */
  private async requestBackupCodes(): Promise<string[]> {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_backup_codes' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.backupCodes || [];
      }

      return [];
    } catch (error) {
      console.error('Error requesting backup codes:', error);
      return [];
    }
  }

  /**
   * Verify backup code via API
   */
  public async verifyBackupCode(code: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify_backup_code',
          code: code.toUpperCase()
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.success || false;
      }

      return false;
    } catch (error) {
      console.error('Error verifying backup code:', error);
      return false;
    }
  }

  /**
   * Get backup codes via API
   */
  public async getBackupCodes(): Promise<BackupCode[]> {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_backup_codes' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.backupCodes || [];
      }

      return [];
    } catch (error) {
      console.error('Error getting backup codes:', error);
      return [];
    }
  }

  /**
   * Check if user has backup codes via API
   */
  private async hasBackupCodes(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_backup_codes' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasBackupCodes || false;
      }

      return false;
    } catch (error) {
      console.error('Error checking backup codes:', error);
      return false;
    }
  }

  /**
   * Generate new backup codes (invalidate old ones)
   */
  public async regenerateBackupCodes(): Promise<string[]> {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_backup_codes' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.backupCodes || [];
      }

      throw new Error('Failed to regenerate backup codes');
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      throw new Error('Failed to regenerate backup codes');
    }
  }

  /**
   * Remove all backup codes for user via API
   */
  private async removeBackupCodes(): Promise<void> {
    try {
      await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_backup_codes' })
      });
    } catch (error) {
      console.error('Error removing backup codes:', error);
    }
  }

  /**
   * Validate TOTP code format
   */
  public static validateTOTPCode(code: string): boolean {
    return /^\d{6}$/.test(code);
  }

  /**
   * Validate backup code format
   */
  public static validateBackupCode(code: string): boolean {
    return /^[A-F0-9]{8}$/.test(code.toUpperCase());
  }
}

export default MFAService; 