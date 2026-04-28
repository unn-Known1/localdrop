// WebRTC Service for P2P File Transfer

export interface PeerConnection {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  status: 'connecting' | 'connected' | 'disconnected';
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  onMessage?: (data: any) => void;
  onFileChunk?: (chunk: FileChunk) => void;
  onFileComplete?: (fileId: string) => void;
}

export interface FileChunk {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;
  progress?: number;
}

export interface FileMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
}

export interface TransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  progress: number;
  speed: number;
  status: 'queued' | 'transferring' | 'paused' | 'complete' | 'failed';
  direction: 'upload' | 'download';
  error?: string;
}

export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from: string;
  to: string;
}

const CHUNK_SIZE = 65536; // 64KB chunks
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

class WebRTCService {
  private peers: Map<string, PeerConnection> = new Map();
  private localId: string = '';
  private localName: string = '';
  private pendingFiles: Map<string, { metadata: FileMetadata; chunks: ArrayBuffer[] }> = new Map();

  constructor() {
    this.localId = this.generateId();
    this.localName = this.getDeviceName();
  }

  private generateId(): string {
    // Use crypto.getRandomValues() for cryptographically secure random ID generation
    const array = new Uint32Array(4);
    crypto.getRandomValues(array);
    return Array.from(array, (dec) => dec.toString(36).padStart(6, '0')).join('');
  }

  private getDeviceName(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown Device';
  }

  getLocalInfo() {
    return {
      id: this.localId,
      name: this.localName,
    };
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const dataChannel = pc.createDataChannel('fileTransfer', {
      ordered: true,
    });

    this.setupDataChannel(dataChannel, peerId);

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection = pc;
      peer.dataChannel = dataChannel;
      peer.status = 'connecting';
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE candidate will be sent separately
      }
    };

    return offer;
  }

  async handleOffer(
    offer: RTCSessionDescriptionInit,
    peerId: string,
    peerName: string
  ): Promise<RTCSessionDescriptionInit> {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, peerId);

      const peer = this.peers.get(peerId);
      if (peer) {
        peer.dataChannel = event.channel;
        peer.status = 'connected';
      }
    };

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection = pc;
      peer.status = 'connecting';
    }

    return answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit, peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer?.connection) {
      await peer.connection.setRemoteDescription(answer);
      peer.status = 'connected';
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit, peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer?.connection) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  private setupDataChannel(channel: RTCDataChannel, peerId: string) {
    channel.onopen = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = 'connected';
      }
    };

    channel.onclose = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = 'disconnected';
      }
    };

    channel.onmessage = (event) => {
      this.handleMessage(event.data, peerId);
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  private handleMessage(data: any, peerId: string) {
    try {
      const message = JSON.parse(data);

      if (message.type === 'file-metadata') {
        this.pendingFiles.set(message.fileId, {
          metadata: message,
          chunks: [],
        });
      } else if (message.type === 'file-chunk') {
        const pending = this.pendingFiles.get(message.fileId);
        if (pending) {
          pending.chunks[message.chunkIndex] = message.data;

          const peer = this.peers.get(peerId);
          peer?.onFileChunk?.({
            fileId: message.fileId,
            fileName: message.fileName,
            fileSize: message.fileSize,
            fileType: message.fileType,
            chunkIndex: message.chunkIndex,
            totalChunks: message.totalChunks,
            data: message.data,
            progress: ((message.chunkIndex + 1) / message.totalChunks) * 100,
          });
        }
      } else if (message.type === 'file-complete') {
        const pending = this.pendingFiles.get(message.fileId);
        if (pending) {
          this.assembleFile(message.fileId, pending);
        }
      }
    } catch (error) {
      // Binary file chunk
      console.error('Error handling message:', error);
    }
  }

  private assembleFile(fileId: string, pending: { metadata: FileMetadata; chunks: ArrayBuffer[] }) {
    const blob = new Blob(pending.chunks, { type: pending.metadata.fileType });
    const url = URL.createObjectURL(blob);

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = pending.metadata.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const peer = Array.from(this.peers.values()).find(p =>
      p.dataChannel?.readyState === 'open'
    );
    peer?.onFileComplete?.(fileId);

    this.pendingFiles.delete(fileId);
  }

  addPeer(id: string, name: string, type: 'mobile' | 'desktop') {
    const peer: PeerConnection = {
      id,
      name,
      type,
      status: 'disconnected',
    };
    this.peers.set(id, peer);
    return peer;
  }

  removePeer(id: string) {
    const peer = this.peers.get(id);
    if (peer?.connection) {
      peer.connection.close();
    }
    if (peer?.dataChannel) {
      peer.dataChannel.close();
    }
    this.peers.delete(id);
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  getPeer(id: string) {
    return this.peers.get(id);
  }

  async sendFile(file: File, peerId: string): Promise<string> {
    const peer = this.peers.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') {
      throw new Error('Peer not connected');
    }

    const fileId = this.generateId();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Send metadata
    peer.dataChannel.send(JSON.stringify({
      type: 'file-metadata',
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
    }));

    // Send chunks
    const arrayBuffer = await file.arrayBuffer();
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = arrayBuffer.slice(start, end);

      peer.dataChannel.send(JSON.stringify({
        type: 'file-chunk',
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        chunkIndex: i,
        totalChunks,
      }));

      // Send binary chunk
      peer.dataChannel.send(chunk);
    }

    // Send complete
    peer.dataChannel.send(JSON.stringify({
      type: 'file-complete',
      fileId,
    }));

    return fileId;
  }

  encodeOffer(offer: RTCSessionDescriptionInit): string {
    return btoa(JSON.stringify(offer));
  }

  decodeOffer(encoded: string): RTCSessionDescriptionInit {
    return JSON.parse(atob(encoded));
  }
}

export const webrtcService = new WebRTCService();
