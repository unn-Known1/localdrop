import React from 'react';
import { Check, X, Trash2, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

export function TransferHistory() {
  const { transfers, clearCompletedTransfers } = useTransfer();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const completedTransfers = transfers.filter(t => t.status === 'complete');
  const failedTransfers = transfers.filter(t => t.status === 'failed');
  const activeTransfers = transfers.filter(t => t.status === 'transferring' || t.status === 'queued');
  const formatFileSize = (bytes: number): string => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };
  if (transfers.length === 0) return null;
  return (
    <div className="bg-[#111827]/50 backdrop-blur-xl border-t border-white/5">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all">
        <div className="flex items-center gap-3"><div className="relative"><Clock className="w-5 h-5 text-gray-400" />{activeTransfers.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />}</div><div className="text-left"><p className="text-white font-medium">Transfer Activity</p><p className="text-xs text-gray-400">{completedTransfers.length} completed{failedTransfers.length > 0 && ` • ${failedTransfers.length} failed`}</p></div></div>
        <div className="flex items-center gap-2">{completedTransfers.length > 0 && <button onClick={(e) => { e.stopPropagation(); clearCompletedTransfers(); }} className="p-2 rounded-lg hover:bg-white/10" title="Clear completed"><Trash2 className="w-4 h-4 text-gray-400" /></button>}{isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}</div>
      </button>
      {isExpanded && <div className="px-4 pb-4 max-h-80 overflow-y-auto"><div className="space-y-2">{transfers.map((transfer) => (<div key={transfer.id} className={`flex items-center gap-3 p-3 rounded-xl ${transfer.status === 'complete' ? 'bg-emerald-500/5 border border-emerald-500/10' : ''}${transfer.status === 'failed' ? 'bg-red-500/5 border border-red-500/10' : ''}${transfer.status === 'transferring' ? 'bg-blue-500/5 border border-blue-500/10' : ''}`}><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${transfer.status === 'complete' ? 'bg-emerald-500/20' : ''}${transfer.status === 'failed' ? 'bg-red-500/20' : ''}${transfer.status === 'transferring' ? 'bg-blue-500/20' : ''}`}>{transfer.status === 'complete' && <Check className="w-5 h-5 text-emerald-400" />}{transfer.status === 'failed' && <X className="w-5 h-5 text-red-400" />}{transfer.status === 'transferring' && <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}</div><div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{transfer.fileName}</p><div className="flex items-center gap-2 text-xs text-gray-400"><span>{formatFileSize(transfer.fileSize)}</span>{transfer.status === 'transferring' && <><span>•</span><span>{Math.round(transfer.progress)}%</span></>}{transfer.status === 'failed' && <span className="text-red-400">{transfer.error || 'Failed'}</span>}</div></div>{transfer.status === 'transferring' && <div className="w-24"><div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${transfer.progress}%` }} /></div></div>}</div>))}</div></div>}
    </div>
  );
}