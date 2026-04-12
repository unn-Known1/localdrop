# Platform-Specific Guides

This guide covers setup and usage for different platforms supported by LocalDrop.

## Table of Contents

- [Browser Requirements](#browser-requirements)
- [iOS](#ios)
- [Android](#android)
- [Windows](#windows)
- [macOS](#macos)
- [Linux](#linux)
- [Troubleshooting](#troubleshooting)

---

## Browser Requirements

LocalDrop requires a modern browser with WebRTC support:

| Browser | Minimum Version |
|---------|-----------------|
| Chrome/Edge | 90+ |
| Firefox | 90+ |
| Safari | 15+ |
| Opera | 76+ |

---

## iOS

### Recommended Browser
**Safari** (15+) - Full WebRTC support and best performance

### Installation as PWA

1. Open LocalDrop in Safari
2. Tap the **Share** button (center-bottom)
3. Select **Add to Home Screen**
4. Tap **Add**
5. LocalDrop will appear as a standalone app

### Features Working on iOS

- ✅ P2P file transfer via WebRTC
- ✅ Device discovery
- ✅ QR code pairing
- ✅ File picker
- ✅ HEIC to JPEG conversion
- ✅ Transfer history
- ✅ Dark mode

### iOS Specific Notes

- **No install required** - runs directly in browser
- **AirDrop alternative** - works across iOS/Android/Desktop
- **Photos app integration** - select directly from Photos

### Known Limitations

- Background transfer not supported (keep app open)
- Some Safari privacy features may affect discovery

---

## Android

### Recommended Browser
**Chrome** (90+) - Best WebRTC and PWA support

### Installation as PWA

1. Open LocalDrop in Chrome
2. Tap the three dots (top-right)
3. Select **Add to Home Screen**
4. Confirm installation
5. LocalDrop appears as standalone app

### Features Working on Android

- ✅ Full P2P file transfer
- ✅ Device auto-discovery
- ✅ QR code scanning (via camera)
- ✅ All file types supported
- ✅ Transfer notifications

### Android Specific Notes

- **No installation required**
- Works with any file manager
- Supports receiving files to Downloads

---

## Windows

### Recommended Browsers

1. **Chrome** - Best compatibility
2. **Edge** - Good WebRTC support
3. **Firefox** - Also supported

### Running Locally

```bash
# Clone and run
git clone https://github.com/unn-Known1/localdrop.git
cd localdrop
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

### Windows Firewall

If devices don't discover each other:

1. Open **Windows Security** → **Firewall & network protection**
2. Allow apps through firewall:
   - Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - Or disable firewall temporarily for testing

### Features on Windows

- ✅ Full P2P transfer speeds
- ✅ Large file support (multi-GB)
- ✅ All browser features work
- ✅ Drag and drop from Explorer

---

## macOS

### Recommended Browsers

1. **Safari** (15+) - Native WebRTC, best performance
2. **Chrome** - Full compatibility
3. **Firefox** - Also works

### Running Locally

```bash
git clone https://github.com/unn-Known1/localdrop.git
cd localdrop
pnpm install
pnpm dev
```

### macOS Notes

- **No special configuration needed**
- **AirDrop alternative** for Android/Windows/iOS cross-transfer
- Works with all macOS browsers

### Firewall Configuration

If discovery fails:

```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --get globalstate

# For development, you may need to allow Node.js
# System Settings → Network → Firewall → Options
```

---

## Linux

### Recommended Browsers

- **Chrome** (or Chromium)
- **Firefox**
- **Edge** (via .deb or snap)

### Running Locally

```bash
# Install dependencies
git clone https://github.com/unn-Known1/localdrop.git
cd localdrop
pnpm install
pnpm dev
```

### Linux Notes

- Works with all modern browsers
- Full P2P functionality
- May need firewall configuration for device discovery

### Firewall (Ubuntu/Debian)

```bash
# Allow mDNS
sudo ufw allow 5353/udp

# Allow WebRTC ports
sudo ufw allow 3478/udp
sudo ufw allow 49152:49172/udp

# Check status
sudo ufw status
```

---

## Troubleshooting

### Devices Not Discovering Each Other

**Solutions:**

1. **Same network** - Ensure all devices on same WiFi/LAN
2. **Refresh the page** - Sometimes needs a refresh
3. **Check browser** - Try Chrome on all devices
4. **Disable VPN** - VPNs can block local discovery
5. **Check firewall** - See platform-specific sections above

### Transfer Fails

**Solutions:**

1. **Keep app open** - Don't switch tabs during transfer
2. **Check connection** - Ensure devices stay on same network
3. **Try again** - Some network hiccups are temporary
4. **Smaller files** - Try with small file first

### QR Code Not Scanning

**Solutions:**

1. **Allow camera permission**
2. **Good lighting** - Ensure QR code is well-lit
3. **Correct distance** - Hold device 6-12 inches away
4. **Clean screen** - No screen protector interference

### Speed Slower Than Expected

**Solutions:**

1. **Use WiFi 6** - For fastest transfers
2. **Ethernet** - Wired connection is fastest
3. **Close other apps** - Reduce network load
4. **Same room** - Closer devices = faster transfer

### Still Having Issues?

[Open an issue](https://github.com/unn-Known1/localdrop/issues) with:
- Device types and OS versions
- Browser used
- Network setup (same WiFi? Router model?)
- Error messages (if any)