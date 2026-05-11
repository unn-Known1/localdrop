export type TransferErrorCode =
  | 'FILE_TOO_LARGE'
  | 'NOT_CONNECTED'
  | 'TRANSFER_FAILED'
  | 'VERIFICATION_FAILED'
  | 'INVALID_FILE'
  | 'CHUNK_MISSING';

export type DeviceErrorCode =
  | 'NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'DISCONNECTED';

export type StorageErrorCode =
  | 'DB_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_DATA';

export class TransferError extends Error {
  constructor(
    message: string,
    public readonly code: TransferErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

export class DeviceError extends Error {
  constructor(
    message: string,
    public readonly code: DeviceErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DeviceError';
  }
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function handleError(error: unknown, context: string): string {
  if (error instanceof TransferError) {
    return `Transfer error: ${error.message}`;
  }
  if (error instanceof DeviceError) {
    return `Device error: ${error.message}`;
  }
  if (error instanceof StorageError) {
    return `Storage error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${context}: ${error.message}`;
  }
  return `${context}: Unknown error`;
}

export function isTransferError(error: unknown): error is TransferError {
  return error instanceof TransferError;
}

export function isDeviceError(error: unknown): error is DeviceError {
  return error instanceof DeviceError;
}
