import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TelegramProvider } from './context/TelegramContext';
import { getApiBaseUrl } from './config/api';
import { initCacheBust } from './lib/cacheBust';
import { logMobile } from './lib/mobileDebug';
import './styles/App.css';

initCacheBust();
logMobile('[WorkflowGPT] API URL:', getApiBaseUrl() || '(set VITE_API_URL)');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramProvider>
      <App />
    </TelegramProvider>
  </React.StrictMode>
);
