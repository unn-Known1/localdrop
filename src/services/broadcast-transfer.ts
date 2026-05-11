import { enhancedWebRTC } from './enhanced-webrtc';

export async function broadcastFile(file: File, deviceIds: string[]) {
  const tasks = deviceIds.map(id => enhancedWebRTC.sendFile(file, id));
  return Promise.all(tasks);
}
