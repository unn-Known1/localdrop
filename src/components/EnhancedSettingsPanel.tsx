import React from 'react';
import { X, Settings, User, Bell, Shield, Palette, Zap, HardDrive } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

interface SettingsPanelProps { isOpen: boolean; onClose: () => void; }

export function EnhancedSettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSettings, localName, setLocalName, requestNotificationPermission, notificationsEnabled } = useTransfer();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1f2937] rounded-3xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center"><Settings className="w-5 h-5 text-blue-400" /></div><div><h2 className="text-lg font-semibold text-white">Settings</h2><p className="text-xs text-gray-400">Customize your experience</p></div></div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2"><User className="w-4 h-4" /> Device</h3>
            <div className="space-y-3">
              <div><label className="text-sm text-gray-400 mb-1 block">Device Name</label><input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} className="w-full p-3 rounded-xl bg-[#111827] border border-white/10" /></div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2"><Shield className="w-4 h-4" /> Security</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"><div><p className="text-white">PIN Protection</p><p className="text-xs text-gray-400">Require PIN to access app</p></div><button onClick={() => updateSettings({ pinEnabled: !settings.pinEnabled })} className={`w-12 h-6 rounded-full transition-colors ${settings.pinEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.pinEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} /></div></div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"><div><p className="text-white">Auto-Accept Transfers</p><p className="text-xs text-gray-400">Automatically accept file transfers</p></div><button onClick={() => updateSettings({ autoAccept: !settings.autoAccept })} className={`w-12 h-6 rounded-full transition-colors ${settings.autoAccept ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.autoAccept ? 'translate-x-6' : 'translate-x-0.5'}`} /></div></div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"><div><p className="text-white">Push Notifications</p><p className="text-xs text-gray-400">Get notified about transfers</p></div><button onClick={requestNotificationPermission} className={`w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} /></div></div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"><div><p className="text-white">Sound</p><p className="text-xs text-gray-400">Play sounds for events</p></div><button onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })} className={`w-12 h-6 rounded-full transition-colors ${settings.soundEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} /></div></div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2"><Zap className="w-4 h-4" /> Transfer</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"><div><p className="text-white">Compression</p><p className="text-xs text-gray-400">Compress images before sending</p></div><button onClick={() => updateSettings({ compressionEnabled: !settings.compressionEnabled })} className={`w-12 h-6 rounded-full transition-colors ${settings.compressionEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.compressionEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} /></div></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Default Quality</label><select value={settings.defaultQuality} onChange={(e) => updateSettings({ defaultQuality: e.target.value as any })} className="w-full p-3 rounded-xl bg-[#111827] border border-white/10"><option value="original">Original</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}