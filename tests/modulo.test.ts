import { strFromU8, unzipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { applica, type CampiLezione } from '../src/dominio/motore';
import { lezioniDi } from '../src/dominio/viste';
import { celleFisse, creaModuloSettimana, righeSettimana } from '../src/moduloSettimana';

/** Programma settimanale sul modulo ufficiale (public/modelli/programma-settimanale.xlsx). */

const modello = new Uint8Array(readFileSync(resolve(__dirname, '../public/modelli/programma-settimanale.xlsx')));
const FOGLIO = 'xl/worksheets/sheet1.xml';
const C1 = 'c-2026-1';
const LUNEDI = '2026-07-13'; // seconda settimana del primo corso: c'è il periodo MEO del lunedì
const dati = datiEsempio();
const corso = dati.corsi.find((c) => c.id === C1)!;
const lezioni = lezioniDi(dati, C1);

const lez = (id: string, data: string, ordine: number, parte: number, minuti: number, extra: Partial<CampiLezione> = {}): CampiLezione => ({
  id,
  corso_id: C1,
  data,
  ordine,
  parte,
  minuti,
  materia: 'm028',
  chapter: '34',
  istruttore_id: null,
  aula: '',
  tipo: 'lezione',
  note: '',
  ...extra,
});
const foglioDi = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)[FOGLIO]);
/** Valore di una cella del foglio: testo, numero, null se vuota, undefined se la cella non c'è. */
const leggi = (foglio: string, cella: string) => {
  const c = foglio.match(new RegExp(`<c r="${cella}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`));
  if (!c) return undefined;
  if (c[1] == null) return null;
  return c[1].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? Number(c[1].match(/<v>(.*?)<\/v>/)![1]);
};
const stile = (foglio: string, cella: string) => foglio.match(new RegExp(`<c r="${cella}" s="(\\d+)"`))?.[1];
const unioni = (foglio: string) => [...foglio.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1]).sort();

it('intestazione, direttore, frequentatori e firma vanno nelle celle fisse del modulo', () => {
  const c = celleFisse(dati, corso, LUNEDI);
  expect([c.C6, c.H6, c.C8, c.H8]).toEqual(['T1-2026/1', 2, '13 settimane', null]);
  expect([c.C7, c.H7]).toEqual([46209, 46297]); // 06/07/2026 e 02/10/2026 come le conserva Excel
  expect(c.C43).toBe('Cap. NERI Marco');
  // frequentatori in ordine alfabetico, «Grado COGNOME Nome» ed ente; chi non ha compilato i Personal Data resta con lo username
  expect([c.B47, c.D47, c.B51, c.B52, c.B53, c.G47]).toEqual(['Serg. BRUNO Alessandro', '1° Rgt. AVES', 'Serg. Magg. ROMANO Giulia', 'simone.fontana', null, null]);
  expect(c.F58).toBe('Col. Giorgio ESEMPIO');
  // oltre la fine stimata il modulo riporta il ritardo
  const tardi = celleFisse(dati, corso, '2026-10-12');
  expect([tardi.H6, tardi.H8]).toEqual([15, '2 settimane']);
});

it('una riga per lezione: orario fisso del periodo, titolo e numero del chapter svolto, istruttore, aula', () => {
  const [lun, , , , ven] = righeSettimana(dati, corso, LUNEDI, lezioni);
  expect(lun.map((periodo) => periodo.length)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(lun.map(([riga]) => riga[0])).toEqual(['08:20-09:20', '09:30-10:30', '10:50-11:50', '12:00-13:00', '14:00-15:00', '15:10-16:10']);
  const prima = lezioni.find((l) => l.data === LUNEDI && l.ordine === 0)!;
  expect(lun[0][0]).toEqual(['08:20-09:20', 'Rotor Drives', 63, { 'u-rinaldi': 'Mar. Ca. Rinaldi', 'u-colombo': 'Lgt. Colombo', 'u-neri': 'Cap. Neri' }[prima.istruttore_id!], 'Aula N.1']);
  expect(lun[5][0]).toEqual(['15:10-16:10', 'Mantenimento Efficienza Operativa', 'MEO', '', 'Aula N.1']);
  expect(ven).toHaveLength(3);

  const varie = righeSettimana(dati, corso, '2026-10-12', [
    lez('rec', '2026-10-16', 2, 0, 45, { materia: 'm001', chapter: '05', aula: 'Aula N.4', tipo: 'recupero' }),
    lez('sosp', '2026-10-12', 0, 0, 60, { materia: '', chapter: '', tipo: 'sospensione' }),
    // gruppo «Navigation» (34…42A): sul modulo va il chapter svolto, non il nome del gruppo
    lez('pn', '2026-10-13', 0, 0, 60, { chapter: '36' }),
    lez('nav', '2026-10-13', 1, 0, 60, { chapter: '' }),
  ]);
  expect(varie[4][2]).toEqual([['10:50-11:35', 'Time limits/Maintenance checks (recupero)', '05', '', 'Aula N.4']]); // "05" resta testo
  expect(varie[0][0]).toEqual([['08:20-09:20', 'Sospensione', '////', '', '////']]);
  expect(varie[1].slice(0, 3).map(([r]) => [r[1], r[2]])).toEqual([['Pneumatic', 36], ['Navigation', 34], [null, null]]);
});

it('il file Excel è il modulo ufficiale compilato: stessa struttura, nessun dato dell’esempio originale', () => {
  const bytes = creaModuloSettimana(modello, dati, corso, LUNEDI, lezioni);
  if (process.env.PTT_SALVA_XLSX) writeFileSync(process.env.PTT_SALVA_XLSX, bytes);
  const parti = unzipSync(bytes);
  expect(Object.keys(parti).sort()).toEqual(Object.keys(unzipSync(modello)).sort());
  const foglio = strFromU8(parti[FOGLIO]);
  const originale = foglioDi(modello);
  // senza periodi divisi stile, unioni e impostazione di stampa restano quelli del modulo, cella per cella
  const struttura = (xml: string) => [unioni(xml), xml.match(/<dimension[^>]*>/)![0], xml.match(/<pageSetup[^>]*>/)![0], xml.match(/<cols>.*<\/cols>/)![0], [...xml.matchAll(/<c r="([A-Z]+\d+)"( s="\d+")?/g)].map((m) => m[0])];
  expect(struttura(foglio)).toEqual(struttura(originale));
  expect([leggi(foglio, 'H6'), leggi(foglio, 'C43'), leggi(foglio, 'A11'), leggi(foglio, 'A39')]).toEqual([2, 'Cap. NERI Marco', 'Lun\n13/07', 'Ven\n17/07']);
  expect([leggi(foglio, 'B11'), leggi(foglio, 'C11'), leggi(foglio, 'G11'), leggi(foglio, 'I11')]).toEqual(['08:20-09:20', 'Rotor Drives', 63, 'Aula N.1']);
  expect([leggi(foglio, 'C15'), leggi(foglio, 'C17'), leggi(foglio, 'G17')]).toEqual(['PAUSA PRANZO', 'Mantenimento Efficienza Operativa', 'MEO']);
  for (const residuo of ['06-B1.3-CH', 'Navigation', '20 settimane', 'Grado COGNOME Nome', 'Gruppo firma COMANDANTE', '12:00-13-00']) expect(foglio).not.toContain(residuo);
  expect(strFromU8(parti['xl/workbook.xml'])).toContain(`'2 SETTIMANA'!$A$1:$I$63<`);
  // nel modulo non restano autori né percorsi del file originale
  expect(Object.keys(parti).some((p) => p.startsWith('docProps') || p.includes('printerSettings'))).toBe(false);
});

it('più lezioni nello stesso periodo: una riga ciascuna, il resto del modulo scende e la stampa resta in una pagina', () => {
  const divisa: CampiLezione[] = [
    // due mezz'ore nella prima ora del lunedì, tre lezioni nell'ultima, due nell'ultima del venerdì
    lez('a', '2026-10-12', 0, 0, 30, { istruttore_id: 'u-rinaldi' }),
    lez('b', '2026-10-12', 0, 1, 30, { chapter: '36', istruttore_id: 'u-colombo', aula: 'Aula N.2' }),
    lez('c', '2026-10-12', 5, 0, 15),
    lez('d', '2026-10-12', 5, 1, 15, { chapter: '37' }),
    lez('e', '2026-10-12', 5, 2, 30, { chapter: '40' }),
    lez('f', '2026-10-13', 0, 0, 45),
    lez('g', '2026-10-16', 2, 0, 30),
    lez('h', '2026-10-16', 2, 1, 30, { chapter: '42' }),
  ];
  const lun = righeSettimana(dati, corso, '2026-10-12', divisa)[0];
  expect(lun.map((periodo) => periodo.length)).toEqual([2, 1, 1, 1, 1, 3]);
  expect(lun[0]).toEqual([
    ['08:20-08:50', 'Navigation', 34, 'Mar. Ca. Rinaldi', 'Aula N.1'],
    ['08:50-09:20', 'Pneumatic', 36, 'Lgt. Colombo', 'Aula N.2'],
  ]);
  expect(lun[5].map((r) => r[0])).toEqual(['15:10-15:25', '15:25-15:40', '15:40-16:10']);

  const bytes = creaModuloSettimana(modello, dati, corso, '2026-10-12', divisa);
  if (process.env.PTT_SALVA_XLSX_DIVISO) writeFileSync(process.env.PTT_SALVA_XLSX_DIVISO, bytes);
  const foglio = foglioDi(bytes);
  const riga = (n: number) => ['B', 'C', 'G', 'H', 'I'].map((c) => leggi(foglio, `${c}${n}`));
  // lunedì: righe 11-20 (3 in più), con la pausa pranzo scesa di una riga
  expect(leggi(foglio, 'A11')).toBe('Lun\n12/10');
  expect([riga(11), riga(12)]).toEqual(lun[0]);
  expect(riga(16)).toEqual(['13:00-14:00', 'PAUSA PRANZO', '////', null, '////']);
  expect([18, 19, 20].map((n) => riga(n).slice(0, 3))).toEqual([['15:10-15:25', 'Navigation', 34], ['15:25-15:40', 'Vacuum', 37], ['15:40-16:10', 'Operational attack functions', 40]]);
  expect([leggi(foglio, 'A21'), leggi(foglio, 'B21')]).toEqual(['Mar\n13/10', '08:20-09:05']);
  // venerdì: righe 42-45; in tutto 4 righe in più, e sotto la tabella tutto scende di 4
  expect([leggi(foglio, 'A42'), riga(44).slice(0, 3), riga(45).slice(0, 3)]).toEqual(['Ven\n16/10', ['10:50-11:20', 'Navigation', 34], ['11:20-11:50', 'Integrated modular avionics', 42]]);
  expect([leggi(foglio, 'A47'), leggi(foglio, 'C47'), leggi(foglio, 'B51'), leggi(foglio, 'F62')]).toEqual(['DIRETTORE DEL CORSO:', 'Cap. NERI Marco', 'Serg. BRUNO Alessandro', 'Col. Giorgio ESEMPIO']);
  expect(unioni(foglio)).toEqual(expect.arrayContaining(['A11:A20', 'A21:A27', 'A42:A45', 'C12:F12', 'C45:F45', 'A47:B47', 'C47:I47', 'F62:I62', 'A67:I67', 'A1:I1']));
  expect(unioni(foglio)).toHaveLength(unioni(foglioDi(modello)).length + 4);
  expect(foglio).toContain('<dimension ref="A1:L67"/>');
  expect(foglio.match(/<row r="/g)).toHaveLength(67);
  // i bordi di testa e di coda della giornata restano sulla prima e sull'ultima riga, le righe aggiunte sono interne
  const originale = foglioDi(modello);
  expect([11, 12, 18, 19, 20, 44, 45].map((n) => stile(foglio, `B${n}`))).toEqual([11, 12, 12, 12, 17, 40, 41].map((n) => stile(originale, `B${n}`)));
  expect(foglio.match(/<pageSetup[^>]*>/)![0]).toContain(' scale="83"');
  expect(strFromU8(unzipSync(bytes)['xl/workbook.xml'])).toContain(`'15 SETTIMANA'!$A$1:$I$67<`);
});

it('caratteri speciali e corso troppo numeroso', () => {
  const firmato = { ...corso, gruppo_firma: 'Col. <A&B>' };
  expect(foglioDi(creaModuloSettimana(modello, dati, firmato, LUNEDI, lezioni))).toContain('Col. &lt;A&amp;B&gt;');
  let pieno = dati;
  const ctx = { utenteId: 'u-tm', ora: '2026-10-12T10:00:00.000Z', oggi: '2026-10-12' };
  for (let i = 0; i < 11; i++) {
    pieno = applica(pieno, { tipo: 'utente.crea', utente: { id: `n${i}`, username: `nuovo.${i}aa`, ruolo: 'trainee', grado: '', nome: '', cognome: '', istruttore_id: null }, password: 'password1' }, ctx).dati;
    pieno = applica(pieno, { tipo: 'corso.iscrivi', iscrizione: { id: `in${i}`, corso_id: C1, user_id: `n${i}`, ruolo: 'trainee' } }, ctx).dati;
  }
  expect(() => celleFisse(pieno, corso, LUNEDI)).toThrow(/16 righe/);
});
