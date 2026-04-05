import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { signalingService, Device as SignalingDevice } from '../services/signaling';
import { enhancedWebRTC, TransferState } from '../services/enhanced-webrtc';
import { storageService, StoredDevice, TransferRecord, AppSettings, Statistics } from '../services/storage';
import { notificationService } from '../services/notifications';
import { fileProcessor, ProcessedFile } from '../services/fileProcessor';

export interface Device { id: string; name: string; type: 'mobile' | 'desktop'; status: 'discovered' | 'connecting' | 'connected' | 'disconnected'; nickname?: string; isFavorite?: boolean; signalStrength?: number; lastConnected?: number; }
export interface SelectedFile { id: string; file: File; thumbnail?: string; size: number; type: string; width?: number; height?: number; duration?: number; processed?: ProcessedFile; }
export interface Transfer { id: string; fileName: string; fileSize: number; fileType: string; direction: 'upload' | 'download'; status: 'pending' | 'queued' | 'transferring' | 'paused' | 'complete' | 'failed' | 'verifying'; progress: number; speed: number; deviceId?: string; deviceName?: string; error?: string; verified?: boolean; startedAt?: number; completedAt?: number; }
export interface AppSettingsState extends AppSettings { deviceNickname: string; }
interface Toast { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string; duration?: number; }
interface TransferContextType {
  localId: string; localName: string; setLocalName: (name: string) => void;
  devices: Device[]; savedDevices: StoredDevice[]; selectedDevice: Device | null; setSelectedDevice: (device: Device | null) => void;
  connectToDevice: (deviceId: string) => Promise<void>; disconnectDevice: (deviceId: string) => void;
  selectedFiles: SelectedFile[]; addFiles: (files: FileList | File[], options?: { compress?: boolean; quality?: string }) => Promise<void>;
  removeFile: (id: string) => void; clearFiles: () => void; previewFile: (id: string) => void; processedFiles: Map<string, ProcessedFile>;
  transfers: Transfer[]; sendFiles: () => Promise<void>; pauseTransfer: (id: string) => void; resumeTransfer: (id: string) => void; cancelTransfer: (id: string) => void;
  transferHistory: TransferRecord[]; loadTransferHistory: () => Promise<void>; clearTransferHistory: () => Promise<void>;
  settings: AppSettingsState; updateSettings: (settings: Partial<AppSettingsState>) => void; loadSettings: () => Promise<void>;
  statistics: Statistics; loadStatistics: () => Promise<void>;
  isPinVerified: boolean; setPinVerified: (verified: boolean) => void; verifyPin: (pin: string) => boolean; setPin: (pin: string) => void; disablePin: () => void;
  notificationsEnabled: boolean; requestNotificationPermission: () => Promise<boolean>;
  toasts: Toast[]; addToast: (toast: Omit<Toast, 'id'>) => void; removeToast: (id: string) => void;
  isScanning: boolean; startScanning: () => void; stopScanning: () => void;
}
const TransferContext = createContext<TransferContextType | null>(null);
const defaultSettings: AppSettingsState = { pinEnabled: false, pin: '', autoAccept: false, theme: 'dark', defaultQuality: 'original', compressionEnabled: false, notifications: false, soundEnabled: true, vibrationEnabled: true, maxConcurrentTransfers: 3, deviceNickname: '' };
const defaultStatistics: Statistics = { totalFilesSent: 0, totalFilesReceived: 0, totalBytesSent: 0, totalBytesReceived: 0, averageSpeed: 0, peakSpeed: 0, sessionStart: Date.now(), totalSessions: 0 };

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const localInfo = signalingService.getLocalInfo();
  const [localId] = useState(localInfo.id);
  const [localName, setLocalNameState] = useState(localInfo.name);
  const [devices, setDevices] = useState<Device[]>([]);
  const [savedDevices, setSavedDevices] = useState<StoredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [processedFiles, setProcessedFiles] = useState<Map<string, ProcessedFile>>(new Map());
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [settings, setSettings] = useState<AppSettingsState>(defaultSettings);
  const [statistics, setStatistics] = useState<Statistics>(defaultStatistics);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 15);
    setToasts(prev => [...prev, { ...toast, id }]);
    if (settings.soundEnabled) { if (toast.type === 'success') notificationService.playSound('transfer-complete'); if (toast.type === 'error') notificationService.playSound('transfer-error'); }
    if (settings.vibrationEnabled) { if (toast.type === 'success') notificationService.vibrate(100); if (toast.type === 'error') notificationService.vibrate([100, 50, 100]); }
    setTimeout(() => removeToast(id), toast.duration || 4000);
  }, [settings.soundEnabled, settings.vibrationEnabled, removeToast]);

  const setLocalName = useCallback((name: string) => { setLocalNameState(name); signalingService.setLocalName(name); storageService.saveSetting('deviceNickname', name); }, []);
  const loadSettings = useCallback(async () => { const savedSettings = await storageService.getAllSettings(); const nickname = await storageService.getSetting('deviceNickname', ''); setSettings({ ...defaultSettings, ...savedSettings, deviceNickname: nickname }); if (nickname) setLocalNameState(nickname); }, []);
  const updateSettings = useCallback(async (newSettings: Partial<AppSettingsState>) => { setSettings(prev => { const updated = { ...prev, ...newSettings }; Object.entries(newSettings).forEach(([key, value]) => { storageService.saveSetting(key, value); }); return updated; }); }, []);
  const loadStatistics = useCallback(async () => { const stats = await storageService.getStatistics(); setStatistics(stats); }, []);
  const loadSavedDevices = useCallback(async () => { const devices = await storageService.getRecentDevices(20); setSavedDevices(devices); }, []);
  const loadTransferHistory = useCallback(async () => { const history = await storageService.getRecentTransfers(100); setTransferHistory(history); }, []);
  const clearTransferHistory = useCallback(async () => { await storageService.clearTransferHistory(); setTransferHistory([]); }, []);

  useEffect(() => {
    signalingService.start({
      onDeviceDiscovered: (device: SignalingDevice) => { setDevices(prev => { const exists = prev.find(d => d.id === device.id); if (exists) return prev.map(d => d.id === device.id ? { ...d, ...device } : d); return [...prev, device]; }); addToast({ type: 'info', message: `Found: ${device.name}` }); },
      onDeviceConnected: (device: SignalingDevice) => { setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'connected' } : d)); notificationService.playSound('device-connected'); storageService.saveDevice({ id: device.id, name: device.name, type: device.type, lastConnected: Date.now(), totalTransfers: 0, totalBytesTransferred: 0, isFavorite: false }); loadSavedDevices(); },
      onDeviceDisconnected: (deviceId: string) => { setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'disconnected' } : d)); },
      onSignalReceived: async (message) => { if (message.type === 'offer') { await enhancedWebRTC.handleOffer(message.payload, message.from, devices.find(d => d.id === message.from)?.name || 'Unknown', devices.find(d => d.id === message.from)?.type || 'desktop'); } else if (message.type === 'answer') { await enhancedWebRTC.handleAnswer(message.payload, message.from); } else if (message.type === 'ice-candidate') { await enhancedWebRTC.handleIceCandidate(message.payload, message.from); } },
    });
    loadSavedDevices(); loadSettings(); loadStatistics(); loadTransferHistory();
    return () => signalingService.stop();
  }, []);

  const connectToDevice = useCallback(async (deviceId: string) => { const device = devices.find(d => d.id === deviceId); if (!device) return; setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'connecting' } : d)); try { await enhancedWebRTC.createPeer(deviceId, device.name, device.type); } catch { setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'discovered' } : d)); addToast({ type: 'error', message: 'Failed to connect' }); } }, [devices, addToast]);
  const disconnectDevice = useCallback((deviceId: string) => { enhancedWebRTC.removePeer(deviceId); signalingService.disconnect(deviceId); setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'discovered' } : d)); if (selectedDevice?.id === deviceId) setSelectedDevice(null); }, [selectedDevice]);
  const addFiles = useCallback(async (files: FileList | File[], options?: { compress?: boolean; quality?: string }) => {
    const fileArray = Array.from(files); const newFiles: SelectedFile[] = [];
    for (const file of fileArray) {
      const id = Math.random().toString(36).substring(2, 15);
      const info = await fileProcessor.getFileInfo(file);
      let thumbnail: string | undefined; if (info.isImage || info.isVideo) thumbnail = URL.createObjectURL(file);
      let processed: ProcessedFile | undefined;
      if (options?.compress && (info.isImage || info.isVideo)) {
        try { if (info.isImage) processed = await fileProcessor.processImage(file, { quality: (options.quality as any) || settings.defaultQuality }); else if (info.isVideo) processed = await fileProcessor.processVideo(file, { quality: (options.quality as any) || settings.defaultQuality }); if (processed?.wasCompressed) setProcessedFiles(prev => new Map(prev).set(id, processed!)); } catch (e) { console.error('Compression failed:', e); }
      }
      let finalFile = file; if (processed?.file) finalFile = processed.file instanceof File ? processed.file : new File([processed.file], file.name, { type: processed.file.type || file.type, lastModified: Date.now() });
      newFiles.push({ id, file: finalFile, thumbnail, size: processed?.processedSize || file.size, type: file.type, width: info.width, height: info.height, duration: info.duration, processed });
    }
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [settings.defaultQuality]);
  const removeFile = useCallback((id: string) => { setSelectedFiles(prev => { const file = prev.find(f => f.id === id); if (file?.thumbnail) URL.revokeObjectURL(file.thumbnail); return prev.filter(f => f.id !== id); }); }, []);
  const clearFiles = useCallback(() => { setSelectedFiles(prev => { prev.forEach(f => { if (f.thumbnail) URL.revokeObjectURL(f.thumbnail); }); return []; }); setProcessedFiles(new Map()); }, []);
  const previewFile = useCallback((id: string) => { const file = selectedFiles.find(f => f.id === id); if (file) { const url = URL.createObjectURL(file.file); window.open(url, '_blank'); } }, [selectedFiles]);
  const sendFiles = useCallback(async () => {
    if (!selectedDevice || selectedDevice.status !== 'connected') { addToast({ type: 'error', message: 'No device connected' }); return; }
    if (selectedFiles.length === 0) { addToast({ type: 'warning', message: 'No files selected' }); return; }
    if (settings.pinEnabled && !isPinVerified) { addToast({ type: 'warning', message: 'Enter PIN first' }); return; }
    for (const selectedFile of selectedFiles) {
      const transferId = Math.random().toString(36).substring(2, 15);
      const transfer: Transfer = { id: transferId, fileName: selectedFile.file.name, fileSize: selectedFile.size, fileType: selectedFile.type, direction: 'upload', status: 'transferring', progress: 0, speed: 0, deviceId: selectedDevice.id, deviceName: selectedDevice.name, startedAt: Date.now(), thumbnail: selectedFile.thumbnail };
      setTransfers(prev => [...prev, transfer]);
      try { await enhancedWebRTC.sendFile(selectedFile.file, selectedDevice.id); } catch { setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'failed', error: 'Transfer failed' } : t)); addToast({ type: 'error', message: `Failed to send ${selectedFile.file.name}` }); }
    }
    clearFiles();
  }, [selectedDevice, selectedFiles, settings.pinEnabled, isPinVerified, addToast, clearFiles]);
  const pauseTransfer = useCallback((id: string) => { enhancedWebRTC.pauseTransfer(id); setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t)); }, []);
  const resumeTransfer = useCallback((id: string) => { enhancedWebRTC.resumeTransfer(id); setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'transferring' } : t)); }, []);
  const cancelTransfer = useCallback((id: string) => { enhancedWebRTC.cancelTransfer(id); setTransfers(prev => prev.filter(t => t.id !== id)); }, []);
  const verifyPin = useCallback((pin: string): boolean => pin === settings.pin, [settings.pin]);
  const setPin = useCallback((pin: string) => { updateSettings({ pin, pinEnabled: true }); setIsPinVerified(true); }, [updateSettings]);
  const disablePin = useCallback(() => { updateSettings({ pin: '', pinEnabled: false }); setIsPinVerified(false); }, [updateSettings]);
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => { const granted = await notificationService.requestPermission(); setNotificationsEnabled(granted); return granted; }, []);
  const startScanning = useCallback(() => { setIsScanning(true); }, []);
  const stopScanning = useCallback(() => { setIsScanning(false); }, []);

  return (
    <TransferContext.Provider value={{ localId, localName, setLocalName, devices, savedDevices, selectedDevice, setSelectedDevice, connectToDevice, disconnectDevice, selectedFiles, addFiles, removeFile, clearFiles, previewFile, processedFiles, transfers, sendFiles, pauseTransfer, resumeTransfer, cancelTransfer, transferHistory, loadTransferHistory, clearTransferHistory, settings, updateSettings, loadSettings, statistics, loadStatistics, isPinVerified, setPinVerified: setIsPinVerified, verifyPin, setPin, disablePin, notificationsEnabled, requestNotificationPermission, toasts, addToast, removeToast, isScanning, startScanning, stopScanning }}>
      {children}
    </TransferContext.Provider>
  );
}
export function useTransfer() { const context = useContext(TransferContext); if (!context) throw new Error('useTransfer must be used within a TransferProvider'); return context; }