import crypto from 'crypto';

const ENCRYPTION_ALGO = 'aes-256-gcm';
const ENCRYPTION_SALT = 'mindshifting-labs-openrouter-key';

function getEncryptionSecret(): string {
  const secret = process.env.LABS_KEYS_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('LABS_KEYS_ENCRYPTION_SECRET is not configured');
  }
  return secret;
}

function deriveKey(secret: string): Buffer {
  return crypto.scryptSync(secret, ENCRYPTION_SALT, 32);
}

export function encryptOpenRouterKey(apiKey: string): string {
  const secret = getEncryptionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptOpenRouterKey(payload: string): string {
  const secret = getEncryptionSecret();
  const [ivB64, tagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted OpenRouter key payload');
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGO,
    deriveKey(secret),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export async function getUserOpenRouterKey(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_labs_openrouter_keys')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.api_key_encrypted) {
    return null;
  }

  return decryptOpenRouterKey(data.api_key_encrypted);
}

export async function upsertUserOpenRouterKey(supabase: any, userId: string, apiKey: string): Promise<void> {
  const encrypted = encryptOpenRouterKey(apiKey);
  const { error } = await supabase
    .from('user_labs_openrouter_keys')
    .upsert(
      {
        user_id: userId,
        api_key_encrypted: encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    throw error;
  }
}

