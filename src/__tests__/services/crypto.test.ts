// src/__tests__/services/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, generateSecureId } from '../../services/crypto';

describe('Crypto Service', () => {
  describe('hashPin', () => {
    it('should hash PIN with salt', async () => {
      const result = await hashPin('1234');

      expect(result.hash).toHaveLength(64); // SHA-256 = 64 hex chars
      expect(result.salt).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should produce different hashes for same PIN', async () => {
      const result1 = await hashPin('1234');
      const result2 = await hashPin('1234');

      expect(result1.hash).not.toBe(result2.hash); // Different due to salt
      expect(result1.salt).not.toBe(result2.salt);
    });
  });

  describe('verifyPin', () => {
    it('should verify correct PIN', async () => {
      const { hash, salt } = await hashPin('1234');
      const isValid = await verifyPin('1234', hash, salt);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const { hash, salt } = await hashPin('1234');
      const isValid = await verifyPin('wrong', hash, salt);

      expect(isValid).toBe(false);
    });

    it('should reject empty PIN', async () => {
      const { hash, salt } = await hashPin('1234');
      const isValid = await verifyPin('', hash, salt);

      expect(isValid).toBe(false);
    });
  });

  describe('generateSecureId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateSecureId();
      const id2 = generateSecureId();

      expect(id1).not.toBe(id2);
    });

    it('should generate ID with correct length', () => {
      const id = generateSecureId();
      expect(id.length).toBeGreaterThan(20);
    });
  });
});