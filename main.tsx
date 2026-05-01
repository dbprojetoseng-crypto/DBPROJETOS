import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { LanguageProvider } from './LanguageContext';
import { ErrorGuard } from './components/ErrorGuard'; // Using ErrorGuard to avoid collision issues

createRoot(document.getElementById('root')!).render(
  <ErrorGuard>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ErrorGuard>,
);
