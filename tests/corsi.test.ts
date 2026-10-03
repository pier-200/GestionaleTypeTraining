import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { applica, type CampiCorso, type Comando } from '../src/dominio/motore';
import { assenzeDi } from '../src/dominio/presenze';
import { MDS, PROGRAMMI_TEORICI, programmiPer, soloTeorica } from '../src/dominio/programmi';
import type { Lezione, Rapportino, Presenza } from '../src/dominio/tipi';

/** Mezzi, categorie e periodi del programma settimanale. */

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-23T10:00:00.000Z', oggi: '2026-09-23' });
const dati = datiEsempio();
const TEORICO = PROGRAMMI_TEORICI[0];
const C2 = 'c-2026-2';

const corso = (extra: Partial<CampiCorso> = {}): Comando => ({
  tipo: 'corso.salva',
  corso: {
    id: 'c-nuovo',
    codice: 'T1-2027/1',
    nome: 'Corso di prova',
    mds: 'CH-47F',
    categoria: 'B1.3',
    data_inizio: null,
    data_fine: null,
    maintenance_organization: '',
    location: '',
    ora_inizio: '08:30',
    minuti_giorno: [360, 360, 360, 360, 180],
    attivo: true,
    ...extra,
  },
});
const creato = (c: Comando) => applica(dati, c, ctx('u-tm')).dati.corsi.find((x) => x.id === 'c-nuovo')!;

describe('mezzi e categorie', () => {
  it('ogni MDS ha le sue categorie e le C prevedono solo la teoria', () => {
    expect(MDS.map((m) => m.codice)).toEqual(['CH-47F', 'UC-228', 'VC-180A']);
    expect(MDS.find((m) => m.codice === 'CH-47F')!.categorie).toEqual(['B1.3', 'B2', 'C']);
    expect(MDS.find((m) => m.codice === 'UC-228')!.categorie).toEqual(['B1.1', 'B2', 'C']);
    expect(soloTeorica('C')).toBe(true);
    expect(soloTeorica('B1.1')).toBe(false);
    expect(programmiPer('CH-47F', 'C').pratico).toBeUndefined();
    expect(programmiPer('CH-47F', 'B1.3').teorico?.id).toBe(TEORICO.id);
  });

  it('i programmi del corso seguono mezzo e categoria', () => {
    const b13 = creato(corso());
    expect([b13.programma_teorico, b13.programma_pratico]).toEqual(['mtt-ch47f-b13', 'ptr-ch47f-b13']);
    const b2 = creato(corso({ categoria: 'B2' }));
    expect([b2.programma_teorico, b2.programma_pratico]).toEqual(['mtt-ch47f-b2', 'ptr-ch47f-b2']);
    const c = creato(corso({ categoria: 'C' }));
    expect([c.programma_teorico, c.programma_pratico]).toEqual(['mtt-ch47f-c', null]);
  });

  it('tutti i corsi dei tre MDS hanno i loro programmi, coerenti tra teoria e pratica', () => {
    for (const m of MDS)
      for (const cat of m.categorie) {
        const p = programmiPer(m.codice, cat);
        expect(p.teorico, `${m.codice} ${cat} teorico`).toBeDefined();
        expect(p.teorico!.materie.every((x) => x.minuti > 0)).toBe(true);
        if (soloTeorica(cat)) continue;
        expect(p.pratico, `${m.codice} ${cat} pratico`).toBeDefined();
        // ogni task cade in un modulo del programma teorico dello stesso corso
        const moduli = new Set(p.teorico!.moduli.map((x) => x.numero));
        expect(p.pratico!.task.every((t) => moduli.has(t.modulo))).toBe(true);
      }
  });

  it('rifiuta categorie non previste dal mezzo', () => {
    expect(() => applica(dati, corso({ mds: 'UC-228', categoria: 'B1.3' }), ctx('u-tm'))).toThrow(/non prevede la categoria/);
    expect(() => applica(dati, corso({ mds: 'AB-212' }), ctx('u-tm'))).toThrow(/mezzo/i);
  });
});

describe('periodi del programma', () => {
  const lezione = (ordine: number, extra: Partial<Lezione> = {}) => ({
    id: `p${ordine}`,
    corso_id: C2,
    data: '2026-10-05',
    ordine,
    minuti: 60,
    materia: TEORICO.materie[0].id,
    istruttore_id: 'u-rinaldi',
    tipo: 'lezione' as const,
    note: '',
    ...extra,
  });

  it('la giornata ha 6 periodi dal lunedì al giovedì e 3 il venerdì', () => {
    const cmd = (ordine: number, data = '2026-10-05'): Comando => ({ tipo: 'lezioni.sostituisci', corso_id: C2, giorni: [data], lezioni: [lezione(ordine, { data })] });
    expect(applica(dati, cmd(5), ctx('u-neri')).dati.lezioni.some((l) => l.id === 'p5')).toBe(true);
    expect(() => applica(dati, cmd(6), ctx('u-neri'))).toThrow(/Periodo fuori/);
    expect(applica(dati, cmd(2, '2026-10-09'), ctx('u-neri')).dati.lezioni.some((l) => l.id === 'p2')).toBe(true);
    expect(() => applica(dati, cmd(3, '2026-10-09'), ctx('u-neri'))).toThrow(/Periodo fuori/); // venerdì
  });

  it('MEO, sospensione ed esame non vogliono materia e non contano come programma', () => {
    const speciale: Comando = {
      tipo: 'lezioni.sostituisci',
      corso_id: C2,
      giorni: ['2026-10-05'],
      lezioni: [lezione(0, { tipo: 'meo', materia: 'inesistente' }), lezione(1, { tipo: 'esame', materia: '' })],
    };
    const dopo = applica(dati, speciale, ctx('u-neri')).dati;
    expect(dopo.lezioni.filter((l) => l.data === '2026-10-05').map((l) => [l.tipo, l.materia])).toEqual([
      ['meo', ''],
      ['esame', ''],
    ]);
    // un periodo non didattico non produce assenze nemmeno per chi manca
    const lezioni = dopo.lezioni.filter((l) => l.data === '2026-10-05').map((l) => ({ ...l, corso_id: C2 }) as Lezione);
    const rapportini: Rapportino[] = [{ id: 'r', corso_id: C2, data: '2026-10-05', note: '', compilato_da: null, compilato_il: '', validato_da: null, validato_il: 'x' }];
    const presenze: Presenza[] = [{ id: 'p', corso_id: C2, data: '2026-10-05', user_id: 'u-marchetti', stato: 'assente', dalle: null, alle: null, motivo: '' }];
    expect(assenzeDi(TEORICO, dati.corsi[1], lezioni, rapportini, presenze, 'u-marchetti').minuti).toBe(0);
    expect(() => applica(dati, { ...speciale, lezioni: [lezione(0, { materia: 'inesistente' })] }, ctx('u-neri'))).toThrow(/Materia/);
  });
});
