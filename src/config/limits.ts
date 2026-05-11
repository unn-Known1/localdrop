// src/config/limits.ts
/**
 * Centralized configuration for file size limits and transfer settings.
 * Single source of truth to prevent inconsistencies across services.
 */

export const FILE_LIMITS = {
  /** Maximum size per file in bytes (2GB) */
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024,

  /** Maximum total queue size in bytes (10GB) */
  MAX_TOTAL_SIZE: 10 * 1024 * 1024 * 1024,

  /** Chunk size for file transfers (256KB) */
  CHUNK_SIZE: 262144,

  /** Maximum concurrent chunk sends */
  MAX_CONCURRENT_CHUNKS: 4,

  /** Maximum concurrent transfers */
  MAX_CONCURRENT_TRANSFERS: 3,

  /** Maximum file name length */
  MAX_FILENAME_LENGTH: 255,
} as const;

export const SECURITY_LIMITS = {
  /** PIN hashing iterations for PBKDF2 */
  PIN_ITERATIONS: 100000,

  /** Salt length in bytes */
  SALT_LENGTH: 16,

  /** Maximum discovery broadcast rate (ms) */
  MIN_DISCOVERY_INTERVAL: 1000,
} as const;

export const STORAGE_KEYS = {
  DEVICE_NICKNAME: 'deviceNickname',
  PIN_HASH: 'pinHash',
  PIN_SALT: 'pinSalt',
  PIN_ENABLED: 'pinEnabled',
} as const;

/**
 * Validates file size against maximum limit
 */
export function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size <= 0) {
    return { valid: false, error: 'File size must be greater than 0' };
  }
  if (size > FILE_LIMITS.MAX_FILE_SIZE) {
    const maxGB = FILE_LIMITS.MAX_FILE_SIZE / (1024 * 1024 * 1024);
    return { valid: false, error: `File exceeds ${maxGB}GB limit` };
  }
  return { valid: true };
}

/**
 * Validates total queue size
 */
export function validateTotalSize(currentTotal: number, addingSize: number): { valid: boolean; error?: string } {
  const newTotal = currentTotal + addingSize;
  if (newTotal > FILE_LIMITS.MAX_TOTAL_SIZE) {
    const maxGB = FILE_LIMITS.MAX_TOTAL_SIZE / (1024 * 1024 * 1024);
    return { valid: false, error: `Total files exceed ${maxGB}GB limit` };
  }
  return { valid: true };
}
