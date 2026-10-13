// Collaudo dell'archivio su repository GitHub: configurazione iniziale, corso, account,
// programma settimanale validato e rapportino presenze, con verifica che tutto resti scritto
// nel repository dei dati. Serve un token con Contents: read and write sui due repository.
//
//   TT_URL=http://localhost:4174/ TT_TOKEN=github_pat_… node tests/collaudo-github.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const BASE = process.env.TT_URL ?? 'http://localhost:4174/';
const TOKEN = process.env.TT_TOKEN;
const PASSWORD = process.env.TT_PASSWORD ?? 'collaudo-tt-2026';
if (!TOKEN) throw new Error('Manca TT_TOKEN');

const browser = await chromium.launch({ channel: 'msedge' });
const contesto = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await contesto.newPage();
const errori = [];
page.on('pageerror', (e) => errori.push(e.message));
const pausa = (ms = 400) => page.waitForTimeout(ms);

// suffisso diverso a ogni giro: lo script si può rilanciare sugli stessi repository
const N = Date.now().toString().slice(-5);
await page.goto(BASE);
await page.waitForSelector('form', { timeout: 30000 });
const primoAvvio = await page.getByLabel(/Token GitHub/).isVisible();
if (primoAvvio) {
  await page.getByLabel(/Token GitHub/).fill(TOKEN);
  await page.getByLabel('Username del Training Manager').fill('tm.collaudo');
  await page.getByLabel('Grado, nome e cognome').fill('Magg. Collaudo Prova');
  await page.locator('input[type="password"]').nth(1).fill(PASSWORD); // il primo è il token
  await page.getByRole('button', { name: 'Configura e accedi' }).click();
} else {
  await page.locator('input[autocomplete=username]').fill('tm.collaudo');
  await page.locator('input[autocomplete=current-password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Accedi' }).click();
}
await page.waitForSelector('.guscio', { timeout: 60000 });
console.log(primoAvvio ? 'archivio GitHub: Training Manager creato' : 'archivio GitHub: accesso con il portachiavi cifrato');

// corso con parte teorica e pratica
await page.goto(`${BASE}#/corsi`);
await page.getByRole('button', { name: 'Nuovo corso' }).click();
await page.getByLabel('Codice').fill(`C-${N}`);
await page.getByLabel('Nome del corso').fill('Corso di collaudo');
await page.getByLabel('Data di inizio').fill('2026-09-21'); // i programmi sono già preselezionati
await page.getByRole('button', { name: /Crea|Salva/ }).last().click();
await page.locator('.scheda-corso', { hasText: `C-${N}` }).waitFor({ timeout: 60000 });

// un frequentatore, assegnato al corso
await page.goto(`${BASE}#/account`);
await pausa();
await page.getByRole('button', { name: 'Nuovo account' }).click();
await page.getByLabel('Username').fill(`allievo.c${N}`);
await page.getByRole('button', { name: 'Crea account' }).click();
await page.getByText('Credenziali da consegnare di persona').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Chiudi' }).click();
await page.goto(`${BASE}#/corsi`);
await page.locator('.scheda-corso', { hasText: `C-${N}` }).getByRole('button', { name: 'Apri' }).click();
await page.waitForSelector('.guscio');
await page.goto(`${BASE}#/corso`);
await pausa();
await page.getByRole('combobox', { name: 'Assegna al corso' }).click();
await page.getByRole('option', { name: new RegExp(`allievo\.c${N}`) }).click();
await page.getByRole('button', { name: 'Assegna', exact: true }).click();
await page.getByText('Assegnato al corso').waitFor({ timeout: 60000 });

// programma settimanale: un periodo, salvato e validato
await page.goto(`${BASE}#/settimana?w=2026-09-21`);
await pausa(600);
await page.locator('.periodo.vuoto:visible').first().click();
await page.getByRole('button', { name: 'Fatto' }).click();
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Programma della settimana salvato').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Altre azioni' }).click();
await page.getByRole('menuitem', { name: 'Valida la settimana' }).click();
await page.getByText('Settimana validata').waitFor({ timeout: 60000 });

// rapportino presenze del lunedì, con un'assenza, poi validato
await page.goto(`${BASE}#/rapportino?g=2026-09-21`);
await pausa(600);
await page.locator('.riga-presenza').first().getByText('Assente', { exact: true }).click();
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Rapportino salvato').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Valida' }).click();
await page.getByText('Rapportino validato').waitFor({ timeout: 60000 });

// ricarica: i dati arrivano dal repository, non dal browser
await page.goto(`${BASE}#/assenze`);
await page.reload();
await page.waitForSelector('.cartiglio', { timeout: 90000 });
await pausa(800);
const testo = await page.locator('body').innerText();
assert.match(testo, new RegExp(`allievo\.c${N}|Idoneo`, 'i'), 'quadro assenze ricaricato dal repository');
assert.match(await page.locator('.cartiglio').innerText(), /limite di assenza/i, 'cartiglio delle assenze');

await browser.close();
assert.deepEqual(errori, [], `errori JavaScript: ${errori.join('; ')}`);
console.log('collaudo archivio GitHub: tutti i controlli superati');
