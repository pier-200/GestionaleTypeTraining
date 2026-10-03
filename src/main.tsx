import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
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
    <MantineProvider theme={tema} forceColorScheme="light">
      <Notifications position="top-center" autoClose={3500} />
      <App />
    </MantineProvider>
  </StrictMode>,
);

// PWA: installazione come app "Type Training" (il service worker serve solo in produzione)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
