// ===============================================
// REUSABLE MYAI TEMPLATE - 2FA SERVICE
// ===============================================
// Complete Two-Factor Authentication service using Supabase MFA

import { createClient } from '@/lib/database';
import { createServerClient } from '@/lib/database-server';
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
    try {
      // Use server client for API routes, browser client for frontend
      const isServerSide = typeof window === 'undefined';
      console.log(`MFA Service: Detected ${isServerSide ? 'server' : 'browser'} environment`);
      
      if (isServerSide) {
        console.log('MFA Service: Creating server client...');
        this.supabase = createServerClient();
      } else {
        console.log('MFA Service: Creating browser client...');
        this.supabase = createClient();
      }
      
      console.log(`MFA Service: Using ${isServerSide ? 'server' : 'browser'} client created successfully`);
    } catch (error) {
      console.error('MFA Service: Error in constructor:', error);
      throw error;
    }
  }

  public static getInstance(): MFAService {
    if (!MFAService.instance) {
      try {
        console.log('MFA Service: Creating new instance...');
        MFAService.instance = new MFAService();
        console.log('MFA Service: Instance created successfully');
      } catch (error) {
        console.error('MFA Service: Error creating instance:', error);
        throw error;
      }
    }
    return MFAService.instance;
  }

  /**
   * Get current MFA status for user
   */
  public async getMFAStatus(): Promise<MFAStatus> {
    try {
      console.log('MFA Service: Getting MFA status...');
      
      // First verify user is authenticated
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) {
        console.error('MFA Service: User not authenticated:', userError?.message);
        throw new Error('User not authenticated for MFA operations');
      }
      
      console.log('MFA Service: User authenticated, listing factors...');
      const { data: factors, error } = await this.supabase.auth.mfa.listFactors();
      
      if (error) {
        console.error('MFA Service: Error listing factors:', error);
        throw error;
      }

      console.log('MFA Service: Factors retrieved:', factors);
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
      console.error('MFA Service: Error getting MFA status:', error);
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
      console.log('MFA Service: Starting 2FA setup...');
      
      // Validate Supabase client
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      // Check authentication
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError) {
        console.error('MFA Service: User authentication error:', userError);
        throw new Error(`Authentication failed: ${userError.message}`);
      }
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log('MFA Service: User authenticated, enrolling MFA factor...');

      // Enroll a new TOTP factor with QR-friendly parameters
      const { data: factor, error: enrollError } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MyAi' // Keep it short for QR code compatibility
      });

      if (enrollError) {
        console.error('MFA Service: MFA enrollment error:', enrollError);
        throw new Error(`MFA enrollment failed: ${enrollError.message}`);
      }
      
      if (!factor || !factor.totp) {
        throw new Error('Invalid MFA factor response from Supabase');
      }

      console.log('MFA Service: MFA factor enrolled successfully:', {
        factorId: factor.id,
        hasSecret: !!factor.totp.secret,
        hasQrCode: !!factor.totp.qr_code
      });

      console.log('MFA Service: MFA factor enrolled successfully, generating QR code...');

      // Get QR code data - try Supabase's first, then custom if needed
      let qrCodeData = factor.totp.qr_code;
      
      if (!qrCodeData) {
        throw new Error('No QR code data received from Supabase');
      }
      
      // If Supabase QR data is too long, generate a shorter custom URI
      if (qrCodeData.length > 500) { // Threshold for QR code issues
        console.log('MFA Service: Supabase QR data too long, generating custom URI...');
        
        // Extract just the secret from Supabase's URI or use the secret directly
        const secret = factor.totp.secret;
        const { data: { user } } = await this.supabase.auth.getUser();
        const email = user?.email || 'user';
        
        // Generate a shorter TOTP URI
        qrCodeData = `otpauth://totp/MyAi:${email}?secret=${secret}&issuer=MyAi`;
        console.log('MFA Service: Custom URI generated, length:', qrCodeData.length);
      }

      console.log('MFA Service: QR code data length:', qrCodeData.length);
      
      // Generate QR code with error handling for large data
      let qrCodeDataUrl: string | null = null;
      try {
        console.log('MFA Service: Attempting QR code generation...');
        
        // Strategy 1: Try with low error correction for maximum data capacity
        qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
          errorCorrectionLevel: 'L', // Low = ~7% error correction, max data
          width: 300,
          margin: 2,
          scale: 1
        });
        console.log('MFA Service: QR code generated successfully with strategy 1');
        
      } catch (qrError1) {
        console.log('MFA Service: Strategy 1 failed, trying strategy 2...', qrError1);
        
        try {
          // Strategy 2: Minimal settings with tiny margin
          qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
            width: 256,
            margin: 1,
            scale: 1,
            type: 'image/png'
          });
          console.log('MFA Service: QR code generated successfully with strategy 2');
          
        } catch (qrError2) {
          console.log('MFA Service: Strategy 2 failed, trying strategy 3...', qrError2);
          
          try {
            // Strategy 3: Ultra-compact settings
            qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
              width: 200,
              margin: 0
            });
            console.log('MFA Service: QR code generated successfully with strategy 3');
            
          } catch (qrError3) {
            console.log('MFA Service: All QR generation strategies failed, using manual entry fallback');
            console.log('MFA Service: QR errors:', { qrError1, qrError2, qrError3 });
            
            // Don't throw error, continue with null QR code - user can enter secret manually
          }
        }
      }

      console.log('MFA Service: Requesting backup codes...');
      
      // Request backup codes from API
      const backupCodes = await this.requestBackupCodes();

      console.log('MFA Service: 2FA setup completed successfully');

      return {
        secret: factor.totp.secret,
        qrCodeDataUrl: qrCodeDataUrl || '', // Provide empty string if QR generation failed
        backupCodes,
        factorId: factor.id
      };
    } catch (error) {
      console.error('MFA Service: Error setting up MFA:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('JWT')) {
          throw new Error('Authentication token invalid. Please sign out and sign back in.');
        } else if (error.message.includes('project')) {
          throw new Error('MFA not enabled for this project. Please contact support.');
        } else if (error.message.includes('network')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        throw error;
      }
      
      throw new Error('Failed to setup 2FA. Please try again or contact support.');
    }
  }

  /**
   * Verify 2FA setup with user's code
   */
  public async verifyMFASetup(factorId: string, code: string): Promise<MFAVerificationResult> {
    try {
      console.log('MFA Service: Verifying setup with:', {
        factorId,
        hasCode: !!code,
        codeLength: code.length
      });
      
      // For setup verification, we need to create a challenge first
      const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) {
        console.error('MFA Service: Challenge creation failed:', challengeError);
        return {
          success: false,
          error: challengeError.message || 'Failed to create MFA challenge'
        };
      }

      console.log('MFA Service: Challenge created, verifying code...');

      const { data, error } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code
      });

      if (error) {
        console.error('MFA Service: Verification failed:', error);
        return {
          success: false,
          error: error.message || 'Invalid verification code'
        };
      }

      console.log('MFA Service: Verification successful');

      return {
        success: true,
        factorId,
        token: data.access_token
      };
    } catch (error) {
      console.error('MFA Service: Error verifying MFA setup:', error);
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
   * Check if user has backup codes directly from database
   */
  private async hasBackupCodes(): Promise<boolean> {
    try {
      console.log('MFA Service: Checking for backup codes...');
      
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      if (userError || !user) {
        console.error('MFA Service: User not authenticated for backup codes check:', userError?.message);
        return false;
      }

      // Check backup codes directly in database
      const { count, error } = await this.supabase
        .from('mfa_backup_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('used', false);

      if (error) {
        console.error('MFA Service: Error checking backup codes:', error);
        return false;
      }

      console.log('MFA Service: Found', count, 'unused backup codes');
      return (count || 0) > 0;
    } catch (error) {
      console.error('MFA Service: Error checking backup codes:', error);
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