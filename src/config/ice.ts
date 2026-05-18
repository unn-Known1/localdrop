// STUN server pool for randomization
const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.stunprotocol.org:3478',
  'stun:stun.freeswitch.org:3478',
] as const;

// Get a randomized subset of STUN servers to prevent fingerprinting
function getRandomizedStunServers(count: number = 2): RTCIceServer[] {
  const shuffled = [...STUN_SERVERS].sort(() => crypto.getRandomValues(new Uint32Array(1))[0] / (0xFFFFFFFF + 1) - 0.5);
  return shuffled.slice(0, count).map(url => ({ urls: url }));
}

export const ICE_SERVERS: RTCIceServer[] = [
  // Randomized STUN servers from pool (dynamically selected on load)
  ...getRandomizedStunServers(2),

  // Public TURN servers (using free tier from Metered.ca as example/fallback)
  // In production, these should be replaced with private authenticated servers
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
