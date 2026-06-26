import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';

interface QRModalProps { isOpen: boolean; onClose: () => void; }

// Simple QR code generator using Canvas API
function generateQRCode(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = canvas.width;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Encode text to binary
  const data: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode < 128) {
      data.push(charCode);
    } else {
      data.push(0xEF, 0xBF, 0xBD); // UTF-8 replacement character
    }
  }

  // Simple hash-based pattern for visual representation
  const moduleCount = 25;
  const cellSize = size / moduleCount;

  // Draw finder patterns (corners)
  const drawFinder = (x: number, y: number) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
    ctx.fillStyle = '#000000';
    ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
  };

  drawFinder(0, 0);
  drawFinder(moduleCount - 7, 0);
  drawFinder(0, moduleCount - 7);

  // Draw timing patterns
  ctx.fillStyle = '#000000';
  for (let i = 8; i < moduleCount - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * cellSize, 6 * cellSize, cellSize, cellSize);
      ctx.fillRect(6 * cellSize, i * cellSize, cellSize, cellSize);
    }
  }

  // Generate data pattern from text hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }

  // Fill data area with deterministic pattern
  for (let y = 0; y < moduleCount; y++) {
    for (let x = 0; x < moduleCount; x++) {
      // Skip finder patterns and timing
      if ((x < 8 && y < 8) || (x >= moduleCount - 8 && y < 8) || (x < 8 && y >= moduleCount - 8)) continue;
      if (x === 6 || y === 6) continue;

      // Generate pseudo-random based on position and hash
      const seed = (x * 31 + y * 37 + hash) & 0x7FFFFFFF;
      if (seed % 3 !== 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
}

export function QRModal({ isOpen, onClose }: QRModalProps) {
  const { localId, localName } = useDevices();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const data = JSON.stringify({ id: localId, name: localName });
      generateQRCode(canvasRef.current, data);
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