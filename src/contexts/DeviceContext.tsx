import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { signalingService } from '../services/signaling';
import { enhancedWebRTC } from '../services/enhanced-webrtc';
import { storageService } from '../services/storage';
import { notificationService } from '../services/notifications';
import { Device, StoredDevice } from '../types';

interface DeviceContextType {
  localId: string;
  localName: string;
  setLocalName: (name: string) => void;
  devices: Device[];
  savedDevices: StoredDevice[];
  selectedDeviceIds: string[];
  setSelectedDeviceIds: (ids: string[]) => void;
  toggleDeviceSelection: (deviceId: string) => void;
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
  const devicesRef = useRef<Device[]>([]);
  const [savedDevices, setSavedDevices] = useState<StoredDevice[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const loadSavedDevices = useCallback(async () => {
    const data = await storageService.getRecentDevices(20);
    setSavedDevices(data);
  }, []);

  const setLocalName = useCallback((name: string) => {
    setLocalNameState(name);
    signalingService.setLocalName(name);
    storageService.saveSetting('deviceNickname', name);
  }, []);

  useEffect(() => {
    signalingService.start({
      onDeviceDiscovered: (device) => {
        setDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (exists) return prev.map(d => d.id === device.id ? { ...d, ...device } : d);
          return [...prev, device as Device];
        });
      },
      onDeviceConnected: (device) => {
        setDevices(prev => prev.map(d => d.id === device.id ? { ...d, status: 'connected' } : d));
        notificationService.playSound('device-connected');
        storageService.saveDevice({
          id: device.id, name: device.name, type: device.type,
          lastConnected: Date.now(), totalTransfers: 0,
          totalBytesTransferred: 0, isFavorite: false
        });
        loadSavedDevices();
      },
      onDeviceDisconnected: (deviceId) => {
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'disconnected' } : d));
      },
      onSignalReceived: async (message) => {
        const device = devicesRef.current.find(d => d.id === message.from);
        if (message.type === 'offer') {
          await enhancedWebRTC.handleOffer(message.payload as RTCSessionDescriptionInit, message.from, device?.name || 'Unknown', device?.type || 'desktop');
        } else if (message.type === 'answer') {
          await enhancedWebRTC.handleAnswer(message.payload as RTCSessionDescriptionInit, message.from);
        } else if (message.type === 'ice-candidate') {
          await enhancedWebRTC.handleIceCandidate(message.payload as RTCIceCandidateInit, message.from);
        }
      },
    });
    loadSavedDevices();
    return () => signalingService.stop();
  }, [loadSavedDevices]);

  const connectToDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'connecting' } : d));
    try {
      await enhancedWebRTC.createPeer(deviceId, device.name, device.type);
    } catch {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'discovered' } : d));
    }
  }, [devices]);

  const disconnectDevice = useCallback((deviceId: string) => {
    enhancedWebRTC.removePeer(deviceId);
    signalingService.disconnect(deviceId);
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'discovered' } : d));
    setSelectedDeviceIds(prev => prev.filter(id => id !== deviceId));
  }, []);

  const toggleDeviceSelection = useCallback((deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  }, []);

  const removeSavedDevice = useCallback((id: string) => {
    storageService.deleteDevice(id);
    setSavedDevices(prev => prev.filter(d => d.id !== id));
  }, []);

  const toggleFavoriteDevice = useCallback((id: string) => {
    setSavedDevices(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d);
      const device = updated.find(d => d.id === id);
      if (device) {
        storageService.saveDevice(device).catch(() => {});
      }
      return updated;
    });
  }, []);

  const renameDevice = useCallback((id: string, name: string) => {
    setSavedDevices(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, nickname: name } : d);
      const device = updated.find(d => d.id === id);
      if (device) {
        storageService.saveDevice(device).catch(() => {});
      }
      return updated;
    });
  }, []);

  return (
    <DeviceContext.Provider value={{
      localId, localName, setLocalName,
      devices, savedDevices, selectedDeviceIds, setSelectedDeviceIds,
      toggleDeviceSelection,
      connectToDevice, disconnectDevice,
      removeSavedDevice, toggleFavoriteDevice, renameDevice,
      isScanning, startScanning: () => setIsScanning(true), stopScanning: () => setIsScanning(false)
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevices must be used within DeviceProvider');
  return context;
}
