import { FILE_LIMITS } from '../config/limits';

/**
 * Characters not allowed in file names across platforms
 */
const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Sanitizes a file name by removing dangerous characters.
 * Prevents path traversal and other file system attacks.
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    return 'unnamed_file';
  }

  let sanitized = name;

  // Remove path separators (prevents path traversal)
  sanitized = sanitized.replace(/[/\\]/g, '_');

  // Remove other forbidden characters
  sanitized = sanitized.replace(FORBIDDEN_CHARS, '_');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Truncate if too long
  if (sanitized.length > FILE_LIMITS.MAX_FILENAME_LENGTH) {
    const ext = sanitized.slice(sanitized.lastIndexOf('.'));
    const baseName = sanitized.slice(0, sanitized.lastIndexOf('.'));
    const maxBaseLength = FILE_LIMITS.MAX_FILENAME_LENGTH - ext.length;
    sanitized = baseName.slice(0, maxBaseLength) + ext;
  }

  // Ensure non-empty
  return sanitized || 'unnamed_file';
}

/**
 * Validates if a file name is safe to use.
 */
export function isValidFileName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  if (name.length === 0 || name.length > FILE_LIMITS.MAX_FILENAME_LENGTH) {
    return false;
  }

  // Check for forbidden characters
  if (FORBIDDEN_CHARS.test(name)) {
    return false;
  }

  // Check for path separators
  if (name.includes('/') || name.includes('\\')) {
    return false;
  }

  return true;
}