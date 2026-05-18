// Enhanced WebRTC Service with Chunked Transfer, Pause/Resume, and Hash Verification
import { signalingService } from './signaling';
import { FILE_LIMITS } from '../config/limits';
import { ICE_SERVERS } from '../config/ice';
import { sanitizeFileName } from '../utils/sanitize';
import { TransferError } from '../utils/errors';
import { saveTransferProgress, getTransferProgress, clearTransferProgress } from './resumable-transfer';

export interface FileInfo { fileId: string; fileName: string; relativePath?: string; fileSize: number; fileType: string; totalChunks: number; hash?: string; }
export interface ChunkProgress { fileId: string; chunkIndex: number; received: boolean; hash?: string; }
export interface TransferState { fileId: string; fileName: string; relativePath?: string; fileSize: number; fileType: string; totalChunks: number; receivedChunks: ChunkProgress[]; status: 'pending' | 'paused' | 'transferring' | 'complete' | 'failed' | 'verifying' | 'cancelled'; progress: number; speed: number; startTime?: number; deviceId: string; direction: 'upload' | 'download'; error?: string; }
export interface PeerConnection { id: string; name: string; type: 'mobile' | 'desktop'; status: 'connecting' | 'connected' | 'disconnected'; connection?: RTCPeerConnection; dataChannel?: RTCDataChannel; signalStrength?: number; }
export type TransferCallback = { onProgress?: (state: TransferState) => void; onComplete?: (fileId: string, file: File) => void; onError?: (fileId: string, error: string) => void; onVerificationComplete?: (fileId: string, verified: boolean) => void; };

// Transfer Queue Management for issue #62
interface QueuedTransfer {
  file: File;
  deviceId: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
  fileId?: string;
  relativePath?: string;
}

// Helper to check if connection is closed (for validation)
function isConnectionClosed(connection: RTCPeerConnection): boolean {
  const state = connection.connectionState || connection.iceConnectionState;
  return state === 'closed' || state === 'failed' || state === 'disconnected';
}

class TransferQueueManager {
  private queue: QueuedTransfer[] = [];
  private activeTransfers: Map<string, boolean> = new Map();
  private maxConcurrent = 1;
  private maxRetries = 3;

  enqueue(transfer: Omit<QueuedTransfer, 'retryCount'>): void {
    const queued: QueuedTransfer = { ...transfer, retryCount: 0 };
    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(t => t.priority < queued.priority);
    if (insertIndex === -1) {
      this.queue.push(queued);
    } else {
      this.queue.splice(insertIndex, 0, queued);
    }
  }

  async processNext(getPeerReady: (deviceId: string) => boolean, sendFileFn: (file: File, deviceId: string, fileId?: string, relativePath?: string) => Promise<string>): Promise<string | null> {
    if (this.queue.length === 0) return null;
    const transfer = this.queue[0];
    if (!getPeerReady(transfer.deviceId)) {
      return null; // Peer not ready, skip for now
    }
    this.queue.shift();
    this.activeTransfers.set(transfer.fileId || 'pending', true);
    try {
      const fileId = await sendFileFn(transfer.file, transfer.deviceId, transfer.fileId, transfer.relativePath);
      this.activeTransfers.delete(fileId);
      return fileId;
    } catch {
      this.activeTransfers.delete(transfer.fileId || 'pending');
      if (transfer.retryCount < this.maxRetries) {
        transfer.retryCount++;
        // Re-enqueue with same priority after exponential backoff
        setTimeout(() => {
          this.queue.unshift(transfer);
        }, Math.pow(2, transfer.retryCount) * 1000);
      }
      return null;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

// Connection Quality Monitor for issue #60
class ConnectionQualityMonitor {
  private samples: number[] = [];
  private maxSamples = 10;
  private lastRtt = 0;

  addSample(rtt: number): void {
    this.samples.push(rtt);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    this.lastRtt = rtt;
  }

  getQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (this.samples.length === 0) return 'good';
    const avgRtt = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (avgRtt < 50) return 'excellent';
    if (avgRtt < 150) return 'good';
    if (avgRtt < 300) return 'fair';
    return 'poor';
  }

  getAverageRtt(): number {
    if (this.samples.length === 0) return this.lastRtt;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  reset(): void {
    this.samples = [];
    this.lastRtt = 0;
  }
}
class EnhancedWebRTC {
  private peers: Map<string, PeerConnection> = new Map();
  private pendingFiles: Map<string, FileInfo> = new Map();
  private receivedChunks: Map<string, ArrayBuffer[]> = new Map();
  private transferStates: Map<string, TransferState> = new Map();
  private callbacks: Map<string, TransferCallback> = new Map();
  private localId: string = '';
  private localName: string = '';
  private activeReceiveFileId: string | null = null;
  private transferQueue: TransferQueueManager = new TransferQueueManager();
  private qualityMonitor: ConnectionQualityMonitor = new ConnectionQualityMonitor();

  constructor() { const info = signalingService.getLocalInfo(); this.localId = info.id; this.localName = info.name; }

  // Public methods for queue management
  queueTransfer(file: File, deviceId: string, priority: number = 1, fileId?: string, relativePath?: string): void {
    this.transferQueue.enqueue({ file, deviceId, priority, fileId, relativePath });
  }

  getQueueLength(): number {
    return this.transferQueue.getQueueLength();
  }

  clearQueue(): void {
    this.transferQueue.clear();
  }

  processNextTransfer(): Promise<string | null> {
    return this.transferQueue.processNext(
      (deviceId) => {
        const peer = this.peers.get(deviceId);
        return !!peer?.dataChannel && peer.dataChannel.readyState === 'open' && !isConnectionClosed(peer.connection!);
      },
      (file, deviceId, fileId, relativePath) => this.sendFile(file, deviceId, fileId, relativePath)
    );
  }

  // Connection quality monitoring
  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    return this.qualityMonitor.getQuality();
  }

  recordRtt(_deviceId: string, rtt: number): void {
    this.qualityMonitor.addSample(rtt);
  }
  private async* streamFileChunks(file: File, chunkSize: number) {
    const totalChunks = Math.ceil(file.size / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);
      const buffer = await blob.arrayBuffer();
      yield { index: i, buffer };
    }
  }

  private async waitForBufferLow(dataChannel: RTCDataChannel, limit = 1024 * 1024) {
    if (dataChannel.bufferedAmount <= limit) return;
    return new Promise<void>(resolve => {
      const check = () => {
        if (dataChannel.bufferedAmount <= limit) {
          dataChannel.removeEventListener('bufferedamountlow', check);
          resolve();
        }
      };
      dataChannel.addEventListener('bufferedamountlow', check);
    });
  }

  private async hashChunk(data: ArrayBuffer): Promise<string> { const hashBuffer = await crypto.subtle.digest('SHA-256', data); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); }
  private async verifyFileHash(fileId: string): Promise<boolean> { const fileInfo = this.pendingFiles.get(fileId); const chunks = this.receivedChunks.get(fileId); if (!fileInfo || !chunks || !fileInfo.hash) return true; const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0); const combined = new Uint8Array(totalLength); let offset = 0; for (const chunk of chunks) { combined.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; } const fileHash = await this.hashChunk(combined.buffer); return fileHash === fileInfo.hash; }

  async createPeer(deviceId: string, deviceName: string, deviceType: 'mobile' | 'desktop'): Promise<PeerConnection> {
    // Validate peer connection state before creating new one
    const existingPeer = this.peers.get(deviceId);
    if (existingPeer?.connection && !isConnectionClosed(existingPeer.connection)) {
      console.warn(`Peer ${deviceId} already exists and is not closed. Reusing existing connection.`);
      return existingPeer;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerConnection = { id: deviceId, name: deviceName, type: deviceType, status: 'connecting', connection: pc };
    this.peers.set(deviceId, peer);
    const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });
    this.setupDataChannel(dataChannel, deviceId);
    peer.dataChannel = dataChannel;
    pc.onicecandidate = (event) => { if (event.candidate) signalingService.sendSignal(deviceId, { type: 'ice-candidate', payload: event.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { peer.status = 'connected'; signalingService.connect(deviceId); }
      else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') { peer.status = 'disconnected'; signalingService.disconnect(deviceId); }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signalingService.sendSignal(deviceId, { type: 'offer', payload: pc.localDescription });
    return peer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit, deviceId: string, deviceName: string, deviceType: 'mobile' | 'desktop'): Promise<void> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerConnection = { id: deviceId, name: deviceName, type: deviceType, status: 'connecting', connection: pc };
    this.peers.set(deviceId, peer);
    pc.ondatachannel = (event) => { this.setupDataChannel(event.channel, deviceId); peer.dataChannel = event.channel; };
    pc.onicecandidate = (event) => { if (event.candidate) signalingService.sendSignal(deviceId, { type: 'ice-candidate', payload: event.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') { peer.status = 'connected'; signalingService.connect(deviceId); } };
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    signalingService.sendSignal(deviceId, { type: 'answer', payload: pc.localDescription });
  }

  async handleAnswer(answer: RTCSessionDescriptionInit, deviceId: string): Promise<void> { const peer = this.peers.get(deviceId); if (peer?.connection) await peer.connection.setRemoteDescription(answer); }
  async handleIceCandidate(candidate: RTCIceCandidateInit, deviceId: string): Promise<void> { const peer = this.peers.get(deviceId); if (peer?.connection) await peer.connection.addIceCandidate(new RTCIceCandidate(candidate)); }

  private setupDataChannel(channel: RTCDataChannel, deviceId: string) {
    channel.onopen = () => { const peer = this.peers.get(deviceId); if (peer) peer.status = 'connected'; };
    channel.onclose = () => { const peer = this.peers.get(deviceId); if (peer) peer.status = 'disconnected'; };
    channel.onmessage = (event) => { this.handleDataMessage(event.data, deviceId); };
    channel.onerror = (error) => { console.error('Data channel error:', error); };
  }

  private async handleDataMessage(data: ArrayBuffer | string, deviceId: string) {
    try {
      if (data instanceof ArrayBuffer) await this.handleBinaryChunk(data, deviceId);
      else if (typeof data === 'string') { const message = JSON.parse(data); await this.handleControlMessage(message, deviceId); }
    } catch { console.error('Error handling data message:', error); }
  }

  private async handleControlMessage(message: { type: string; [key: string]: unknown }, deviceId: string) {
    switch (message.type) {
      case 'file-info': this.handleFileInfo(message as unknown as FileInfo, deviceId); break;
      case 'file-complete': await this.handleFileComplete(message as unknown as { fileId: string }, deviceId); break;
      case 'file-pause': this.handleFilePause(message as unknown as { fileId: string }); break;
      case 'file-resume': this.handleFileResume(message as unknown as { fileId: string }); break;
      case 'chunk-ack': this.handleChunkAck(message as unknown as { fileId: string; chunkIndex: number }); break;
      case 'file-cancel': this.handleFileCancel(message as unknown as { fileId: string }); break;
    }
  }

  private handleFileInfo(message: { fileId: string; fileName: string; relativePath?: string; fileSize: number; fileType: string; totalChunks: number; hash?: string }, deviceId: string) {
    if (!message.fileId || typeof message.fileId !== 'string') return;
    const fileName = sanitizeFileName(message.fileName);
    if (!fileName) return;
    if (!message.fileSize || message.fileSize <= 0 || message.fileSize > FILE_LIMITS.MAX_FILE_SIZE) {
      console.error(`Invalid file size: ${message.fileSize}`);
      return;
    }
    const expectedChunks = Math.ceil(message.fileSize / FILE_LIMITS.CHUNK_SIZE);
    if (message.totalChunks !== expectedChunks || message.totalChunks > 10000) {
      console.error(`Invalid chunk count: ${message.totalChunks} (expected: ${expectedChunks})`);
      return;
    }

    // Use sanitized fileName
    const fileInfo: FileInfo = { fileId: message.fileId, fileName, relativePath: message.relativePath, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, hash: message.hash };
    this.pendingFiles.set(message.fileId, fileInfo);
    this.receivedChunks.set(message.fileId, []);
    const state: TransferState = { fileId: message.fileId, fileName, relativePath: message.relativePath, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'download' };
    this.transferStates.set(message.fileId, state);
    this.callbacks.get(deviceId)?.onProgress?.(state);
    this.activeReceiveFileId = message.fileId;
  }

  private async handleBinaryChunk(data: ArrayBuffer, deviceId: string) {
    if (!this.activeReceiveFileId) return;
    const fileId = this.activeReceiveFileId;
    const fileInfo = this.pendingFiles.get(fileId);
    if (!fileInfo) return;

    // Initialize received chunks array if needed
    if (!this.receivedChunks.has(fileId)) {
      this.receivedChunks.set(fileId, []);
    }
    const received = this.receivedChunks.get(fileId)!;

    // Get chunk index from the binary data header (first 4 bytes as big-endian uint32)
    if (data.byteLength < 4) {
      console.error('Invalid chunk: too small to contain index');
      return;
    }
    const view = new DataView(data.slice(0, 4));
    const chunkIndex = view.getUint32(0, false); // big-endian

    // SECURITY: Validate chunk index to prevent memory exhaustion attacks
    // Chunk index must be within valid range [0, totalChunks-1]
    if (chunkIndex >= fileInfo.totalChunks) {
      console.error(`Invalid chunk index: ${chunkIndex} (expected < ${fileInfo.totalChunks})`);
      return;
    }
    if (chunkIndex < 0) {
      console.error(`Negative chunk index: ${chunkIndex}`);
      return;
    }

    const chunkData = data.slice(4);

    // Ensure array is large enough and store chunk at correct index
    while (received.length < chunkIndex) {
      received.push(null as unknown as ArrayBuffer); // Fill gaps with null placeholders
    }

    // SECURITY: Prevent duplicate chunk overwrite - only accept first chunk at each index
    if (received[chunkIndex] === null) {
      received[chunkIndex] = chunkData;
    }

    // Count received chunks (non-null)
    const receivedCount = received.filter(c => c !== null).length;
    const progress = (receivedCount / fileInfo.totalChunks) * 100;
    const state = this.transferStates.get(fileId);
    if (state) {
      state.progress = progress;
      state.receivedChunks.push({ fileId, chunkIndex, received: true });
      const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000;
      state.speed = (receivedCount * FILE_LIMITS.CHUNK_SIZE) / elapsed;
      this.callbacks.get(deviceId)?.onProgress?.(state);
    }
    const peer = this.peers.get(deviceId);
    peer?.dataChannel?.send(JSON.stringify({ type: 'chunk-ack', fileId, chunkIndex }));
  }

  private async handleFileComplete(message: { fileId: string }, deviceId: string) {
    const fileId = message.fileId;
    const state = this.transferStates.get(fileId);
    if (state) {
      state.status = 'verifying';
      this.callbacks.get(deviceId)?.onProgress?.(state);
      const verified = await this.verifyFileHash(fileId);
      if (verified) {
        state.status = 'complete'; state.progress = 100;
        const chunks = this.receivedChunks.get(fileId);
        if (chunks) {
          // Filter out null chunks (missing/out-of-order chunks)
          const validChunks = chunks.filter((c): c is ArrayBuffer => c !== null);
          if (validChunks.length === chunks.length) {
            const blob = new Blob(validChunks, { type: state.fileType });
            const file = new File([blob], state.fileName);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = state.fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            this.callbacks.get(deviceId)?.onComplete?.(fileId, file);
          } else {
            state.status = 'failed';
            state.error = `Missing ${chunks.length - validChunks.length} chunks`;
            this.callbacks.get(deviceId)?.onError?.(fileId, state.error);
          }
        }
      } else { state.status = 'failed'; state.error = 'File verification failed'; this.callbacks.get(deviceId)?.onError?.(fileId, 'File verification failed'); }
        this.callbacks.get(deviceId)?.onProgress?.(state);
        this.callbacks.get(deviceId)?.onVerificationComplete?.(fileId, verified);
        this.activeReceiveFileId = null;
        setTimeout(() => { this.cleanup(fileId); }, 5000);
    }
  }

  private handleFilePause(message: { fileId: string }) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'paused'; this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleFileResume(message: { fileId: string }) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'transferring'; state.startTime = Date.now(); this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleChunkAck(message: { fileId: string; chunkIndex: number }) {
    const state = this.transferStates.get(message.fileId);
    if (state && state.direction === 'upload') {
      const ackIndex = message.chunkIndex;
      state.progress = ((ackIndex + 1) / state.totalChunks) * 100;
      const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000;
      state.speed = ((ackIndex + 1) * FILE_LIMITS.CHUNK_SIZE) / elapsed;

      // Persist progress for resume capability
      saveTransferProgress(message.fileId, {
        fileId: message.fileId,
        chunkIndex: ackIndex + 1,
        totalChunks: state.totalChunks,
        timestamp: Date.now()
      }).catch(err => console.error('Failed to save transfer progress:', err));

      this.callbacks.get(state.deviceId)?.onProgress?.(state);
    }
  }
  private handleFileCancel(message: { fileId: string }) {
    if (this.activeReceiveFileId === message.fileId) {
      this.activeReceiveFileId = null;
    }
    this.cleanup(message.fileId);
  }

  async sendFile(file: File, deviceId: string, fileId?: string, relativePath?: string): Promise<string> {
    if (file.size > FILE_LIMITS.MAX_FILE_SIZE) {
      throw new TransferError(
        `File too large. Maximum size: ${FILE_LIMITS.MAX_FILE_SIZE / (1024*1024*1024)}GB`,
        'FILE_TOO_LARGE',
        { fileSize: file.size, maxSize: FILE_LIMITS.MAX_FILE_SIZE }
      );
    }

    const peer = this.peers.get(deviceId);
    if (!peer?.connection) {
      throw new TransferError('Peer connection not found', 'NOT_CONNECTED');
    }
    if (isConnectionClosed(peer.connection)) {
      throw new TransferError('Peer connection is closed', 'CONNECTION_CLOSED');
    }
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      throw new TransferError('Peer not connected', 'NOT_CONNECTED');
    }
    // Use crypto for secure file ID generation if no fileId provided
    const generateSecureId = (): string => {
      const array = new Uint32Array(4);
      crypto.getRandomValues(array);
      return Array.from(array, (dec) => dec.toString(36).padStart(6, '0')).join('');
    };
    const id = fileId || generateSecureId();
    const totalChunks = Math.ceil(file.size / FILE_LIMITS.CHUNK_SIZE);
    const state: TransferState = { fileId: id, fileName: file.name, relativePath, fileSize: file.size, fileType: file.type, totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'upload' };
    this.transferStates.set(id, state);
    peer.dataChannel.send(JSON.stringify({ type: 'file-info', fileId: id, fileName: file.name, relativePath, fileSize: file.size, fileType: file.type, totalChunks }));

    const savedProgress = await getTransferProgress(id);
    const startChunk = savedProgress ? savedProgress.chunkIndex : 0;

    for await (const chunk of this.streamFileChunks(file, FILE_LIMITS.CHUNK_SIZE)) {
      if (chunk.index < startChunk) continue;

      const currentState = this.transferStates.get(id);
      if (!currentState || currentState.status === 'cancelled') break;

      if (currentState.status === 'paused') {
        await new Promise<void>(resolve => {
          const checkPause = setInterval(() => {
            const s = this.transferStates.get(id);
            if (!s || s.status === 'cancelled') { clearInterval(checkPause); resolve(); }
            else if (s.status === 'transferring') { clearInterval(checkPause); resolve(); }
          }, 100);
        });
      }

      const latestState = this.transferStates.get(id);
      if (!latestState || latestState.status === 'cancelled') break;

      // Prepare packet with 4-byte index header
      const packet = new Uint8Array(4 + chunk.buffer.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, chunk.index, false);
      packet.set(new Uint8Array(chunk.buffer), 4);

      peer.dataChannel.send(packet.buffer);

      // Throttle if buffer is full (16MB default limit)
      if (peer.dataChannel.bufferedAmount > 16 * 1024 * 1024) {
        await this.waitForBufferLow(peer.dataChannel);
      }
    }
    const finalState = this.transferStates.get(id);
    if (finalState && finalState.status !== 'cancelled') {
      peer.dataChannel.send(JSON.stringify({ type: 'file-complete', fileId: id }));
      await clearTransferProgress(id);
    }
    return id;
  }

  pauseTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { state.status = 'paused'; this.callbacks.get(state.deviceId)?.onProgress?.(state); this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-pause', fileId })); } }
  resumeTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { state.status = 'transferring'; state.startTime = Date.now(); this.callbacks.get(state.deviceId)?.onProgress?.(state); this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-resume', fileId })); } }
  cancelTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { state.status = 'cancelled'; this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-cancel', fileId })); this.cleanup(fileId); } }
  getTransferState(fileId: string): TransferState | undefined { return this.transferStates.get(fileId); }
  getAllTransferStates(): TransferState[] { return Array.from(this.transferStates.values()); }
  registerCallback(deviceId: string, callback: TransferCallback) { this.callbacks.set(deviceId, callback); }
  removePeer(deviceId: string) { const peer = this.peers.get(deviceId); if (peer) { peer.connection?.close(); peer.dataChannel?.close(); this.peers.delete(deviceId); } }
  getPeers(): PeerConnection[] { return Array.from(this.peers.values()); }
  getPeer(id: string): PeerConnection | undefined { return this.peers.get(id); }
  private cleanup(fileId: string) { this.pendingFiles.delete(fileId); this.receivedChunks.delete(fileId); this.transferStates.delete(fileId); }
}
export const enhancedWebRTC = new EnhancedWebRTC();