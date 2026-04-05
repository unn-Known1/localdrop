import React from 'react'
import ReactDOM from 'react-dom/client'
import { TransferProvider } from './contexts/EnhancedTransferContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TransferProvider>
      <App />
    </TransferProvider>
  </React.StrictMode>,
)