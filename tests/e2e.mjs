// Prova end-to-end nel browser (Microsoft Edge) sulla modalità dimostrativa (?demo).
//   npm run build && npx vite preview --port 4174   poi   npm run e2e
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const BASE = process.env.PTT_URL ?? 'http://localhost:4174/?demo';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', (e) => errori.push(e.message));
const pausa = (ms = 300) => page.waitForTimeout(ms);
const profilo = async (nome) => {
  await page.getByRole('button', { name: new RegExp(nome) }).first().click();
  await page.waitForSelector('.guscio, form');
  await pausa();
};
const esci = async () => {
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('ptt:demo:sessione');
  });
  await page.goto(BASE);
  await page.reload();
  await page.waitForSelector('.profili');
};
const apriCorso = async (codice) => {
  await page.goto(`${BASE}#/corsi`);
  await page.locator('.scheda-corso', { hasText: codice }).getByRole('button', { name: 'Apri' }).click();
  await page.waitForSelector('.guscio');
  await pausa();
};

await page.goto(BASE);
await page.waitForSelector('.profili');
await page.getByRole('button', { name: 'Ripristina la situazione esempio' }).click();

// 1. il frequentatore registra un task dal telefono: logbook e report si aggiornano
await profilo('Matteo Gallo');
await page.goto(`${BASE}#/logbook?ch=44`);
await pausa(500);
await page.locator('.task-riga').first().click();
await page.getByRole('button', { name: 'Registra questo task' }).click();
await page.getByLabel(/ET – tempo stimato/).fill('35');
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForSelector('.task.eseguito');
await page.goto(`${BASE}#/report`);
await pausa();
const riga44 = page.locator('.cr-tabella tr', { has: page.locator('td:first-child', { hasText: /^44$/ }) });
assert.equal((await riga44.locator('td').nth(2).textContent()).trim(), '1', 'chapter 44 eseguito nel report');

// 2. data futura rifiutata
await page.goto(`${BASE}#/logbook`);
await pausa();
await page.getByRole('button', { name: /^Registra task$/ }).last().click();
await page.getByPlaceholder('Cerca per numero, chapter o descrizione').fill('Placards');
await page.getByRole('option').first().click();
await page.getByLabel(/^Data/).fill('2099-01-01');
await page.getByLabel(/ET – tempo stimato/).fill('20');
await page.getByRole('button', { name: 'Salva' }).click();
// il browser blocca già l'invio (max = oggi); il motore rifiuta comunque le date future (tests/dominio.test.ts)
assert.ok(await page.getByLabel(/^Data/).evaluate((el) => el.validity.rangeOverflow), 'data futura bloccata');
assert.ok(await page.locator('.mantine-Drawer-content').isVisible(), 'registrazione non salvata');
await page.keyboard.press('Escape');

// 3. il frequentatore vede solo il proprio corso e non i compagni
assert.equal(await page.locator('.scheda-corso').count(), 0, 'il frequentatore non gestisce i corsi');
await page.goto(`${BASE}#/teoria`);
await pausa();
assert.match(await page.locator('.cartiglio').innerText(), /ore/i, 'il frequentatore vede la situazione della teoria');

// 4. il direttore prepara una settimana di lezioni e vede il conto a scalare
await esci();
await profilo('Marco Neri');
await apriCorso('T1-2026/2');
await page.goto(`${BASE}#/settimana?c=c-2026-2&w=2026-10-05`);
await pausa(500);
const residuoPrima = await page.locator('.conto-scalare b').innerText();
await page.getByRole('button', { name: 'Genera' }).click();
await pausa();
assert.ok((await page.locator('.periodo:not(.vuoto):visible').count()) > 0, 'la generazione compila i periodi');
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Programma della settimana salvato').waitFor({ timeout: 15000 });
await pausa(500);
const residuoDopo = await page.locator('.conto-scalare b').innerText();
assert.notEqual(residuoPrima, residuoDopo, 'il conto a scalare è diminuito');

// 5. il TM crea un account e lo iscrive al corso
await esci();
await profilo('Luca Ferri');
await apriCorso('T1-2026/1');
await page.goto(`${BASE}#/distinta?c=c-2026-1`);
await pausa(500);
assert.match(await page.locator('body').innerText(), /Matteo Gallo/, 'il TM vede i frequentatori del corso');
await page.goto(`${BASE}#/account`);
await pausa();
await page.getByRole('button', { name: 'Nuovo account' }).click();
await page.getByLabel('Username').fill('nuovo.allievo');
const password = await page.getByLabel('Password provvisoria').inputValue();
await page.getByRole('button', { name: 'Crea account' }).click();
await page.getByText('Credenziali da consegnare di persona').waitFor();
await page.getByRole('button', { name: 'Chiudi' }).click();
await page.goto(`${BASE}#/corso?c=c-2026-1`);
await pausa();
await page.getByRole('combobox', { name: 'Aggiungi al corso' }).click();
await page.getByRole('option', { name: /nuovo\.allievo/ }).click();
await page.getByRole('button', { name: 'Iscrivi' }).click();
await page.getByText('Iscritto al corso').waitFor({ timeout: 15000 });

// 6. primo accesso del nuovo frequentatore: cambio password e Personal Data
await esci();
await page.locator('input[autocomplete=username]').fill('nuovo.allievo');
await page.locator('input[autocomplete=current-password]').fill(password);
await page.getByRole('button', { name: 'Accedi' }).click();
await page.getByText('Scegli la tua password').waitFor();
await page.getByLabel('Password provvisoria').fill(password);
await page.getByLabel(/^Nuova password/).fill('nuovapassword1');
await page.getByLabel('Ripeti la nuova password').fill('nuovapassword1');
await page.getByRole('button', { name: 'Cambia password' }).click();
await page.getByRole('heading', { name: 'Trainee data' }).waitFor();
await page.getByLabel('Rank (grado)').fill('Serg.');
await page.getByLabel('Name (nome)').fill('Marco');
await page.getByLabel('Surname (cognome)').fill('Villa');
await page.getByLabel('Date of birth').fill('1999-04-12');
await page.getByLabel('Place of birth').fill('Rieti');
await page.getByRole('button', { name: 'Salva personal data' }).click();
// si entra nell'avanzamento del corso, con teoria e pratica affiancate
await page.locator('.quadro-parti').waitFor();
assert.equal(await page.locator('.quadro-parti .parte-corso').count(), 2, 'avanzamento con le due parti');
await page.goto(`${BASE}#/tavola`);
await page.locator('.cartiglio').waitFor();
assert.ok(await page.locator('.cartiglio').getByText('Serg. Marco Villa').isVisible(), 'cartiglio del nuovo frequentatore');

// 7. l'istruttore legge e basta, e solo i suoi corsi
await esci();
await profilo('Paolo Rinaldi');
await page.goto(`${BASE}#/logbook?c=c-2026-1&f=u-romano`);
await pausa();
assert.equal(await page.getByRole('button', { name: /Registra/ }).count(), 0, 'istruttore in sola lettura');
await page.goto(`${BASE}#/settimana?c=c-2026-1`);
await pausa();
assert.equal(await page.getByRole('button', { name: 'Genera' }).count(), 0, 'istruttore non genera il programma');

// 8. un frequentatore compila il rapportino presenze per un compagno
await esci();
await profilo('Matteo Gallo');
await page.goto(`${BASE}#/rapportino?c=c-2026-1&g=2026-09-22`);
await pausa(500);
const primo = page.locator('.riga-presenza').first();
const nomeSegnato = (await primo.locator('.chi strong').innerText()).trim();
await primo.getByText('Assente', { exact: true }).click();
await primo.getByLabel('Motivo').fill('Servizio di guardia');
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Rapportino salvato').waitFor({ timeout: 15000 });
await pausa(400);
assert.ok(await page.locator('.riga-presenza.assente').first().isVisible(), 'assenza registrata nel rapportino');

// 9. il direttore valida il rapportino: da lì in poi il frequentatore non lo tocca più
await esci();
await profilo('Marco Neri');
await page.goto(`${BASE}#/rapportino?c=c-2026-1&g=2026-09-22`);
await pausa(500);
await page.getByRole('button', { name: 'Valida' }).click();
await page.getByText('Rapportino validato').waitFor({ timeout: 15000 });
await pausa(400);
assert.match(await page.locator('.conto-scalare').innerText(), /validato da/i, 'rapportino validato');
await page.goto(`${BASE}#/assenze?c=c-2026-1`);
await pausa(500);
const assenze = await page.locator('body').innerText();
assert.match(assenze, /Non idoneo/, 'lo staff vede chi ha superato il 10% di assenze');
assert.match(assenze, new RegExp(nomeSegnato.split(' ').at(-1)), 'il frequentatore segnato compare nel quadro assenze');

await esci();
await profilo('Matteo Gallo');
await page.goto(`${BASE}#/rapportino?c=c-2026-1&g=2026-09-22`);
await pausa(500);
assert.ok(await page.getByRole('button', { name: 'Salva' }).isDisabled(), 'rapportino validato: il frequentatore non lo modifica');
await page.goto(`${BASE}#/assenze?c=c-2026-1`);
await pausa(400);
assert.equal(await page.locator('.riga-assenze').count(), 1, 'il frequentatore vede solo le proprie assenze');

// 10. il direttore compone un singolo periodo e lo pubblica; prima della validazione il frequentatore non vede nulla
await esci();
await profilo('Marco Neri');
await page.goto(`${BASE}#/settimana?c=c-2026-2&w=2026-10-12`);
await pausa(500);
await page.locator('.periodo.vuoto:visible').first().click();
await page.getByRole('combobox', { name: 'Durata' }).click();
await page.getByRole('option', { name: '45′', exact: true }).click();
await page.getByRole('combobox', { name: 'Cosa si svolge' }).click();
await page.getByRole('option', { name: 'Esame teorico' }).click();
await page.getByRole('button', { name: 'Fatto' }).click();
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Programma della settimana salvato').waitFor({ timeout: 15000 });
await pausa(400);
assert.match(await page.locator('.settimana-testa').innerText(), /da validare/i, 'la settimana salvata resta da validare');

await esci();
await profilo('Davide Marchetti');
await page.goto(`${BASE}#/settimana?c=c-2026-2&w=2026-10-12`);
await pausa(500);
assert.equal(await page.locator('.periodo:not(.vuoto):visible').count(), 0, 'il frequentatore non vede il programma non validato');

await esci();
await profilo('Marco Neri');
await page.goto(`${BASE}#/settimana?c=c-2026-2&w=2026-10-12`);
await pausa(500);
await page.getByRole('button', { name: 'Altre azioni' }).click();
await page.getByRole('menuitem', { name: 'Valida la settimana' }).click();
await page.getByText('Settimana validata').waitFor({ timeout: 15000 });
await esci();
await profilo('Davide Marchetti');
await page.goto(`${BASE}#/settimana?c=c-2026-2&w=2026-10-12`);
await pausa(500);
assert.ok((await page.locator('.periodo:not(.vuoto):visible').count()) > 0, 'dopo la validazione il frequentatore vede il programma');
assert.match(await page.locator('.settimana-mobile').innerText(), /Esame/i, 'il periodo di esame teorico compare nel programma');

// 11. ore degli istruttori
await esci();
await profilo('Luca Ferri');
await page.goto(`${BASE}#/docenti?c=c-2026-1`);
await pausa(500);
assert.match(await page.locator('.cartiglio').innerText(), /ore già erogate/i, 'quadro delle ore degli istruttori');
assert.ok((await page.locator('.tabella tbody tr').count()) > 0, 'elenco istruttori con le ore erogate');

// 12. registri del Training Manager: corsi e corsisti, certificati P-147
await esci();
await profilo('Luca Ferri');
await page.goto(`${BASE}#/registro`);
await pausa(700);
const registro = await page.locator('body').innerText();
assert.match(registro, /Registro corsi e corsisti/i, 'registro corsi e corsisti');
assert.match(registro, /T1-2026\/1/, 'i corsi compaiono nel registro');
assert.match(registro, /Non idoneo/i, 'il registro segnala i non idonei');

await page.goto(`${BASE}#/certificati`);
await pausa(700);
assert.match(await page.locator('.cartiglio').innerText(), /AER\(EP\).P-147/i, 'registro dei certificati');
const primaCerti = await page.locator('.tabella tbody tr').count();
await page.getByRole('button', { name: 'Nuovo certificato' }).click();
await page.getByRole('combobox', { name: 'Intestatario' }).click();
await page.getByRole('option', { name: /Francesca Costa/ }).first().click();
await page.getByRole('button', { name: 'Rilascia il certificato' }).click();
await page.getByText('Certificato inserito nel registro').waitFor({ timeout: 15000 });
await pausa(600);
assert.equal(await page.locator('.tabella tbody tr').count(), primaCerti + 1, 'il certificato entra nel registro');
assert.match(await page.locator('.tabella tbody').innerText(), /Rilasciato/i, 'certificato rilasciato');

await browser.close();
assert.deepEqual(errori, [], `errori JavaScript: ${errori.join('; ')}`);
console.log('e2e: tutti i controlli superati');
