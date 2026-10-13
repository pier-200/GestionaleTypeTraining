import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { apriXlsx, chiudiXlsx, senzaMetadati } from './src/xlsx';

const MODELLI = resolve(__dirname, 'modelli');
const INDICE = 'indice.json';
/** Moduli che l'applicazione compila: senza, la versione pubblicata non potrebbe produrli. */
const INDISPENSABILI = ['Programma settimanale.xlsx', 'Compliance Report.pdf'];

/** File della cartella `modelli`, con il percorso relativo (esclusi i file temporanei di Excel). */
function elenca(cartella = MODELLI): string[] {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true })
    .flatMap((v) => (v.isDirectory() ? elenca(join(cartella, v.name)) : [relative(MODELLI, join(cartella, v.name)).replaceAll('\\', '/')]))
    .filter((nome) => nome !== INDICE && !nome.split('/').at(-1)!.startsWith('~$'))
    .sort();
}

/** Contenuto da servire: gli Excel senza i dati di chi li ha preparati (autori, percorsi). */
function contenuto(nome: string): Uint8Array {
  const bytes = readFileSync(join(MODELLI, nome));
  if (!nome.toLowerCase().endsWith('.xlsx')) return bytes;
  try {
    return chiudiXlsx(senzaMetadati(apriXlsx(bytes)));
  } catch {
    return bytes;
  }
}

/**
 * La cartella `modelli` (i format ufficiali: programmi, moduli da compilare, abilitazioni) è la sola fonte
 * dell'applicazione. In sviluppo si legge da lì; a ogni build è copiata in `dist/modelli`, quindi online sta
 * accanto all'app, all'indirizzo `./modelli/<file>`. `indice.json` ne elenca il contenuto.
 */
function modelli(): Plugin {
  return {
    name: 'modelli',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const percorso = decodeURIComponent((req.url ?? '').split('?')[0]);
        if (!percorso.startsWith('/modelli/')) return next();
        const nome = percorso.slice('/modelli/'.length);
        if (nome === INDICE) return res.setHeader('Content-Type', 'application/json').end(JSON.stringify(elenca()));
        if (!elenca().includes(nome)) return void ((res.statusCode = 404), res.end());
        res.end(contenuto(nome));
      });
    },
    writeBundle(opzioni) {
      const mancanti = INDISPENSABILI.filter((nome) => !elenca().includes(nome));
      if (mancanti.length) this.error(`Nella cartella modelli mancano: ${mancanti.join(', ')}. Senza, l'applicazione pubblicata non potrebbe compilarli.`);
      const uscita = join(opzioni.dir ?? resolve(__dirname, 'dist'), 'modelli');
      mkdirSync(uscita, { recursive: true });
      for (const nome of elenca()) {
        mkdirSync(dirname(join(uscita, nome)), { recursive: true });
        writeFileSync(join(uscita, nome), contenuto(nome));
      }
      writeFileSync(join(uscita, INDICE), JSON.stringify(elenca()));
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
