import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storageService, AppSettings, Statistics } from '../services/storage';
import { notificationService } from '../services/notifications';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  statistics: Statistics;
  loadStatistics: () => Promise<void>;
  isPinVerified: boolean;
  setPinVerified: (verified: boolean) => void;
  verifyPin: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  notificationsEnabled: boolean;
  requestNotificationPermission: () => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const defaultSettings: AppSettings = {
  pinEnabled: false,
  pinHash: '',
  pinSalt: '',
  autoAccept: false,
  theme: 'dark',
  defaultQuality: 'original',
  compressionEnabled: false,
  notifications: false,
  soundEnabled: true,
  vibrationEnabled: true,
  maxConcurrentTransfers: 3,
  chunkSize: 262144,
  showDetailedStats: true,
  deviceNickname: ''
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [statistics, setStatistics] = useState<Statistics>({
    totalFilesSent: 0, totalFilesReceived: 0, totalBytesSent: 0,
    totalBytesReceived: 0, averageSpeed: 0, peakSpeed: 0,
    sessionStart: Date.now(), totalSessions: 0
  });
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const loadSettings = useCallback(async () => {
    const saved = await storageService.getAllSettings();
    setSettings(prev => ({ ...prev, ...saved }));
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      Object.entries(newSettings).forEach(([key, value]) => {
        storageService.saveSetting(key, value);
      });
      return updated;
    });
  }, []);

  const loadStatistics = useCallback(async () => {
    const stats = await storageService.getStatistics();
    setStatistics(stats);
  }, []);

  useEffect(() => {
    loadSettings();
    loadStatistics();
    setNotificationsEnabled(notificationService.isEnabled());
  }, [loadSettings, loadStatistics]);

  const verifyPin = useCallback(async (pin: string) => {
    return await storageService.verifyPin(pin);
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await storageService.setPin(pin);
    setSettings(prev => ({ ...prev, pinEnabled: true }));
    setIsPinVerified(true);
  }, []);

  const disablePin = useCallback(async () => {
    await storageService.disablePin();
    setSettings(prev => ({ ...prev, pinEnabled: false }));
    setIsPinVerified(false);
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    return granted;
  }, []);

  return (
    <SettingsContext.Provider value={{
      settings, updateSettings, statistics, loadStatistics,
      isPinVerified, setPinVerified: setIsPinVerified,
      verifyPin, setPin, disablePin,
      notificationsEnabled, requestNotificationPermission
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
