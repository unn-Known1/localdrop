# LocalDrop Protocols

This document describes the network protocols and communication mechanisms used by LocalDrop.

## Overview

LocalDrop uses a multi-layer architecture for device discovery and peer-to-peer file transfer:

```
┌─────────────────────────────────────────────────┐
│              LocalDrop Application              │
├─────────────────────────────────────────────────┤
│  Device Discovery  │  WebRTC P2P Transfer      │
│  (BroadcastChannel │  (DataChannels)           │
│   + WebSocket)     │                           │
├─────────────────────────────────────────────────┤
│            Network Layer (TCP/UDP)              │
└─────────────────────────────────────────────────┘
```

## Device Discovery Protocol

### Discovery Mechanism

LocalDrop uses three complementary discovery mechanisms:

1. **BroadcastChannel API** — Primary discovery within same browser context
2. **localStorage Events** — Cross-tab discovery fallback
3. **WebSocket Signaling** — Network-wide device discovery via signaling server

### Discovery Message Types

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `discovery` | Broadcast | Announce device presence |
| `ping` | Unicast | Liveness check |
| `pong` | Unicast | Liveness response |
| `connect` | Unicast | Initiate connection |
| `disconnect` | Unicast | Notify disconnection |

### Discovery Payload

```typescript
interface DiscoveryPayload {
  name: string;      // Device name (e.g., "iPhone 14")
  type: 'mobile' | 'desktop';
  id: string;         // Unique device ID
}
```

### Discovery Flow

1. On app start, each device generates a unique ID
2. Device broadcasts presence every 5 seconds
3. Receiving devices add sender to discovered list
4. Stale devices (>60s without ping) are removed

## WebRTC Signaling

### Signaling Flow

LocalDrop uses both local BroadcastChannel and WebSocket for signaling:

```
Device A                          Device B
   │                                 │
   ├───── discovery (broadcast) ──► │
   │                                 │
   │ ◄─────── pong ─────────────────┤
   │                                 │
   │ ───── offer ──────────────────►│
   │                                 │
   │ ◄──── answer ──────────────────┤
   │                                 │
   │ ◄─── ICE candidates ───────────┤
   │                                 │
   │ ─── WebRTC connected ──────────►│
   │                                 │
   │ ◄─── P2P file transfer ────────│
```

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `offer` | Offerer → Answerer | SDP offer for connection |
| `answer` | Answerer → Offerer | SDP answer |
| `ice-candidate` | Bidirectional | ICE candidates for NAT traversal |

## WebRTC Data Channel

### Channel Configuration

```typescript
const dataChannel = pc.createDataChannel('fileTransfer', {
  ordered: true,  // Ensure in-order delivery
});
```

### Transfer Protocol

Files are transferred in chunks with the following message types:

| Type | Purpose |
|------|---------|
| `file-info` | File metadata (name, size, type, chunk count) |
| Binary chunk | 4-byte index header + chunk data |
| `file-complete` | Transfer completion signal |
| `chunk-ack` | Acknowledgment for each chunk |
| `file-pause` | Pause transfer |
| `file-resume` | Resume transfer |
| `file-cancel` | Cancel transfer |

### Chunk Format

Each binary chunk includes a 4-byte header:

```
┌──────────────────────┬──────────────────────┐
│   Chunk Index (4B)   │   Chunk Data (N)     │
│   Big-endian uint32  │   ArrayBuffer        │
└──────────────────────┴──────────────────────┘
```

### Chunk Size

Default chunk size: **256 KB** (262,144 bytes)

This size is optimized for:
- Browser memory constraints
- Network MTU compatibility
- Progress update frequency

## ICE Configuration

### STUN Servers

LocalDrop uses a randomized subset of public STUN servers:

```typescript
const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  // ... more servers
];
```

### TURN Servers

For networks with symmetric NAT, TURN servers are available as fallback:

```typescript
{
  urls: 'turn:openrelay.metered.ca:80',
  username: 'openrelayproject',
  credential: 'openrelayproject',
}
```

## Network Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 5353 | UDP | mDNS/Bonjour discovery |
| 3478 | UDP | STUN (WebRTC) |
| 8000-9000 | UDP | WebRTC ICE candidates |

## Security

### Data Integrity

- SHA-256 hash verification for transferred files
- Final file hash is compared to sender's hash
- Chunk-level validation via acknowledgments

### PIN Protection

- Optional PIN protection using PBKDF2 hashing
- 100,000 iterations for key derivation
- Constant-time hash comparison to prevent timing attacks

### Privacy

- All transfers are P2P (no server storage)
- No data leaves local network
- Randomized STUN server selection to prevent fingerprinting

## Browser APIs Used

| API | Purpose |
|-----|---------|
| BroadcastChannel | Cross-tab/device discovery |
| WebRTC (RTCPeerConnection) | P2P connections |
| RTCDataChannel | File transfer |
| localStorage + storage event | Discovery fallback |
| IndexedDB | Transfer history and settings |
| Web Workers | Background chunk processing |
| crypto.subtle | PIN hashing and file verification |

## Error Handling

| Error | Handling |
|-------|----------|
| Peer not connected | Automatic retry with connection timeout |
| Transfer interrupted | Pause/resume support |
| Connection failed | ICE restart attempt |
| WebSocket unavailable | Falls back to local-only discovery |
