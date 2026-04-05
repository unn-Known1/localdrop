import React, { useState } from 'react';
import { Smartphone, Monitor, Wifi, WifiOff, Star, MoreVertical, X, RefreshCw, Trash2, QrCode, Download, History } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';
import { QRModal } from './QRModal';
import { ReceiveModal } from './ReceiveModal';
import { TransferHistory } from './TransferHistory';

export function EnhancedDevicePanel() {
  const { devices, savedDevices, selectedDevice, setSelectedDevice, connectToDevice, disconnectDevice, removeSavedDevice, toggleFavoriteDevice, renameDevice, loadTransferHistory } = useTransfer();
  const [showQR, setShowQR] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuDevice, setMenuDevice] = useState<string | null>(null);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getDeviceIcon = (type: string) => type === 'mobile' ? Smartphone : Monitor;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-emerald-500';
      case 'connecting': return 'bg-amber-500 animate-pulse';
      case 'discovered': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <div className="w-80 border-l border-white/5 bg-[#111827]/50 p-4 overflow-y-auto hidden md:block">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Devices</h2>
          <div className="flex gap-1">
            <button onClick={() => { setShowQR(true); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white"><QrCode className="w-4 h-4" /></button>
            <button onClick={() => { setShowReceive(true); loadTransferHistory(); }} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white"><Download className="w-4 h-4" /></button>
            <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-lg ${showHistory ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}><History className="w-4 h-4" /></button>
          </div>
        </div>
        {showHistory ? <TransferHistory /> : (
          <>
            {devices.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Nearby</h3>
                <div className="space-y-2">
                  {devices.map((device) => {
                    const Icon = getDeviceIcon(device.type);
                    return (
                      <div key={device.id} onClick={() => device.status !== 'connected' ? connectToDevice(device.id) : setSelectedDevice(device)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedDevice?.id === device.id ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-[#1f2937] hover:bg-[#1f2937]/80'}`}>
                        <div className="relative"><Icon className="w-6 h-6 text-gray-400" /><span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${getStatusColor(device.status)}`} /></div>
                        <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{device.name}</p><p className="text-xs text-gray-400 capitalize">{device.status}</p></div>
                        {device.status === 'connected' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {savedDevices.length > 0 && (
              <div>
                <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Saved Devices</h3>
                <div className="space-y-2">
                  {savedDevices.map((device) => {
                    const Icon = getDeviceIcon(device.type);
                    return (
                      <div key={device.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1f2937]">
                        <Icon className="w-6 h-6 text-gray-400" />
                        <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{device.nickname || device.name}</p><p className="text-xs text-gray-400">{formatTime(device.lastConnected)}</p></div>
                        <button onClick={() => toggleFavoriteDevice(device.id)} className={`p-1 ${device.isFavorite ? 'text-amber-400' : 'text-gray-500'}`}><Star className="w-4 h-4" fill={device.isFavorite ? 'currentColor' : 'none'} /></button>
                        <button onClick={() => connectToDevice(device.id)} className="p-1 rounded-lg bg-blue-500/20 text-blue-400"><RefreshCw className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {devices.length === 0 && savedDevices.length === 0 && (
              <div className="text-center py-12 text-gray-400"><p className="text-sm">No devices found</p><p className="text-xs mt-1">Make sure devices are on the same network</p></div>
            )}
          </>
        )}
      </div>
      <QRModal isOpen={showQR} onClose={() => setShowQR(false)} />
      <ReceiveModal isOpen={showReceive} onClose={() => setShowReceive(false)} />
    </>
  );
}