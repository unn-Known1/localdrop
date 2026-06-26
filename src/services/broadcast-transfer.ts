import { enhancedWebRTC } from './enhanced-webrtc';

export async function broadcastFile(file: File, deviceIds: string[]) {
  const results: { deviceId: string; fileId: string }[] = [];
  const errors: { deviceId: string; error: string }[] = [];

  for (const id of deviceIds) {
    const peer = enhancedWebRTC.getPeer(id);
    if (!peer || peer.status !== 'connected' || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      errors.push({ deviceId: id, error: 'Device not connected' });
      continue;
    }
    try {
      const fileId = await enhancedWebRTC.sendFile(file, id);
      results.push({ deviceId: id, fileId });
    } catch (e) {
      errors.push({ deviceId: id, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  return { results, errors };
}
