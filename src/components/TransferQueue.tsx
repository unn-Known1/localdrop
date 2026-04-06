import React, { useState } from 'react';
import { 
  Upload, Download, Pause, Play, X, RotateCcw, 
  Check, Clock, Wifi, HardDrive, AlertCircle, FileText,
  Image, Film, FolderOpen
} from 'lucide-react';
import { useTransfer, Transfer } from '../contexts/EnhancedTransferContext';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s';
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('video/')) return Film;
  return FileText;
}

interface TransferItemProps {
  transfer: Transfer;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

function TransferItem({ transfer, onPause, onResume, onCancel, onRetry }: TransferItemProps) {
  const Icon = getFileIcon(transfer.fileType);
  const isActive = transfer.status === 'transferring';
  const isPaused = transfer.status === 'paused';
  const isQueued = transfer.status === 'queued';
  const isComplete = transfer.status === 'complete';
  const isFailed = transfer.status === 'failed';

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
      isActive ? 'bg-blue-500/5 border border-blue-500/10' :
      isPaused ? 'bg-amber-500/5 border border-amber-500/10' :
      isQueued ? 'bg-gray-500/5 border border-gray-500/10' :
      isComplete ? 'bg-emerald-500/5 border border-emerald-500/10' :
      isFailed ? 'bg-red-500/5 border border-red-500/10' :
      'bg-[#1f2937]'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isActive ? 'bg-blue-500/20' :
        isPaused ? 'bg-amber-500/20' :
        isQueued ? 'bg-gray-500/20' :
        isComplete ? 'bg-emerald-500/20' :
        isFailed ? 'bg-red-500/20' :
        'bg-[#111827]'
      }`}>
        {isActive && <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
        {isPaused && <Pause className="w-5 h-5 text-amber-400" />}
        {isQueued && <Clock className="w-5 h-5 text-gray-400" />}
        {isComplete && <Check className="w-5 h-5 text-emerald-400" />}
        {isFailed && <AlertCircle className="w-5 h-5 text-red-400" />}
        {!isActive && !isPaused && !isQueued && !isComplete && !isFailed && (
          transfer.direction === 'upload' ? 
            <Upload className="w-5 h-5 text-blue-400" /> : 
            <Download className="w-5 h-5 text-cyan-400" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm truncate">{transfer.fileName}</p>
          {transfer.deviceName && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              → {transfer.deviceName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatFileSize(transfer.fileSize)}</span>
          {isActive && (
            <>
              <span>•</span>
              <span className="text-blue-400">{formatSpeed(transfer.speed)}</span>
              <span>•</span>
              <span>{Math.round(transfer.progress)}%</span>
            </>
          )}
          {isFailed && transfer.error && (
            <span className="text-red-400">{transfer.error}</span>
          )}
        </div>
        {(isActive || isPaused) && (
          <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                isPaused ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}
              style={{ width: `${transfer.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isActive && (
          <button 
            onClick={() => onPause(transfer.id)} 
            className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
            title="Pause"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {isPaused && (
          <button 
            onClick={() => onResume(transfer.id)} 
            className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
            title="Resume"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {isFailed && (
          <button 
            onClick={() => onRetry(transfer.id)} 
            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            title="Retry"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {(isActive || isPaused || isQueued || isFailed) && (
          <button 
            onClick={() => onCancel(transfer.id)} 
            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TransferQueue() {
  const { transfers, pauseTransfer, resumeTransfer, cancelTransfer, selectedDevice, sendFiles } = useTransfer();
  const [isExpanded, setIsExpanded] = useState(true);

  const activeTransfers = transfers.filter(t => t.status === 'transferring');
  const pausedTransfers = transfers.filter(t => t.status === 'paused');
  const queuedTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'queued');
  const failedTransfers = transfers.filter(t => t.status === 'failed');
  const completedTransfers = transfers.filter(t => t.status === 'complete');

  const hasTransfers = transfers.length > 0;

  const handleRetry = (transferId: string) => {
    const transfer = transfers.find(t => t.id === transferId);
    if (transfer && selectedDevice?.status === 'connected') {
      cancelTransfer(transferId);
      sendFiles();
    }
  };

  if (!hasTransfers) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            Transfer Queue
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 text-sm">No transfers yet</p>
          <p className="text-gray-500 text-xs mt-1">Drop files to start transferring</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button 
        onClick={() => setIsExpanded(!isExpanded)} 
        className="w-full flex items-center justify-between mb-4 hover:bg-white/5 p-2 -ml-2 rounded-lg transition-all"
      >
        <h2 className="text-white font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          Transfer Queue
          <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded-full">
            {activeTransfers.length + pausedTransfers.length + queuedTransfers.length}
          </span>
        </h2>
        <Clock className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {(activeTransfers.length > 0 || pausedTransfers.length > 0) && (
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Wifi className="w-3 h-3" />
                Active
              </h3>
              <div className="space-y-2">
                {[...activeTransfers, ...pausedTransfers].map(transfer => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    onPause={pauseTransfer}
                    onResume={resumeTransfer}
                    onCancel={cancelTransfer}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            </div>
          )}

          {queuedTransfers.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Queued
              </h3>
              <div className="space-y-2">
                {queuedTransfers.map(transfer => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    onPause={pauseTransfer}
                    onResume={resumeTransfer}
                    onCancel={cancelTransfer}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            </div>
          )}

          {failedTransfers.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                Failed
              </h3>
              <div className="space-y-2">
                {failedTransfers.map(transfer => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    onPause={pauseTransfer}
                    onResume={resumeTransfer}
                    onCancel={cancelTransfer}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            </div>
          )}

          {completedTransfers.length > 0 && (
            <div className="pt-2 border-t border-white/5">
              <h3 className="text-xs text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Check className="w-3 h-3" />
                Completed ({completedTransfers.length})
              </h3>
              <div className="space-y-2">
                {completedTransfers.slice(0, 5).map(transfer => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    onPause={pauseTransfer}
                    onResume={resumeTransfer}
                    onCancel={cancelTransfer}
                    onRetry={handleRetry}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
