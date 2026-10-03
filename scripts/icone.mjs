// Genera le icone PNG della PWA e favicon.ico (anche per il collegamento sul desktop) da public/icona.svg.
//   node scripts/icone.mjs   (Playwright + Microsoft Edge)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const FONDO = '#18302b';
const font = readFileSync('node_modules/@fontsource/figtree/files/figtree-latin-800-normal.woff2').toString('base64');
const svg = readFileSync('public/icona.svg', 'utf8');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();

async function png(lato, scala, fondo) {
  await page.setViewportSize({ width: lato, height: lato });
  await page.setContent(`<style>@font-face{font-family:Figtree;font-weight:800;src:url(data:font/woff2;base64,${font})}
    html,body{margin:0;background:${fondo}}div{width:${lato}px;height:${lato}px;display:grid;place-items:center}svg{width:${lato * scala}px;height:${lato * scala}px}</style><div>${svg}</div>`);
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ omitBackground: fondo === 'transparent' });
}

for (const [suffisso, lato] of [['-512', 512], ['-192', 192], ['-180', 180]]) writeFileSync(`public/icona${suffisso}.png`, await png(lato, 1, 'transparent'));
// maskable: fondo pieno, disegno al 78% dentro la zona sicura
writeFileSync('public/icona-maskable-512.png', await png(512, 0.78, FONDO));

// favicon.ico con immagini PNG incorporate (formato accettato da Windows Vista in poi)
const lati = [16, 32, 48, 256];
const immagini = [];
for (const lato of lati) immagini.push(await png(lato, 1, 'transparent'));
const testa = Buffer.alloc(6 + 16 * lati.length);
testa.writeUInt16LE(0, 0);
testa.writeUInt16LE(1, 2);
testa.writeUInt16LE(lati.length, 4);
let posizione = testa.length;
lati.forEach((lato, i) => {
  const o = 6 + 16 * i;
  testa.writeUInt8(lato === 256 ? 0 : lato, o);
  testa.writeUInt8(lato === 256 ? 0 : lato, o + 1);
  testa.writeUInt16LE(1, o + 4);
  testa.writeUInt16LE(32, o + 6);
  testa.writeUInt32LE(immagini[i].length, o + 8);
  testa.writeUInt32LE(posizione, o + 12);
  posizione += immagini[i].length;
});
writeFileSync('public/favicon.ico', Buffer.concat([testa, ...immagini]));
await browser.close();
console.log('Icone e favicon.ico generate in public/');
