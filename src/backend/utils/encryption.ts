import crypto from 'crypto';

// The key must be exactly 32 bytes (256 bits) for aes-256-cbc.
// Our ENCRYPTION_KEY in .env.local is a 64-character hex string (which represents 32 bytes).
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY must be defined in .env.local');
}

// Convert the hex string to a Buffer
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

if (keyBuffer.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
}

export function encrypt(text: string): { iv: string; encryptedData: string } {
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted
  };
}

export function decrypt(text: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  let decrypted = decipher.update(text, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
