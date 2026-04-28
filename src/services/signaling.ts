// Signaling Service for WebRTC P2P Connections
export interface Device { id: string; name: string; type: 'mobile' | 'desktop'; status: 'discovered' | 'connecting' | 'connected' | 'disconnected'; lastSeen: number; avatar?: string; signalStrength?: number; ipAddress?: string; }
export interface SignalMessage { type: 'offer' | 'answer' | 'ice-candidate' | 'discovery' | 'ping' | 'pong' | 'connect' | 'disconnect'; from: string; to: string; payload?: any; timestamp: number; }
class SignalingService {
  private localId: string = '';
  private localName: string = '';
  private localType: 'mobile' | 'desktop' = 'desktop';
  private isRunning: boolean = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private discoveredDevices: Map<string, Device> = new Map();
  private onDeviceDiscovered?: (device: Device) => void;
  private onDeviceConnected?: (device: Device) => void;
  private onDeviceDisconnected?: (deviceId: string) => void;
  private onSignalReceived?: (message: SignalMessage) => void;
  private pingInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private initialized: boolean = false;

  constructor() {}

  private initialize() {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.localId = this.generateId();
      this.localName = this.getDeviceName();
      this.localType = /mobile|iphone|android|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    } else {
      this.localId = 'server-' + this.generateId();
      this.localName = 'Server';
    }
  }

  private generateId(): string {
    // Use crypto.getRandomValues() for cryptographically secure random ID generation
    const array = new Uint32Array(4);
    crypto.getRandomValues(array);
    return Array.from(array, (dec) => dec.toString(36).padStart(6, '0')).join('');
  }
  private getDeviceName(): string {
    if (typeof navigator === 'undefined') return 'Device';
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Device';
  }

  start(options?: { onDeviceDiscovered?: (device: Device) => void; onDeviceConnected?: (device: Device) => void; onDeviceDisconnected?: (deviceId: string) => void; onSignalReceived?: (message: SignalMessage) => void; }) {
    if (this.isRunning) return;
    this.initialize();
    this.onDeviceDiscovered = options?.onDeviceDiscovered;
    this.onDeviceConnected = options?.onDeviceConnected;
    this.onDeviceDisconnected = options?.onDeviceDisconnected;
    this.onSignalReceived = options?.onSignalReceived;
    try { this.broadcastChannel = new BroadcastChannel('localdrop-signaling'); this.broadcastChannel.onmessage = (event) => { this.handleMessage(event.data); }; } catch (e) { console.warn('BroadcastChannel not supported'); }
    this.broadcastPresence();
    this.pingInterval = window.setInterval(() => { this.broadcastPresence(); }, 5000);
    this.cleanupInterval = window.setInterval(() => { this.cleanupStaleDevices(); }, 15000);
    window.addEventListener('storage', this.handleStorageEvent);
    this.isRunning = true;
  }

  stop() {
    if (!this.isRunning) return;
    this.broadcastChannel?.close();
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    window.removeEventListener('storage', this.handleStorageEvent);
    this.isRunning = false;
  }

  private broadcastPresence() {
    const message: SignalMessage = { type: 'discovery', from: this.localId, to: 'broadcast', payload: { name: this.localName, type: this.localType }, timestamp: Date.now() };
    this.sendMessage(message);
  }

  private sendMessage(message: SignalMessage) {
    try {
      this.initialize();
      this.broadcastChannel?.postMessage(message);
      if (typeof localStorage !== 'undefined') {
        const key = `localdrop_${message.type}_${message.to}_${message.timestamp}`;
        localStorage.setItem(key, JSON.stringify(message));
        setTimeout(() => { try { localStorage.removeItem(key); } catch (e) {} }, 5000);
      }
    } catch (error) { console.error('Failed to send message:', error); }
  }

  private handleMessage(message: SignalMessage) {
    if (message.from === this.localId) return;
    switch (message.type) {
      case 'discovery': this.handleDiscovery(message); break;
      case 'ping': this.handlePing(message); break;
      case 'pong': this.handlePong(message); break;
      case 'connect': this.handleConnect(message); break;
      case 'disconnect': this.handleDisconnect(message); break;
      case 'offer': case 'answer': case 'ice-candidate': this.onSignalReceived?.(message); break;
    }
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (!event.key?.startsWith('localdrop_')) return;
    try { const message = JSON.parse(event.newValue || ''); if (message && typeof message === 'object') this.handleMessage(message); } catch (error) {}
  };

  private handleDiscovery(message: SignalMessage) {
    const device: Device = { id: message.from, name: message.payload?.name || 'Unknown', type: message.payload?.type || 'desktop', status: 'discovered', lastSeen: message.timestamp };
    const existingDevice = this.discoveredDevices.get(device.id);
    if (!existingDevice) { this.discoveredDevices.set(device.id, device); this.onDeviceDiscovered?.(device); } else { existingDevice.lastSeen = message.timestamp; existingDevice.name = device.name; existingDevice.type = device.type; }
    this.sendPong(message.from);
  }

  private handlePing(message: SignalMessage) { this.sendPong(message.from); }
  private handlePong(message: SignalMessage) { const device = this.discoveredDevices.get(message.from); if (device) { device.lastSeen = message.timestamp; device.signalStrength = this.calculateSignalStrength(message.timestamp); } }
  private sendPong(toId: string) { const message: SignalMessage = { type: 'pong', from: this.localId, to: toId, timestamp: Date.now() }; this.sendMessage(message); }
  private handleConnect(message: SignalMessage) { const device = this.discoveredDevices.get(message.from); if (device) { device.status = 'connected'; this.onDeviceConnected?.(device); } }
  private handleDisconnect(message: SignalMessage) { const device = this.discoveredDevices.get(message.from); if (device) { device.status = 'disconnected'; this.onDeviceDisconnected?.(message.from); } }
  private calculateSignalStrength(lastSeen: number): number { const age = Date.now() - lastSeen; if (age < 1000) return 100; if (age < 5000) return 80; if (age < 10000) return 60; if (age < 30000) return 40; return 20; }
  private cleanupStaleDevices() { const now = Date.now(); for (const [id, device] of this.discoveredDevices) { if (now - device.lastSeen > 60000) { this.discoveredDevices.delete(id); this.onDeviceDisconnected?.(id); } } }
  connect(deviceId: string) { const message: SignalMessage = { type: 'connect', from: this.localId, to: deviceId, timestamp: Date.now() }; this.sendMessage(message); }
  disconnect(deviceId: string) { const message: SignalMessage = { type: 'disconnect', from: this.localId, to: deviceId, timestamp: Date.now() }; this.sendMessage(message); }
  sendSignal(toId: string, signal: Partial<SignalMessage>) { const message: SignalMessage = { type: signal.type as any, from: this.localId, to: toId, payload: signal.payload, timestamp: Date.now() }; this.sendMessage(message); }
  getDevices(): Device[] { return Array.from(this.discoveredDevices.values()); }
  getDevice(id: string): Device | undefined { return this.discoveredDevices.get(id); }
  getLocalInfo() { this.initialize(); return { id: this.localId || 'unknown', name: this.localName || 'Device', type: this.localType }; }
  setLocalName(name: string) { this.localName = name; this.broadcastPresence(); }
}
export const signalingService = new SignalingService();