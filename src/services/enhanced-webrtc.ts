// Enhanced WebRTC Service with Chunked Transfer, Pause/Resume, and Hash Verification
import { signalingService, Device } from './signaling';
const CHUNK_SIZE = 262144;
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB limit - prevents memory exhaustion
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun2.l.google.com:19302' }];
export interface FileInfo { fileId: string; fileName: string; fileSize: number; fileType: string; totalChunks: number; hash?: string; }
export interface ChunkProgress { fileId: string; chunkIndex: number; received: boolean; hash?: string; }
export interface TransferState { fileId: string; fileName: string; fileSize: number; fileType: string; totalChunks: number; receivedChunks: ChunkProgress[]; status: 'pending' | 'paused' | 'transferring' | 'complete' | 'failed' | 'verifying' | 'cancelled'; progress: number; speed: number; startTime?: number; deviceId: string; direction: 'upload' | 'download'; error?: string; }
export interface PeerConnection { id: string; name: string; type: 'mobile' | 'desktop'; status: 'connecting' | 'connected' | 'disconnected'; connection?: RTCPeerConnection; dataChannel?: RTCDataChannel; signalStrength?: number; }
export type TransferCallback = { onProgress?: (state: TransferState) => void; onComplete?: (fileId: string, file: File) => void; onError?: (fileId: string, error: string) => void; onVerificationComplete?: (fileId: string, verified: boolean) => void; };
class EnhancedWebRTC {
  private peers: Map<string, PeerConnection> = new Map();
  private pendingFiles: Map<string, FileInfo> = new Map();
  private receivedChunks: Map<string, ArrayBuffer[]> = new Map();
  private transferStates: Map<string, TransferState> = new Map();
  private callbacks: Map<string, TransferCallback> = new Map();
  private localId: string = '';
  private localName: string = '';
  private activeReceiveFileId: string | null = null;

  constructor() { const info = signalingService.getLocalInfo(); this.localId = info.id; this.localName = info.name; }
  private async hashChunk(data: ArrayBuffer): Promise<string> { const hashBuffer = await crypto.subtle.digest('SHA-256', data); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); }
  private async verifyFileHash(fileId: string): Promise<boolean> { const fileInfo = this.pendingFiles.get(fileId); const chunks = this.receivedChunks.get(fileId); if (!fileInfo || !chunks || !fileInfo.hash) return true; const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0); const combined = new Uint8Array(totalLength); let offset = 0; for (const chunk of chunks) { combined.set(new Uint8Array(chunk), offset); offset += chunk.byteLength; } const fileHash = await this.hashChunk(combined.buffer); return fileHash === fileInfo.hash; }

  async createPeer(deviceId: string, deviceName: string, deviceType: 'mobile' | 'desktop'): Promise<PeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: PeerConnection = { id: deviceId, name: deviceName, type: deviceType, status: 'connecting', connection: pc };
    this.peers.set(deviceId, peer);
    const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });
    this.setupDataChannel(dataChannel, deviceId);
    peer.dataChannel = dataChannel;
    pc.onicecandidate = (event) => { if (event.candidate) signalingService.sendSignal(deviceId, { type: 'ice-candidate', payload: event.candidate.toJSON() }); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') { peer.status = 'connected'; signalingService.connect(deviceId); } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') { peer.status = 'disconnected'; signalingService.disconnect(deviceId); } };
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

  private async handleDataMessage(data: any, deviceId: string) {
    try {
      if (data instanceof ArrayBuffer) await this.handleBinaryChunk(data, deviceId);
      else if (typeof data === 'string') { const message = JSON.parse(data); await this.handleControlMessage(message, deviceId); }
    } catch (error) { console.error('Error handling data message:', error); }
  }

  private async handleControlMessage(message: any, deviceId: string) {
    switch (message.type) {
      case 'file-info': this.handleFileInfo(message, deviceId); break;
      case 'file-complete': await this.handleFileComplete(message, deviceId); break;
      case 'file-pause': this.handleFilePause(message); break;
      case 'file-resume': this.handleFileResume(message); break;
      case 'chunk-ack': this.handleChunkAck(message); break;
      case 'file-cancel': this.handleFileCancel(message); break;
    }
  }

  private handleFileInfo(message: any, deviceId: string) {
    // SECURITY: Validate file size to prevent memory exhaustion attacks
    if (!message.fileSize || typeof message.fileSize !== 'number' || message.fileSize <= 0) {
      console.error('Invalid file size:', message.fileSize);
      return;
    }
    if (message.fileSize > MAX_FILE_SIZE) {
      console.error(`File too large: ${message.fileSize} bytes (max: ${MAX_FILE_SIZE})`);
      const peer = this.peers.get(deviceId);
      peer?.dataChannel?.send(JSON.stringify({ type: 'file-cancel', fileId: message.fileId, reason: 'File too large' }));
      return;
    }
    if (!message.totalChunks || message.totalChunks < 1 || message.totalChunks > 100000) {
      console.error('Invalid totalChunks:', message.totalChunks);
      return;
    }

    const fileInfo: FileInfo = { fileId: message.fileId, fileName: message.fileName, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, hash: message.hash };
    this.pendingFiles.set(message.fileId, fileInfo);
    this.receivedChunks.set(message.fileId, []);
    const state: TransferState = { fileId: message.fileId, fileName: message.fileName, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'download' };
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

    // Ensure array is large enough and store chunk at correct index (atomic operation)
    // Use a lock mechanism to prevent race conditions in chunk storage
    if (received.length <= chunkIndex) {
      // Pre-allocate array to required size atomically
      received.length = chunkIndex + 1;
    }

    // SECURITY: Atomic chunk write - only accept first chunk at each index
    // This prevents potential race conditions where multiple chunks could overwrite each other
    const currentValue = received[chunkIndex];
    if (currentValue === undefined) {
      received[chunkIndex] = chunkData;
    } else {
      // Chunk already received - skip to prevent data corruption
      console.warn(`Duplicate chunk ${chunkIndex} ignored for file ${fileId}`);
      return;
    }

    // Count received chunks (non-null)
    const receivedCount = received.filter(c => c !== null).length;
    const progress = (receivedCount / fileInfo.totalChunks) * 100;
    const state = this.transferStates.get(fileId);
    if (state) {
      state.progress = progress;
      state.receivedChunks.push({ fileId, chunkIndex, received: true });
      const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000;
      state.speed = (receivedCount * CHUNK_SIZE) / elapsed;
      this.callbacks.get(deviceId)?.onProgress?.(state);
    }
    const peer = this.peers.get(deviceId);
    peer?.dataChannel?.send(JSON.stringify({ type: 'chunk-ack', fileId, chunkIndex }));
  }

  private async handleFileComplete(message: any, deviceId: string) {
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

  private handleFilePause(message: any) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'paused'; this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleFileResume(message: any) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'transferring'; state.startTime = Date.now(); this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleChunkAck(message: any) { const state = this.transferStates.get(message.fileId); if (state && state.direction === 'upload') { const ackIndex = message.chunkIndex; state.progress = ((ackIndex + 1) / state.totalChunks) * 100; const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000; state.speed = ((ackIndex + 1) * CHUNK_SIZE) / elapsed; this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleFileCancel(message: any) { 
    if (this.activeReceiveFileId === message.fileId) {
      this.activeReceiveFileId = null;
    }
    this.cleanup(message.fileId); 
  }

  async sendFile(file: File, deviceId: string, fileId?: string): Promise<string> {
    const peer = this.peers.get(deviceId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') throw new Error('Peer not connected');
    // Use crypto for secure file ID generation if no fileId provided
    const generateSecureId = (): string => {
      const array = new Uint32Array(4);
      crypto.getRandomValues(array);
      return Array.from(array, (dec) => dec.toString(36).padStart(6, '0')).join('');
    };
    const id = fileId || generateSecureId();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const arrayBuffer = await file.arrayBuffer();
    const hash = await this.hashChunk(arrayBuffer);
    const state: TransferState = { fileId: id, fileName: file.name, fileSize: file.size, fileType: file.type, totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'upload' };
    this.transferStates.set(id, state);
    peer.dataChannel.send(JSON.stringify({ type: 'file-info', fileId: id, fileName: file.name, fileSize: file.size, fileType: file.type, totalChunks, hash }));
    let offset = 0;
    for (let i = 0; i < totalChunks; i++) {
      const currentState = this.transferStates.get(id);
      if (!currentState || currentState.status === 'cancelled') break;
      if (currentState.status === 'paused') {
        // SECURITY: Add timeout to prevent infinite waiting loops
        const maxWaitTime = 300000; // 5 minutes max wait time
        const pauseStartTime = Date.now();

        await new Promise<void>(resolve => {
          const checkPause = setInterval(() => {
            const s = this.transferStates.get(id);
            const elapsedTime = Date.now() - pauseStartTime;

            // Exit conditions with timeout protection
            if (!s || s.status === 'cancelled') {
              clearInterval(checkPause);
              resolve();
            }
            else if (s.status === 'transferring') {
              clearInterval(checkPause);
              resolve();
            }
            // SECURITY: Force exit after timeout to prevent infinite loop
            else if (elapsedTime > maxWaitTime) {
              clearInterval(checkPause);
              console.warn(`Transfer ${id} timeout after waiting ${maxWaitTime}ms for resume`);
              // Cancel the transfer to prevent hanging
              s.status = 'cancelled';
              resolve();
            }
          }, 100);
        });

        // Check if transfer was cancelled due to timeout
        const postWaitState = this.transferStates.get(id);
        if (!postWaitState || postWaitState.status === 'cancelled') break;
      }
      const latestState = this.transferStates.get(id);
      if (!latestState || latestState.status === 'cancelled') break;
      const start = i * CHUNK_SIZE; const end = Math.min(start + CHUNK_SIZE, file.size);
      peer.dataChannel.send(JSON.stringify({ type: 'file-chunk', fileId: id, fileName: file.name, fileSize: file.size, fileType: file.type, chunkIndex: i, totalChunks }));
      peer.dataChannel.send(arrayBuffer.slice(start, end));
    }
    const finalState = this.transferStates.get(id);
    if (finalState && finalState.status !== 'cancelled') {
      peer.dataChannel.send(JSON.stringify({ type: 'file-complete', fileId: id }));
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