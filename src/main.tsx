import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TelegramProvider } from './context/TelegramContext';
import { AuthProvider } from './context/AuthContext';
import { useTelegram } from './hooks/useTelegram';
import { getApiBaseUrl } from './config/api';
import { initCacheBust } from './lib/cacheBust';
import { logMobile } from './lib/mobileDebug';
import './styles/App.css';

initCacheBust();
logMobile('[WorkflowGPT] API URL:', getApiBaseUrl() || '(set VITE_API_URL)');

const AppBootstrap: React.FC = () => {
  const { isReady } = useTelegram();
  return (
    <AuthProvider telegramReady={isReady}>
      <App />
    </AuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TelegramProvider>
      <AppBootstrap />
    </TelegramProvider>
  </React.StrictMode>
);
