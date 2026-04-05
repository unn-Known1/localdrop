# LocalDrop - Local File Transfer

<p align="center">
  <strong>Secure, peer-to-peer file transfer between devices on your local network</strong>
</p>

## Features

- **WebRTC P2P** - Direct device-to-device transfer using WebRTC DataChannels
- **Cross-Platform** - Works on iOS, Android, Windows, macOS, and Linux
- **Local Network Only** - All data stays on your network, no cloud uploads
- **QR Code Pairing** - Easy device connection via QR codes
- **Pause/Resume** - Transfer large files without starting over
- **File Verification** - SHA-256 hash verification ensures data integrity
- **Image Compression** - Reduce file sizes before transfer
- **HEIC Support** - Automatically converts iPhone HEIC photos to JPEG
- **PIN Protection** - Optional PIN lock for app access
- **Transfer History** - Track all your transfers with statistics
- **Dark Mode** - Beautiful dark theme optimized for OLED displays

## Quick Start

### Option 1: Open Directly (Recommended)

Simply open the app in your browser on all devices. All devices must be on the same local network (WiFi).

### Option 2: Run Locally

```bash
git clone https://github.com/yourusername/localdrop.git
cd localdrop
pnpm install
pnpm dev
```

## How It Works

1. Open the app on two or more devices connected to the same WiFi
2. Devices auto-discover each other (or use QR codes for faster pairing)
3. Select files to send from one device
4. Choose a device to send to
5. Accept the transfer on the receiving device
6. Files are transferred directly between devices (P2P)

## Tech Stack

- React 18, TypeScript, Vite, Tailwind CSS
- WebRTC for peer-to-peer connections
- IndexedDB for local storage
- SHA-256 for file verification

## Security

- All transfers happen directly between devices (P2P)
- No data is uploaded to any server
- Files are verified using SHA-256 hashes
- Optional PIN protection for app access

## License

MIT License - feel free to use this project for any purpose.
