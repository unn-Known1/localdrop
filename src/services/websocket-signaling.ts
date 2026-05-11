import { SignalMessage } from '../types';

export class WebSocketSignaling {
  private ws: WebSocket | null = null;
  private onMessageCallback?: (message: SignalMessage) => void;
  private url: string;

  constructor(url: string = 'wss://signaling.localdrop.io') {
    this.url = url;
  }

  connect(onMessage: (message: SignalMessage) => void) {
    this.onMessageCallback = onMessage;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.onMessageCallback?.(message);
        } catch (e) {
          console.error('Failed to parse signaling message', e);
        }
      };

      this.ws.onclose = () => {
        // Auto-reconnect after 10 seconds
        setTimeout(() => this.connect(onMessage), 10000);
      };

      this.ws.onerror = () => {
        console.warn('WebSocket signaling server unavailable. Falling back to local-only discovery.');
      };
    } catch (e) {
      console.warn('WebSocket connection failed', e);
    }
  }

  send(message: SignalMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const wsSignaling = new WebSocketSignaling();
