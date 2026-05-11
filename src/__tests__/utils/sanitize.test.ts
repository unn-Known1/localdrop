import { describe, it, expect } from 'vitest';
import { sanitizeFileName, isValidFileName } from '../../utils/sanitize';

describe('sanitizeFileName', () => {
  it('should return valid names unchanged', () => {
    expect(sanitizeFileName('document.pdf')).toBe('document.pdf');
    expect(sanitizeFileName('photo.jpg')).toBe('photo.jpg');
  });

  it('should remove path separators', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toBe('.._.._.._etc_passwd');
    expect(sanitizeFileName('folder\\file.txt')).toBe('folder_file.txt');
  });

  it('should remove forbidden characters', () => {
    expect(sanitizeFileName('file<name>.txt')).toBe('file_name_.txt');
    expect(sanitizeFileName('file:name?.txt')).toBe('file_name_.txt');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFileName('  file.txt  ')).toBe('file.txt');
  });

  it('should truncate long names', () => {
    const longName = 'a'.repeat(300) + '.txt';
    const result = sanitizeFileName(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('should handle empty strings', () => {
    expect(sanitizeFileName('')).toBe('unnamed_file');
  });

  it('should handle null bytes', () => {
    expect(sanitizeFileName('file\x00name.txt')).toBe('file_name.txt');
  });
});

describe('isValidFileName', () => {
  it('should accept valid names', () => {
    expect(isValidFileName('document.pdf')).toBe(true);
    expect(isValidFileName('photo_2024.jpg')).toBe(true);
  });

  it('should reject empty names', () => {
    expect(isValidFileName('')).toBe(false);
  });

  it('should reject names with path separators', () => {
    expect(isValidFileName('path/file.txt')).toBe(false);
    expect(isValidFileName('path\\file.txt')).toBe(false);
  });

  it('should reject names that are too long', () => {
    expect(isValidFileName('a'.repeat(256))).toBe(false);
  });
});