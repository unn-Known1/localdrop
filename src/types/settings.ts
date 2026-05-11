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
