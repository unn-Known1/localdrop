// IndexedDB Storage Service for persistent device memory and settings

const DB_NAME = 'LocalDropDB';
const DB_VERSION = 1;

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

export interface AppSettings {
  pinEnabled: boolean;
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

class StorageService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  // SECURITY: Salt for PIN hashing - should be unique per installation
  private static PIN_SALT_LENGTH = 16;
  private static PIN_HASH_ALGORITHM = 'SHA-256';
  private cachedPinHash: string | null = null;
  private cachedSalt: Uint8Array | null = null;

  constructor() {
    this.dbReady = this.initDB();
  }

  // SECURITY: Hash PIN using Web Crypto API with salt
  private async hashPin(pin: string, salt: Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    // Combine salt + PIN for hashing
    const combined = new Uint8Array(salt.length + data.length);
    combined.set(salt, 0);
    combined.set(data, salt.length);
    const hashBuffer = await crypto.subtle.digest(this.PIN_HASH_ALGORITHM, combined);
    return this.arrayBufferToHex(hashBuffer);
  }

  private arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.PIN_SALT_LENGTH));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // SECURITY: Store PIN as hashed value instead of plaintext
  async setPin(pin: string): Promise<void> {
    if (!pin || pin.length < 4 || pin.length > 8) {
      throw new Error('PIN must be 4-8 digits');
    }
    // Validate PIN contains only digits
    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    const salt = this.generateSalt();
    const hash = await this.hashPin(pin, salt);

    // Store salt and hash separately
    await this.saveSetting('pinSalt', this.arrayBufferToBase64(salt.buffer));
    await this.saveSetting('pinHash', hash);

    // Cache for quick verification
    this.cachedPinHash = hash;
    this.cachedSalt = salt;
  }

  // SECURITY: Verify PIN against stored hash
  async verifyPin(pin: string): Promise<boolean> {
    try {
      const saltBase64 = await this.getSetting<string | null>('pinSalt', null);
      const storedHash = await this.getSetting<string | null>('pinHash', null);

      if (!saltBase64 || !storedHash) {
        return false;
      }

      const salt = this.base64ToArrayBuffer(saltBase64);
      const inputHash = await this.hashPin(pin, salt);

      // Use timing-safe comparison to prevent timing attacks
      if (inputHash.length !== storedHash.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < inputHash.length; i++) {
        result |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
      }

      return result === 0;
    } catch (error) {
      console.error('PIN verification error:', error);
      return false;
    }
  }

  async isPinSet(): Promise<boolean> {
    const hash = await this.getSetting<string | null>('pinHash', null);
    return hash !== null;
  }

  // SECURITY: Clear PIN data securely
  async clearPin(): Promise<void> {
    await this.saveSetting('pinHash', '');
    await this.saveSetting('pinSalt', '');
    this.cachedPinHash = null;
    this.cachedSalt = null;
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Devices store
        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
          deviceStore.createIndex('lastConnected', 'lastConnected', { unique: false });
          deviceStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        }

        // Transfer history store
        if (!db.objectStoreNames.contains('transfers')) {
          const transferStore = db.createObjectStore('transfers', { keyPath: 'id' });
          transferStore.createIndex('timestamp', 'timestamp', { unique: false });
          transferStore.createIndex('deviceId', 'deviceId', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Statistics store
        if (!db.objectStoreNames.contains('statistics')) {
          db.createObjectStore('statistics', { keyPath: 'key' });
        }

        // Pending transfers (offline queue)
        if (!db.objectStoreNames.contains('pendingTransfers')) {
          const pendingStore = db.createObjectStore('pendingTransfers', { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.dbReady;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // Device operations
  async saveDevice(device: StoredDevice): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['devices'], 'readwrite');
      const store = transaction.objectStore('devices');
      const request = store.put(device);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getDevice(id: string): Promise<StoredDevice | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['devices'], 'readonly');
      const store = transaction.objectStore('devices');
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllDevices(): Promise<StoredDevice[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['devices'], 'readonly');
      const store = transaction.objectStore('devices');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getRecentDevices(limit: number = 10): Promise<StoredDevice[]> {
    const devices = await this.getAllDevices();
    return devices
      .sort((a, b) => b.lastConnected - a.lastConnected)
      .slice(0, limit);
  }

  async getFavoriteDevices(): Promise<StoredDevice[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['devices'], 'readonly');
      const store = transaction.objectStore('devices');
      const index = store.index('isFavorite');
      const request = index.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async deleteDevice(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['devices'], 'readwrite');
      const store = transaction.objectStore('devices');
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Transfer history operations
  async saveTransfer(transfer: TransferRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readwrite');
      const store = transaction.objectStore('transfers');
      const request = store.put(transfer);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getTransfer(id: string): Promise<TransferRecord | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readonly');
      const store = transaction.objectStore('transfers');
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllTransfers(): Promise<TransferRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readonly');
      const store = transaction.objectStore('transfers');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getRecentTransfers(limit: number = 50): Promise<TransferRecord[]> {
    const transfers = await this.getAllTransfers();
    return transfers
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getTransfersByDevice(deviceId: string): Promise<TransferRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readonly');
      const store = transaction.objectStore('transfers');
      const index = store.index('deviceId');
      const request = index.getAll(deviceId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async deleteTransfer(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readwrite');
      const store = transaction.objectStore('transfers');
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearTransferHistory(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['transfers'], 'readwrite');
      const store = transaction.objectStore('transfers');
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.value ?? defaultValue);
      };
    });
  }

  async getAllSettings(): Promise<Partial<AppSettings>> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const settings: Partial<AppSettings> = {};
        for (const item of request.result || []) {
          Object.assign(settings, { [item.key]: item.value });
        }
        resolve(settings);
      };
    });
  }

  // Statistics operations
  async updateStatistics(update: Partial<Statistics>): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['statistics'], 'readwrite');
      const store = transaction.objectStore('statistics');
      const getRequest = store.get('main');
      getRequest.onsuccess = () => {
        const current = getRequest.result?.value || {
          totalFilesSent: 0,
          totalFilesReceived: 0,
          totalBytesSent: 0,
          totalBytesReceived: 0,
          averageSpeed: 0,
          peakSpeed: 0,
          sessionStart: Date.now(),
          totalSessions: 0,
        };
        const updated = { ...current, ...update, key: 'main' };
        const putRequest = store.put(updated);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getStatistics(): Promise<Statistics> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['statistics'], 'readonly');
      const store = transaction.objectStore('statistics');
      const request = store.get('main');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result?.value || {
          totalFilesSent: 0,
          totalFilesReceived: 0,
          totalBytesSent: 0,
          totalBytesReceived: 0,
          averageSpeed: 0,
          peakSpeed: 0,
          sessionStart: Date.now(),
          totalSessions: 0,
        });
      };
    });
  }

  // Pending transfers (offline queue)
  async addPendingTransfer(transfer: {
    id: string;
    deviceId: string;
    deviceName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileData?: Blob;
  }): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingTransfers'], 'readwrite');
      const store = transaction.objectStore('pendingTransfers');
      const request = store.put({
        ...transfer,
        timestamp: Date.now(),
      });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getPendingTransfers(): Promise<any[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingTransfers'], 'readonly');
      const store = transaction.objectStore('pendingTransfers');
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async removePendingTransfer(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingTransfers'], 'readwrite');
      const store = transaction.objectStore('pendingTransfers');
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearPendingTransfers(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingTransfers'], 'readwrite');
      const store = transaction.objectStore('pendingTransfers');
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const storageService = new StorageService();
