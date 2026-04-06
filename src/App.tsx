import React from 'react';
import { EnhancedHeader } from './components/EnhancedHeader';
import { EnhancedTransferZone } from './components/EnhancedTransferZone';
import { EnhancedDevicePanel } from './components/EnhancedDevicePanel';
import { TransferQueue } from './components/TransferQueue';
import { ToastContainer } from './components/ToastContainer';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0e17] flex flex-col">
        <EnhancedHeader />
        <div className="flex flex-1 flex-col md:flex-row pt-16 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <EnhancedTransferZone />
          </div>
          <div className="hidden md:flex flex-col w-80 border-l border-white/5 bg-[#111827]/50">
            <TransferQueue />
            <EnhancedDevicePanel />
          </div>
          <div className="md:hidden">
            <EnhancedDevicePanel />
          </div>
        </div>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}