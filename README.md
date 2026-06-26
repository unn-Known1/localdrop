# LocalDrop — P2P File Transfer Over Your Local Network

Send files between devices on the same network — **instantly, privately, and without a server**.

![WebRTC](https://img.shields.io/badge/WebRTC-P2P-blue?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge)
![Privacy](https://img.shields.io/badge/Privacy-Serverless-green?style=for-the-badge)

## Features

- **Blazing fast** — local network speeds, no upload/download caps
- **Fully private** — WebRTC data channel, files never touch a server
- **Works everywhere** — browser on any device, no app install needed
- **QR code sharing** — scan to connect instantly, no typing IPs
- **No sign-up** — just open the page and share
- **Clipboard paste** — paste images/files directly from clipboard
- **Concurrent transfers** — send/receive multiple files simultaneously
- **Pause/resume** — pause and resume transfers at any time
- **Connection recovery** — automatic ICE restart on connection failures

## Quick Start

```bash
git clone https://github.com/unn-known1/localdrop.git
cd localdrop
npm install
npm run dev
```

Open `http://localhost:3000` — share the URL with devices on the same network.

## How It Works

1. Open LocalDrop on both devices
2. Device A shares the session link (QR code or URL)
3. Device B opens it and connects via WebRTC
4. Drop files — they transfer directly peer-to-peer

## Stack

- **Frontend:** React + TypeScript
- **Networking:** WebRTC (data channels)
- **Signaling:** BroadcastChannel + WebSocket
- **Styling:** Tailwind CSS
- **No backend** — 100% client-side

## Use Cases

- Send photos/videos to your laptop from your phone
- Share large files at home without cloud uploads
- Offline file transfer at meetups/conferences
- Quick workspace file sharing without USB drives

## License

MIT License — built by [Gaurang Patel](https://github.com/unn-known1)
