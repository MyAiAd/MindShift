import { NextRequest, NextResponse } from 'next/server';
import { MFAService } from '@/services/auth/mfa.service';
import { createServerClient } from '@/lib/database-server';
import { validateSession } from '@/lib/security-middleware';

// POST /api/auth/mfa/challenge - Create MFA challenge for login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, factorId, challengeId, code } = body;

    const mfaService = MFAService.getInstance();

    switch (action) {
      case 'create':
        return await handleCreateChallenge(factorId, mfaService);
      
      case 'verify':
        return await handleVerifyChallenge(factorId, challengeId, code, mfaService);
      
      case 'verify_backup':
        return await handleVerifyBackupCode(code, mfaService);
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling MFA challenge:', error);
    return NextResponse.json({ error: 'Failed to process MFA challenge' }, { status: 500 });
  }
}

// Create MFA challenge
async function handleCreateChallenge(factorId: string, mfaService: MFAService) {
  try {
    if (!factorId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: factorId' 
      }, { status: 400 });
    }

    const challengeId = await mfaService.challengeMFA(factorId);
    
    return NextResponse.json({
      success: true,
      challengeId,
      message: 'MFA challenge created. Please enter your verification code.'
    });
  } catch (error) {
    console.error('Error creating MFA challenge:', error);
    return NextResponse.json({ 
      error: 'Failed to create MFA challenge' 
    }, { status: 500 });
  }
}

// Verify MFA challenge
async function handleVerifyChallenge(factorId: string, challengeId: string, code: string, mfaService: MFAService) {
  try {
    if (!factorId || !challengeId || !code) {
      return NextResponse.json({ 
        error: 'Missing required parameters: factorId, challengeId, code' 
      }, { status: 400 });
    }

    // Validate code format
    if (!MFAService.validateTOTPCode(code)) {
      return NextResponse.json({ 
        error: 'Invalid code format. Code must be 6 digits.' 
      }, { status: 400 });
    }

    const result = await mfaService.verifyMFA(factorId, challengeId, code);
    
    return NextResponse.json({
      success: result.success,
      token: result.token,
      error: result.error,
      message: result.success ? 'MFA verification successful' : 'MFA verification failed'
    });
  } catch (error) {
    console.error('Error verifying MFA challenge:', error);
    return NextResponse.json({ 
      error: 'Failed to verify MFA challenge' 
    }, { status: 500 });
  }
}

// Verify backup code
async function handleVerifyBackupCode(code: string, mfaService: MFAService) {
  try {
    if (!code) {
      return NextResponse.json({ 
        error: 'Missing required parameter: code' 
      }, { status: 400 });
    }

    // Validate backup code format
    if (!MFAService.validateBackupCode(code)) {
      return NextResponse.json({ 
        error: 'Invalid backup code format' 
      }, { status: 400 });
    }

    const isValid = await mfaService.verifyBackupCode(code);
    
    return NextResponse.json({
      success: isValid,
      message: isValid ? 'Backup code verified successfully' : 'Invalid or used backup code'
    });
  } catch (error) {
    console.error('Error verifying backup code:', error);
    return NextResponse.json({ 
      error: 'Failed to verify backup code' 
    }, { status: 500 });
  }
} 