import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { DeviceProvider } from './contexts/DeviceContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { TransferProvider } from './contexts/EnhancedTransferContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <DeviceProvider>
        <TransferProvider>
          <App />
        </TransferProvider>
      </DeviceProvider>
    </SettingsProvider>
  </React.StrictMode>,
)
