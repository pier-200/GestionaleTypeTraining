import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-800.css';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './ui/stili.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { App } from './ui/App';
import { tema } from './ui/tema';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={tema} defaultColorScheme="auto">
      <Notifications position="top-center" autoClose={3500} />
      <App />
    </MantineProvider>
  </StrictMode>,
);

// PWA: installazione come app "Type Training" (il service worker serve solo in produzione)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
