import { SignalMessage } from '../types';

export class WebSocketSignaling {
  private ws: WebSocket | null = null;
  private onMessageCallback?: (message: SignalMessage) => void;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private isConnecting = false;

  constructor(url: string = 'wss://signaling.localdrop.io') {
    this.url = url;
  }

  connect(onMessage: (message: SignalMessage) => void) {
    this.onMessageCallback = onMessage;
    this.attemptConnect();
  }

  private attemptConnect() {
    if (this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.onMessageCallback?.(message);
        } catch (e) {
          console.error('Failed to parse signaling message', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;
        setTimeout(() => this.attemptConnect(), delay);
      };

      this.ws.onerror = () => {
        console.warn('WebSocket signaling server unavailable. Falling back to local-only discovery.');
      };
    } catch (e) {
      this.isConnecting = false;
      console.warn('WebSocket connection failed', e);
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      setTimeout(() => this.attemptConnect(), delay);
    }
  }

  send(message: SignalMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const wsSignaling = new WebSocketSignaling();
