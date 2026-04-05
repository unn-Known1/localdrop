import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';
import { useTransfer } from '../contexts/EnhancedTransferContext';

interface PinModalProps { isOpen: boolean; onClose: () => void; mode: 'enter' | 'setup'; }

export function PinModal({ isOpen, onClose, mode }: PinModalProps) {
  const { verifyPin, setPin, disablePin, settings } = useTransfer();
  const [pin, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (mode === 'enter') {
      if (verifyPin(pin)) { onClose(); setPinInput(''); }
      else { setError('Incorrect PIN'); setPinInput(''); }
    } else {
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
      setPin(pin); onClose(); setPinInput(''); setConfirmPin('');
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#1f2937] rounded-3xl border border-white/10 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-amber-400" /></div>
        <h2 className="text-xl font-semibold text-white text-center mb-2">{mode === 'enter' ? 'Enter PIN' : 'Set Up PIN'}</h2>
        <p className="text-sm text-gray-400 text-center mb-6">{mode === 'enter' ? 'Enter your PIN to unlock' : 'Create a PIN to protect your app'}</p>
        <div className="space-y-4">
          <input type="password" value={pin} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter PIN" className="w-full p-4 rounded-xl bg-[#111827] border border-white/10 text-center text-2xl tracking-widest" maxLength={6} />
          {mode === 'setup' && <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Confirm PIN" className="w-full p-4 rounded-xl bg-[#111827] border border-white/10 text-center text-2xl tracking-widest" maxLength={6} />}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button onClick={handleSubmit} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium">{mode === 'enter' ? 'Unlock' : 'Set PIN'}</button>
          {mode === 'enter' && settings.pinEnabled && <button onClick={() => { disablePin(); onClose(); }} className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium">Disable PIN</button>}
        </div>
      </div>
    </div>
  );
}