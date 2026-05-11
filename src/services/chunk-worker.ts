// Chunk Worker Manager Service
// Manages Web Worker for off-main-thread chunk processing

export interface ChunkWorkerOptions {
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onComplete?: (hash: string) => void;
  onError?: (error: string) => void;
}

export interface ChunkMessage {
  type: 'hashChunk' | 'hashFile' | 'splitChunks';
  data: ArrayBuffer | File | { file: File; chunkSize: number };
  id: string;
}

export interface ChunkResponse {
  type: 'hashChunkResult' | 'hashFileResult' | 'chunk' | 'done' | 'error';
  id: string;
  data?: string | { chunk: ArrayBuffer; index: number; total: number };
  error?: string;
}

class ChunkWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: string | undefined | void) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: number) => void;
    onComplete?: (hash: string) => void;
    onError?: (error: string) => void;
  }> = new Map();
  private messageId: number = 0;
  private isInitialized: boolean = false;

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      console.warn('Web Workers not supported');
      return;
    }

    try {
      this.worker = new Worker(
        new URL('../workers/chunk.worker.ts', import.meta.url),
        { type: 'module' }
      );
      
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (error) => {
        console.error('Chunk worker error:', error);
      };
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize chunk worker:', error);
    }
  }

  private handleMessage(e: MessageEvent<ChunkResponse>): void {
    const { type, id, data, error } = e.data;
    const pending = this.pendingRequests.get(id);
    
    if (!pending) return;
    
    switch (type) {
      case 'hashChunkResult':
        pending.resolve(data as string);
        break;
      case 'hashFileResult':
        pending.resolve(data as string);
        break;
      case 'chunk':
        if (pending.onProgress && data && typeof data === 'object' && 'index' in data && 'total' in data) {
          const chunkData = data as { index: number; total: number };
          const progress = ((chunkData.index + 1) / chunkData.total) * 100;
          pending.onProgress(progress);
        }
        break;
      case 'done':
        if (pending.onComplete) {
          pending.onComplete(data as string);
        }
        pending.resolve(undefined);
        break;
      case 'error':
        pending.reject(new Error(error || 'Unknown error'));
        if (pending.onError) pending.onError(error || 'Unknown error');
        break;
    }
    
    if (type === 'done' || type === 'error' || type === 'hashChunkResult' || type === 'hashFileResult') {
      this.pendingRequests.delete(id);
    }
  }

  private generateId(): string {
    return `msg-${++this.messageId}-${Date.now()}`;
  }

  async hashChunk(data: ArrayBuffer): Promise<string> {
    await this.initialize();
    if (!this.worker) {
      return this.hashChunkSync(data);
    }
    
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      this.pendingRequests.set(id, {
        resolve: resolve as (value: string | void | undefined) => void,
        reject
      });
      this.worker!.postMessage({ type: 'hashChunk', data, id } as ChunkMessage);
    });
  }

  async hashFile(file: File, options?: ChunkWorkerOptions): Promise<string> {
    await this.initialize();
    if (!this.worker) {
      const buffer = await file.arrayBuffer();
      return this.hashChunkSync(buffer);
    }
    
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      this.pendingRequests.set(id, {
        resolve: resolve as (value: string | void | undefined) => void,
        reject,
        onProgress: options?.onProgress,
        onComplete: options?.onComplete,
        onError: options?.onError
      });
      this.worker!.postMessage({ type: 'hashFile', data: file, id } as ChunkMessage);
    });
  }

  async *splitIntoChunks(
    file: File, 
    chunkSize: number = 65536,
    options?: ChunkWorkerOptions
  ): AsyncGenerator<{ chunk: ArrayBuffer; index: number; total: number }> {
    await this.initialize();
    if (!this.worker) {
      yield* this.splitIntoChunksSync(file, chunkSize);
      return;
    }
    
    const id = this.generateId();
    const buffer: { chunk: ArrayBuffer; index: number; total: number }[] = [];
    let done = false;
    let error: Error | null = null;

    this.pendingRequests.set(id, {
      resolve: () => {},
      reject: (err) => { error = err; },
      onProgress: options?.onProgress,
      onError: options?.onError
    });
    
    this.worker!.postMessage({ 
      type: 'splitChunks', 
      data: { file, chunkSize }, 
      id 
    } as ChunkMessage);
    
    const originalOnMessage = this.worker!.onmessage;
    this.worker!.onmessage = (e: MessageEvent<ChunkResponse>) => {
      const { type, id: msgId, data } = e.data;
      if (msgId !== id) {
        if (originalOnMessage) {
          // Capture the original handler and call it with proper context
          const handler = originalOnMessage as (ev: MessageEvent) => void;
          if (handler) handler(e);
        }
        return;
      }
      
      if (type === 'chunk') {
        buffer.push(data as { chunk: ArrayBuffer; index: number; total: number });
      } else if (type === 'done') {
        done = true;
      } else if (type === 'error') {
        error = new Error(data as string);
      }
    };
    
    try {
      while (!done || buffer.length > 0) {
        if (error) {
          throw error;
        }
        if (buffer.length > 0) {
          const chunk = buffer.shift()!;
          if (options?.onProgress) {
            options.onProgress(((chunk.index + 1) / chunk.total) * 100);
          }
          yield chunk;
        } else {
          await new Promise(r => setTimeout(r, 10));
        }
      }
    } catch (err) {
      // Clean up pending request on error to prevent memory leak
      this.pendingRequests.delete(id);
      throw err;
    } finally {
      // Always clean up pending request when generator completes or errors
      this.pendingRequests.delete(id);
      this.worker!.onmessage = originalOnMessage;
    }
  }

  private async hashChunkSync(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async *splitIntoChunksSync(
    file: File, 
    chunkSize: number
  ): AsyncGenerator<{ chunk: ArrayBuffer; index: number; total: number }> {
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      const chunk = file.slice(start, end);
      const chunkBuffer = await chunk.arrayBuffer();
      
      yield {
        chunk: chunkBuffer,
        index: i,
        total: totalChunks
      };
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
    this.pendingRequests.clear();
  }
}

export const chunkWorkerManager = new ChunkWorkerManager();
