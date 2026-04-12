# LocalDrop Protocols

This document describes the network protocols and communication mechanisms used by LocalDrop.

## Overview

LocalDrop uses a multi-layer architecture for device discovery and peer-to-peer file transfer:

```
┌─────────────────────────────────────────────────┐
│              LocalDrop Application              │
├─────────────────────────────────────────────────┤
│  Device Discovery  │  WebRTC P2P Transfer     │
│  (mDNS + Broadcast) │  (DataChannels)         │
├─────────────────────────────────────────────────┤
│            Network Layer (TCP/UDP)             │
└─────────────────────────────────────────────────┘
```

## Device Discovery Protocol

### Discovery Mechanism

LocalDrop uses two complementary discovery mechanisms:

1. **BroadcastChannel API** - Primary discovery within same browser context
2. **localStorage Events** - Cross-tab discovery fallback
3. **mDNS/Bonjour** - Network-wide device discovery (via bonjour-h5)

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

Since LocalDrop uses local network P2P, it uses a simplified signaling model:

```
Device A                          Device B
   │                                 │
   ├───── discovery (broadcast) ──► │
   │                                 │
   │ ◄─────── pong ─────────────────┤
   │                                 │
   │ ───── offer (via broadcast) ──►│
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

### SDP Exchange

The SDP (Session Description Protocol) is exchanged via the BroadcastChannel, encoded as base64:

```typescript
// Encoding
const encodedOffer = btoa(JSON.stringify(offer));

// Decoding
const offer = JSON.parse(atob(encodedOffer));
```

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
| `file-metadata` | File info (name, size, type, chunk count) |
| `file-chunk` | Binary chunk data |
| `file-complete` | Transfer completion signal |

### Chunk Format

```typescript
interface FileChunk {
  type: 'file-chunk';
  fileId: string;        // Unique transfer ID
  fileName: string;       // Original filename
  fileSize: number;      // Total file size in bytes
  fileType: string;       // MIME type
  chunkIndex: number;     // Current chunk (0-based)
  totalChunks: number;   // Total number of chunks
  data: ArrayBuffer;     // Binary chunk data
}
```

### Chunk Size

Default chunk size: **64 KB** (65,536 bytes)

This size is optimized for:
- Browser memory constraints
- Network MTU compatibility
- Progress update frequency

## ICE Configuration

### STUN Servers

LocalDrop uses Google's public STUN servers:

```typescript
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
```

### NAT Traversal

For local network transfers, ICE typically succeeds immediately since devices are on the same private network. STUN is primarily used as a fallback.

## Network Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 5353 | UDP | mDNS/Bonjour discovery |
| 3478 | UDP | STUN (WebRTC) |
| 49152-49172 | UDP | WebRTC ICE candidates |

## Security

### Data Integrity

- SHA-256 hash verification for transferred files
- Each chunk is validated during transfer
- Final file hash is compared to original

### Privacy

- All transfers are P2P (no server storage)
- No data leaves local network
- No authentication required for local use

## Browser APIs Used

| API | Purpose |
|-----|---------|
| BroadcastChannel | Cross-tab/device discovery |
| WebRTC (RTCPeerConnection) | P2P connections |
| RTCDataChannel | File transfer |
| localStorage + storage event | Discovery fallback |
| IndexedDB | Transfer history storage |

## Error Handling

| Error | Handling |
|-------|----------|
| Peer not connected | Retry with exponential backoff |
| Transfer interrupted | Support pause/resume (future) |
| Browser compatibility | Show compatibility warning |

## Future Enhancements

- TURN server fallback for NAT traversal
- Encrypted signaling
- Transfer queue management
- Bandwidth estimation