# 🚀 LocalDrop - Secure P2P File Transfer

<p align="center">
  <strong>Fast, private, peer-to-peer file sharing directly between devices. No cloud, no tracking, just your local network.</strong>
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
  <a href="https://github.com/unn-Known1/localdrop/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/unn-Known1/localdrop/ci.yml?style=flat-square" alt="CI Status">
  </a>
</p>

---

LocalDrop is a modern, high-performance web application designed for secure and instant file sharing between devices on the same network. Built with **WebRTC**, it establishes direct device-to-device connections, ensuring your data never touches the cloud.

## ✨ Key Features

- 🔒 **Privacy First**: Direct P2P transfers using WebRTC DataChannels. Your files are never stored on any server.
- 🚀 **Blazing Fast**: Transfers at the maximum speed of your local network (WiFi/Ethernet).
- 📂 **Folder Support**: Seamlessly transfer entire directory structures while preserving folder hierarchy.
- 📡 **Multi-Device Broadcast**: Send files to multiple connected devices simultaneously with one click.
- ⏯️ **Resumable Transfers**: Intelligent chunk-based system that can resume large file transfers if interrupted.
- 📱 **Cross-Platform**: Works perfectly on iOS, Android, Windows, macOS, and Linux via any modern browser.
- 🛠️ **No Setup Required**: No apps to install. Just open the URL and start sharing.
- 🛡️ **Secure Access**: Optional **PBKDF2-hardened PIN protection** to control who can access the app on your device.
- 🖼️ **Image Optimization**: Built-in compression and HEIC to JPEG conversion for faster sharing of mobile photos.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **P2P Communication**: WebRTC (DataChannels)
- **Signaling**: WebSocket Bridge + BroadcastChannel API
- **Reliability**: Integrated STUN/TURN servers for NAT traversal
- **Security**: Web Crypto API (PBKDF2, SHA-256)
- **Storage**: IndexedDB for transfer history and settings
- **CI/CD**: GitHub Actions for automated verification

## 🚀 Quick Start

### 1. Open the App
Simply open LocalDrop in your browser on all devices you want to share between.

### 2. Discover Devices
Devices on the same network will automatically discover each other via the WebSocket signaling bridge. For faster pairing, use the **QR Code** feature.

### 3. Send Files
Drag and drop files or folders into the transfer zone, select your target device(s), and hit **Send**.

## 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/unn-Known1/localdrop.git

# Install dependencies
npm install

# Start the development server
npm run dev

# Run the test suite
npm test

# Build for production
npm run build
```

## 🛡️ Security & Privacy

- **End-to-End P2P**: Data is encrypted and sent directly between devices.
- **Zero Cloud Storage**: No files, metadata, or user info are ever uploaded to a server.
- **SHA-256 Verification**: Every file is verified with a cryptographic hash after transfer to ensure data integrity.
- **Sanitized Filenames**: Automatic protection against path traversal and dangerous characters.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for a more private internet.
</p>
