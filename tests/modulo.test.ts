import { strFromU8, unzipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { applica } from '../src/dominio/motore';
import { lezioniDi } from '../src/dominio/viste';
import { celleSettimana, creaModuloSettimana } from '../src/moduloSettimana';

/** Programma settimanale sul modulo ufficiale (public/modelli/programma-settimanale.xlsx). */

const modello = new Uint8Array(readFileSync(resolve(__dirname, '../public/modelli/programma-settimanale.xlsx')));
const C1 = 'c-2026-1';
const LUNEDI = '2026-07-13'; // seconda settimana del primo corso: c'è il periodo MEO del lunedì
const dati = datiEsempio();
const corso = dati.corsi.find((c) => c.id === C1)!;
const lezioni = lezioniDi(dati, C1);

it('ogni cella del modulo prende il suo valore: intestazione, periodi a orari fissi, direttore, frequentatori, firma', () => {
  const c = celleSettimana(dati, corso, LUNEDI, lezioni);
  expect([c.C6, c.H6, c.C8, c.H8]).toEqual(['T1-2026/1', 2, '13 settimane', null]);
  expect([c.C7, c.H7]).toEqual([46209, 46297]); // 06/07/2026 e 02/10/2026 come le conserva Excel
  expect([c.A11, c.A39]).toEqual(['Lun\n13/07', 'Ven\n17/07']);
  // lunedì: quattro periodi, la pausa pranzo (riga 15, non toccata), poi gli ultimi due; il sesto è MEO
  expect([11, 12, 13, 14, 16, 17].map((r) => c[`B${r}`])).toEqual(['08:20-09:20', '09:30-10:30', '10:50-11:50', '12:00-13:00', '14:00-15:00', '15:10-16:10']);
  expect(Object.keys(c).some((k) => /^[A-I](15|22|29|36)$/.test(k))).toBe(false);
  expect([c.C17, c.G17, c.H17, c.I17]).toEqual(['Mantenimento Efficienza Operativa', 'MEO', '', 'Aula N.1']);
  // lezione: titolo e numero del chapter svolto, grado e cognome dell'istruttore, aula del corso
  const prima = lezioni.find((l) => l.data === LUNEDI && l.ordine === 0)!;
  expect([c.C11, c.G11]).toEqual(['Rotor Drives', 63]);
  expect(c.H11).toBe({ 'u-rinaldi': 'Mar. Ca. Rinaldi', 'u-colombo': 'Lgt. Colombo', 'u-neri': 'Cap. Neri' }[prima.istruttore_id!]);
  expect(c.I11).toBe('Aula N.1');
  expect(c.C43).toBe('Cap. NERI Marco');
  // frequentatori in ordine alfabetico, «Grado COGNOME Nome» ed ente; chi non ha compilato i Personal Data resta con lo username
  expect([c.B47, c.D47, c.B51, c.B52, c.B53, c.G47]).toEqual(['Serg. BRUNO Alessandro', '1° Rgt. AVES', 'Serg. Magg. ROMANO Giulia', 'simone.fontana', null, null]);
  expect(c.F58).toBe('Col. Giorgio ESEMPIO');
});

it('settimana oltre la fine stimata: riporta il ritardo; il venerdì ha tre periodi; codici non numerici restano testo', () => {
  const tardi = celleSettimana(dati, corso, '2026-10-12', [
    { id: 'x', corso_id: C1, data: '2026-10-16', ordine: 2, minuti: 45, materia: 'm001', chapter: '05', istruttore_id: null, aula: 'Aula N.4', tipo: 'recupero', note: '' },
    { id: 'y', corso_id: C1, data: '2026-10-12', ordine: 0, minuti: 60, materia: '', chapter: '', istruttore_id: null, aula: '', tipo: 'sospensione', note: '' },
    // gruppo «Navigation» (34…42A): sul modulo va il chapter svolto, non il nome del gruppo
    { id: 'z', corso_id: C1, data: '2026-10-13', ordine: 0, minuti: 60, materia: 'm028', chapter: '36', istruttore_id: null, aula: '', tipo: 'lezione', note: '' },
    { id: 'w', corso_id: C1, data: '2026-10-13', ordine: 1, minuti: 60, materia: 'm028', chapter: '34', istruttore_id: null, aula: '', tipo: 'lezione', note: '' },
    { id: 'v', corso_id: C1, data: '2026-10-13', ordine: 2, minuti: 60, materia: 'm028', chapter: '', istruttore_id: null, aula: '', tipo: 'lezione', note: '' },
  ]);
  expect([18, 19, 20].map((r) => [tardi[`C${r}`], tardi[`G${r}`]])).toEqual([['Pneumatic', 36], ['Navigation', 34], ['Navigation', 34]]);
  expect([tardi.H6, tardi.H8]).toEqual([15, '2 settimane']);
  expect([tardi.B41, tardi.C41, tardi.G41, tardi.I41]).toEqual(['10:50-11:35', 'Time limits/Maintenance checks (recupero)', '05', 'Aula N.4']);
  expect([tardi.C11, tardi.G11, tardi.I11]).toEqual(['Sospensione', '////', '////']);
  expect('B42' in tardi || 'C44' in tardi).toBe(false);
});

it('il file Excel è il modulo ufficiale compilato: stessa struttura, nessun dato dell’esempio originale', () => {
  const bytes = creaModuloSettimana(modello, dati, corso, LUNEDI, lezioni);
  if (process.env.PTT_SALVA_XLSX) writeFileSync(process.env.PTT_SALVA_XLSX, bytes);
  const parti = unzipSync(bytes);
  expect(Object.keys(parti).sort()).toEqual(Object.keys(unzipSync(modello)).sort());
  const foglio = strFromU8(parti['xl/worksheets/sheet1.xml']);
  const originale = strFromU8(unzipSync(modello)['xl/worksheets/sheet1.xml']);
  // stile, unioni e impostazione di stampa restano quelli del modulo
  const struttura = (xml: string) => [xml.match(/<mergeCells.*<\/mergeCells>/)![0], xml.match(/<pageSetup[^>]*>/)![0], xml.match(/<cols>.*<\/cols>/)![0], [...xml.matchAll(/<c r="([A-Z]+\d+)"( s="\d+")?/g)].map((m) => m[0])];
  expect(struttura(foglio)).toEqual(struttura(originale));
  expect(foglio).toContain('<c r="H6" s="31"><v>2</v></c>');
  expect(foglio).toContain('<c r="C43" s="31" t="inlineStr"><is><t xml:space="preserve">Cap. NERI Marco</t></is></c>');
  expect(foglio).toContain('PAUSA PRANZO');
  for (const residuo of ['06-B1.3-CH', 'Navigation', '20 settimane', 'Grado COGNOME Nome', 'Gruppo firma COMANDANTE', '12:00-13-00']) expect(foglio).not.toContain(residuo);
  expect(strFromU8(parti['xl/workbook.xml'])).toContain(`'2 SETTIMANA'!$A$1:$I$63`);
  // nel modulo non restano autori né percorsi del file originale
  expect(Object.keys(parti).some((p) => p.startsWith('docProps') || p.includes('printerSettings'))).toBe(false);
});

it('caratteri speciali e corso troppo numeroso', () => {
  const firmato = { ...corso, gruppo_firma: 'Col. <A&B>' };
  expect(strFromU8(unzipSync(creaModuloSettimana(modello, dati, firmato, LUNEDI, lezioni))['xl/worksheets/sheet1.xml'])).toContain('Col. &lt;A&amp;B&gt;');
  let pieno = dati;
  for (let i = 0; i < 11; i++) {
    pieno = applica(pieno, { tipo: 'utente.crea', utente: { id: `n${i}`, username: `nuovo.${i}aa`, ruolo: 'trainee', grado: '', nome: '', cognome: '', istruttore_id: null }, password: 'password1' }, { utenteId: 'u-tm', ora: '2026-10-12T10:00:00.000Z', oggi: '2026-10-12' }).dati;
    pieno = applica(pieno, { tipo: 'corso.iscrivi', iscrizione: { id: `in${i}`, corso_id: C1, user_id: `n${i}`, ruolo: 'trainee' } }, { utenteId: 'u-tm', ora: '2026-10-12T10:00:00.000Z', oggi: '2026-10-12' }).dati;
  }
  expect(() => celleSettimana(pieno, corso, LUNEDI, lezioni)).toThrow(/16 righe/);
});
