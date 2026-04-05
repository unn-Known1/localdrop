// Notification Service for Push Notifications and Alerts

class NotificationService {
  private permission: NotificationPermission = 'default';

  constructor() {
    if (typeof window !== 'undefined') {
      this.permission = Notification.permission;
    }
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission !== 'denied') {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    }

    return false;
  }

  // Check if notifications are supported
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  // Check if notifications are enabled
  isEnabled(): boolean {
    return this.permission === 'granted';
  }

  // Show incoming transfer notification
  showIncomingTransfer(deviceName: string, fileName: string, fileSize: number) {
    if (!this.isEnabled()) return;

    const sizeStr = this.formatFileSize(fileSize);

    const notification = new Notification('Incoming File', {
      body: `${deviceName} wants to send "${fileName}" (${sizeStr})`,
      icon: '/icon.png',
      tag: 'incoming-transfer',
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }

  // Show transfer complete notification
  showTransferComplete(fileName: string, direction: 'upload' | 'download') {
    if (!this.isEnabled()) return;

    const action = direction === 'download' ? 'received' : 'sent';

    new Notification('Transfer Complete', {
      body: `"${fileName}" has been ${action}`,
      icon: '/icon.png',
      tag: 'transfer-complete',
    });
  }

  // Show transfer error notification
  showTransferError(fileName: string, error: string) {
    if (!this.isEnabled()) return;

    new Notification('Transfer Failed', {
      body: `Failed to transfer "${fileName}": ${error}`,
      icon: '/icon.png',
      tag: 'transfer-error',
    });
  }

  // Show device connected notification
  showDeviceConnected(deviceName: string) {
    if (!this.isEnabled()) return;

    new Notification('Device Connected', {
      body: `${deviceName} is now connected`,
      icon: '/icon.png',
      tag: 'device-connected',
    });
  }

  // Show device disconnected notification
  showDeviceDisconnected(deviceName: string) {
    if (!this.isEnabled()) return;

    new Notification('Device Disconnected', {
      body: `${deviceName} has disconnected`,
      icon: '/icon.png',
      tag: 'device-disconnected',
    });
  }

  // Browser notification helper
  showBrowserNotification(title: string, options?: NotificationOptions) {
    if (!this.isEnabled()) return null;

    return new Notification(title, options);
  }

  // In-app toast notification (for UI display)
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    // This will be handled by the ToastContainer component
    // Just dispatch a custom event
    const event = new CustomEvent('app-notification', {
      detail: { message, type, timestamp: Date.now() },
    });
    window.dispatchEvent(event);
  }

  // Play notification sound
  playSound(type: 'transfer-complete' | 'transfer-error' | 'device-connected' = 'transfer-complete') {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      switch (type) {
        case 'transfer-complete':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.1);
          break;

        case 'transfer-error':
          oscillator.frequency.value = 440;
          oscillator.type = 'square';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.2);
          break;

        case 'device-connected':
          oscillator.frequency.value = 660;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
      }
    } catch (e) {
      console.warn('Could not play sound:', e);
    }
  }

  // Vibrate (mobile devices)
  vibrate(pattern: number | number[] = 100) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Format file size
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const notificationService = new NotificationService();
