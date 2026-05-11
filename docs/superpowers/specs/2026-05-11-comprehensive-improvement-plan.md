# LocalDrop Comprehensive Improvement Plan

**Date:** 2026-05-11  
**Author:** Claude (Kiro)  
**Status:** Draft - Pending User Approval

---

## Executive Summary

This document outlines a comprehensive improvement plan for LocalDrop, a peer-to-peer file transfer application. The analysis identified **26 issues** across security, architecture, features, performance, and testing. This plan prioritizes fixes by impact and provides detailed implementation guidance.

### Key Findings Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 2 | 2 | 2 | 1 | 7 |
| Architecture | 1 | 4 | 3 | 0 | 8 |
| Features | 0 | 3 | 3 | 2 | 8 |
| Performance | 1 | 3 | 2 | 0 | 6 |
| Testing | 0 | 1 | 2 | 0 | 3 |
| **Total** | **4** | **13** | **12** | **3** | **32** |

---

## Part 1: Security Improvements

### 1.1 Unified File Size Limits (Critical)

**Problem:** Inconsistent limits create confusion and potential vulnerabilities.

| File | Limit | Line |
|------|-------|------|
| `webrtc.ts` | 100 MB | 3 |
| `enhanced-webrtc.ts` | 100 MB | 82, 208 |
| `EnhancedTransferContext.tsx` | 10 GB per file, 50 GB total | 96-97 |

**Solution:** Create a single source of truth with streaming support for larger files.

**Implementation:**

```typescript
// src/config/limits.ts
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024,      // 2GB per file
  MAX_TOTAL_SIZE: 10 * 1024 * 1024 * 1024,    // 10GB total queue
  MAX_CHUNK_SIZE: 262144,                      // 256KB chunks
  MAX_CONCURRENT_TRANSFERS: 3,
} as const;

export function validateFileSize(size: number, max: number): boolean {
  return size > 0 && size <= max;
}
```

**Files to modify:**
- `src/config/limits.ts` (new)
- `src/services/webrtc.ts`
- `src/services/enhanced-webrtc.ts`
- `src/contexts/EnhancedTransferContext.tsx`

---

### 1.2 Secure PIN Storage (Critical)

**Problem:** SHA-256 without salt is vulnerable to rainbow table attacks.

**Current implementation:**
```typescript
// storage.ts:412-418
private async hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // No salt, no iterations - vulnerable!
}
```

**Solution:** Use PBKDF2 with random salt and 100,000 iterations.

**Implementation:**

```typescript
// src/services/crypto.ts
const PIN_ITERATIONS = 100000;
const SALT_LENGTH = 16;

export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PIN_ITERATIONS,
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

export async function verifyPin(pin: string, storedHash: string, salt: string): Promise<boolean> {
  const { hash } = await hashPinWithSalt(pin, hexToBuffer(salt));
  return hash === storedHash;
}
```

**Files to modify:**
- `src/services/crypto.ts` (new)
- `src/services/storage.ts`

---

### 1.3 File Name Sanitization (High)

**Problem:** No validation on file names allows potential path traversal.

**Solution:** Sanitize all incoming file names.

**Implementation:**

```typescript
// src/utils/sanitize.ts
const MAX_FILENAME_LENGTH = 255;
const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeFileName(name: string): string {
  // Remove path separators
  let sanitized = name.replace(/[/\\]/g, '_');
  // Remove forbidden characters
  sanitized = sanitized.replace(FORBIDDEN_CHARS, '_');
  // Trim whitespace and limit length
  sanitized = sanitized.trim().slice(0, MAX_FILENAME_LENGTH);
  // Ensure non-empty
  return sanitized || 'unnamed_file';
}

export function isValidFileName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_FILENAME_LENGTH &&
    !FORBIDDEN_CHARS.test(name) &&
    !name.includes('/') &&
    !name.includes('\\')
  );
}
```

---

### 1.4 Chunk Validation Enhancement (Medium)

**Problem:** Binary chunks accepted without full validation.

**Solution:** Add per-chunk checksums and validate received bytes.

**Implementation:**

```typescript
// In enhanced-webrtc.ts
interface ChunkWithChecksum {
  index: number;
  data: ArrayBuffer;
  checksum: string; // SHA-256 of chunk data
}

async function validateChunk(chunk: ChunkWithChecksum): Promise<boolean> {
  const hash = await hashBuffer(chunk.data);
  return hash === chunk.checksum;
}
```

---

### 1.5 Rate Limiting for Discovery (Low)

**Problem:** No rate limiting allows potential DoS through broadcast spam.

**Solution:** Throttle discovery broadcasts.

**Implementation:**

```typescript
// In signaling.ts
const MIN_DISCOVERY_INTERVAL = 1000; // 1 second
let lastDiscoveryTime = 0;

private broadcastPresence() {
  const now = Date.now();
  if (now - lastDiscoveryTime < MIN_DISCOVERY_INTERVAL) return;
  lastDiscoveryTime = now;
  // ... existing broadcast logic
}
```

---

## Part 2: Architecture Improvements

### 2.1 Split Giant Context (Critical)

**Problem:** `EnhancedTransferContext.tsx` has 244 lines with multiple responsibilities.

**Solution:** Split into focused contexts with custom hooks.

**New Structure:**

```
src/
├── types/
│   ├── device.ts       # Device, StoredDevice types
│   ├── transfer.ts     # Transfer, SelectedFile, TransferState types
│   └── settings.ts     # AppSettings, Statistics types
│
├── contexts/
│   ├── DeviceContext.tsx    # Device discovery, connection state
│   ├── TransferContext.tsx  # File selection, transfers, history
│   └── SettingsContext.tsx  # Settings, PIN, notifications
│
├── hooks/
│   ├── useDevices.ts        # Device operations
│   ├── useTransfers.ts      # Transfer operations
│   └── useSettings.ts       # Settings operations
```

**Implementation Details:**

```typescript
// src/types/transfer.ts
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
```

```typescript
// src/contexts/DeviceContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { signalingService } from '../services/signaling';
import { storageService, StoredDevice } from '../services/storage';
import type { Device } from '../types/device';

interface DeviceContextType {
  localId: string;
  localName: string;
  setLocalName: (name: string) => void;
  devices: Device[];
  savedDevices: StoredDevice[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;
  connectToDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => void;
  removeSavedDevice: (id: string) => void;
  toggleFavoriteDevice: (id: string) => void;
  renameDevice: (id: string, name: string) => void;
  isScanning: boolean;
  startScanning: () => void;
  stopScanning: () => void;
}

const DeviceContext = createContext<DeviceContextType | null>(null);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const localInfo = signalingService.getLocalInfo();
  const [localId] = useState(localInfo.id);
  const [localName, setLocalNameState] = useState(localInfo.name);
  const [devices, setDevices] = useState<Device[]>([]);
  const [savedDevices, setSavedDevices] = useState<StoredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // ... implementation details
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevices must be used within DeviceProvider');
  return context;
}
```

---

### 2.2 Remove Duplicate WebRTC Service (High)

**Problem:** Two WebRTC services cause confusion. `webrtc.ts` is unused.

**Solution:** Delete `webrtc.ts` and ensure all imports use `enhanced-webrtc.ts`.

**Files to delete:**
- `src/services/webrtc.ts`

**Files to verify:**
- Check all imports point to `enhanced-webrtc.ts`

---

### 2.3 Centralized Type Definitions (High)

**Problem:** Types defined inline in multiple files.

**Solution:** Create `src/types/` directory with all shared types.

**Files to create:**
- `src/types/device.ts`
- `src/types/transfer.ts`
- `src/types/settings.ts`
- `src/types/webrtc.ts`
- `src/types/index.ts` (re-exports all)

---

### 2.4 Consistent Error Handling (Medium)

**Problem:** Mixed try/catch patterns, silent failures.

**Solution:** Create error handling utility with typed errors.

**Implementation:**

```typescript
// src/utils/errors.ts
export class TransferError extends Error {
  constructor(
    message: string,
    public code: 'FILE_TOO_LARGE' | 'NOT_CONNECTED' | 'TRANSFER_FAILED' | 'VERIFICATION_FAILED',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

export class DeviceError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'CONNECTION_FAILED' | 'TIMEOUT',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeviceError';
  }
}

export function handleError(error: unknown, context: string): string {
  if (error instanceof TransferError || error instanceof DeviceError) {
    return error.message;
  }
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: Unknown error`;
}
```

---

### 2.5 Add CI/CD Pipeline (Medium)

**Problem:** No automated testing or deployment.

**Solution:** Add GitHub Actions workflow.

**Implementation:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

---

## Part 3: Feature Improvements

### 3.1 True mDNS Discovery (High Priority)

**Problem:** README claims mDNS but implementation uses BroadcastChannel (same-browser only).

**Reality Check:** mDNS requires native code or a backend service. Browser-only solutions cannot do true mDNS.

**Options:**

| Option | Pros | Cons |
|--------|------|------|
| **A) Add signaling server** | Works across devices | Requires backend deployment |
| **B) Use QR code only** | Simple, works now | Manual pairing required |
| **C) WebSocket local discovery** | Works on same network | Needs server component |

**Recommendation:** Implement Option C with a lightweight local WebSocket server, or update README to accurately describe current behavior.

**Implementation (Option C - WebSocket Signaling):**

```typescript
// src/services/websocket-signaling.ts
export class WebSocketSignaling {
  private ws: WebSocket | null = null;
  private roomId: string;
  
  constructor(roomId: string) {
    this.roomId = roomId;
  }
  
  connect(serverUrl: string = 'wss://signal.localdrop.local') {
    this.ws = new WebSocket(serverUrl);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }
  
  broadcast(message: SignalMessage) {
    this.ws?.send(JSON.stringify({
      room: this.roomId,
      ...message
    }));
  }
}
```

---

### 3.2 TURN Server Fallback (High Priority)

**Problem:** Won't work across NATs without TURN relay.

**Solution:** Add public TURN servers and configuration.

**Implementation:**

```typescript
// src/config/ice.ts
export const ICE_SERVERS = [
  // STUN servers for initial connection
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // Public TURN servers (free tier)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
```

---

### 3.3 Multi-Device Broadcast (High Priority)

**Problem:** Can only send to one device at a time.

**Solution:** Implement broadcast transfer to multiple connected devices.

**Implementation:**

```typescript
// src/services/broadcast-transfer.ts
export async function broadcastFile(
  file: File,
  deviceIds: string[],
  onProgress: (deviceId: string, progress: number) => void
): Promise<Map<string, string>> {
  const transferIds = new Map<string, string>();
  
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const transferId = await enhancedWebRTC.sendFile(file, deviceId);
      transferIds.set(deviceId, transferId);
    })
  );
  
  return transferIds;
}
```

---

### 3.4 Folder Transfer Support (Medium Priority)

**Problem:** Users must select files individually.

**Solution:** Add folder selection and preserve directory structure.

**Implementation:**

```typescript
// In EnhancedTransferZone.tsx
const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;
  
  // Files from folder input include relative path
  const filesWithPath = Array.from(files).map(file => ({
    file,
    relativePath: (file as any).webkitRelativePath || file.name,
  }));
  
  await addFiles(filesWithPath.map(f => f.file));
};
```

```html
<!-- Add folder input -->
<input
  ref={folderInputRef}
  type="file"
  webkitdirectory=""
  directory=""
  multiple
  className="hidden"
  onChange={handleFolderSelect}
/>
```

---

### 3.5 Transfer Resume After Disconnect (Medium Priority)

**Problem:** Large files must restart if connection drops.

**Solution:** Persist chunk state and resume from last received chunk.

**Implementation:**

```typescript
// src/services/resumable-transfer.ts
interface ResumableState {
  fileId: string;
  receivedChunks: boolean[]; // Track which chunks received
  totalChunks: number;
  fileHash: string;
}

export async function saveTransferState(state: ResumableState): Promise<void> {
  await storageService.saveSetting(`transfer_${state.fileId}`, state);
}

export async function resumeTransfer(fileId: string): Promise<ResumableState | null> {
  return await storageService.getSetting(`transfer_${fileId}`, null);
}
```

---

### 3.6 Fix HEIC Conversion (Medium Priority)

**Problem:** Claimed HEIC support but browsers can't read HEIC natively.

**Solution:** Use `heic2any` library for conversion.

**Implementation:**

```bash
npm install heic2any
```

```typescript
// src/services/fileProcessor.ts
import heic2any from 'heic2any';

async convertHeicToJpeg(file: File): Promise<File> {
  if (!this.isHeic(file)) return file;
  
  const blob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.95,
  });
  
  const jpegName = file.name.replace(/\.heic$/i, '.jpg');
  return new File([blob], jpegName, { type: 'image/jpeg' });
}

private isHeic(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic')
  );
}
```

---

### 3.7 Implement Real Video Compression (Low Priority)

**Problem:** Video compression is a stub that returns original file.

**Solution:** Use FFmpeg.wasm for browser-based video compression.

**Implementation:**

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

```typescript
// src/services/video-processor.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

export async function compressVideo(
  file: File,
  quality: 'high' | 'medium' | 'low' = 'medium'
): Promise<File> {
  if (!ffmpeg.loaded) {
    await ffmpeg.load({
      coreURL: '/ffmpeg-core.js',
      wasmURL: '/ffmpeg-core.wasm',
    });
  }
  
  const inputName = 'input.mp4';
  const outputName = 'output.mp4';
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  const crf = quality === 'high' ? 23 : quality === 'medium' ? 28 : 33;
  
  await ffmpeg.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', 'fast',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputName,
  ]);
  
  const data = await ffmpeg.readFile(outputName);
  return new File([data], file.name, { type: file.type });
}
```

---

### 3.8 Accessibility Improvements (Medium Priority)

**Problem:** No keyboard navigation, missing ARIA labels.

**Solution:** Add comprehensive accessibility support.

**Implementation:**

```tsx
// In EnhancedTransferZone.tsx
<div
  role="region"
  aria-label="File drop zone"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      fileInputRef.current?.click();
    }
  }}
>
  <button
    aria-label="Browse files"
    onClick={() => fileInputRef.current?.click()}
  >
    Browse
  </button>
</div>

// Transfer progress
<div
  role="progressbar"
  aria-valuenow={transfer.progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`${transfer.fileName} transfer progress`}
>
  <div style={{ width: `${transfer.progress}%` }} />
</div>
```

---

## Part 4: Performance Improvements

### 4.1 Streaming File Transfer (Critical)

**Problem:** Entire file loaded into memory before transfer.

**Solution:** Stream chunks directly from file using File.slice().

**Implementation:**

```typescript
// src/services/streaming-transfer.ts
async function* streamFileChunks(
  file: File,
  chunkSize: number = CHUNK_SIZE
): AsyncGenerator<{ index: number; data: ArrayBuffer }> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    
    yield { index: i, data: buffer };
  }
}

// Usage in sendFile
async sendFile(file: File, deviceId: string): Promise<string> {
  const peer = this.peers.get(deviceId);
  if (!peer?.dataChannel) throw new Error('Not connected');
  
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  // Send metadata first
  peer.dataChannel.send(JSON.stringify({
    type: 'file-info',
    fileSize: file.size,
    totalChunks,
    // ...
  }));
  
  // Stream chunks
  for await (const { index, data } of streamFileChunks(file)) {
    peer.dataChannel.send(data);
    // Wait for ack before next chunk to prevent buffer overflow
    await this.waitForAck(index);
  }
}
```

---

### 4.2 Parallel Chunk Transfer (High Priority)

**Problem:** Chunks sent sequentially, underutilizing bandwidth.

**Solution:** Send multiple chunks concurrently (4-8 in parallel).

**Implementation:**

```typescript
// src/services/parallel-transfer.ts
const MAX_CONCURRENT_CHUNKS = 4;

async function sendFileParallel(
  file: File,
  deviceId: string,
  onProgress: (progress: number) => void
): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let sentChunks = 0;
  
  const sendChunk = async (index: number): Promise<void> => {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    
    await sendChunkWithRetry(deviceId, index, buffer);
    sentChunks++;
    onProgress((sentChunks / totalChunks) * 100);
  };
  
  // Process chunks with concurrency limit
  const queue = new PQueue({ concurrency: MAX_CONCURRENT_CHUNKS });
  const tasks = Array.from({ length: totalChunks }, (_, i) => 
    queue.add(() => sendChunk(i))
  );
  
  await Promise.all(tasks);
}
```

---

### 4.3 Fix Thumbnail Memory Leaks (High Priority)

**Problem:** Object URLs not always revoked.

**Solution:** Centralize URL lifecycle management.

**Implementation:**

```typescript
// src/utils/object-url-manager.ts
const activeUrls = new Set<string>();

export function createObjectURL(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  activeUrls.add(url);
  return url;
}

export function revokeObjectURL(url: string): void {
  if (activeUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeUrls.delete(url);
  }
}

export function revokeAllObjectURLs(): void {
  activeUrls.forEach(url => URL.revokeObjectURL(url));
  activeUrls.clear();
}
```

---

### 4.4 Replace Pause Polling with Event-Based (Medium Priority)

**Problem:** 100ms interval polling wastes CPU.

**Solution:** Use Promise with event-based resume.

**Implementation:**

```typescript
// src/services/pause-handler.ts
class PauseHandler {
  private resumeResolvers = new Map<string, () => void>();
  
  pause(fileId: string): void {
    // No action needed, transfer will await
  }
  
  async waitIfPaused(fileId: string): Promise<void> {
    if (!this.isPaused(fileId)) return;
    
    return new Promise(resolve => {
      this.resumeResolvers.set(fileId, resolve);
    });
  }
  
  resume(fileId: string): void {
    const resolver = this.resumeResolvers.get(fileId);
    if (resolver) {
      resolver();
      this.resumeResolvers.delete(fileId);
    }
  }
}
```

---

### 4.5 Use Web Workers for Chunking (Medium Priority)

**Problem:** `chunk.worker.ts` exists but is unused.

**Solution:** Offload chunk processing to worker.

**Implementation:**

```typescript
// src/services/chunk-worker-client.ts
const worker = new Worker(new URL('../workers/chunk.worker.ts', import.meta.url));

export async function processChunkInWorker(
  data: ArrayBuffer,
  index: number
): Promise<{ checksum: string; processedData: ArrayBuffer }> {
  return new Promise(resolve => {
    const handler = (e: MessageEvent) => {
      if (e.data.index === index) {
        worker.removeEventListener('message', handler);
        resolve(e.data);
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ data, index });
  });
}
```

---

## Part 5: Testing Implementation

### 5.1 Test Setup (High Priority)

**Install dependencies:**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8
```

**Create test config:**

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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
});
```

```typescript
// src/__tests__/setup.ts
import '@testing-library/jest-dom';
```

---

### 5.2 Unit Tests for Services

```typescript
// src/__tests__/services/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { storageService } from '../../services/storage';

describe('StorageService', () => {
  beforeEach(async () => {
    // Clear IndexedDB before each test
    indexedDB = new IDBFactory();
  });

  it('should save and retrieve a device', async () => {
    const device = {
      id: 'test-id',
      name: 'Test Device',
      type: 'desktop' as const,
      lastConnected: Date.now(),
      totalTransfers: 0,
      totalBytesTransferred: 0,
      isFavorite: false,
    };

    await storageService.saveDevice(device);
    const retrieved = await storageService.getDevice('test-id');
    
    expect(retrieved).toEqual(device);
  });

  it('should return undefined for non-existent device', async () => {
    const result = await storageService.getDevice('non-existent');
    expect(result).toBeUndefined();
  });
});
```

```typescript
// src/__tests__/services/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '../../services/crypto';

describe('Crypto Service', () => {
  it('should hash PIN with salt', async () => {
    const result = await hashPin('1234');
    
    expect(result.hash).toHaveLength(64); // SHA-256 = 64 hex chars
    expect(result.salt).toHaveLength(32); // 16 bytes = 32 hex chars
  });

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

  it('should produce different hashes for same PIN', async () => {
    const result1 = await hashPin('1234');
    const result2 = await hashPin('1234');
    
    expect(result1.hash).not.toBe(result2.hash); // Different due to salt
  });
});
```

---

### 5.3 Component Tests

```typescript
// src/__tests__/components/TransferZone.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedTransferZone } from '../../components/EnhancedTransferZone';

// Mock context
vi.mock('../../contexts/EnhancedTransferContext', () => ({
  useTransfer: () => ({
    selectedFiles: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clearFiles: vi.fn(),
    selectedDevice: null,
    sendFiles: vi.fn(),
    transfers: [],
    settings: {},
    updateSettings: vi.fn(),
    previewFile: vi.fn(),
    processedFiles: new Map(),
  }),
}));

describe('EnhancedTransferZone', () => {
  it('should render drop zone', () => {
    render(<EnhancedTransferZone />);
    
    expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument();
  });

  it('should show browse button', () => {
    render(<EnhancedTransferZone />);
    
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
  });

  it('should disable send button when no device connected', () => {
    render(<EnhancedTransferZone />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });
});
```

---

### 5.4 Integration Tests

```typescript
// src/__tests__/integration/transfer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Transfer Flow', () => {
  it('should send and receive a file between peers', async () => {
    // This would require mocking WebRTC or using a test harness
    // For now, we test the data flow without actual network
    
    const sender = new EnhancedWebRTC();
    const receiver = new EnhancedWebRTC();
    
    // Mock connection
    // In real tests, you'd use a WebRTC mock library
    
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // ... transfer verification
  });
});
```

---

## Part 6: Documentation Updates

### 6.1 Update README for Accuracy

**Current Issues:**
- Claims mDNS but uses BroadcastChannel
- Claims HEIC support but won't work
- Claims video compression but is stub
- Speed claims are unrealistic

**Recommended Updates:**

```markdown
## How It Works

### Device Discovery

LocalDrop uses **BroadcastChannel API** for device discovery within the same browser. For cross-device pairing, use the QR code method.

> Note: True mDNS discovery would require a native application. The web version uses QR codes for pairing across devices.

### File Transfer

Files are transferred via **WebRTC DataChannels** with:
- SHA-256 hash verification
- Chunk-based transfer (256KB chunks)
- Pause/resume support
- Optional image compression

### Platform Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| HEIC conversion | Requires library | Add `heic2any` for support |
| Video compression | Planned | Requires FFmpeg.wasm |
| Cross-network transfer | Requires TURN | Configure TURN servers |
```

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Unified file size limits | Critical | 2h |
| Secure PIN storage | Critical | 4h |
| Split giant context | Critical | 8h |
| Streaming file transfer | Critical | 8h |
| Remove duplicate WebRTC | High | 1h |

### Phase 2: Security & Quality (Week 3-4)

| Task | Priority | Effort |
|------|----------|--------|
| File name sanitization | High | 2h |
| Chunk validation | Medium | 4h |
| Consistent error handling | Medium | 4h |
| Add CI/CD pipeline | Medium | 4h |
| Type centralization | High | 4h |

### Phase 3: Feature Enhancements (Week 5-6)

| Task | Priority | Effort |
|------|----------|--------|
| TURN server fallback | High | 2h |
| Multi-device broadcast | High | 6h |
| Folder transfer | Medium | 4h |
| WebSocket signaling | High | 8h |
| Transfer resume | Medium | 6h |

### Phase 4: Performance & Testing (Week 7-8)

| Task | Priority | Effort |
|------|----------|--------|
| Parallel chunk transfer | High | 6h |
| Fix memory leaks | High | 4h |
| Pause handler refactor | Medium | 2h |
| Test setup | High | 4h |
| Unit tests (core services) | High | 8h |
| Component tests | Medium | 4h |

### Phase 5: Polish (Week 9-10)

| Task | Priority | Effort |
|------|----------|--------|
| HEIC conversion (heic2any) | Medium | 4h |
| Accessibility improvements | Medium | 6h |
| Video compression (FFmpeg.wasm) | Low | 8h |
| Documentation updates | Medium | 4h |

---

## Summary

This improvement plan addresses **32 issues** across 5 categories:

1. **Security** - Fix critical vulnerabilities in file handling and PIN storage
2. **Architecture** - Refactor for maintainability and testability
3. **Features** - Add missing functionality and fix broken claims
4. **Performance** - Implement streaming and fix memory issues
5. **Testing** - Add comprehensive test coverage

**Estimated Total Effort:** ~80-100 hours over 10 weeks

**Next Steps:**
1. User reviews and approves this spec
2. Create implementation plan using writing-plans skill
3. Execute plan in phases

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-11
