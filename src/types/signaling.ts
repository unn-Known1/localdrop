import { Device as BaseDevice } from './device';

export type Device = BaseDevice;

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'discovery' | 'ping' | 'pong' | 'connect' | 'disconnect';
  from: string;
  to: string;
  payload?: unknown;
  timestamp: number;
}
