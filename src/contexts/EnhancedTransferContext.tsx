import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { enhancedWebRTC } from '../services/enhanced-webrtc';
import { storageService, TransferRecord } from '../services/storage';
import { fileProcessor, ProcessedFile } from '../services/fileProcessor';
import { useDevices } from './DeviceContext';
import { useSettings } from './SettingsContext';
import { SelectedFile, Transfer } from '../types';
import { generateSecureId } from '../services/crypto';
import { validateFileSize, validateTotalSize } from '../config/limits';
import { notificationService } from '../services/notifications';

interface Toast { id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string; duration?: number; }

interface TransferContextType {
  selectedFiles: SelectedFile[];
  addFiles: (files: FileList | File[] | { file: File, relativePath?: string }[], options?: { compress?: boolean; quality?: string }) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  previewFile: (id: string) => void;
  processedFiles: Map<string, ProcessedFile>;
  transfers: Transfer[];
  sendFiles: () => Promise<void>;
  pauseTransfer: (id: string) => void;
  resumeTransfer: (id: string) => void;
  cancelTransfer: (id: string) => void;
  transferHistory: TransferRecord[];
  loadTransferHistory: () => Promise<void>;
  clearTransferHistory: () => Promise<void>;
  clearCompletedTransfers: () => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const TransferContext = createContext<TransferContextType | null>(null);

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const { devices, selectedDeviceIds } = useDevices();
  const { settings, isPinVerified } = useSettings();

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [processedFiles, setProcessedFiles] = useState<Map<string, ProcessedFile>>(new Map());
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateSecureId();
    setToasts(prev => [...prev, { ...toast, id }]);

    if (settings.soundEnabled) {
      if (toast.type === 'success') notificationService.playSound('transfer-complete');
      if (toast.type === 'error') notificationService.playSound('transfer-error');
    }

    if (settings.vibrationEnabled) {
      if (toast.type === 'success') notificationService.vibrate(100);
      if (toast.type === 'error') notificationService.vibrate([100, 50, 100]);
    }

    setTimeout(() => removeToast(id), toast.duration || 4000);
  }, [settings.soundEnabled, settings.vibrationEnabled, removeToast]);

  const loadTransferHistory = useCallback(async () => {
    const history = await storageService.getRecentTransfers(100);
    setTransferHistory(history);
  }, []);

  const clearTransferHistory = useCallback(async () => {
    await storageService.clearTransferHistory();
    setTransferHistory([]);
  }, []);

  const clearCompletedTransfers = useCallback(() => {
    setTransfers(prev => prev.filter(t => t.status !== 'complete'));
  }, []);

  const addFiles = useCallback(async (files: FileList | File[] | { file: File, relativePath?: string }[], options?: { compress?: boolean; quality?: string }) => {
    // Normalize files to a common structure: { file: File, relativePath?: string }[]
    const rawFiles: any[] = Array.isArray(files) ? files : Array.from(files as any);
    const fileArray: { file: File; relativePath?: string }[] = rawFiles.map(f => {
      if (f instanceof File) return { file: f, relativePath: undefined };
      if (f && typeof f === 'object' && 'file' in f) return f;
      return { file: f as File, relativePath: undefined };
    });

    let totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    for (const item of fileArray) {
      const file = item.file;
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

    const newFiles: SelectedFile[] = [];
    for (const item of fileArray) {
      const file = item.file;
      const relativePath = item.relativePath;
      const id = generateSecureId();
      const info = await fileProcessor.getFileInfo(file);
      let thumbnail: string | undefined;
      if (info.isImage || info.isVideo) thumbnail = URL.createObjectURL(file);

      let processed: ProcessedFile | undefined;
      let compressionFailed = false;

      if (options?.compress && (info.isImage || info.isVideo)) {
        try {
          const quality = (options.quality as 'original' | 'high' | 'medium' | 'low') || settings.defaultQuality;
          if (info.isImage) {
            processed = await fileProcessor.processImage(file, { quality });
          } else if (info.isVideo) {
            processed = await fileProcessor.processVideo(file, { quality });
          }
          if (processed?.wasCompressed) setProcessedFiles(prev => new Map(prev).set(id, processed!));
        } catch (e) {
          compressionFailed = true;
          console.error('Compression failed:', e);
          addToast({ type: 'warning', message: `Compression failed for ${file.name} - sending original file` });
        }
      }

      const finalFile = processed?.file instanceof File ? processed.file : (processed?.file ? new File([processed.file], file.name, { type: processed.file.type || file.type, lastModified: Date.now() }) : file);

      newFiles.push({
        id, file: finalFile, relativePath, thumbnail,
        size: processed?.processedSize || file.size,
        type: file.type, width: info.width, height: info.height,
        duration: info.duration, processed, hasCompressionIssue: compressionFailed
      });
    }
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [settings.defaultQuality, addToast, selectedFiles]);

  const removeFile = useCallback((id: string) => {
    setSelectedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.thumbnail) URL.revokeObjectURL(file.thumbnail);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles(prev => {
      prev.forEach(f => { if (f.thumbnail) URL.revokeObjectURL(f.thumbnail); });
      return [];
    });
    setProcessedFiles(new Map());
  }, []);

  const previewFile = useCallback((id: string) => {
    const file = selectedFiles.find(f => f.id === id);
    if (file) {
      const url = URL.createObjectURL(file.file);
      window.open(url, '_blank');
    }
  }, [selectedFiles]);

  const sendFiles = useCallback(async () => {
    const selectedDevices = devices.filter(d => selectedDeviceIds.includes(d.id));
    const connectedDevices = selectedDevices.filter(d => d.status === 'connected');

    if (connectedDevices.length === 0) {
      addToast({ type: 'error', message: 'No connected devices selected' });
      return;
    }
    if (selectedFiles.length === 0) {
      addToast({ type: 'warning', message: 'No files selected' });
      return;
    }
    if (settings.pinEnabled && !isPinVerified) {
      addToast({ type: 'warning', message: 'Enter PIN first' });
      return;
    }

    const transferIdToFileId = new Map<string, string>();

    connectedDevices.forEach(device => {
      enhancedWebRTC.registerCallback(device.id, {
        onProgress: (state) => {
          const transferId = [...transferIdToFileId.entries()].find(([, fid]) => fid === state.fileId)?.[0];
          if (transferId) {
            setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: state.status as Transfer['status'], progress: state.progress, speed: state.speed } : t));
          }
        },
        onComplete: (fileId, file) => {
          const transferId = [...transferIdToFileId.entries()].find(([, fid]) => fid === fileId)?.[0];
          if (transferId) {
            setTransfers(prev => {
              const transfer = prev.find(t => t.id === transferId);
              if (transfer?.thumbnail) URL.revokeObjectURL(transfer.thumbnail);
              return prev.map(t => t.id === transferId ? { ...t, status: 'complete', progress: 100, completedAt: Date.now(), thumbnail: undefined } : t);
            });
            addToast({ type: 'success', message: `Sent: ${file.name} to ${device.name}` });
            loadTransferHistory();
          }
        },
        onError: (fileId, error) => {
          const transferId = [...transferIdToFileId.entries()].find(([, fid]) => fid === fileId)?.[0];
          if (transferId) {
            setTransfers(prev => {
              const transfer = prev.find(t => t.id === transferId);
              if (transfer?.thumbnail) URL.revokeObjectURL(transfer.thumbnail);
              return prev.map(t => t.id === transferId ? { ...t, status: 'failed', error, thumbnail: undefined } : t);
            });
          }
        },
        onVerificationComplete: (fileId, verified) => {
          const transferId = [...transferIdToFileId.entries()].find(([, fid]) => fid === fileId)?.[0];
          if (transferId) {
            setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, verified } : t));
          }
        },
      });
    });

    for (const selectedFile of selectedFiles) {
      for (const device of connectedDevices) {
        const transferId = generateSecureId();
        transferIdToFileId.set(transferId, transferId);
        const transfer: Transfer = {
          id: transferId, fileName: selectedFile.file.name,
          fileSize: selectedFile.size, fileType: selectedFile.type,
          direction: 'upload', status: 'transferring', progress: 0,
          speed: 0, deviceId: device.id, deviceName: device.name,
          startedAt: Date.now(), thumbnail: selectedFile.thumbnail
        };
        setTransfers(prev => [...prev, transfer]);
        try {
          await enhancedWebRTC.sendFile(selectedFile.file, device.id, transferId, selectedFile.relativePath);
        } catch {
          setTransfers(prev => {
            const transfer = prev.find(t => t.id === transferId);
            if (transfer?.thumbnail) URL.revokeObjectURL(transfer.thumbnail);
            return prev.map(t => t.id === transferId ? { ...t, status: 'failed', error: 'Transfer failed', thumbnail: undefined } : t);
          });
          addToast({ type: 'error', message: `Failed to send ${selectedFile.file.name} to ${device.name}` });
        }
      }
    }
    clearFiles();
  }, [devices, selectedDeviceIds, selectedFiles, settings, isPinVerified, addToast, clearFiles, loadTransferHistory]);

  const pauseTransfer = useCallback((id: string) => {
    enhancedWebRTC.pauseTransfer(id);
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t));
  }, []);

  const resumeTransfer = useCallback((id: string) => {
    enhancedWebRTC.resumeTransfer(id);
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'transferring' } : t));
  }, []);

  const cancelTransfer = useCallback((id: string) => {
    setTransfers(prev => {
      const transfer = prev.find(t => t.id === id);
      if (transfer?.thumbnail) URL.revokeObjectURL(transfer.thumbnail);
      return prev.filter(t => t.id !== id);
    });
    enhancedWebRTC.cancelTransfer(id);
  }, []);

  useEffect(() => {
    loadTransferHistory();
  }, [loadTransferHistory]);

  return (
    <TransferContext.Provider value={{
      selectedFiles, addFiles, removeFile, clearFiles, previewFile, processedFiles,
      transfers, sendFiles, pauseTransfer, resumeTransfer, cancelTransfer,
      transferHistory, loadTransferHistory, clearTransferHistory, clearCompletedTransfers,
      toasts, addToast, removeToast
    }}>
      {children}
    </TransferContext.Provider>
  );
}

export function useTransfer() {
  const context = useContext(TransferContext);
  if (!context) throw new Error('useTransfer must be used within a TransferProvider');
  return context;
}
