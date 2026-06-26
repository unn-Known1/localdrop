// src/services/crypto.ts
import { SECURITY_LIMITS } from '../config/limits';

/**
 * Converts ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hashes a PIN using PBKDF2 with a random salt.
 * Returns both the hash and salt for storage.
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(SECURITY_LIMITS.SALT_LENGTH));

  // Import PIN as key material
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: SECURITY_LIMITS.PIN_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return {
    hash: bufferToHex(derivedBits),
    salt: bufferToHex(salt),
  };
}

/**
 * Verifies a PIN against stored hash and salt.
 */
export async function verifyPin(pin: string, storedHash: string, storedSalt: string): Promise<boolean> {
  if (!pin || !storedHash || !storedSalt) {
    return false;
  }

  try {
    const salt = hexToUint8Array(storedSalt);

    // Import PIN as key material
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive bits using same parameters
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: SECURITY_LIMITS.PIN_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );

    const computedHash = bufferToHex(derivedBits);

    // Constant-time comparison to prevent timing attacks
    let result = 0;
    const len = Math.max(computedHash.length, storedHash.length);
    for (let i = 0; i < len; i++) {
      const a = i < computedHash.length ? computedHash.charCodeAt(i) : 0;
      const b = i < storedHash.length ? storedHash.charCodeAt(i) : 0;
      result |= a ^ b;
    }

    return result === 0;
  } catch (err) {
    console.error('verifyPin error', err);
    return false;
  }
}

/**
 * Generates a cryptographically secure random ID.
 */
export function generateSecureId(): string {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  return Array.from(array, dec => dec.toString(36).padStart(6, '0')).join('');
}

/**
 * Computes SHA-256 hash of data.
 */
export async function hashBuffer(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}
