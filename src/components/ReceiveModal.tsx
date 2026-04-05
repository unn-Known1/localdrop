import React, { useState } from 'react';
import { X, Check, Copy, CheckCheck, Loader2 } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

interface ReceiveModalProps { isOpen: boolean; onClose: () => void; }

export function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
  const { localId, localName } = useTransfer();
  const [mode, setMode] = useState<'show' | 'enter'>('show');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const deviceInfo = { id: localId, name: localName, type: /mobile/i.test(navigator?.userAgent || '') ? 'mobile' : 'desktop' };
  const shareCode = btoa(JSON.stringify(deviceInfo)).substring(0, 8).toUpperCase();

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(shareCode); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {}
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1f2937] rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center"><svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg></div><div><h2 className="text-lg font-semibold text-white">Receive Files</h2><p className="text-xs text-gray-400">Get ready to receive</p></div></div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="flex border-b border-white/5">
          <button onClick={() => setMode('show')} className={`flex-1 py-3 text-sm font-medium ${mode === 'show' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Show Code</button>
          <button onClick={() => setMode('enter')} className={`flex-1 py-3 text-sm font-medium ${mode === 'enter' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400'}`}>Enter Code</button>
        </div>
        <div className="p-6">
          {mode === 'show' ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4"><svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" /></svg></div>
              <h3 className="text-xl font-semibold text-white mb-2">Your Share Code</h3>
              <p className="text-sm text-gray-400 mb-6 text-center">Give this code to the sender</p>
              <div className="relative w-full p-4 rounded-2xl bg-[#111827] border border-white/5">
                <div className="flex items-center justify-center gap-3">
                  {shareCode.split('').map((char, i) => (<span key={i} className="w-10 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center"><span className="text-2xl font-bold text-cyan-400">{char}</span></span>))}
                </div>
                <button onClick={handleCopy} className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10">{copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-semibold text-white mb-2">Enter Sender Code</h3>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="XXXXXXXX" className="w-full p-4 rounded-2xl bg-[#111827] border border-white/10 text-center font-mono text-2xl tracking-widest" maxLength={8} />
              <button disabled={code.length < 8} className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium disabled:opacity-50">Connect</button>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-white/5 bg-[#111827]/50"><div className="flex items-center gap-2 text-xs text-gray-500"><svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg><span>All transfers stay on your local network</span></div></div>
      </div>
    </div>
  );
}