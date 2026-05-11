// src/types/transfer.ts
import type { ProcessedFile } from '../services/fileProcessor';

export interface SelectedFile {
  id: string;
  file: File;
  relativePath?: string;
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
  relativePath?: string;
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
