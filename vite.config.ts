import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const MODELLI = resolve(__dirname, 'modelli');
const INDICE = 'indice.json';

/** File della cartella `modelli`, con il percorso relativo (esclusi i file temporanei di Excel). */
function elenca(cartella = MODELLI): string[] {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true })
    .flatMap((v) => (v.isDirectory() ? elenca(join(cartella, v.name)) : [relative(MODELLI, join(cartella, v.name)).replaceAll('\\', '/')]))
    .filter((nome) => nome !== INDICE && !nome.split('/').at(-1)!.startsWith('~$'))
    .sort();
}

/**
 * La cartella locale `modelli` è la copia di lavoro dei format ufficiali: la usano gli script e le prove, e
 * `npm run dev` e `vite preview` la espongono alla modalità dimostrativa. Non entra nella build: online i modelli
 * stanno nel repository privato dei dati (`npm run modelli` li carica) e li legge solo chi ha fatto l'accesso.
 */
function modelli(): Plugin {
  const servi = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use((req, res, next) => {
      const percorso = decodeURIComponent((req.url ?? '').split('?')[0]);
      if (!percorso.startsWith('/modelli/')) return next();
      const nome = percorso.slice('/modelli/'.length);
      if (nome === INDICE) return res.setHeader('Content-Type', 'application/json').end(JSON.stringify(elenca()));
      if (!elenca().includes(nome)) return void ((res.statusCode = 404), res.end());
      res.end(readFileSync(join(MODELLI, nome)));
    });
  };
  return { name: 'modelli', configureServer: servi, configurePreviewServer: servi };
}

// base './': funziona a qualsiasi indirizzo (es. https://<utente>.github.io/<repository>/), con routing a hash.
export default defineConfig({
  base: './',
  plugins: [react(), modelli()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { port: 5174 },
});
