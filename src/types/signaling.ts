export interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  status: 'discovered' | 'connecting' | 'connected' | 'disconnected';
  lastSeen: number;
  avatar?: string;
  signalStrength?: number;
  ipAddress?: string;
}

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'discovery' | 'ping' | 'pong' | 'connect' | 'disconnect';
  from: string;
  to: string;
  payload?: any;
  timestamp: number;
}
