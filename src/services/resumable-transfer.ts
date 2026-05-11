// Resumable Transfer Service for managing partially completed transfers
import { storageService } from './storage';

export interface TransferProgress {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  timestamp: number;
}

const PROGRESS_KEY_PREFIX = 'transfer_progress_';

export async function saveTransferProgress(fileId: string, progress: TransferProgress): Promise<void> {
  await storageService.saveSetting(`${PROGRESS_KEY_PREFIX}${fileId}`, progress);
}

export async function getTransferProgress(fileId: string): Promise<TransferProgress | null> {
  return await storageService.getSetting<TransferProgress | null>(`${PROGRESS_KEY_PREFIX}${fileId}`, null);
}

export async function clearTransferProgress(fileId: string): Promise<void> {
  await storageService.saveSetting(`${PROGRESS_KEY_PREFIX}${fileId}`, null);
}

export async function getAllTransferProgress(): Promise<TransferProgress[]> {
  const allSettings = await storageService.getAllSettings();
  const progressList: TransferProgress[] = [];

  for (const [key, value] of Object.entries(allSettings)) {
    if (key.startsWith(PROGRESS_KEY_PREFIX)) {
      progressList.push((value as any).value as TransferProgress);
    }
  }

  return progressList;
}
