# LocalDrop - Local File Transfer

<p align="center">
  <strong>Secure, peer-to-peer file transfer between devices on your local network</strong>
</p>

<p align="center">
  <a href="https://github.com/unn-Known1/localdrop/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/unn-Known1/localdrop?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/unn-Known1/localdrop/pulls">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome">
  </a>
  <a href="https://github.com/unn-Known1/localdrop/stargazers">
    <img src="https://img.shields.io/github/stars/unn-Known1/localdrop?style=flat-square" alt="Stars">
  </a>
  <a href="https://github.com/unn-Known1/localdrop/issues">
    <img src="https://img.shields.io/github/issues/unn-Known1/localdrop?style=flat-square" alt="Issues">
  </a>
  <img src="https://img.shields.io/github/languages/count/unn-Known1/localdrop?style=flat-square" alt="Languages">
</p>

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Platform Compatibility](#platform-compatibility)
- [How It Works](#how-it-works)
- [Network Setup](#network-setup)
- [Speed Benchmarks](#speed-benchmarks)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### Option 1: Open Directly (Recommended)

Simply open the app in your browser on all devices. All devices must be on the same local network (WiFi).

**No installation required** - just open the hosted version or run locally.

### Option 2: Run Locally

```bash
git clone https://github.com/unn-Known1/localdrop.git
cd localdrop
pnpm install
pnpm dev
```

Then open `http://localhost:5173` in your browser.

---

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
- **No Server Required** - Runs entirely in your browser

---

## Platform Compatibility

| Platform | Browser Support | Notes |
|----------|-----------------|-------|
| **iOS** | Safari 15+ | Full support with PWA capability |
| **Android** | Chrome 90+ | Full support with PWA capability |
| **Windows** | Chrome, Firefox, Edge 90+ | Full support |
| **macOS** | Safari, Chrome, Firefox 90+ | Full support |
| **Linux** | Chrome, Firefox, Edge 90+ | Full support |

### Requirements
- Modern browser with WebRTC support
- All devices on the same local network
- mDNS/avahi for automatic device discovery

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL NETWORK                               │
│                                                                  │
│   ┌─────────┐      mDNS Discovery      ┌─────────┐             │
│   │ Device  │ ◄──────────────────────► │ Device  │             │
│   │    A    │                          │    B    │             │
│   └────┬────┘                          └────┬────┘             │
│        │                                      │                  │
│        │     WebRTC DataChannel (P2P)        │                  │
│        ══════════════════════════════════════╝                  │
│                                                                  │
│   Files transfer DIRECTLY between devices - no server!          │
└─────────────────────────────────────────────────────────────────┘
```

1. Open the app on two or more devices connected to the same WiFi
2. Devices auto-discover each other (or use QR codes for faster pairing)
3. Select files to send from one device
4. Choose a device to send to
5. Accept the transfer on the receiving device
6. Files are transferred directly between devices (P2P)

---

## Network Setup

### Firewall Requirements

For device discovery and P2P transfers to work, ensure:

| Port | Protocol | Purpose |
|------|----------|---------|
| 5353 | UDP | mDNS for device discovery |
| 3478 | UDP | STUN for WebRTC |
| 49152-49172 | UDP | WebRTC ICE candidates |

### Common Issues

- **Devices not showing up**: Check that mDNS is enabled on your router
- **Transfer fails**: Verify firewall allows the ports above
- **Works on some networks**: Some routers block peer-to-peer connections

---

## Speed Benchmarks

Typical transfer speeds on local network:

| File Type | Size | Average Speed |
|-----------|------|---------------|
| Photos (JPG) | 10 MB | ~50-100 MB/s |
| Videos (MP4) | 500 MB | ~80-150 MB/s |
| Documents | 5 MB | ~30-80 MB/s |
| Archives | 1 GB | ~100-200 MB/s |

*Speeds depend on network hardware. WiFi 6 and Ethernet connections will achieve the highest speeds.*

---

## Security

- **End-to-End P2P**: All transfers happen directly between devices
- **No Cloud Uploads**: Data never leaves your local network
- **SHA-256 Verification**: Files are verified to ensure data integrity
- **Optional PIN Protection**: Lock app access with a PIN
- **No Server Storage**: Nothing is stored on external servers

### Privacy

LocalDrop does NOT:
- Collect any user data
- Send analytics or telemetry
- Store files on any server
- Require account or login

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **P2P Communication**: WebRTC DataChannels
- **Discovery**: mDNS (via bonjour-h5)
- **Local Storage**: IndexedDB
- **File Verification**: SHA-256

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

### Ways to Contribute

- 🐛 Report bugs by opening an issue
- 💡 Suggest new features
- 📖 Improve documentation
- 🔧 Submit pull requests

### Good First Issues

Looking for ways to contribute? Check out these beginner-friendly tasks:
- [Add QR code for easy device pairing](https://github.com/unn-Known1/localdrop/issues)
- [Document firewall configuration](https://github.com/unn-Known1/localdrop/issues)

---

## License

MIT License - feel free to use this project for any purpose.

---

<p align="center">
  Built with ❤️ using WebRTC
</p>