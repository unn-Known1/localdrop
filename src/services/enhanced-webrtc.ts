// Enhanced WebRTC Service with Chunked Transfer, Pause/Resume, and Hash Verification
import { signalingService, Device } from './signaling';
const CHUNK_SIZE = 65536;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun2.l.google.com:19302' }];
export interface FileInfo { fileId: string; fileName: string; fileSize: number; fileType: string; totalChunks: number; hash?: string; }
export interface ChunkProgress { fileId: string; chunkIndex: number; received: boolean; hash?: string; }
export interface TransferState { fileId: string; fileName: string; fileSize: number; fileType: string; totalChunks: number; receivedChunks: ChunkProgress[]; status: 'pending' | 'paused' | 'transferring' | 'complete' | 'failed' | 'verifying'; progress: number; speed: number; startTime?: number; deviceId: string; direction: 'upload' | 'download'; error?: string; }
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
    const fileInfo: FileInfo = { fileId: message.fileId, fileName: message.fileName, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, hash: message.hash };
    this.pendingFiles.set(message.fileId, fileInfo);
    this.receivedChunks.set(message.fileId, []);
    const state: TransferState = { fileId: message.fileId, fileName: message.fileName, fileSize: message.fileSize, fileType: message.fileType, totalChunks: message.totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'download' };
    this.transferStates.set(message.fileId, state);
    this.callbacks.get(deviceId)?.onProgress?.(state);
  }

  private async handleBinaryChunk(data: ArrayBuffer, deviceId: string) {
    for (const [fileId, fileInfo] of this.pendingFiles) {
      const received = this.receivedChunks.get(fileId);
      if (received && received.length < fileInfo.totalChunks) {
        received.push(data);
        const progress = (received.length / fileInfo.totalChunks) * 100;
        const state = this.transferStates.get(fileId);
        if (state) {
          state.progress = progress;
          state.receivedChunks.push({ fileId, chunkIndex: received.length - 1, received: true });
          const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000;
          state.speed = (received.length * CHUNK_SIZE) / elapsed;
          this.callbacks.get(deviceId)?.onProgress?.(state);
        }
        const peer = this.peers.get(deviceId);
        peer?.dataChannel?.send(JSON.stringify({ type: 'chunk-ack', fileId, chunkIndex: received.length - 1 }));
        break;
      }
    }
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
          const blob = new Blob(chunks, { type: state.fileType });
          const file = new File([blob], state.fileName);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = state.fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          this.callbacks.get(deviceId)?.onComplete?.(fileId, file);
        }
      } else { state.status = 'failed'; state.error = 'File verification failed'; this.callbacks.get(deviceId)?.onError?.(fileId, 'File verification failed'); }
      this.callbacks.get(deviceId)?.onProgress?.(state);
      this.callbacks.get(deviceId)?.onVerificationComplete?.(fileId, verified);
      setTimeout(() => { this.cleanup(fileId); }, 5000);
    }
  }

  private handleFilePause(message: any) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'paused'; this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleFileResume(message: any) { const state = this.transferStates.get(message.fileId); if (state) { state.status = 'transferring'; state.startTime = Date.now(); this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleChunkAck(message: any) { const state = this.transferStates.get(message.fileId); if (state && state.direction === 'upload') { const ackIndex = message.chunkIndex; state.progress = ((ackIndex + 1) / state.totalChunks) * 100; const elapsed = (Date.now() - (state.startTime || Date.now())) / 1000; state.speed = ((ackIndex + 1) * CHUNK_SIZE) / elapsed; this.callbacks.get(state.deviceId)?.onProgress?.(state); } }
  private handleFileCancel(message: any) { this.cleanup(message.fileId); }

  async sendFile(file: File, deviceId: string): Promise<string> {
    const peer = this.peers.get(deviceId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') throw new Error('Peer not connected');
    const fileId = Math.random().toString(36).substring(2, 15);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const arrayBuffer = await file.arrayBuffer();
    const hash = await this.hashChunk(arrayBuffer);
    const state: TransferState = { fileId, fileName: file.name, fileSize: file.size, fileType: file.type, totalChunks, receivedChunks: [], status: 'transferring', progress: 0, speed: 0, startTime: Date.now(), deviceId, direction: 'upload' };
    this.transferStates.set(fileId, state);
    peer.dataChannel.send(JSON.stringify({ type: 'file-info', fileId, fileName: file.name, fileSize: file.size, fileType: file.type, totalChunks, hash }));
    let offset = 0;
    for (let i = 0; i < totalChunks; i++) {
      const currentState = this.transferStates.get(fileId);
      if (currentState?.status === 'paused') await new Promise<void>(resolve => { const checkResume = setInterval(() => { const s = this.transferStates.get(fileId); if (s?.status === 'transferring') { clearInterval(checkResume); resolve(); } }, 100); });
      const start = i * CHUNK_SIZE; const end = Math.min(start + CHUNK_SIZE, file.size);
      peer.dataChannel.send(JSON.stringify({ type: 'file-chunk', fileId, fileName: file.name, fileSize: file.size, fileType: file.type, chunkIndex: i, totalChunks }));
      peer.dataChannel.send(arrayBuffer.slice(start, end));
    }
    peer.dataChannel.send(JSON.stringify({ type: 'file-complete', fileId }));
    return fileId;
  }

  pauseTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { state.status = 'paused'; this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-pause', fileId })); } }
  resumeTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { state.status = 'transferring'; this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-resume', fileId, fromChunk: state.receivedChunks.length })); } }
  cancelTransfer(fileId: string) { const state = this.transferStates.get(fileId); if (state) { this.peers.get(state.deviceId)?.dataChannel?.send(JSON.stringify({ type: 'file-cancel', fileId })); this.cleanup(fileId); } }
  getTransferState(fileId: string): TransferState | undefined { return this.transferStates.get(fileId); }
  getAllTransferStates(): TransferState[] { return Array.from(this.transferStates.values()); }
  registerCallback(deviceId: string, callback: TransferCallback) { this.callbacks.set(deviceId, callback); }
  removePeer(deviceId: string) { const peer = this.peers.get(deviceId); if (peer) { peer.connection?.close(); peer.dataChannel?.close(); this.peers.delete(deviceId); } }
  getPeers(): PeerConnection[] { return Array.from(this.peers.values()); }
  getPeer(id: string): PeerConnection | undefined { return this.peers.get(id); }
  private cleanup(fileId: string) { this.pendingFiles.delete(fileId); this.receivedChunks.delete(fileId); this.transferStates.delete(fileId); }
}
export const enhancedWebRTC = new EnhancedWebRTC();