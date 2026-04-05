import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

interface QRModalProps { isOpen: boolean; onClose: () => void; }

export function QRModal({ isOpen, onClose }: QRModalProps) {
  const { localId, localName } = useTransfer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const data = JSON.stringify({ id: localId, name: localName });
      const qrData = btoa(data);
      const size = Math.min(canvas.width, canvas.height);
      const cellSize = size / 25;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'black';
      for (let i = 0; i < qrData.length; i++) {
        const x = (i % 21) * cellSize + cellSize * 2;
        const y = Math.floor(i / 21) * cellSize + cellSize * 2;
        if (qrData.charCodeAt(i) % 2 === 0) ctx.fillRect(x, y, cellSize * 0.8, cellSize * 0.8);
      }
    }
  }, [isOpen, localId, localName]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1f2937] rounded-3xl border border-white/10 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        <h2 className="text-xl font-semibold text-white text-center mb-4">Scan to Connect</h2>
        <canvas ref={canvasRef} width={200} height={200} className="mx-auto rounded-xl" />
        <p className="text-sm text-gray-400 text-center mt-4">Or enter this code on the receiving device</p>
        <div className="mt-4 p-4 rounded-xl bg-[#111827] text-center">
          <p className="text-xs text-gray-500 mb-2">Your Device Code</p>
          <p className="text-2xl font-mono text-cyan-400 tracking-wider">{localId.substring(0, 8).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}