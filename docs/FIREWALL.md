# Firewall Configuration Guide for LocalDrop

This guide covers firewall configuration for successful LocalDrop connections across different platforms and networks.

## Table of Contents
- [Required Ports](#required-ports)
- [Windows Firewall](#windows-firewall)
- [macOS Firewall](#macos-firewall)
- [Linux (iptables/nftables)](#linux-iptablesnftables)
- [Router Configuration](#router-configuration)
- [Browser-Specific Settings](#browser-specific-settings)
- [Troubleshooting](#troubleshooting)

---

## Required Ports

LocalDrop uses the following ports for P2P communication:

| Port | Protocol | Purpose | Required |
|------|----------|---------|----------|
| **5353** | UDP | mDNS (device discovery) | ✅ Yes |
| **3478** | UDP | STUN (NAT traversal) | ✅ Yes |
| **8000-9000** | UDP | WebRTC data channels | ✅ For transfers |
| **443** | TCP | HTTPS (fallback) | ✅ Sometimes |

### Why These Ports Matter
- **mDNS (5353 UDP)**: Allows devices to discover each other on local network without knowing IP addresses
- **STUN (3478 UDP)**: Helps establish direct peer-to-peer connections through NAT/firewalls
- **WebRTC (8000-9000 UDP)**: Actual data transfer between peers

---

## Windows Firewall

### Method 1: Windows Defender Firewall

**Step 1: Allow LocalDrop through Firewall**

1. Open **Windows Security** → **Firewall & network protection**
2. Click **Allow an app through the firewall**
3. Click **Change settings** (requires admin)
4. Click **Allow another app**
5. Browse to your browser executable:
   - Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - Edge: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
   - Firefox: Usually auto-allowed, but verify below
6. Check **Private** and **Public** for the browser
7. Click **OK**

**Step 2: Allow Specific Ports (Alternative)**

If you prefer to allow specific ports instead:

1. Open **Windows Defender Firewall** → **Advanced settings**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → **UDP** → **Specific local ports**: `5353,3478,8000-9000`
4. Select **Allow the connection**
5. Apply to all profiles (Domain, Private, Public)
6. Name it "LocalDrop UDP"

### Method 2: Quick Command (PowerShell as Admin)

```powershell
# Allow Chrome through firewall
netsh advfirewall firewall add rule name="LocalDrop-Chrome" dir=in action=allow program="C:\Program Files\Google\Chrome\Application\chrome.exe" enable=yes

# Allow Edge through firewall
netsh advfirewall firewall add rule name="LocalDrop-Edge" dir=in action=allow program="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" enable=yes

# Allow UDP ports for WebRTC
netsh advfirewall firewall add rule name="LocalDrop-mDNS" dir=in action=allow protocol=udp localport=5353
netsh advfirewall firewall add rule name="LocalDrop-STUN" dir=in action=allow protocol=udp localport=3478
```

---

## macOS Firewall

### Method 1: System Preferences

**Step 1: Add Screen Sharing Exception (includes WebRTC)**

1. Go to **System Settings** → **Network** → **Firewall**
2. Click **Firewall Options**
3. Click **+** to add application
4. Add your browser:
   - Safari: Usually already allowed
   - Chrome: `/Applications/Google Chrome.app`
   - Firefox: `/Applications/Firefox.app`
5. Set to **Allow incoming connections**

**Step 2: Allow Specific Ports (Terminal)**

```bash
# Create firewall rules for LocalDrop ports
sudo pfctl -a com.localdrop -f /dev/stdin <<EOF
# Allow mDNS
pass in proto udp from any to any port 5353
# Allow STUN
pass in proto udp from any to any port 3478
# Allow WebRTC range
pass in proto udp from any to any port 8000:9000
EOF

# Alternative using ipfw (older macOS)
sudo ipfw add allow udp from any to any 5353
sudo ipfw add allow udp from any to any 3478
```

### macOS Big Sur+ ( Silicon/M1/M2)

Due to improved security, you may need to:

1. Go to **System Settings** → **Privacy & Security** → **Firewall**
2. Ensure firewall is configured
3. For full P2P support, may need to disable "Require local network access" for browsers

---

## Linux (iptables/nftables)

### Using iptables

```bash
# Allow mDNS (LocalDrop discovery)
sudo iptables -A INPUT -p udp --dport 5353 -j ACCEPT

# Allow STUN (NAT traversal)
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT

# Allow WebRTC data channels (8000-9000)
sudo iptables -A INPUT -p udp --dport 8000:9000 -j ACCEPT

# Save rules (Debian/Ubuntu)
sudo netfilter-persistent save

# Save rules (RHEL/CentOS)
sudo service iptables save
```

### Using ufw (Simpler)

```bash
# Allow LocalDrop ports
sudo ufw allow 5353/udp comment 'LocalDrop mDNS'
sudo ufw allow 3478/udp comment 'LocalDrop STUN'
sudo ufw allow 8000:9000/udp comment 'LocalDrop WebRTC'

# Verify rules
sudo ufw status verbose
```

### Using nftables (Modern)

```bash
# Create nftables ruleset
sudo nano /etc/nftables/localdrop.nft

# Add to /etc/nftables/localdrop.nft:
table inet filter {
    chain input {
        # Accept LocalDrop UDP ports
        udp dport 5353 accept comment "LocalDrop mDNS"
        udp dport 3478 accept comment "LocalDrop STUN"
        udp dport 8000-9000 accept comment "LocalDrop WebRTC"
    }
}

# Load rules
sudo nft -f /etc/nftables/localdrop.nft
```

---

## Router Configuration

If devices are on different networks or behind strict NAT, you may need router configuration.

### UPnP (Recommended - Easiest)

Most routers support UPnP which auto-opens required ports:

1. Access router admin panel (usually 192.168.1.1 or 192.168.0.1)
2. Look for **UPnP**, **NAT**, or **Port Forwarding** settings
3. Enable **UPnP**
4. LocalDrop will automatically configure ports when needed

### Manual Port Forwarding (If UPnP unavailable)

If UPnP is disabled or unavailable:

1. Access router admin panel
2. Find **Port Forwarding** or **NAT** settings
3. Create the following rules:

| Name | External Port | Internal Port | Protocol | Internal IP |
|------|---------------|---------------|----------|-------------|
| LocalDrop-mDNS | 5353 | 5353 | UDP | Your device IP |
| LocalDrop-STUN | 3478 | 3478 | UDP | Your device IP |
| LocalDrop-WebRTC-1 | 8000 | 8000 | UDP | Your device IP |
| LocalDrop-WebRTC-2 | 9000 | 9000 | UDP | Your device IP |

4. Save and reboot router

### Finding Your Device IP

**Windows:**
```cmd
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

**macOS/Linux:**
```bash
ip addr show
# or
hostname -I
```

### Disable SIP ALG (Sometimes Required)

Some routers have SIP ALG which interferes with WebRTC:

1. Access router admin panel
2. Find **NAT**, **ALG**, or **Application Layer Gateway**
3. **Disable SIP ALG** or **SIP ALG passthrough**
4. Save and reboot

---

## Browser-Specific Settings

### Google Chrome

Chrome usually works out-of-box, but if having issues:

1. Go to `chrome://flags/#enable-webrtc`
2. Ensure WebRTC is enabled
3. Check `chrome://settings/privacy` → **Use secure DNS**
   - Try disabling if having connection issues

**Chromeflags for better P2P:**
```
chrome://flags/#enable-webgl
chrome://flags/#enable-peer-connection
```

### Mozilla Firefox

Firefox may need configuration for WebRTC:

1. Go to `about:config`
2. Search for `media.peerconnection.enabled`
3. Ensure it's set to **true**
4. Check `media.peerconnection.turn.v1` and `turn.v2` are enabled

### Safari (macOS/iOS)

Safari has strict WebRTC requirements:

1. Ensure **Local Network Access** is allowed
2. Go to **Settings** → **Safari** → **Advanced** → **Experimental Features**
3. Enable **WebRTC**
4. On iOS: Settings → Browser → Allow Local Network

---

## Troubleshooting

### Devices Can't Discover Each Other

**Symptoms:** Devices on same network don't appear in LocalDrop

**Solutions:**
1. Check both devices are on same subnet (192.168.x.x)
2. Verify mDNS port 5353 is open on both devices
3. Check WiFi isolation settings on router (disable if enabled)
4. Try disabling VPN temporarily
5. Restart both devices and router

### Connection Timeout Errors

**Symptoms:** "Connection timed out" or "Peer unreachable"

**Solutions:**
1. Open STUN port 3478 UDP on both devices
2. Open WebRTC port range 8000-9000 UDP
3. Check router doesn't block peer-to-peer traffic
4. Try connecting over mobile hotspot as test
5. Ensure both devices have internet access (for STUN servers)

### One Device Works, Other Doesn't

**Troubleshooting Steps:**

1. **Check firewall on failing device**:
   - Windows: `netsh advfirewall firewall show rule name=all`
   - macOS: `sudo /usr/libexec/ApplicationFirewall/socketfilter --list`
   - Linux: `sudo iptables -L -n | grep -E '(5353|3478|8000)'`

2. **Compare network settings**:
   - Same subnet? Same DNS servers?
   - One on VPN but other not?

3. **Test with mobile hotspot**:
   - Connect both devices to phone hotspot
   - If works, router has P2P restrictions

### WebRTC Connection Failed

**Advanced Troubleshooting:**

1. **Check STUN server connectivity**:
   ```bash
   # Test STUN port
   nc -u -v stunserver.example.com 3478
   ```

2. **Verify no overlapping rules**:
   ```bash
   # List all UDP firewall rules
   sudo iptables -L -n | grep udp
   ```

3. **Check for symmetric NAT** (rare):
   - Some corporate networks prevent P2P
   - May need TURN server fallback

---

## Quick Reference Cheat Sheet

### Windows (Quick Commands)
```powershell
# Check firewall status
Get-NetFirewallProfile

# Test port connectivity
Test-NetConnection -ComputerName stun.example.com -Port 3478
```

### macOS (Quick Commands)
```bash
# Check firewall
sudo /usr/libexec/ApplicationFirewall/socketfilter --list

# Open firewall for app
sudo /usr/libexec/ApplicationFirewall/socketfilter -i /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### Linux (Quick Commands)
```bash
# Check open ports
sudo ss -ulnp | grep -E '(5353|3478|8[0-9]{3})'

# Test UDP port
nc -lu 5353
```

---

## Additional Resources

- [WebRTC Firewall Configuration](https://webrtc.org/nat-firewall/)
- [mDNS Discovery Issues](https://github.com/esphome/faq/blob/main/mdns.rst)
- [STUN/TURN Servers](https://gist.github.com/mondain/b0ec1cb2f8e32a70f7e8)

---

*For more help, open a GitHub issue with your firewall logs and error messages.*