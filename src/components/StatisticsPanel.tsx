import React from 'react';
import { X, TrendingUp, TrendingDown, Clock, Files, HardDrive, Zap, Activity } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

interface StatisticsPanelProps { isOpen: boolean; onClose: () => void; }

export function StatisticsPanel({ isOpen, onClose }: StatisticsPanelProps) {
  const { transfers, statistics, transferHistory, clearTransferHistory } = useTransfer();
  if (!isOpen) return null;
  const formatBytes = (bytes: number): string => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; };
  const formatSpeed = (bytesPerSecond: number): string => { const mbps = (bytesPerSecond * 8) / 1000000; return mbps.toFixed(1) + ' Mbps'; };
  const totalTransfers = statistics.totalFilesSent + statistics.totalFilesReceived;
  const totalBytes = statistics.totalBytesSent + statistics.totalBytesReceived;
  const sessionDuration = Math.floor((Date.now() - statistics.sessionStart) / 1000);
  const formatDuration = (seconds: number): string => { const hours = Math.floor(seconds / 3600); const mins = Math.floor((seconds % 3600) / 60); const secs = seconds % 60; if (hours > 0) return `${hours}h ${mins}m`; if (mins > 0) return `${mins}m ${secs}s`; return `${secs}s`; };
  const recentActivity = transferHistory.slice(0, 5);
  const activeTransfers = transfers.filter(t => t.status === 'transferring').length;
  const queuedTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'queued').length;
  const currentSpeed = transfers.filter(t => t.status === 'transferring').reduce((acc, t) => acc + (t.speed || 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#1f2937] rounded-3xl border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center"><Activity className="w-5 h-5 text-blue-400" /></div><div><h2 className="text-lg font-semibold text-white">Statistics</h2><p className="text-xs text-gray-400">Transfer analytics</p></div></div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20"><div className="flex items-center gap-2 mb-2"><Files className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400">Total</span></div><p className="text-2xl font-bold text-white">{totalTransfers}</p></div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20"><div className="flex items-center gap-2 mb-2"><HardDrive className="w-4 h-4 text-emerald-400" /><span className="text-xs text-gray-400">Data</span></div><p className="text-2xl font-bold text-white">{formatBytes(totalBytes)}</p></div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-cyan-400" /><span className="text-xs text-gray-400">Sent</span></div><p className="text-2xl font-bold text-white">{statistics.totalFilesSent}</p></div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20"><div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400">Received</span></div><p className="text-2xl font-bold text-white">{statistics.totalFilesReceived}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#111827] border border-white/5"><div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-400" /><span className="text-xs text-gray-400">Peak Speed</span></div><p className="text-xl font-bold text-white">{statistics.peakSpeed > 0 ? formatSpeed(statistics.peakSpeed) : '--'}</p></div>
            <div className="p-4 rounded-2xl bg-[#111827] border border-white/5"><div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-emerald-400" /><span className="text-xs text-gray-400">Avg Speed</span></div><p className="text-xl font-bold text-white">{statistics.averageSpeed > 0 ? formatSpeed(statistics.averageSpeed) : '--'}</p></div>
            <div className="p-4 rounded-2xl bg-[#111827] border border-white/5"><div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-blue-400" /><span className="text-xs text-gray-400">Current Speed</span></div><p className="text-xl font-bold text-white">{currentSpeed > 0 ? formatSpeed(currentSpeed) : '--'}</p></div>
            <div className="p-4 rounded-2xl bg-[#111827] border border-white/5"><div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-purple-400" /><span className="text-xs text-gray-400">Active / Queued</span></div><p className="text-xl font-bold text-white">{activeTransfers} / {queuedTransfers}</p></div>
          </div>
          <div className="p-4 rounded-2xl bg-[#111827] border border-white/5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Clock className="w-5 h-5 text-gray-400" /><div><p className="text-sm text-white">Current Session</p><p className="text-xs text-gray-400">Since {new Date(statistics.sessionStart).toLocaleTimeString()}</p></div></div><div className="text-right"><p className="text-lg font-semibold text-white">{formatDuration(sessionDuration)}</p><p className="text-xs text-gray-400">{statistics.totalSessions} sessions</p></div></div></div>
          {recentActivity.length > 0 && <div>{transferHistory.length > 0 && <button onClick={clearTransferHistory} className="text-xs text-red-400 hover:text-red-300 mb-4">Clear History</button>}<div className="space-y-2">{recentActivity.map((t) => (<div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#111827] border border-white/5"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.direction === 'upload' ? 'bg-blue-500/20' : 'bg-cyan-500/20'}`}>{t.direction === 'upload' ? <TrendingUp className="w-4 h-4 text-blue-400" /> : <TrendingDown className="w-4 h-4 text-cyan-400" />}</div><div className="flex-1"><p className="text-sm text-white truncate">{t.fileName}</p><p className="text-xs text-gray-400">{formatBytes(t.fileSize)} • {t.deviceName}</p></div><div className="text-right"><p className={`text-xs ${t.status === 'complete' ? 'text-emerald-400' : 'text-red-400'}`}>{t.status}</p></div></div>))}</div></div>}
        </div>
      </div>
    </div>
  );
}