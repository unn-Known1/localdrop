# Phase 1: Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical security vulnerabilities and architecture issues to make the app production-ready.

**Architecture:** Create centralized configuration, secure crypto service, split the giant context into focused modules, and implement streaming file transfer to prevent memory exhaustion.

**Tech Stack:** React 18, TypeScript, Vite, Web Crypto API, IndexedDB

---

## File Structure

```
src/
├── config/
│   └── limits.ts              # Centralized limits configuration
├── services/
│   ├── crypto.ts              # Secure PIN hashing with PBKDF2
│   └── enhanced-webrtc.ts     # Modified for streaming
├── types/
│   ├── device.ts              # Device-related types
│   ├── transfer.ts            # Transfer-related types
│   ├── settings.ts            # Settings types
│   └── index.ts               # Re-exports
├── utils/
│   ├── sanitize.ts            # File name sanitization
│   └── errors.ts              # Typed error classes
└── __tests__/
    ├── services/
    │   ├── crypto.test.ts
    │   └── storage.test.ts
    └── utils/
        └── sanitize.test.ts
```

---

## Task 1: Create Centralized Configuration

**Files:**
- Create: `src/config/limits.ts`
- Create: `src/config/index.ts`

- [ ] **Step 1: Create limits configuration file**

```typescript
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
```

- [ ] **Step 2: Create config index file**

```typescript
// src/config/index.ts
export * from './limits';
```

- [ ] **Step 3: Commit**

```bash
git add src/config/
git commit -m "feat: add centralized configuration for file limits"
```

---

## Task 2: Create Type Definitions

**Files:**
- Create: `src/types/device.ts`
- Create: `src/types/transfer.ts`
- Create: `src/types/settings.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Create device types**

```typescript
// src/types/device.ts
export interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  status: 'discovered' | 'connecting' | 'connected' | 'disconnected';
  nickname?: string;
  isFavorite?: boolean;
  signalStrength?: number;
  lastConnected?: number;
}

export interface StoredDevice {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  nickname?: string;
  avatar?: string;
  lastConnected: number;
  totalTransfers: number;
  totalBytesTransferred: number;
  isFavorite: boolean;
}
```

- [ ] **Step 2: Create transfer types**

```typescript
// src/types/transfer.ts
import type { ProcessedFile } from '../services/fileProcessor';

export interface SelectedFile {
  id: string;
  file: File;
  thumbnail?: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  duration?: number;
  processed?: ProcessedFile;
  hasCompressionIssue?: boolean;
}

export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'upload' | 'download';
  status: 'pending' | 'queued' | 'transferring' | 'paused' | 'complete' | 'failed' | 'verifying';
  progress: number;
  speed: number;
  deviceId?: string;
  deviceName?: string;
  error?: string;
  verified?: boolean;
  startedAt?: number;
  completedAt?: number;
  thumbnail?: string;
}

export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'upload' | 'download';
  deviceId: string;
  deviceName: string;
  timestamp: number;
  duration: number;
  status: 'complete' | 'failed' | 'cancelled';
  verified: boolean;
}

export interface TransferState {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  receivedChunks: ChunkProgress[];
  status: 'pending' | 'paused' | 'transferring' | 'complete' | 'failed' | 'verifying' | 'cancelled';
  progress: number;
  speed: number;
  startTime?: number;
  deviceId: string;
  direction: 'upload' | 'download';
  error?: string;
}

export interface ChunkProgress {
  fileId: string;
  chunkIndex: number;
  received: boolean;
  hash?: string;
}
```

- [ ] **Step 3: Create settings types**

```typescript
// src/types/settings.ts
export interface AppSettings {
  pinEnabled: boolean;
  pinHash: string;
  autoAccept: boolean;
  theme: 'dark' | 'light' | 'system';
  defaultQuality: 'original' | 'high' | 'medium' | 'low';
  compressionEnabled: boolean;
  notifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  maxConcurrentTransfers: number;
  chunkSize: number;
  showDetailedStats: boolean;
  deviceNickname: string;
}

export interface Statistics {
  totalFilesSent: number;
  totalFilesReceived: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  averageSpeed: number;
  peakSpeed: number;
  sessionStart: number;
  totalSessions: number;
}
```

- [ ] **Step 4: Create types index**

```typescript
// src/types/index.ts
export * from './device';
export * from './transfer';
export * from './settings';
```

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: add centralized type definitions"
```

---

## Task 3: Create Secure Crypto Service

**Files:**
- Create: `src/services/crypto.ts`
- Create: `src/__tests__/services/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 3: Create test setup**

```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Install test dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd localdrop && npm test -- --run src/__tests__/services/crypto.test.ts`
Expected: FAIL with "Cannot find module '../../services/crypto'"

- [ ] **Step 6: Write implementation**

```typescript
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
 * Converts hex string to ArrayBuffer
 */
function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
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
    const salt = hexToBuffer(storedSalt);
    
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
    if (computedHash.length !== storedHash.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < computedHash.length; i++) {
      result |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    
    return result === 0;
  } catch {
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd localdrop && npm test -- --run src/__tests__/services/crypto.test.ts`
Expected: PASS (all tests)

- [ ] **Step 8: Update package.json test script**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest --run",
    "test:coverage": "vitest --run --coverage"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add src/services/crypto.ts src/__tests__/ vitest.config.ts package.json
git commit -m "feat: add secure crypto service with PBKDF2 PIN hashing"
```

---

## Task 4: Create File Sanitization Utility

**Files:**
- Create: `src/utils/sanitize.ts`
- Create: `src/__tests__/utils/sanitize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/utils/sanitize.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd localdrop && npm test -- --run src/__tests__/utils/sanitize.test.ts`
Expected: FAIL with "Cannot find module '../../utils/sanitize'"

- [ ] **Step 3: Write implementation**

```typescript
// src/utils/sanitize.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd localdrop && npm test -- --run src/__tests__/utils/sanitize.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/sanitize.ts src/__tests__/utils/sanitize.test.ts
git commit -m "feat: add file name sanitization for security"
```

---

## Task 5: Create Error Handling Utilities

**Files:**
- Create: `src/utils/errors.ts`

- [ ] **Step 1: Create error classes**

```typescript
// src/utils/errors.ts

export type TransferErrorCode =
  | 'FILE_TOO_LARGE'
  | 'NOT_CONNECTED'
  | 'TRANSFER_FAILED'
  | 'VERIFICATION_FAILED'
  | 'INVALID_FILE'
  | 'CHUNK_MISSING';

export type DeviceErrorCode =
  | 'NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'DISCONNECTED';

export type StorageErrorCode =
  | 'DB_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_DATA';

/**
 * Error class for transfer-related failures
 */
export class TransferError extends Error {
  constructor(
    message: string,
    public readonly code: TransferErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

/**
 * Error class for device-related failures
 */
export class DeviceError extends Error {
  constructor(
    message: string,
    public readonly code: DeviceErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeviceError';
  }
}

/**
 * Error class for storage-related failures
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Handles unknown errors and returns a user-friendly message.
 */
export function handleError(error: unknown, context: string): string {
  if (error instanceof TransferError) {
    return `Transfer error: ${error.message}`;
  }
  if (error instanceof DeviceError) {
    return `Device error: ${error.message}`;
  }
  if (error instanceof StorageError) {
    return `Storage error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: Unknown error`;
}

/**
 * Type guard for TransferError
 */
export function isTransferError(error: unknown): error is TransferError {
  return error instanceof TransferError;
}

/**
 * Type guard for DeviceError
 */
export function isDeviceError(error: unknown): error is DeviceError {
  return error instanceof DeviceError;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/errors.ts
git commit -m "feat: add typed error classes for consistent error handling"
```

---

## Task 6: Update Storage Service for Secure PIN

**Files:**
- Modify: `src/services/storage.ts`

- [ ] **Step 1: Add imports at top of file**

```typescript
// Add to existing imports at top of src/services/storage.ts
import { hashPin as secureHashPin, verifyPin as secureVerifyPin } from './crypto';
import { STORAGE_KEYS } from '../config/limits';
```

- [ ] **Step 2: Replace PIN methods (lines 411-435)**

Replace the old `hashPin`, `verifyPin`, `setPin`, and `disablePin` methods with:

```typescript
// Remove old hashPin private method entirely

async verifyPin(pin: string): Promise<boolean> {
  if (!await this.getSetting<boolean>('pinEnabled', false)) {
    return true;
  }
  
  const storedHash = await this.getSetting<string>(STORAGE_KEYS.PIN_HASH, '');
  const storedSalt = await this.getSetting<string>(STORAGE_KEYS.PIN_SALT, '');
  
  if (!storedHash || !storedSalt) {
    return false;
  }
  
  return secureVerifyPin(pin, storedHash, storedSalt);
}

async setPin(pin: string): Promise<void> {
  const { hash, salt } = await secureHashPin(pin);
  await this.saveSetting(STORAGE_KEYS.PIN_HASH, hash);
  await this.saveSetting(STORAGE_KEYS.PIN_SALT, salt);
  await this.saveSetting(STORAGE_KEYS.PIN_ENABLED, true);
}

async disablePin(): Promise<void> {
  await this.saveSetting(STORAGE_KEYS.PIN_HASH, '');
  await this.saveSetting(STORAGE_KEYS.PIN_SALT, '');
  await this.saveSetting(STORAGE_KEYS.PIN_ENABLED, false);
}

async isPinSet(): Promise<boolean> {
  return await this.getSetting<boolean>(STORAGE_KEYS.PIN_ENABLED, false);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/storage.ts
git commit -m "fix: use secure PBKDF2 PIN hashing in storage service"
```

---

## Task 7: Update WebRTC Service with Unified Limits

**Files:**
- Modify: `src/services/enhanced-webrtc.ts`
- Delete: `src/services/webrtc.ts` (dead code)

- [ ] **Step 1: Update imports (lines 1-4)**

Replace:
```typescript
// src/services/enhanced-webrtc.ts
import { signalingService, Device } from './signaling';
import { FILE_LIMITS } from '../config/limits';
import { sanitizeFileName } from '../utils/sanitize';
import { TransferError } from '../utils/errors';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];
```

- [ ] **Step 2: Remove hardcoded CHUNK_SIZE constant (line 3)**

Delete: `const CHUNK_SIZE = 262144;`
Use `FILE_LIMITS.CHUNK_SIZE` throughout the file instead.

- [ ] **Step 3: Update handleFileInfo method (around line 80)**

```typescript
private handleFileInfo(message: any, deviceId: string) {
  // Validate file metadata from untrusted peer
  if (!message.fileId || typeof message.fileId !== 'string') return;
  
  // Sanitize file name
  const fileName = sanitizeFileName(message.fileName);
  if (!fileName) return;
  
  if (!message.fileSize || message.fileSize <= 0 || message.fileSize > FILE_LIMITS.MAX_FILE_SIZE) {
    console.error(`Invalid file size: ${message.fileSize}`);
    return;
  }
  
  // Validate totalChunks is reasonable
  const expectedChunks = Math.ceil(message.fileSize / FILE_LIMITS.CHUNK_SIZE);
  if (message.totalChunks !== expectedChunks || message.totalChunks > 10000) {
    console.error(`Invalid chunk count: ${message.totalChunks} (expected: ${expectedChunks})`);
    return;
  }

  const fileInfo: FileInfo = { 
    fileId: message.fileId, 
    fileName, // Use sanitized name
    fileSize: message.fileSize, 
    fileType: message.fileType, 
    totalChunks: message.totalChunks, 
    hash: message.hash 
  };
  // ... rest of method unchanged
}
```

- [ ] **Step 4: Update sendFile method (around line 206)**

```typescript
async sendFile(file: File, deviceId: string, fileId?: string): Promise<string> {
  // Validate file size using centralized config
  if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
    throw new TransferError(
      `File too large. Maximum size: ${FILE_LIMITS.MAX_FILE_SIZE / (1024*1024*1024)}GB`,
      'FILE_TOO_LARGE',
      { fileSize: file.size, maxSize: FILE_LIMITS.MAX_FILE_SIZE }
    );
  }

  const peer = this.peers.get(deviceId);
  if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
    throw new TransferError('Peer not connected', 'NOT_CONNECTED');
  }
  
  // Use FILE_LIMITS.CHUNK_SIZE instead of hardcoded value
  const totalChunks = Math.ceil(file.size / FILE_LIMITS.CHUNK_SIZE);
  // ... rest of method
}
```

- [ ] **Step 5: Delete unused webrtc.ts**

```bash
rm src/services/webrtc.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/services/enhanced-webrtc.ts
git rm src/services/webrtc.ts
git commit -m "refactor: use centralized config and remove duplicate webrtc service"
```

---

## Task 8: Update Transfer Context with Unified Limits

**Files:**
- Modify: `src/contexts/EnhancedTransferContext.tsx`

- [ ] **Step 1: Add imports at top**

```typescript
import { FILE_LIMITS, validateFileSize, validateTotalSize } from '../config/limits';
import { generateSecureId } from '../services/crypto';
import { TransferError } from '../utils/errors';
```

- [ ] **Step 2: Remove duplicate generateSecureId function**

Delete the local `generateSecureId` function (around lines 52-56) and use the imported one from crypto service.

- [ ] **Step 3: Update addFiles validation (around lines 95-111)**

Replace the hardcoded validation with:

```typescript
const addFiles = useCallback(async (files: FileList | File[], options?: { compress?: boolean; quality?: string }) => {
  const fileArray = Array.from(files);

  // Use centralized validation
  let totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  // Validate all files before processing
  for (const file of fileArray) {
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      addToast({ type: 'error', message: `${sizeValidation.error}: ${file.name}` });
      return;
    }
    
    const totalValidation = validateTotalSize(totalSize, file.size);
    if (!totalValidation.valid) {
      addToast({ type: 'error', message: totalValidation.error! });
      return;
    }
    totalSize += file.size;
  }

  // ... rest of method unchanged
}, [settings.defaultQuality, addToast, selectedFiles]);
```

- [ ] **Step 4: Update verifyPin to use async storage method (around line 227)**

```typescript
const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
  if (!settings.pinEnabled) return true;
  return await storageService.verifyPin(pin);
}, [settings.pinEnabled]);
```

- [ ] **Step 5: Commit**

```bash
git add src/contexts/EnhancedTransferContext.tsx
git commit -m "refactor: use centralized config and secure PIN verification"
```

---

## Task 9: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `cd localdrop && npm test -- --run`
Expected: All tests pass

- [ ] **Step 2: Run linter**

Run: `cd localdrop && npm run lint`
Expected: No errors (fix any that appear)

- [ ] **Step 3: Run type check**

Run: `cd localdrop && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `cd localdrop && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Create summary commit if needed**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "fix: address linting and type errors"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] All tests pass (`npm test -- --run`)
- [ ] Linter passes (`npm run lint`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Production build succeeds (`npm run build`)
- [ ] File size limits are consistent across all files
- [ ] PIN storage uses PBKDF2 with salt
- [ ] File names are sanitized before use
- [ ] Duplicate webrtc.ts is removed
- [ ] Centralized types are created

---

## Next Steps

After completing Phase 1, proceed to Phase 2 which covers:
- CI/CD pipeline setup
- Architecture refactoring (split context)
- Performance improvements (streaming)
- Accessibility improvements
