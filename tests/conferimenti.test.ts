import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { leggiFogli, scomponiNominativo, usernameDa } from '../src/dominio/abilitazioni';
import { applica } from '../src/dominio/motore';
import { chapterDelMds } from '../src/dominio/programmi';
import { abilitatiPer } from '../src/dominio/viste';
import { fogliXlsx } from '../src/xlsx';

/** «Conferimenti.xlsx» della cartella modelli (fuori da git): un foglio per mezzo, chapter × istruttori con le «X». */

const fogli = fogliXlsx(new Uint8Array(readFileSync(resolve(__dirname, '../modelli/Conferimenti.xlsx'))));
const ctx = { utenteId: 'u-tm', ora: '2026-10-15T10:00:00.000Z', oggi: '2026-10-15' };

it('nominativi «Grado COGNOME Nome», anche con gradi in maiuscolo e cognomi di più parole', () => {
  expect(scomponiNominativo('1° Lgt. ROSSI Mario')).toEqual({ grado: '1° Lgt.', cognome: 'ROSSI', nome: 'Mario' });
  expect(scomponiNominativo('SMA DE LUCA Gian Paolo')).toEqual({ grado: 'SMA', cognome: 'DE LUCA', nome: 'Gian Paolo' });
  expect(scomponiNominativo('Grd. A. VERDI Anna')).toEqual({ grado: 'Grd. A.', cognome: 'VERDI', nome: 'Anna' });
  expect(scomponiNominativo('Mario Rossi')).toBeNull();
  expect(usernameDa('Gian Paolo', "D'Amico", ['gianpaolo.damico'])).toBe('gianpaolo.damico2');
});

it('ogni foglio è un mezzo: chi non ha un account si crea, poi ogni chapter del syllabus ha i suoi abilitati', () => {
  expect(fogli.map((f) => f.nome)).toEqual(['CH-47F', 'UC-228', 'VC-180A']);
  let dati = datiEsempio();
  const prima = leggiFogli(fogli, dati);
  // nell'esempio gli istruttori sono inventati: nessuno del file ha già un account
  expect(prima.righe).toEqual([]);
  expect(prima.scartate).toEqual([]);
  expect(prima.mancanti.length).toBeGreaterThan(20);

  const usati = dati.utenti.map((u) => u.username);
  for (const m of prima.mancanti) {
    const username = usernameDa(m.nome, m.cognome, usati);
    usati.push(username);
    dati = applica(dati, { tipo: 'utente.crea', utente: { id: username, username, ruolo: 'instructor', grado: m.grado, nome: m.nome, cognome: m.cognome, istruttore_id: null }, password: 'provvisoria1' }, ctx).dati;
  }
  const dopo = leggiFogli(fogli, dati);
  expect([dopo.mancanti, dopo.scartate]).toEqual([[], []]);
  const importato = applica(dati, { tipo: 'abilitazioni.importa', righe: dopo.righe }, ctx).dati;
  for (const mds of ['CH-47F', 'UC-228', 'VC-180A']) {
    const senza = chapterDelMds(mds).filter((c) => !abilitatiPer(importato, mds, c.chapter).some((u) => u.id !== 'u-rinaldi' && u.id !== 'u-greco' && u.id !== 'u-neri' && u.id !== 'u-colombo'));
    expect(senza.map((c) => c.chapter), mds).toEqual([]);
  }
  // istruttori per mezzo come nel file: le colonne con almeno una «X»
  const perMds = (mds: string) => new Set(dopo.righe.filter((r) => r.mds === mds).map((r) => r.user_id)).size;
  expect([perMds('CH-47F'), perMds('UC-228'), perMds('VC-180A')]).toEqual([18, 8, 6]);
});
