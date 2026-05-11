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
  lastSeen?: number;
  avatar?: string;
  ipAddress?: string;
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
