// Prova end-to-end nel browser (Microsoft Edge) sulla modalità dimostrativa (?demo).
//   npm run build && npx vite preview --port 4174   poi   npm run e2e
import { chromium } from '@playwright/test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
const entra = async (nome) => {
  await esci();
  await profilo(nome);
};
const apri = async (percorso, ms = 500) => {
  await page.goto(`${BASE}#${percorso}`);
  await pausa(ms);
};
const apriCorso = async (codice) => {
  await page.goto(`${BASE}#/corsi`);
  await page.locator('.scheda-corso', { hasText: codice }).getByRole('button', { name: 'Apri' }).click();
  await page.waitForSelector('.guscio');
  await pausa();
};
const testo = () => page.locator('body').innerText();
const cassetto = page.locator('.mantine-Drawer-content');
/** Sceglie una voce di una tendina. */
const scegli = async (tendina, voce, esatta = true) => {
  await page.getByRole('combobox', { name: tendina }).click();
  await page.getByRole('option', { name: voce, exact: esatta }).click();
};
/** Cerca nella tendina dei chapter e sceglie quello che comincia con il testo dato. */
const scegliChapter = async (cerca, inizio) => {
  await page.getByRole('combobox', { name: 'Chapter' }).fill(cerca);
  await page.getByRole('option', { name: new RegExp(`^${inizio}`) }).click();
};
const salvaSettimana = async () => {
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.getByText('Programma della settimana salvato').last().waitFor({ timeout: 15000 });
  await pausa(800);
};
const validaSettimana = async () => {
  await page.getByRole('button', { name: 'Altre azioni' }).click();
  await page.getByRole('menuitem', { name: 'Valida la settimana' }).click();
  await page.getByText('Settimana validata').waitFor({ timeout: 15000 });
};
const nonTrovata = async (percorso, perche) => {
  await apri(percorso);
  assert.equal(await page.getByRole('heading', { name: 'Pagina non trovata' }).count(), 1, perche);
};

await page.goto(BASE);
await page.waitForSelector('.profili');
await page.getByRole('button', { name: 'Ripristina la situazione esempio' }).click();

// 1. il frequentatore registra un task dal telefono: aeromobile dall'elenco del corso, luogo già compilato
await profilo('Matteo Gallo');
await apri('/logbook?ch=44');
await page.locator('.task-riga').first().click();
await page.getByRole('button', { name: 'Registra questo task' }).click();
const luogo = cassetto.getByRole('textbox', { name: 'Maintenance location' });
assert.ok(await luogo.inputValue(), 'il luogo di manutenzione è già compilato');
assert.equal(await luogo.getAttribute('placeholder'), null, 'nessun testo di esempio nel luogo di manutenzione');
await page.getByRole('combobox', { name: 'Aeromobile' }).click();
const aeromobili = await page.getByRole('option').allInnerTexts();
assert.ok(aeromobili.length > 1 && aeromobili.every((a) => /EI-?\d+$/.test(a)), `aeromobili del corso nella tendina: ${aeromobili}`);
await page.getByRole('option').first().click();
await page.getByLabel(/ET – tempo stimato/).fill('35');
await page.getByRole('button', { name: 'Salva' }).click();
await page.waitForSelector('.task.eseguito');
await apri('/report', 300);
const riga44 = page.locator('.cr-tabella tr', { has: page.locator('td:first-child', { hasText: /^44$/ }) });
assert.equal((await riga44.locator('td').nth(2).textContent()).trim(), '1', 'chapter 44 eseguito nel report');

// 2. data futura rifiutata
await apri('/logbook', 300);
await page.getByRole('button', { name: /^Registra task$/ }).last().click();
await page.getByPlaceholder('Cerca per numero, chapter o descrizione').fill('Placards');
await page.getByRole('option').first().click();
await page.getByLabel(/^Data/).fill('2099-01-01');
await page.getByLabel(/ET – tempo stimato/).fill('20');
await page.getByRole('button', { name: 'Salva' }).click();
// il browser blocca già l'invio (max = oggi); il motore rifiuta comunque le date future (tests/dominio.test.ts)
assert.ok(await page.getByLabel(/^Data/).evaluate((el) => el.validity.rangeOverflow), 'data futura bloccata');
assert.ok(await cassetto.isVisible(), 'registrazione non salvata');
await page.keyboard.press('Escape');

// 3. il frequentatore vede solo il proprio corso; i Personal Data li legge ma non li modifica
assert.equal(await page.locator('.scheda-corso').count(), 0, 'il frequentatore non gestisce i corsi');
await apri('/teoria', 300);
assert.match(await page.locator('.cartiglio').innerText(), /ore/i, 'il frequentatore vede la situazione della teoria');
await apri('/dati', 300);
assert.equal(await page.getByLabel('Surname (cognome)').inputValue(), 'Gallo', 'il frequentatore legge i propri Personal Data');
assert.equal(await page.getByRole('button', { name: /^Salva/ }).count(), 0, 'ma non li modifica');
await nonTrovata('/docenti', 'il frequentatore non apre le ore degli istruttori');
await nonTrovata('/istruttori', 'il frequentatore non apre Practical Instructors');
await nonTrovata('/registro', 'il frequentatore non apre il registro');

// 4. il direttore prepara una settimana di lezioni e vede il conto a scalare
await entra('Marco Neri');
await apriCorso('T1-2026/2');
await apri('/settimana?c=c-2026-2&w=2026-10-05');
const residuoPrima = await page.locator('.conto-scalare b').innerText();
await page.getByRole('button', { name: 'Genera' }).click();
await pausa();
assert.ok((await page.locator('.periodo:not(.vuoto):visible').count()) > 0, 'la generazione compila i periodi');
await salvaSettimana();
assert.notEqual(residuoPrima, await page.locator('.conto-scalare b').innerText(), 'il conto a scalare è diminuito');
// la situazione della teoria colora le materie: verde se a calendario per intero, ambra se in parte
await apri('/teoria?c=c-2026-2');
assert.ok((await page.locator('td.si').count()) > 0 && (await page.locator('td.in-parte').count()) > 0, 'materie complete e parziali distinte dal colore');
// direttore: ore degli istruttori sì, registri e abilitazioni no
await apri('/docenti?c=c-2026-2');
assert.match(await page.locator('.cartiglio').innerText(), /ore/i, 'il direttore vede le ore degli istruttori del suo corso');
await nonTrovata('/registro', 'il direttore non apre il registro corsi e corsisti');
await nonTrovata('/certificati', 'il direttore non apre il registro dei certificati');
await nonTrovata('/materie', 'il direttore non apre materie e istruttori');

// 5. il TM crea un account (solo frequentatore o istruttore) e lo assegna al corso
await entra('Luca Ferri');
await apriCorso('T1-2026/1');
await apri('/distinta?c=c-2026-1');
assert.match(await testo(), /Matteo Gallo/, 'il TM vede i frequentatori del corso');
await apri('/account', 300);
// il filtro ha una voce per corso, con i suoi frequentatori
await page.locator('input[aria-label="Quali account mostrare"]').click();
await page.getByRole('option', { name: /Frequentatori · T1-2026\/2/ }).click();
await pausa();
const delCorso = await page.locator('.foglio').innerText();
assert.match(delCorso, /Davide Marchetti/, 'il filtro per corso mostra i suoi frequentatori');
assert.doesNotMatch(delCorso, /Matteo Gallo|Paolo Rinaldi/, 'e solo quelli');
await page.getByRole('button', { name: 'Nuovo account' }).click();
await page.getByLabel('Username').waitFor();
assert.deepEqual(await cassetto.locator('.mantine-SegmentedControl-label').allInnerTexts(), ['Frequentatore', 'Istruttore'], 'si creano solo frequentatori e istruttori');
await page.getByLabel('Username').fill('nuovo.allievo');
const password = await page.getByLabel('Password provvisoria').inputValue();
await page.getByRole('button', { name: 'Crea account' }).click();
await page.getByText('Credenziali da consegnare di persona').waitFor();
await page.getByRole('button', { name: 'Chiudi' }).click();
await apri('/corso?c=c-2026-1', 300);
await page.getByRole('combobox', { name: 'Assegna al corso' }).click();
assert.equal(await page.getByRole('option', { name: /Rinaldi|Neri|Greco|Colombo/ }).count(), 0, 'gli istruttori non si assegnano al corso');
await page.getByRole('option', { name: /nuovo\.allievo/ }).click();
await page.getByRole('button', { name: 'Assegna', exact: true }).click();
await page.getByText('Assegnato al corso').waitFor({ timeout: 15000 });
await apri('/account', 300);
await page.locator('input[aria-label="Quali account mostrare"]').click();
await page.getByRole('option', { name: /Frequentatori · T1-2026\/1/ }).click();
await pausa();
assert.match(await page.locator('.foglio').innerText(), /nuovo\.allievo/, 'l’assegnazione al corso si riflette negli account');

// 6. primo accesso del nuovo frequentatore: cambia la password ed entra; i Personal Data glieli inserisce il direttore
await esci();
await page.locator('input[autocomplete=username]').fill('nuovo.allievo');
await page.locator('input[autocomplete=current-password]').fill(password);
await page.getByRole('button', { name: 'Accedi' }).click();
await page.getByText('Scegli la tua password').waitFor();
await page.getByLabel('Password provvisoria').fill(password);
await page.getByLabel(/^Nuova password/).fill('nuovapassword1');
await page.getByLabel('Ripeti la nuova password').fill('nuovapassword1');
await page.getByRole('button', { name: 'Cambia password' }).click();
// si entra nell'avanzamento del corso, con teoria e pratica affiancate
await page.locator('.quadro-parti').waitFor();
assert.equal(await page.locator('.quadro-parti .parte-corso').count(), 2, 'avanzamento con le due parti');

await entra('Marco Neri');
await apri('/dati?c=c-2026-1');
await page.getByRole('combobox', { name: 'Frequentatore' }).click();
await page.getByRole('option', { name: /nuovo\.allievo/ }).click();
await page.getByRole('heading', { name: 'Trainee data' }).waitFor();
await page.getByLabel('Rank (grado)').fill('Serg.');
await page.getByLabel('Name (nome)').fill('Marco');
await page.getByLabel('Surname (cognome)').fill('Villa');
await page.getByLabel('Date of birth').fill('1999-04-12');
await page.getByLabel('Place of birth').fill('Rieti');
await page.getByRole('button', { name: 'Salva personal data' }).click();
await page.getByText('Personal data salvati').waitFor({ timeout: 15000 });
await apri('/tavola?c=c-2026-1');
assert.ok(await page.locator('.cartiglio').getByText('Serg. Marco Villa').isVisible(), 'cartiglio del nuovo frequentatore');

// 7. l'istruttore legge e basta, solo i suoi corsi, e non apre le pagine di chi guida il corso
await entra('Paolo Rinaldi');
await apri('/logbook?c=c-2026-1&f=u-romano', 300);
assert.equal(await page.getByRole('button', { name: /Registra/ }).count(), 0, 'istruttore in sola lettura');
await apri('/settimana?c=c-2026-1', 300);
assert.equal(await page.getByRole('button', { name: 'Genera' }).count(), 0, 'istruttore non genera il programma');
await nonTrovata('/docenti?c=c-2026-1', 'l’istruttore non apre le ore degli istruttori');
await nonTrovata('/istruttori?c=c-2026-1&f=u-romano', 'l’istruttore non apre Practical Instructors');
await nonTrovata('/materie', 'l’istruttore non apre materie e istruttori');

// 8. un frequentatore compila il rapportino presenze per un compagno
await entra('Matteo Gallo');
await apri('/rapportino?c=c-2026-1&g=2026-09-22');
const primo = page.locator('.riga-presenza').first();
const nomeSegnato = (await primo.locator('.chi strong').innerText()).trim();
await primo.getByText('Assente', { exact: true }).click();
await primo.getByLabel('Motivo').fill('Servizio di guardia');
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Rapportino salvato').waitFor({ timeout: 15000 });
await pausa(400);
assert.ok(await page.locator('.riga-presenza.assente').first().isVisible(), 'assenza registrata nel rapportino');

// 9. il direttore valida il rapportino: da lì in poi il frequentatore non lo tocca più
await entra('Marco Neri');
await apri('/rapportino?c=c-2026-1&g=2026-09-22');
await page.getByRole('button', { name: 'Valida' }).click();
await page.getByText('Rapportino validato').waitFor({ timeout: 15000 });
await pausa(400);
assert.match(await page.locator('.conto-scalare').innerText(), /validato da/i, 'rapportino validato');
await apri('/assenze?c=c-2026-1');
const assenze = await testo();
assert.match(assenze, /Non idoneo/, 'lo staff vede chi ha superato il 10% di assenze');
assert.match(assenze, new RegExp(nomeSegnato.split(' ').at(-1)), 'il frequentatore segnato compare nel quadro assenze');

await entra('Matteo Gallo');
await apri('/rapportino?c=c-2026-1&g=2026-09-22');
assert.ok(await page.getByRole('button', { name: 'Salva' }).isDisabled(), 'rapportino validato: il frequentatore non lo modifica');
await apri('/assenze?c=c-2026-1', 400);
assert.equal(await page.locator('.riga-assenze').count(), 1, 'il frequentatore vede solo le proprie assenze');

// 10. il direttore compone i periodi uno a uno: ogni attività ha i suoi campi
await entra('Marco Neri');
await apri('/settimana?c=c-2026-2&w=2026-10-12');
const nuovoPeriodo = () => page.locator('.periodo.vuoto:visible').first().click();
const fatto = () => page.getByRole('button', { name: 'Fatto' }).click();
// esame teorico: l'istruttore è il presidente di commissione
await nuovoPeriodo();
await scegli('Durata', '45′');
await scegli('Cosa si svolge', 'Esame teorico');
assert.equal(await page.getByRole('combobox', { name: 'Presidente di commissione' }).count(), 1, 'esame: presidente di commissione');
assert.equal(await page.getByRole('combobox', { name: 'Chapter' }).count(), 0, 'esame: nessun chapter');
await fatto();
// sospensione: cella sbarrata, senza istruttore né aula
await nuovoPeriodo();
await scegli('Cosa si svolge', 'Sospensione');
assert.equal(await cassetto.getByText(/^(Istruttore|Aula|Note|Chapter)/).count(), 0, 'sospensione: nessun altro campo');
await fatto();
assert.equal(await page.locator('.periodo.t-sospensione:visible').count(), 1, 'la sospensione è una cella sbarrata');
// MEO: si propone il direttore del corso
await nuovoPeriodo();
await scegli('Cosa si svolge', 'Mantenimento efficienza operativa');
assert.match(await page.getByRole('combobox', { name: 'Istruttore di riferimento' }).inputValue(), /Marco Neri/, 'MEO: proposto il direttore del corso');
await fatto();
// pratiche amministrative: anche chi non ha un account, come l'RSPP
await nuovoPeriodo();
await scegli('Cosa si svolge', 'Pratiche amministrative');
await page.getByPlaceholder('nessuno', { exact: true }).click();
await page.getByRole('option', { name: 'RSPP', exact: true }).click();
await fatto();
// altrove l'RSPP non è fra le persone selezionabili
await nuovoPeriodo();
await scegli('Cosa si svolge', 'Valutazione in itinere');
assert.match(await page.getByRole('combobox', { name: 'Durata' }).inputValue(), /60′|1 h/, 'valutazione in itinere: un’ora');
await page.getByRole('combobox', { name: 'Istruttore' }).click();
assert.equal(await page.getByRole('option', { name: 'RSPP' }).count(), 0, 'RSPP solo nelle pratiche amministrative');
await page.getByRole('option', { name: /Stefano Greco/ }).click();
await fatto();
// lezione di recupero: per i frequentatori scelti
await nuovoPeriodo();
await scegli('Cosa si svolge', 'Lezione di recupero');
await page.getByPlaceholder('Scegli i frequentatori').click();
await page.getByRole('option', { name: /Davide Marchetti/ }).click();
await page.locator('.mantine-Drawer-title').click();
await fatto();
for (const tipo of ['Esame pratico', 'Practical training']) {
  await nuovoPeriodo();
  await scegli('Cosa si svolge', tipo);
  await fatto();
}
await salvaSettimana();
assert.match(await page.locator('.settimana-testa').innerText(), /da validare/i, 'la settimana salvata resta da validare');
const griglia = await page.locator('.settimana-mobile').innerText();
for (const sigla of ['EX', 'MEO', 'PA', 'RSPP', 'VI', 'PT', 'REC']) assert.match(griglia, new RegExp(`\\b${sigla}\\b`), `nella griglia compare ${sigla}`);

// prima della validazione il frequentatore non vede nulla
await entra('Davide Marchetti');
await apri('/settimana?c=c-2026-2&w=2026-10-12');
assert.equal(await page.locator('.periodo:not(.vuoto):visible').count(), 0, 'il frequentatore non vede il programma non validato');
assert.equal(await page.getByRole('button', { name: 'Altre azioni' }).count(), 0, 'il modulo con i nominativi non è per i frequentatori');

await entra('Marco Neri');
await apri('/settimana?c=c-2026-2&w=2026-10-12');
await validaSettimana();
await entra('Davide Marchetti');
await apri('/settimana?c=c-2026-2&w=2026-10-12');
assert.ok((await page.locator('.periodo:not(.vuoto):visible').count()) > 0, 'dopo la validazione il frequentatore vede il programma');
assert.match(await page.locator('.settimana-mobile').innerText(), /Esame/i, 'il periodo di esame teorico compare nel programma');

// 11. ore degli istruttori
await entra('Luca Ferri');
await apri('/docenti?c=c-2026-1');
assert.match(await page.locator('.cartiglio').innerText(), /ore già erogate/i, 'quadro delle ore degli istruttori');
assert.ok((await page.locator('.tabella tbody tr').count()) > 0, 'elenco istruttori con le ore erogate');

// 12. registri del Training Manager: corsi e corsisti, certificati P-147
await apri('/registro', 700);
const registro = await testo();
assert.match(registro, /Registro corsi e corsisti/i, 'registro corsi e corsisti');
assert.match(registro, /T1-2026\/1/, 'i corsi compaiono nel registro');
assert.match(registro, /Non idoneo/i, 'il registro segnala i non idonei');

await apri('/certificati', 700);
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

// 13. il TM affida il secondo corso a un altro istruttore e scarica il programma sul modulo ufficiale
await apri('/corsi', 300);
await page.locator('.scheda-corso', { hasText: 'T1-2026/2' }).getByRole('button', { name: 'Modifica' }).click();
const direttore = page.getByPlaceholder('da assegnare');
assert.match(await direttore.inputValue(), /Marco Neri/, 'il direttore attuale è nel campo del corso');
await direttore.fill('Greco');
await page.getByRole('option', { name: /Stefano Greco/ }).click();
await page.getByLabel('Gruppo firma del comandante').fill('Ten. Col. Prova FIRMA');
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Corso aggiornato').waitFor({ timeout: 15000 });
await apri('/corso?c=c-2026-2');
assert.match(await page.locator('.riepilogo-corso').innerText(), /Direttore del corso\s+1° Mar\. Stefano Greco/i, 'il nuovo direttore compare nel corso');
assert.match(await testo(), /\(stimata\)/, 'a corso aperto la data di fine è stimata');
await apri('/settimana?c=c-2026-2&w=2026-09-14');
// il chapter della lezione si sceglie solo fra quelli con ore nel syllabus: niente 35 Oxygen, 36 Pneumatic, 14, 63A…
await page.locator('.periodo:not(.vuoto):visible').first().click();
const chapter = page.getByRole('combobox', { name: 'Chapter' });
for (const assente of ['Oxygen', 'Pneumatic', '63A']) {
  await chapter.fill(assente);
  await pausa(300);
  assert.equal(await page.getByRole('option').count(), 0, `chapter non previsto dal syllabus non selezionabile: ${assente}`);
}
await chapter.fill('Servicing');
await pausa(300);
assert.deepEqual((await page.getByRole('option').allInnerTexts()).map((t) => t.split(' · ')[0]), ['12'], 'Servicing è il solo chapter 12');
await page.getByRole('option').first().click();
// l'istruttore si sceglie solo fra gli abilitati a quel chapter
await page.getByRole('combobox', { name: 'Istruttore' }).click();
assert.deepEqual(await page.getByRole('option').allInnerTexts(), ['1° Mar. Stefano Greco'], 'solo gli istruttori abilitati al chapter');
await page.getByRole('option').first().click();
// due lezioni di mezz'ora nella stessa ora: si accorcia la prima e nel tempo libero si mette la seconda
await scegli('Durata', '30′');
await page.getByRole('button', { name: /Altra lezione nel periodo · 30′ liberi/ }).click();
await pausa(300);
await scegliChapter('Lifting', '07 · Lifting');
assert.ok(await page.getByRole('button', { name: /prima accorcia questa/ }).isDisabled(), 'ora piena: niente terza lezione');
await fatto();
const parti = page.locator('.periodo.parte:visible');
assert.equal(await parti.count(), 2, 'il periodo mostra le due lezioni');
assert.match((await parti.allInnerTexts()).join(' | '), /08:20\s*Ch 12\s*Servicing[\s\S]*\|\s*08:50\s*Ch 07\s*Lifting and Shoring/, 'ogni lezione con il suo orario e il suo chapter');
await salvaSettimana();
await page.getByRole('button', { name: 'Altre azioni' }).click();
const [scaricato] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Programma settimanale in Excel' }).click()]);
assert.equal(scaricato.suggestedFilename(), 'Programma_settimanale_T1-2026_2_2026-09-14.xlsx', 'nome del file del programma settimanale');
const foglio = strFromU8(unzipSync(new Uint8Array(readFileSync(await scaricato.path())))['xl/worksheets/sheet1.xml']);
assert.match(foglio, /<c r="C11"[^>]*><is><t[^>]*>Servicing<\/t><\/is><\/c>.*<c r="G11"[^>]*><v>12<\/v><\/c>/, 'modulo: ADDESTRAMENTO e COD. del chapter svolto');
// il periodo diviso prende una riga in più sul modulo, ciascuna con il suo orario
assert.match(foglio, /<c r="B11"[^>]*><is><t[^>]*>08:20-08:50<\/t>.*<c r="B12"[^>]*><is><t[^>]*>08:50-09:20<\/t>.*<c r="C12"[^>]*><is><t[^>]*>Lifting and Shoring<\/t>/, 'modulo: una riga per ciascuna lezione del periodo');
assert.equal(foglio.match(/<row r="/g).length, 64, 'modulo: il resto scende di una riga');
for (const atteso of ['T1-2026/2', '1° Mar. GRECO Stefano', 'Ten. Col. Prova FIRMA', 'Serg. MARCHETTI Davide', '08:20-09:20', 'Aula N.1']) assert.ok(foglio.includes(atteso), `modulo compilato: ${atteso}`);

// 14. l'istruttore vede subito le sue lezioni da oggi in poi, ma solo quando la settimana è validata
const FUTURA = '2027-03-01';
await apri(`/settimana?c=c-2026-2&w=${FUTURA}`);
await nuovoPeriodo();
await scegliChapter('Time limits', '05 · Time limits');
const istruttore = page.getByRole('combobox', { name: 'Istruttore' });
if (!/Rinaldi/.test(await istruttore.inputValue())) {
  await istruttore.click();
  await page.getByRole('option', { name: /Paolo Rinaldi/ }).click();
}
await fatto();
await salvaSettimana();
const sueLezioni = async () => {
  await entra('Paolo Rinaldi');
  await page.goto(`${BASE}#/corsi`);
  await page.getByRole('heading', { name: 'Le mie lezioni' }).waitFor();
  return page.locator('.mie-lezioni section', { hasText: '01/03' });
};
assert.equal(await (await sueLezioni()).count(), 0, 'settimana non validata: la lezione non è ancora un impegno');
await entra('Luca Ferri');
await apri(`/settimana?c=c-2026-2&w=${FUTURA}`);
await validaSettimana();
const impegno = await sueLezioni();
assert.equal(await impegno.count(), 1, 'settimana validata: la lezione compare fra gli impegni');
assert.match(await impegno.innerText(), /08:20–09:20[\s\S]*Ch 05 · /, 'impegno con orario e chapter');
await apri(`/settimana?c=c-2026-2&w=${FUTURA}`);
assert.equal(await page.locator('.periodo.mia:visible').count(), 1, 'nella griglia la sua lezione è evidenziata');

// chi dirigeva il corso torna istruttore in quel corso, e resta direttore dell'altro
await entra('Marco Neri');
await apri('/settimana?c=c-2026-2&w=2026-10-19');
assert.equal(await page.getByRole('button', { name: 'Genera' }).count(), 0, 'senza incarico l’istruttore non prepara il programma');
await nonTrovata('/docenti?c=c-2026-2', 'né vede le ore degli istruttori di quel corso');
await apri('/settimana?c=c-2026-1&w=2026-10-19');
assert.equal(await page.getByRole('button', { name: 'Genera' }).count(), 1, 'nel corso che dirige prepara il programma');

// 15. menu del TM: «Materie e istruttori» accanto a «Corsi», «Generality and Purpose» nella parte pratica
await entra('Luca Ferri');
await page.setViewportSize({ width: 1280, height: 900 });
await apri('/distinta?c=c-2026-1');
const menu = (await page.locator('nav').first().innerText()).replace(/\s+/g, ' ');
assert.match(menu, /Corsi Materie e istruttori/, 'Materie e istruttori accanto a Corsi');
assert.match(menu, /Personal & Training Data Generality and Purpose/, 'Generality and Purpose sotto la parte pratica');
// su schermo largo l'elenco per telefono non si accoda più alla tabella dei frequentatori
assert.equal(await page.locator('.elenco-mobile.solo-mobile-blocco').isVisible(), false, 'la distinta mostra la sola tabella');
await page.setViewportSize({ width: 390, height: 844 });

// 16. abilitazioni: dall'Excel (qui scelto dal computer) e a mano; chi è abilitato diventa selezionabile
await apri('/materie');
const riga = (n, celle) => `<row r="${n}">${celle.map((t, i) => `<c r="${'ABC'[i]}${n}" t="inlineStr"><is><t>${t}</t></is></c>`).join('')}</row>`;
const excel = zipSync({ 'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${riga(1, ['Istruttore', 'MDS', 'Chapter'])}${riga(2, ['Colombo Andrea', 'CH-47F', '12, 07, 63A'])}</sheetData></worksheet>`) });
await page.locator('input[type=file]').setInputFiles({ name: 'Abilitazioni.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(excel) });
await page.getByText('2 abilitazioni per 1 istruttori').waitFor();
assert.match(await testo(), /chapter «63A» non previsto dal syllabus/, 'i chapter fuori syllabus sono segnalati e scartati');
await page.getByRole('button', { name: 'Importa', exact: true }).click();
await page.getByText('Abilitazioni importate per 1 istruttori').waitFor({ timeout: 15000 });
const copertura = page.locator('.tabella tbody tr', { has: page.locator('td:first-child', { hasText: /^12$/ }) });
assert.match(await copertura.innerText(), /Stefano Greco.*Andrea Colombo|Andrea Colombo.*Stefano Greco/, 'copertura del chapter 12 aggiornata');
await apri('/settimana?c=c-2026-2&w=2027-03-08');
await nuovoPeriodo();
await scegliChapter('Servicing', '12 · Servicing');
await page.getByRole('combobox', { name: 'Istruttore' }).click();
assert.equal(await page.getByRole('option').count(), 2, 'dopo l’abilitazione l’istruttore è selezionabile per quel chapter');
await page.getByRole('option', { name: /Andrea Colombo/ }).click();
await fatto();

// 17. esclusione di un frequentatore: fuori dalle viste attive, dati storici consultabili, modifiche con conferma
await apri('/corso?c=c-2026-1');
await page.locator('.elenco-iscritti li', { hasText: 'Matteo Gallo' }).getByRole('button', { name: 'Escludi' }).click();
await page.getByRole('button', { name: 'Escludi dal corso' }).click();
await page.getByText('Frequentatore escluso dal corso').waitFor({ timeout: 15000 });
await page.getByText('Esclusi dal corso · 1').waitFor();
await apri('/distinta?c=c-2026-1');
assert.doesNotMatch(await page.locator('.foglio').innerText(), /Matteo Gallo/, 'l’escluso non è più nella situazione pratica');
await apri('/dati?c=c-2026-1&f=u-gallo');
assert.match(await page.locator('.avviso-escluso').innerText(), /Fuori dal corso dal/, 'i dati storici restano consultabili');
await page.getByLabel('Ente di appartenenza').fill('1° Rgt. AVES');
await page.getByRole('button', { name: 'Salva personal data' }).click();
const conferma = page.getByRole('dialog', { name: 'Conferma la modifica' });
assert.match(await conferma.innerText(), /Matteo Gallo è fuori dal corso T1-2026\/1 dal .+ Confermi la modifica dei suoi dati\?/, 'modificare i dati di un escluso chiede conferma');
await conferma.getByRole('button', { name: 'Sì, confermo' }).click();
await page.getByText('Personal data salvati').waitFor({ timeout: 15000 });

// 18. chiusura del corso: data effettiva al posto di quella stimata; poi ogni modifica chiede conferma
await apri('/corsi', 300);
await page.locator('.scheda-corso', { hasText: 'T1-2026/1' }).getByRole('button', { name: 'Modifica' }).click();
await cassetto.getByRole('switch', { name: 'Corso completato' }).check();
assert.ok(await page.getByLabel('Data effettiva di chiusura').inputValue(), 'alla chiusura si indica la data effettiva');
await page.getByLabel('Data effettiva di chiusura').fill('2026-10-09');
await page.getByRole('button', { name: 'Salva' }).click();
await page.getByText('Corso aggiornato').waitFor({ timeout: 15000 });
assert.match(await page.locator('.scheda-corso', { hasText: 'T1-2026/1' }).innerText(), /Completato/, 'il corso risulta completato');
await apri('/registro', 700);
const chiuso = await testo();
assert.match(chiuso, /09\/10\/2026/, 'nel registro la data di chiusura effettiva');
assert.match(chiuso, /completato/i, 'nel registro il corso è completato');
await apri('/corso?c=c-2026-1');
const pagina = await testo();
assert.match(pagina, /Corso completato il 09\/10\/2026/, 'il corso completato resta consultabile');
assert.doesNotMatch(pagina, /stimata/, 'la data effettiva sostituisce quella stimata');
await page.getByRole('button', { name: 'Riammetti' }).click();
assert.match(await conferma.innerText(), /Il corso T1-2026\/1 è completato\. Confermi la modifica\?/, 'corso completato: la modifica chiede conferma');
await conferma.getByRole('button', { name: 'Annulla' }).click();
await pausa(500);
assert.equal(await page.getByText('Esclusi dal corso · 1').count(), 1, 'senza conferma non si salva nulla');
await page.getByRole('button', { name: 'Riammetti' }).click();
await conferma.getByRole('button', { name: 'Sì, confermo' }).click();
await page.getByText('Riammesso al corso').waitFor({ timeout: 15000 });

await browser.close();
assert.deepEqual(errori, [], `errori JavaScript: ${errori.join('; ')}`);
console.log('e2e: tutti i controlli superati');
