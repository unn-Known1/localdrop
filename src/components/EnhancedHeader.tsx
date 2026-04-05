import React, { useState } from 'react';
import { Settings, Wifi, WifiOff, Shield, Bell, Activity, Lock, Unlock, Scan } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';
import { PinModal } from './PinModal';
import { StatisticsPanel } from './StatisticsPanel';

export function EnhancedHeader() {
  const { localName, devices, settings, notificationsEnabled, requestNotificationPermission, isPinVerified, startScanning, stopScanning, isScanning } = useTransfer();
  const [showPinModal, setShowPinModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [pinMode, setPinMode] = useState<'enter' | 'setup'>('enter');
  const connectedDevices = devices.filter(d => d.status === 'connected').length;
  const discoveredDevices = devices.filter(d => d.status === 'discovered').length;
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

  const handlePinClick = () => {
    if (settings.pinEnabled) { setPinMode('enter'); setShowPinModal(true); }
    else { setPinMode('setup'); setShowPinModal(true); }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-14 md:h-16 bg-[#111827]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="h-full px-2 md:px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <svg className="w-4 h-4 md:w-6 md:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm md:text-lg font-semibold text-white">LocalDrop</h1>
              <p className="text-[10px] md:text-xs text-gray-400">{localName}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
              {isOnline ? <><Wifi className="w-4 h-4 text-emerald-400" /><span className="text-xs text-gray-300">Online</span></> : <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-xs text-gray-300">Offline</span></>}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
              <span className="text-xs text-gray-300">{connectedDevices} connected</span>
            </div>
            {isScanning && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /><span className="text-xs text-cyan-400">Scanning ({discoveredDevices})</span></div>}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={isScanning ? stopScanning : startScanning} className={`p-2 rounded-xl transition-all ${isScanning ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}><Scan className="w-4 h-4 md:w-5 md:h-5" /></button>
            <button onClick={handlePinClick} className="hidden sm:block p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><Lock className="w-4 h-4 md:w-5 md:h-5" /></button>
            {typeof Notification !== 'undefined' && Notification.permission !== 'denied' && <button onClick={requestNotificationPermission} className="hidden sm:block p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><Bell className="w-4 h-4 md:w-5 md:h-5" /></button>}
            <button onClick={() => setShowStats(true)} className="hidden sm:block p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><Activity className="w-4 h-4 md:w-5 md:h-5" /></button>
          </div>
        </div>
      </header>
      <PinModal isOpen={showPinModal} onClose={() => setShowPinModal(false)} mode={pinMode} />
      <StatisticsPanel isOpen={showStats} onClose={() => setShowStats(false)} />
    </>
  );
}