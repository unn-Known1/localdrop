import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image, Film, FileText, X, Send, Pause, Play, Trash2, FolderOpen, Camera, Grid3X3, Archive, Maximize2, Eye, AlertCircle } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

export function EnhancedTransferZone() {
  const { selectedFiles, addFiles, removeFile, clearFiles, selectedDevice, sendFiles, transfers, pauseTransfer, resumeTransfer, cancelTransfer, settings, updateSettings, previewFile, processedFiles } = useTransfer();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(settings.defaultQuality);
  const [enableCompression, setEnableCompression] = useState(settings.compressionEnabled);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) { setIsProcessing(true); await addFiles(files as any, { compress: enableCompression, quality: compressionQuality }); setTimeout(() => setIsProcessing(false), 500); }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { setIsProcessing(true); await addFiles(e.target.files, { compress: enableCompression, quality: compressionQuality }); setTimeout(() => setIsProcessing(false), 500); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number): string => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };
  const getTotalSize = () => selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const getFileIcon = (type: string) => { if (type.startsWith('image/')) return Image; if (type.startsWith('video/')) return Film; return FileText; };
  const activeTransfers = transfers.filter(t => t.status === 'transferring' || t.status === 'paused');
  const failedTransfers = transfers.filter(t => t.status === 'failed');

  return (
    <div className="flex-1 flex flex-col p-4 pt-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white"><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => { setEnableCompression(!enableCompression); updateSettings({ compressionEnabled: !enableCompression }); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs ${enableCompression ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-400'}`}><Archive className="w-3 h-3" />Compress</button>
        </div>
      </div>
      <div className={`relative flex-shrink-0 rounded-3xl border-2 border-dashed transition-all min-h-[200px] ${isDragging ? 'border-blue-500 bg-blue-500/10' : selectedFiles.length > 0 ? 'border-blue-500/50 bg-[#1f2937]/50' : 'border-white/10 bg-[#111827]/30'}`} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,*" className="hidden" onChange={handleFileSelect} />
        <div className="h-full flex flex-col items-center justify-center p-8">
          <div className={`relative mb-4 w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center ${isDragging ? 'scale-110' : ''}`}>
            {isProcessing ? <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /> : <Upload className="w-10 h-10 text-blue-400" />}
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{isProcessing ? 'Processing...' : isDragging ? 'Drop files here' : 'Drag & drop files here'}</h2>
          <p className="text-gray-400 text-sm">or click to browse</p>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm"><FolderOpen className="w-4 h-4" />Browse</button>
          </div>
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <div className="mt-4 bg-[#1f2937]/50 rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><span className="text-blue-400 font-semibold">{selectedFiles.length}</span></div>
              <div><h3 className="text-white font-medium">{selectedFiles.length} files selected</h3><p className="text-sm text-gray-400">{formatFileSize(getTotalSize())} total</p></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearFiles} className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 text-sm">Clear</button>
              <button onClick={sendFiles} disabled={!selectedDevice || selectedDevice.status !== 'connected'} className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium ${selectedDevice?.status === 'connected' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}><Send className="w-4 h-4" />Send</button>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-64 overflow-y-auto">
            {selectedFiles.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <div key={file.id} className="relative group rounded-xl overflow-hidden bg-[#111827] border border-white/5">
                  {file.thumbnail ? <img src={file.thumbnail} alt="" className="w-full h-24 object-cover" /> : <div className="w-full h-24 flex items-center justify-center"><Icon className="w-8 h-8 text-gray-500" /></div>}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); previewFile(file.id); }} className="p-1.5 rounded-lg bg-white/20 text-white"><Eye className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="p-1.5 rounded-lg bg-red-500/20 text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80"><p className="text-[10px] text-white truncate">{file.file.name}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {activeTransfers.length > 0 && (
        <div className="mt-4 bg-[#1f2937]/50 rounded-2xl p-4">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Active Transfers ({activeTransfers.length})</h3>
          <div className="space-y-3">
            {activeTransfers.map((transfer) => (
              <div key={transfer.id} className="flex items-center gap-4 p-3 rounded-xl bg-[#111827]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">{transfer.direction === 'upload' ? <Upload className="w-5 h-5 text-blue-400" /> : <Maximize2 className="w-5 h-5 text-cyan-400" />}</div>
                <div className="flex-1"><p className="text-sm text-white truncate">{transfer.fileName}</p><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${transfer.progress}%` }} /></div></div>
                <div className="flex gap-1">{transfer.status === 'paused' ? <button onClick={() => resumeTransfer(transfer.id)} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><Play className="w-4 h-4" /></button> : <button onClick={() => pauseTransfer(transfer.id)} className="p-2 rounded-lg bg-amber-500/20 text-amber-400"><Pause className="w-4 h-4" /></button>}<button onClick={() => cancelTransfer(transfer.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400"><X className="w-4 h-4" /></button></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}