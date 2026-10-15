import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { apriXlsx, chiudiXlsx, senzaMetadati } from './src/xlsx';

const MODELLI = resolve(__dirname, 'modelli');
const INDICE = 'indice.json';
/**
 * Moduli vuoti, uguali per tutti i corsi e senza dati: entrano nella build perché la demo pubblicata (`?demo`, senza
 * accesso al repository dei dati) possa compilare Excel e PDF. Tutti gli altri modelli restano privati.
 */
const PER_LA_DEMO = ['Programma settimanale.xlsx', 'Compliance Report.pdf'];

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
 * `npm run dev` e `vite preview` la espongono alla modalità dimostrativa. Nella build entrano solo i moduli vuoti
 * per la demo: per l'archivio reale i modelli stanno nel repository privato dei dati (`npm run modelli` li carica).
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
  return {
    name: 'modelli',
    configureServer: servi,
    configurePreviewServer: servi,
    writeBundle(opzioni) {
      const presenti = PER_LA_DEMO.filter((nome) => existsSync(join(MODELLI, nome)));
      if (presenti.length < PER_LA_DEMO.length) this.warn(`Nella cartella modelli mancano ${PER_LA_DEMO.filter((n) => !presenti.includes(n)).join(', ')}: la demo pubblicata non potrà usarli.`);
      const uscita = join(opzioni.dir ?? resolve(__dirname, 'dist'), 'modelli');
      mkdirSync(uscita, { recursive: true });
      for (const nome of presenti) {
        const bytes = readFileSync(join(MODELLI, nome));
        // dagli Excel si tolgono autore, percorso e stampante di chi li ha salvati
        writeFileSync(join(uscita, nome), nome.endsWith('.xlsx') ? chiudiXlsx(senzaMetadati(apriXlsx(bytes))) : bytes);
      }
      writeFileSync(join(uscita, INDICE), JSON.stringify(presenti));
    },
  };
}

// base './': funziona a qualsiasi indirizzo (es. https://<utente>.github.io/<repository>/), con routing a hash.
export default defineConfig({
  base: './',
  plugins: [react(), modelli()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { port: 5174 },
});
