import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { DialogProvider } from './ui/Dialogs';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </StoreProvider>
  </StrictMode>,
);

// Service worker : uniquement en production, pour le fonctionnement hors connexion.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker non enregistré', e));
  });
}
