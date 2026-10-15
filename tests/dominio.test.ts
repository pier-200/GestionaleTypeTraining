import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { leggiAbilitazioni } from '../src/dominio/abilitazioni';
import { calcolaReport, requisitiMancanti } from '../src/dominio/compliance';
import { conferme } from '../src/dominio/conferme';
import { applica, corsiDi, ruoloNelCorso, type CampiLezione, type Comando } from '../src/dominio/motore';
import { generaSettimana, indiceGiorno, lunediDi, orariLezioni, periodiDelGiorno, statoTeorico } from '../src/dominio/pianificazione';
import { assenzeDi } from '../src/dominio/presenze';
import { PROGRAMMI_PRATICI, PROGRAMMI_TEORICI, chapterDelMds, programmaTeorico } from '../src/dominio/programmi';
import { aggiornaDati, type Dati, type TipoPeriodo } from '../src/dominio/tipi';
import { menuPer, puoAprire } from '../src/ui/navigazione';
import { abilitatiPer, nomeUtente, fineCorso, formatoFine, frequentatori, impegniDi, lezioniDi, nomeDirettore, presenzeDi, rapportiniDi, registrazioniDi, situazione } from '../src/dominio/viste';

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-22T10:00:00.000Z', oggi: '2026-09-22' });
const dati = datiEsempio();
const PRATICO = PROGRAMMI_PRATICI[0];
const TEORICO = PROGRAMMI_TEORICI[0];
const C1 = 'c-2026-1';
const C2 = 'c-2026-2';
const M = TEORICO.materie;
const di = (id: string, corso = C1) => registrazioniDi(dati, corso, id);
const report = (id: string) => calcolaReport(di(id), PRATICO);
const corso = (d: Dati, id = C2) => d.corsi.find((c) => c.id === id)!;
const utente = (d: Dati, id: string) => d.utenti.find((u) => u.id === id)!;
/** Un istruttore abilitato al chapter della materia (nell'esempio ogni chapter ne ha almeno uno). */
const abilitato = (materia = M[0]) => abilitatiPer(dati, 'CH-47F', materia.chapter)[0].id;
const lez = (id: string, extra: Partial<CampiLezione> = {}): CampiLezione => ({
  id,
  corso_id: C2,
  data: '2026-10-05',
  ordine: 0,
  parte: 0,
  minuti: 60,
  materia: M[0].id,
  istruttore_id: null,
  persona: '',
  frequentatori: [],
  aula: '',
  tipo: 'lezione',
  note: '',
  ...extra,
});
const salvaLezioni = (lezioni: CampiLezione[], chi = 'u-neri', d = dati) => applica(d, { tipo: 'lezioni.sostituisci', corso_id: C2, giorni: ['2026-10-05'], lezioni }, ctx(chi)).dati.lezioni.filter((l) => l.data === '2026-10-05');

describe('programmi', () => {
  it('il programma pratico ricalca i totali del Compliance Report', () => {
    const r = calcolaReport([], PRATICO);
    expect(r.perTipo.map((x) => [x.codice, x.previsti])).toEqual([['LOC', 66], ['FOT', 35], ['SGH', 36], ['R/I', 26], ['MEL', 0], ['TS', 27]]);
    expect(r.perModulo.map((x) => x.previsti)).toEqual([16, 25, 8, 77, 36, 21, 1, 6]);
    expect([r.totaleP66.previsti, r.totale.previsti]).toEqual([183, 190]);
    expect(r.perChapter).toHaveLength(68);
    expect(r.perTipo.find((x) => x.codice === 'MEL')!.conforme).toBeNull();
  });

  it('il programma teorico somma 219 ore in 8 moduli', () => {
    expect(TEORICO.moduli.reduce((s, m) => s + m.minuti, 0)).toBe(13140);
    expect(TEORICO.moduli.map((m) => m.minuti / 60)).toEqual([9, 52, 1, 108, 25, 16, 3, 5]);
    expect(M).toHaveLength(51);
    expect(M.every((m) => m.minuti > 0 && m.minuti % 60 === 0 && m.chapter)).toBe(true);
  });

  it('nel syllabus ci sono solo i chapter con ore: ogni materia è un chapter', () => {
    const chapter = (titolo: string) => M.filter((m) => m.titolo.startsWith(titolo)).map((m) => m.chapter);
    expect(chapter('Servicing')).toEqual(['12']); // non il 14
    expect(chapter('Vibration and Noise Analysis')).toEqual(['18']); // non il 60
    expect(chapter('Rotors')).toEqual(['62', '67']); // «Rotors» 62 (non 62A) e «Rotors Flight Control» 67
    expect(chapter('Rotor Drives')).toEqual(['63']); // non 63A, 64, 64A, 65…
    expect(chapter('Navigation')).toEqual(['34']);
    // nel modulo 3 l'unico chapter con ore è lo 06, non quelli strutturali senza livello
    expect(M.filter((m) => m.modulo === 3).map((m) => [m.chapter, m.titolo])).toEqual([['06', 'Zonal and Station Identification Systems.']]);
    const tutti = M.map((m) => m.chapter);
    for (const assente of ['14', '60', '62A', '63A', '64', '64A', '65', '66', '35', '38', '51', '21A']) expect(tutti).not.toContain(assente);
    // per tutti i programmi: nessuna materia senza ore
    expect(PROGRAMMI_TEORICI.every((p) => p.materie.every((m) => m.minuti > 0))).toBe(true);
    // i chapter su cui si abilitano gli istruttori sono quelli del mezzo, in tutte le categorie
    const ch47 = chapterDelMds('CH-47F');
    expect(ch47.map((c) => c.chapter)).toEqual(expect.arrayContaining(['05', '12', '18', '62', '63', '34', 'AVES 1']));
    expect(ch47.find((c) => c.chapter === '06')!.titolo).toBe('Dimensions/Areas (MTOM, etc.) / Zonal and Station Identification Systems.');
    expect(ch47.find((c) => c.chapter === '05')!.titolo).toBe('Time limits/Maintenance checks'); // non ripetuto per ogni categoria
    expect(chapterDelMds('boh')).toEqual([]);
  });
});

describe('compliance', () => {
  it('50% esatto è conforme, un task in meno no; le ripetizioni contano una volta', () => {
    const m8 = PRATICO.task.filter((t) => t.modulo === 8); // 6 task: servono 3
    const tre = m8.slice(0, 3).map((t) => ({ task_id: t.id }));
    expect(calcolaReport(tre, PRATICO).perModulo[7]).toMatchObject({ eseguiti: 3, conforme: true, mancano: 0 });
    expect(calcolaReport([...tre.slice(0, 2), tre[0], tre[0]], PRATICO).perModulo[7]).toMatchObject({ eseguiti: 2, conforme: false, mancano: 1 });
  });

  it('serve il 50% dei task di ogni chapter, non uno solo', () => {
    const chapter = (codice: string) => PRATICO.task.filter((t) => t.chapter === codice);
    const lungo = PRATICO.chapter.map((c) => chapter(c.codice)).find((t) => t.length >= 4)!;
    const meta = Math.ceil(lungo.length / 2);
    const riga = (quanti: number) => calcolaReport(lungo.slice(0, quanti).map((t) => ({ task_id: t.id })), PRATICO).perChapter.find((c) => c.codice === lungo[0].chapter)!;
    expect(riga(1)).toMatchObject({ eseguiti: 1, conforme: false, mancano: meta - 1 });
    expect(riga(meta)).toMatchObject({ conforme: true, mancano: 0 });
    const unoPerChapter = PRATICO.chapter.map((c) => ({ task_id: chapter(c.codice)[0].id }));
    expect(requisitiMancanti(calcolaReport(unoPerChapter, PRATICO)).chapter.length).toBeGreaterThan(0);
  });

  it('situazione esempio: esiti attesi', () => {
    expect(report('u-romano').conforme).toBe(true);
    const bruno = requisitiMancanti(report('u-bruno'));
    expect(bruno.moduli).toHaveLength(0);
    expect(bruno.tipi).toHaveLength(0);
    expect(bruno.chapter.map((c) => c.codice)).toEqual(['44', '46', 'AVES 3']);
    expect(report('u-gallo').conforme).toBe(false);
    expect(di('u-fontana')).toHaveLength(0);
    expect(dati.registrazioni.every((r) => r.data <= '2026-09-21' && r.et_minuti > 0 && r.corso_id === C1)).toBe(true);
  });
});

describe('pianificazione', () => {
  it('riempie la settimana rispettando 6 ore dal lunedì al giovedì e 3 il venerdì', () => {
    const proposte = generaSettimana(TEORICO, [], '2026-09-14');
    const perGiorno = new Map<string, number>();
    for (const p of proposte) perGiorno.set(p.data, (perGiorno.get(p.data) ?? 0) + p.minuti);
    expect([...perGiorno.values()]).toEqual([360, 360, 360, 360, 180]);
    expect(proposte[0]).toMatchObject({ data: '2026-09-14', ordine: 0, materia: M[0].id });
    // una materia lunga si spezza in lezioni di un'ora al massimo
    expect(proposte.every((p) => p.minuti === 60)).toBe(true);
  });

  it('non tocca i giorni già pieni e scala le ore residue', () => {
    const lezioni = dati.lezioni.filter((l) => l.corso_id === C2);
    const stato = statoTeorico(TEORICO, lezioni);
    expect(stato.totale.pianificati).toBe(lezioni.reduce((s, l) => s + l.minuti, 0));
    expect(stato.totale.residui).toBe(stato.totale.minuti - stato.totale.pianificati);
    expect(generaSettimana(TEORICO, lezioni, lunediDi(lezioni[0].data))).toEqual([]);
    const dopo = generaSettimana(TEORICO, lezioni, '2026-09-28');
    expect(dopo.length).toBeGreaterThan(0);
    const nuove = dopo.map((p, i) => ({ ...lezioni[0], ...p, id: String(i) }));
    expect(statoTeorico(TEORICO, [...lezioni, ...nuove]).totale.pianificati).toBe(stato.totale.pianificati + dopo.reduce((s, p) => s + p.minuti, 0));
  });

  it('la generazione riempie l’ora anche quando una materia finisce a metà periodo', () => {
    // nell'UC-228 molte materie durano 30 o 90 minuti: il resto dell'ora va alla materia successiva
    const uc = programmaTeorico('mtt-uc228-b11')!;
    const proposte = generaSettimana(uc, [], '2026-09-14');
    const perPeriodo = new Map<string, typeof proposte>();
    for (const p of proposte) perPeriodo.set(`${p.data}|${p.ordine}`, [...(perPeriodo.get(`${p.data}|${p.ordine}`) ?? []), p]);
    expect(perPeriodo.size).toBe(27);
    expect([...perPeriodo.values()].every((parti) => parti.reduce((s, p) => s + p.minuti, 0) === 60)).toBe(true);
    const divisi = [...perPeriodo.values()].filter((parti) => parti.length > 1);
    expect(divisi.length).toBeGreaterThan(0);
    expect(divisi.every((parti) => parti.map((p) => p.parte).join() === parti.map((_, i) => i).join() && new Set(parti.map((p) => p.materia)).size === parti.length)).toBe(true);
  });
});

describe('logbook e account', () => {
  const reg = (user_id: string, extra = {}, corso_id = C1): Comando => ({
    tipo: 'registrazione.salva',
    registrazione: { id: 'nuova', corso_id, user_id, task_id: 1, maintenance_location: 'Viterbo', data: '2026-09-22', tipo_esecuzione: 'AC', matricola: corso(dati, C1).aeromobili[0], et_minuti: 30, instructor_id: 'ist-greco', ...extra },
  });

  it('il frequentatore registra solo per sé, l’istruttore non modifica', () => {
    expect(applica(dati, reg('u-gallo'), ctx('u-gallo')).dati.registrazioni.some((r) => r.id === 'nuova')).toBe(true);
    expect(() => applica(dati, reg('u-romano'), ctx('u-gallo'))).toThrow(/permessi/);
    expect(() => applica(dati, reg('u-gallo'), ctx('u-rinaldi'))).toThrow(/permessi/);
    expect(applica(dati, reg('u-gallo'), ctx('u-tm')).dati.registrazioni.find((r) => r.id === 'nuova')!.modificato_da).toBe('u-tm');
  });

  it('non si registra su un corso a cui non si è iscritti o senza parte pratica', () => {
    expect(() => applica(dati, reg('u-gallo', {}, C2), ctx('u-gallo'))).toThrow(/parte pratica|non iscritto/);
    expect(() => applica(dati, reg('u-marchetti', {}, C1), ctx('u-marchetti'))).toThrow(/permessi|non iscritto/);
  });

  it('valida data futura, ET, aeromobile e istruttore', () => {
    expect(() => applica(dati, reg('u-gallo', { data: '2026-09-23' }), ctx('u-gallo'))).toThrow(/futura/);
    expect(() => applica(dati, reg('u-gallo', { et_minuti: 0 }), ctx('u-gallo'))).toThrow(/ET/);
    expect(() => applica(dati, reg('u-gallo', { matricola: ' ' }), ctx('u-gallo'))).toThrow(/Matricola/);
    expect(applica(dati, reg('u-gallo', { tipo_esecuzione: 'SIM', matricola: 'x' }), ctx('u-gallo')).dati.registrazioni.find((r) => r.id === 'nuova')!.matricola).toBe('');
    expect(() => applica(dati, reg('u-gallo', { instructor_id: 'boh' }), ctx('u-gallo'))).toThrow(/Instructor/);
    // l'aeromobile si sceglie fra quelli inseriti nel corso; senza elenco resta libero
    expect(() => applica(dati, reg('u-gallo', { matricola: 'EI999' }), ctx('u-gallo'))).toThrow(/Aeromobile/);
    const senzaElenco = applica(dati, { tipo: 'corso.salva', corso: { ...corso(dati, C1), aeromobili: [] } }, ctx('u-tm')).dati;
    expect(applica(senzaElenco, reg('u-gallo', { matricola: 'EI999' }), ctx('u-gallo')).dati.registrazioni.find((r) => r.id === 'nuova')!.matricola).toBe('EI999');
    const conElenco = applica(dati, { tipo: 'corso.salva', corso: { ...corso(dati, C1), aeromobili: [' EI906 ', 'EI910', 'EI906', ''] } }, ctx('u-tm')).dati;
    expect(corso(conElenco, C1).aeromobili).toEqual(['EI906', 'EI910']);
  });

  it('solo il TM crea account e corsi; la disattivazione revoca le credenziali', () => {
    const crea: Comando = { tipo: 'utente.crea', utente: { id: 'x', username: 'nuovo.utente', ruolo: 'trainee', grado: '', nome: '', cognome: '', istruttore_id: null }, password: 'password123' };
    expect(() => applica(dati, crea, ctx('u-gallo'))).toThrow();
    expect(applica(dati, crea, ctx('u-tm')).effetti).toEqual([{ tipo: 'credenziali.imposta', username: 'nuovo.utente', password: 'password123', admin: false }]);
    expect(() => applica(dati, { ...crea, password: 'ab' }, ctx('u-tm'))).toThrow(/4 caratteri/);
    expect(() => applica(dati, { ...crea, utente: { ...crea.utente, ruolo: 'direttore' as never, grado: 'Cap.', nome: 'A', cognome: 'B' } }, ctx('u-tm'))).toThrow(/Ruolo/);
    const off = applica(dati, { tipo: 'utente.modifica', utente: { id: 'u-gallo', grado: '', nome: '', cognome: '', attivo: false, istruttore_id: null } }, ctx('u-tm'));
    expect(off.effetti).toEqual([{ tipo: 'credenziali.rimuovi', username: 'matteo.gallo' }]);
    expect(() => applica(off.dati, reg('u-gallo'), ctx('u-gallo'))).toThrow(/non abilitato/);
    const nuovo: Comando = { tipo: 'corso.salva', corso: { ...corso(dati, C1), id: 'c-x', codice: 'T1-2027/1', nome: 'Nuovo corso' } };
    expect(() => applica(dati, nuovo, ctx('u-neri'))).toThrow(/Training Manager/);
    expect(applica(dati, nuovo, ctx('u-tm')).dati.corsi).toHaveLength(4);
  });

  it('i Personal Data li vedono tutti, li modificano solo il TM e il direttore del corso', () => {
    const cmd = (user_id: string): Comando => ({ tipo: 'anagrafica.salva', anagrafica: { user_id, grado: 'Serg.', nome: 'Simone', cognome: 'Fontana', data_nascita: '1998-01-01', citta_nascita: 'Roma', maml: '', ente: '1° Rgt.' } });
    expect(applica(dati, cmd('u-fontana'), ctx('u-tm')).dati.anagrafiche.find((a) => a.user_id === 'u-fontana')!.ente).toBe('1° Rgt.');
    expect(applica(dati, cmd('u-fontana'), ctx('u-neri')).dati.anagrafiche.some((a) => a.user_id === 'u-fontana')).toBe(true);
    expect(() => applica(dati, cmd('u-fontana'), ctx('u-fontana'))).toThrow(/Training Manager|permessi/); // nemmeno i propri
    expect(() => applica(dati, cmd('u-fontana'), ctx('u-rinaldi'))).toThrow(/Training Manager|permessi/);
  });

  it('istruttori duplicati rifiutati', () => {
    const c: Comando = { tipo: 'istruttore.crea', istruttore: { id: 'n', grado: 'mar. ca.', nome: 'paolo', cognome: 'RINALDI' } };
    expect(() => applica(dati, c, ctx('u-gallo'))).toThrow(/già/);
  });
});

describe('programma settimanale', () => {
  it('il direttore prepara il programma del suo corso; la lezione va a un istruttore abilitato al chapter', () => {
    const lezione = lez('l-x', { istruttore_id: abilitato() });
    expect(salvaLezioni([lezione]).some((l) => l.id === 'l-x')).toBe(true);
    expect(() => salvaLezioni([lezione], 'u-rinaldi')).toThrow(/Training Manager|permessi/);
    // chi non è abilitato a quel chapter non tiene la lezione, e nemmeno chi non è un istruttore
    const nonAbilitato = dati.utenti.find((u) => u.ruolo === 'instructor' && !dati.abilitazioni.some((a) => a.user_id === u.id && a.mds === 'CH-47F' && a.chapter === M[0].chapter))!.id;
    expect(() => salvaLezioni([{ ...lezione, istruttore_id: nonAbilitato }])).toThrow(/non abilitato al chapter 05/);
    expect(() => salvaLezioni([{ ...lezione, istruttore_id: 'u-gallo' }])).toThrow(/Istruttore non trovato/);
    expect(() => salvaLezioni([{ ...lezione, materia: 'm999' }])).toThrow(/non previsto dal syllabus/);
    expect(() => applica(dati, { tipo: 'lezioni.sostituisci', corso_id: 'c-ignoto', giorni: ['2026-10-05'], lezioni: [lezione] }, ctx('u-neri'))).toThrow();
  });

  it('più lezioni brevi si dividono un periodo: insieme non superano l’ora e si susseguono senza pausa', () => {
    const parte = (id: string, n: number, minuti: number, ordine = 0) => lez(id, { ordine, parte: n, minuti });
    const orari = (lezioni: ReturnType<typeof salvaLezioni>) => [...orariLezioni(lezioni).values()].map((o) => `${o.inizio}-${o.fine}`);
    expect(orari(salvaLezioni([parte('a', 0, 30), parte('b', 1, 30)]))).toEqual(['08:20-08:50', '08:50-09:20']);
    expect(orari(salvaLezioni([parte('a', 0, 15, 1), parte('b', 1, 15, 1), parte('c', 2, 30, 1)]))).toEqual(['09:30-09:45', '09:45-10:00', '10:00-10:30']);
    expect(orari(salvaLezioni([parte('a', 0, 45), parte('b', 1, 15)]))).toEqual(['08:20-09:05', '09:05-09:20']);
    expect(salvaLezioni([parte('z', 3, 15), parte('y', 1, 30)]).map((l) => [l.id, l.parte])).toEqual([['y', 0], ['z', 1]]);
    expect(() => salvaLezioni([parte('a', 0, 45), parte('b', 1, 30)])).toThrow(/non possono superare 60 minuti/);
    expect(statoTeorico(TEORICO, salvaLezioni([parte('a', 0, 30), parte('b', 1, 15)])).totale.pianificati).toBe(45);
  });

  it('ogni attività ha i suoi campi: sospensione sbarrata, esami e MEO con istruttore, PA con persone senza account', () => {
    const altre: TipoPeriodo[] = ['meo', 'esame', 'esame_pratico', 'pratica', 'valutazione', 'pa'];
    // per queste attività va bene qualunque istruttore, anche non abilitato ad alcun chapter della giornata
    const salvate = salvaLezioni(altre.map((tipo, i) => lez(`t${i}`, { tipo, ordine: i, materia: 'm001', istruttore_id: 'u-colombo', persona: 'RSPP', frequentatori: ['u-marchetti'] })));
    expect(salvate.map((l) => [l.tipo, l.materia, l.istruttore_id, l.persona, l.frequentatori.length])).toEqual(altre.map((tipo) => [tipo, '', 'u-colombo', '', 0]));
    // sospensione: né istruttore né aula né note
    expect(salvaLezioni([lez('s', { tipo: 'sospensione', istruttore_id: 'u-colombo', aula: 'Aula N.2', note: 'x', persona: 'y' })])[0]).toMatchObject({ istruttore_id: null, aula: '', note: '', persona: '', materia: '' });
    // pratiche amministrative: l'RSPP è solo un nome, senza account; altrove la persona non si conserva
    expect(salvaLezioni([lez('pa', { tipo: 'pa', persona: ' RSPP ' })])[0]).toMatchObject({ istruttore_id: null, persona: 'RSPP' });
    expect(salvaLezioni([lez('ex', { tipo: 'esame', persona: 'RSPP' })])[0].persona).toBe('');
    expect(() => salvaLezioni([lez('boh', { tipo: 'altro' as never })])).toThrow(/Tipo/);
  });

  it('la lezione di recupero è per i frequentatori scelti, e solo a loro scala le assenze', () => {
    expect(() => salvaLezioni([lez('r', { tipo: 'recupero' })])).toThrow(/scegliere i frequentatori/);
    expect(() => salvaLezioni([lez('r', { tipo: 'recupero', frequentatori: ['u-gallo'] })])).toThrow(/non fa parte del corso/); // è dell'altro corso
    expect(salvaLezioni([lez('r', { tipo: 'recupero', frequentatori: ['u-marchetti', 'u-marchetti', 'u-esposito'] })])[0].frequentatori).toEqual(['u-marchetti', 'u-esposito']);
    // due assenti alla stessa lezione; il recupero è per uno solo: l'altro, pur presente, resta con l'assenza
    const base = { validata: true, validata_da: null, validata_il: null, creato_il: '', modificato_il: '', modificato_da: null };
    const lezioni = [
      { ...lez('a', { data: '2026-09-14' }), ...base },
      { ...lez('rec', { data: '2026-09-21', tipo: 'recupero', frequentatori: ['u1'] }), ...base },
    ];
    const rapportini = ['2026-09-14', '2026-09-21'].map((data) => ({ id: data, corso_id: C2, data, note: '', compilato_da: null, compilato_il: '', validato_da: null, validato_il: 'x' }));
    const presenze = ['u1', 'u2'].flatMap((user_id) => [
      { id: `a${user_id}`, corso_id: C2, data: '2026-09-14', user_id, stato: 'assente' as const, dalle: null, alle: null, motivo: '' },
      { id: `r${user_id}`, corso_id: C2, data: '2026-09-21', user_id, stato: 'presente' as const, dalle: null, alle: null, motivo: '' },
    ]);
    expect(assenzeDi(TEORICO, lezioni, rapportini, presenze, 'u1')).toMatchObject({ lordi: 60, recuperati: 60, minuti: 0 });
    expect(assenzeDi(TEORICO, lezioni, rapportini, presenze, 'u2')).toMatchObject({ lordi: 60, recuperati: 0, minuti: 60 });
    // chi non aveva assenze in quella materia non accumula ore in più
    const sempre = presenze.map((p) => ({ ...p, stato: 'presente' as const }));
    expect(assenzeDi(TEORICO, lezioni, rapportini, sempre, 'u1')).toMatchObject({ lordi: 0, recuperati: 0, minuti: 0 });
  });

  it('l’istruttore vede le sue lezioni da oggi in poi, solo dei programmi validati, in tutti i suoi corsi', () => {
    const oggi = '2026-09-16';
    const chi = dati.lezioni.find((l) => !l.validata && l.data >= oggi && l.istruttore_id)!.istruttore_id!;
    const suoi = impegniDi(dati, chi, oggi);
    const attese = dati.lezioni.filter((l) => l.istruttore_id === chi && l.validata && l.data >= oggi);
    expect(suoi.map((i) => i.lezione.id).sort()).toEqual(attese.map((l) => l.id).sort());
    expect(suoi.every((i) => /^\d\d:\d\d$/.test(i.orario.inizio) && i.orario.fine > i.orario.inizio)).toBe(true);
    // la seconda settimana del secondo corso non è validata: compare solo dopo la validazione
    const daValidare = dati.lezioni.filter((l) => l.istruttore_id === chi && !l.validata && l.data >= oggi);
    const validati = applica(dati, { tipo: 'settimana.valida', corso_id: C2, giorni: [...new Set(daValidare.map((l) => l.data))], valida: true }, ctx('u-neri')).dati;
    expect(impegniDi(validati, chi, oggi)).toHaveLength(suoi.length + daValidare.length);
    expect(impegniDi(dati, 'u-gallo', oggi)).toEqual([]);
  });
});

describe('abilitazioni degli istruttori', () => {
  it('per mezzo e chapter: le assegna solo il TM, solo sui chapter del syllabus', () => {
    const cmd: Comando = { tipo: 'abilitazioni.imposta', user_id: 'u-colombo', mds: 'CH-47F', chapters: ['34', '34', '62A', 'inesistente', 'AVES 1'] };
    const dopo = applica(dati, cmd, ctx('u-tm')).dati;
    expect(dopo.abilitazioni.filter((a) => a.user_id === 'u-colombo' && a.mds === 'CH-47F').map((a) => `${a.mds} ${a.chapter}`)).toEqual(['CH-47F 34', 'CH-47F AVES 1']); // sostituisce quelle che aveva
    expect(() => applica(dati, cmd, ctx('u-neri'))).toThrow(/Training Manager/); // nemmeno il direttore
    expect(() => applica(dati, { ...cmd, user_id: 'u-gallo' }, ctx('u-tm'))).toThrow(/Istruttore non trovato/);
    expect(() => applica(dati, { ...cmd, mds: 'AB-212' }, ctx('u-tm'))).toThrow(/Mezzo non previsto/);
    // le abilitazioni di un mezzo non toccano quelle di un altro
    const due = applica(dopo, { tipo: 'abilitazioni.importa', righe: [{ user_id: 'u-colombo', mds: 'UC-228', chapters: ['05'] }, { user_id: 'u-greco', mds: 'UC-228', chapters: ['05', '06'] }] }, ctx('u-tm')).dati;
    expect(due.abilitazioni.filter((a) => a.user_id === 'u-colombo')).toHaveLength(3);
    expect(due.abilitazioni.filter((a) => a.user_id === 'u-greco' && a.mds === 'UC-228').map((a) => a.chapter)).toEqual(['05', '06']);
    expect(abilitatiPer(due, 'UC-228', '05').map((u) => u.id).sort()).toEqual(['u-cang', 'u-ciav', 'u-colombo', 'u-greco', 'u-luon', 'u-mast', 'u-toto']);
    expect(abilitatiPer(dati, 'UC-228', '22').map((u) => u.id)).toEqual(['u-luon']); // avionica, come nei conferimenti
    // dopo l'abilitazione l'istruttore diventa selezionabile per quel chapter
    const navigation = M.find((m) => m.chapter === '34')!;
    expect(salvaLezioni([lez('n', { materia: navigation.id, istruttore_id: 'u-colombo' })], 'u-neri', dopo)[0].istruttore_id).toBe('u-colombo');
  });

  it('l’Excel delle abilitazioni si legge per colonne riconosciute, in qualunque ordine', () => {
    const letto = leggiAbilitazioni(
      [
        ['Abilitazioni istruttori'],
        ['Chapter', 'MDS', 'Istruttore'],
        ['5, 06 ;12', 'ch47f', 'paolo.rinaldi'],
        ['34', 'CH-47F', 'Colombo Andrea'],
        ['aves 1', 'CH-47F', ''], // stesso istruttore e mezzo della riga sopra (celle unite)
        ['tutti', 'UC-228', 'Lgt. Colombo Andrea'],
        ['62A', 'CH-47F', 'Greco'],
        ['34', 'CH-47F', 'Mario Bianchi'],
        ['34', 'AB-212', 'Greco'],
      ],
      dati,
    );
    expect(letto.righe).toEqual([
      { user_id: 'u-rinaldi', mds: 'CH-47F', chapters: ['05', '06', '12'] },
      { user_id: 'u-colombo', mds: 'CH-47F', chapters: ['34', 'AVES 1'] },
      { user_id: 'u-colombo', mds: 'UC-228', chapters: chapterDelMds('UC-228').map((c) => c.chapter) },
    ]);
    expect(letto.scartate).toEqual([
      'Riga 7: chapter «62A» non previsto dal syllabus del CH-47F',
      'Riga 8: istruttore «Mario Bianchi» non trovato fra gli account',
      'Riga 9: mezzo «AB-212» non previsto',
    ]);
    // colonne separate per cognome e nome, e file senza intestazione
    expect(leggiAbilitazioni([['Cognome', 'Nome', 'Mezzo', 'ATA'], ['Neri', 'Marco', 'CH-47F', '07']], dati).righe).toEqual([{ user_id: 'u-neri', mds: 'CH-47F', chapters: ['07'] }]);
    expect(leggiAbilitazioni([['a', 'b']], dati)).toMatchObject({ righe: [], scartate: [expect.stringMatching(/Intestazione/)] });
    // importate, valgono come quelle inserite a mano
    const dopo = applica(dati, { tipo: 'abilitazioni.importa', righe: letto.righe }, ctx('u-tm')).dati;
    expect(dopo.abilitazioni.filter((a) => a.user_id === 'u-rinaldi' && a.mds === 'CH-47F').map((a) => a.chapter)).toEqual(['05', '06', '12']);
    expect(abilitatiPer(dopo, 'CH-47F', '12').map((u) => u.id)).toContain('u-rinaldi');
  });
});

describe('corso: iscritti, direttore, chiusura, esclusioni', () => {
  it('al corso si assegnano i frequentatori; gli istruttori non si iscrivono', () => {
    const assegna = (user_id: string): Comando => ({ tipo: 'corso.iscrivi', iscrizione: { id: 'i-x', corso_id: C2, user_id } });
    expect(applica(dati, assegna('u-costa'), ctx('u-tm')).dati.iscrizioni.find((i) => i.id === 'i-x')).toMatchObject({ ruolo: 'trainee', escluso_il: null });
    expect(applica(dati, assegna('u-costa'), ctx('u-neri')).dati.iscrizioni.some((i) => i.id === 'i-x')).toBe(true);
    expect(() => applica(dati, assegna('u-colombo'), ctx('u-tm'))).toThrow(/solo i frequentatori/);
    expect(() => applica(dati, assegna('u-marchetti'), ctx('u-tm'))).toThrow(/già assegnato/);
    expect(() => applica(dati, assegna('u-costa'), ctx('u-rinaldi'))).toThrow(/Training Manager|permessi/);
    expect(dati.iscrizioni.every((i) => i.ruolo === 'trainee' || i.ruolo === 'direttore')).toBe(true);
  });

  it('l’istruttore segue i corsi che dirige, quelli in cui è nominato per la pratica e quelli in cui ha lezioni', () => {
    // Colombo: nominato per la fase pratica del primo corso
    expect(ruoloNelCorso(dati, utente(dati, 'u-colombo'), C1)).toBe('instructor');
    const senzaLezioni = { ...dati, lezioni: dati.lezioni.filter((l) => l.istruttore_id !== 'u-colombo') };
    expect(corsiDi(senzaLezioni, utente(dati, 'u-colombo')).map((c) => c.id)).toEqual([C1]);
    // con una lezione nel secondo corso lo vede, senza esservi iscritto
    const conLezione = { ...senzaLezioni, lezioni: [...senzaLezioni.lezioni, { ...dati.lezioni[0], id: 'l-c', corso_id: C2, istruttore_id: 'u-colombo' }] };
    expect(ruoloNelCorso(conLezione, utente(dati, 'u-colombo'), C2)).toBe('instructor');
    // la nomina per la pratica si cambia nei dati del corso
    const senzaNomina = applica(senzaLezioni, { tipo: 'corso.salva', corso: corso(dati, C1), istruttori_pratica: ['u-rinaldi'] }, ctx('u-tm')).dati;
    expect(corsiDi(senzaNomina, utente(dati, 'u-colombo'))).toEqual([]);
    expect(() => applica(dati, { tipo: 'corso.salva', corso: corso(dati, C1), istruttori_pratica: ['u-gallo'] }, ctx('u-tm'))).toThrow(/solo istruttori/);
  });

  it('il direttore è un istruttore incaricato sul corso, oppure una persona fuori elenco', () => {
    const affida = (direttore_id: string | null, nome = '', chi = 'u-tm', d = dati) => applica(d, { tipo: 'corso.salva', corso: { ...corso(d), direttore_nome: nome }, direttore_id }, ctx(chi)).dati;
    expect(dati.utenti.map((u) => u.ruolo)).not.toContain('direttore');
    expect([ruoloNelCorso(dati, utente(dati, 'u-neri'), C2), nomeDirettore(dati, corso(dati)), nomeDirettore(dati, corso(dati), true)]).toEqual(['direttore', 'Cap. Marco Neri', 'Cap. NERI Marco']);

    const dopo = affida('u-greco');
    expect(dopo.iscrizioni.filter((i) => i.corso_id === C2 && i.ruolo === 'direttore').map((i) => i.user_id)).toEqual(['u-greco']);
    expect(ruoloNelCorso(dopo, utente(dopo, 'u-neri'), C1)).toBe('direttore'); // l'altro corso non cambia
    expect(salvaLezioni([lez('l-d')], 'u-greco', dopo).some((l) => l.id === 'l-d')).toBe(true);
    expect(() => salvaLezioni([lez('l-d')], 'u-neri', dopo)).toThrow(/Training Manager|permessi/); // senza incarico non prepara più il programma

    // persona fuori elenco: resta scritta nel corso, nessun account ha l'incarico
    const esterno = affida(null, ' Ten. Col. Mario Esterno ');
    expect([nomeDirettore(esterno, corso(esterno)), esterno.iscrizioni.some((i) => i.corso_id === C2 && i.ruolo === 'direttore')]).toEqual(['Ten. Col. Mario Esterno', false]);
    expect(corso(affida('u-greco', 'ignorato', 'u-tm', esterno)).direttore_nome).toBe(''); // scegliendo un istruttore il nome scritto a mano decade
    expect(() => affida('u-marchetti')).toThrow(/istruttori/);
    // il direttore modifica i dati del corso ma non passa l'incarico; senza indicarlo resta com'è
    expect(() => affida('u-greco', '', 'u-neri')).toThrow(/Training Manager/);
    const ritoccato = applica(dati, { tipo: 'corso.salva', corso: { ...corso(dati), aula: 'Aula N.3' } }, ctx('u-neri')).dati;
    expect([corso(ritoccato).aula, ruoloNelCorso(ritoccato, utente(ritoccato, 'u-neri'), C2)]).toEqual(['Aula N.3', 'direttore']);
  });

  it('la data di fine è stimata finché il corso è aperto; alla chiusura si indica quella effettiva', () => {
    const c = corso(dati);
    expect([fineCorso(c), formatoFine(c)]).toEqual(['2027-03-31', '31/03/2027 (stimata)']);
    expect(() => applica(dati, { tipo: 'corso.salva', corso: { ...c, attivo: false } }, ctx('u-tm'))).toThrow(/Data effettiva di chiusura/);
    expect(() => applica(dati, { tipo: 'corso.salva', corso: { ...c, attivo: false, data_chiusura: '2026-09-01' } }, ctx('u-tm'))).toThrow(/precede/);
    const chiuso = applica(dati, { tipo: 'corso.salva', corso: { ...c, attivo: false, data_chiusura: '2026-09-20' } }, ctx('u-tm')).dati;
    expect([fineCorso(corso(chiuso)), formatoFine(corso(chiuso)), corso(chiuso).data_inizio]).toEqual(['2026-09-20', '20/09/2026', c.data_inizio]);
    // riaprendolo torna la data stimata
    const riaperto = applica(chiuso, { tipo: 'corso.salva', corso: { ...corso(chiuso), attivo: true } }, ctx('u-tm')).dati;
    expect([corso(riaperto).data_chiusura, fineCorso(corso(riaperto))]).toEqual([null, '2027-03-31']);

    // corso completato: consultabile, ma ogni modifica chiede conferma
    const lezioni: Comando = { tipo: 'lezioni.sostituisci', corso_id: C2, giorni: ['2026-10-05'], lezioni: [lez('l')] };
    expect(conferme(dati, lezioni)).toEqual([]);
    expect(conferme(chiuso, lezioni)).toEqual(['Il corso T1-2026/2 è completato. Confermi la modifica?']);
    for (const comando of [
      { tipo: 'corso.salva', corso: corso(chiuso) },
      { tipo: 'corso.iscrivi', iscrizione: { id: 'i', corso_id: C2, user_id: 'u-costa' } },
      { tipo: 'rapportino.valida', corso_id: C2, data: '2026-09-15', valida: true },
      { tipo: 'settimana.valida', corso_id: C2, giorni: ['2026-09-14'], valida: false },
    ] satisfies Comando[]) {
      expect(conferme(chiuso, comando)).toHaveLength(1);
    }
    expect(conferme(chiuso, { tipo: 'utente.passwordCambiata' })).toEqual([]);
    expect(lezioniDi(chiuso, C2)).toHaveLength(lezioniDi(dati, C2).length); // i dati restano tutti
  });

  it('frequentatore escluso: fuori da programma e presenze da quel giorno, pratica ferma, dati storici consultabili', () => {
    const iscrizione = dati.iscrizioni.find((i) => i.corso_id === C1 && i.user_id === 'u-gallo')!;
    const escludi = (data: string | null): Comando => ({ tipo: 'corso.escludi', id: iscrizione.id, data });
    const ESCLUSIONE = '2026-09-10';
    const escluso = applica(dati, escludi(ESCLUSIONE), ctx('u-neri')).dati;
    expect(() => applica(dati, escludi(ESCLUSIONE), ctx('u-rinaldi'))).toThrow(/Training Manager|permessi/);
    expect(() => applica(dati, escludi('2026-01-01'), ctx('u-tm'))).toThrow(/precede/);

    // non compare più nelle viste attive, ma nei dati storici sì; in un giorno precedente faceva ancora parte del corso
    const ids = (quali?: Parameters<typeof frequentatori>[2]) => frequentatori(escluso, C1, quali).map((u) => u.id);
    expect(ids()).not.toContain('u-gallo');
    expect(ids({ esclusi: true })).toContain('u-gallo');
    expect([ids({ al: '2026-09-09' }).includes('u-gallo'), ids({ al: ESCLUSIONE }).includes('u-gallo')]).toEqual([true, false]);

    // presenze: dal giorno dell'esclusione non si rilevano più, prima sì
    const rapportino = (data: string): Comando => ({ tipo: 'rapportino.salva', corso_id: C1, data, note: '', presenze: [{ id: 'p', user_id: 'u-gallo', stato: 'assente', dalle: null, alle: null, motivo: '' }] });
    expect(() => applica(escluso, rapportino('2026-09-15'), ctx('u-tm'))).toThrow(/in quel giorno/);
    expect(applica(escluso, rapportino('2026-09-08'), ctx('u-tm')).dati.presenze.some((p) => p.id === 'p')).toBe(true);
    // assenze: contano solo le lezioni precedenti
    const conAssenze = applica(dati, rapportino('2026-09-17'), ctx('u-tm')).dati; // il 17/09 c'è la lezione di recupero, che non genera assenze; aggiungiamo una lezione vera
    const lezioni = [...lezioniDi(conAssenze, C1), { ...lezioniDi(conAssenze, C1)[0], id: 'tardi', data: '2026-09-17', ordine: 1 }];
    const assenze = (fino?: string) => assenzeDi(TEORICO, lezioni, rapportiniDi(conAssenze, C1), presenzeDi(conAssenze, C1), 'u-gallo', fino).assenze.map((a) => a.lezione.id);
    expect([assenze().includes('tardi'), assenze(ESCLUSIONE).includes('tardi')]).toEqual([true, false]);

    // pratica: la situazione resta quella del giorno dell'esclusione
    const prima = situazione(dati, corso(dati, C1), utente(dati, 'u-gallo'));
    const dopo = situazione(escluso, corso(escluso, C1), utente(escluso, 'u-gallo'));
    expect(dopo.escluso).toBe(ESCLUSIONE);
    expect(dopo.registrazioni).toHaveLength(prima.registrazioni.filter((r) => r.data < ESCLUSIONE).length);
    expect(dopo.registrazioni.length).toBeLessThan(prima.registrazioni.length);
    expect(registrazioniDi(escluso, C1, 'u-gallo')).toHaveLength(prima.registrazioni.length); // i dati ci sono ancora tutti

    // lui non modifica più il logbook; il TM sì, ma con una conferma che avvisa che è fuori dal corso
    const reg: Comando = {
      tipo: 'registrazione.salva',
      registrazione: { id: 'n', corso_id: C1, user_id: 'u-gallo', task_id: 1, maintenance_location: 'Viterbo', data: '2026-09-22', tipo_esecuzione: 'AC', matricola: corso(dati, C1).aeromobili[0], et_minuti: 30, instructor_id: 'ist-greco' },
    };
    expect(() => applica(escluso, reg, ctx('u-gallo'))).toThrow(/fuori dal corso/);
    expect(applica(escluso, reg, ctx('u-tm')).dati.registrazioni.some((r) => r.id === 'n')).toBe(true);
    expect(conferme(dati, reg)).toEqual([]);
    expect(conferme(escluso, reg)).toEqual(['C.le Magg. Sc. Matteo Gallo è fuori dal corso T1-2026/1 dal 10/09/2026. Confermi la modifica dei suoi dati?']);
    expect(conferme(escluso, { tipo: 'anagrafica.salva', anagrafica: { ...dati.anagrafiche.find((a) => a.user_id === 'u-gallo')!, ente: 'x' } })).toHaveLength(1);
    expect(conferme(escluso, { tipo: 'registrazione.elimina', id: prima.registrazioni[0].id })).toHaveLength(1);
    expect(conferme(escluso, { ...reg, registrazione: { ...reg.registrazione, user_id: 'u-romano' } })).toEqual([]);

    // un recupero non si destina a chi è già fuori; riammesso, torna nelle viste
    expect(ids.call(null)).toHaveLength(frequentatori(dati, C1).length - 1);
    const riammesso = applica(escluso, escludi(null), ctx('u-tm')).dati;
    expect(frequentatori(riammesso, C1).map((u) => u.id)).toContain('u-gallo');
    // chi ha già dati nel corso non si toglie: va escluso
    expect(() => applica(dati, { tipo: 'corso.disiscrivi', id: iscrizione.id }, ctx('u-tm'))).toThrow(/va escluso/);
  });

  it('i dati di versioni precedenti si aggiornano: direttore e istruttori iscritti, abilitazioni per programma', () => {
    const vecchi = JSON.parse(JSON.stringify(dati)) as Dati;
    const grezzi = vecchi as unknown as Record<string, Record<string, unknown>[]>;
    Object.assign(grezzi.utenti.find((u) => u.id === 'u-neri')!, { ruolo: 'direttore', nome: 'Cap. Marco Neri', grado: undefined, cognome: undefined });
    for (const c of grezzi.corsi) for (const campo of ['aula', 'istruttori_pratica', 'aeromobili', 'direttore_nome', 'data_chiusura']) delete c[campo];
    for (const l of grezzi.lezioni) for (const campo of ['persona', 'frequentatori', 'parte']) delete l[campo];
    for (const i of grezzi.iscrizioni) delete i.escluso_il;
    grezzi.iscrizioni.push({ id: 'i-v', corso_id: C1, user_id: 'u-greco', ruolo: 'instructor', created_at: '' });
    grezzi.abilitazioni.push({ id: 'a-v', user_id: 'u-greco', programma: 'mtt-ch47f-b13', materia: 'm001' });
    const nuovi = aggiornaDati(JSON.parse(JSON.stringify(vecchi)) as Dati);
    const u = nuovi.utenti.find((x) => x.id === 'u-neri')!;
    expect([u.ruolo, u.grado, u.nome, u.cognome]).toEqual(['instructor', '', 'Cap. Marco Neri', '']);
    expect(ruoloNelCorso(nuovi, u, C1)).toBe('direttore');
    // l'istruttore che era iscritto resta nominato per la fase pratica, senza iscrizione
    expect([corso(nuovi, C1).istruttori_pratica, nuovi.iscrizioni.some((i) => i.id === 'i-v')]).toEqual([['u-greco'], false]);
    expect(nuovi.corsi.every((c) => c.aula === '' && c.direttore_nome === '' && c.data_chiusura === null && Array.isArray(c.aeromobili))).toBe(true);
    expect(nuovi.lezioni.every((l) => l.persona === '' && l.parte === 0 && Array.isArray(l.frequentatori))).toBe(true);
    expect(nuovi.iscrizioni.every((i) => i.escluso_il === null)).toBe(true);
    expect(nuovi.abilitazioni).toHaveLength(dati.abilitazioni.length); // quelle per programma e materia non valgono più
  });
});

describe('visibilità delle pagine', () => {
  const voci = (id: string, corsoId = C1) => {
    const u = utente(dati, id);
    const ruolo = ruoloNelCorso(dati, u, corsoId);
    return menuPer(u, corso(dati, corsoId), ruolo);
  };
  const indirizzi = (id: string, corsoId = C1) => voci(id, corsoId).ordinate.map((v) => v.a);

  it('registri e abilitazioni solo al TM; ore degli istruttori e Practical Instructors anche al direttore, nel suo corso', () => {
    const SOLO_TM = ['/materie', '/registro', '/certificati', '/account'];
    const GUIDA = ['/docenti', '/istruttori'];
    expect(indirizzi('u-tm')).toEqual(expect.arrayContaining([...SOLO_TM, ...GUIDA, '/dati', '/corsi']));
    const direttore = indirizzi('u-neri');
    expect(direttore).toEqual(expect.arrayContaining([...GUIDA, '/dati', '/corso', '/distinta']));
    for (const a of SOLO_TM) expect(direttore).not.toContain(a);
    const istruttore = indirizzi('u-rinaldi');
    expect(istruttore).toEqual(expect.arrayContaining(['/dati', '/corso', '/distinta', '/settimana']));
    for (const a of [...SOLO_TM, ...GUIDA]) expect(istruttore).not.toContain(a);
    const frequentatore = indirizzi('u-gallo');
    expect(frequentatore).toEqual(expect.arrayContaining(['/dati', '/logbook', '/settimana', '/generalita']));
    for (const a of [...SOLO_TM, ...GUIDA, '/corso', '/distinta']) expect(frequentatore).not.toContain(a);
  });

  it('vale anche scrivendo l’indirizzo della pagina', () => {
    const [tm, neri, rinaldi, gallo] = ['u-tm', 'u-neri', 'u-rinaldi', 'u-gallo'].map((id) => utente(dati, id));
    for (const a of ['/materie', '/registro', '/certificati']) {
      expect([puoAprire(a, tm, 'admin'), puoAprire(a, neri, 'direttore'), puoAprire(a, rinaldi, 'instructor'), puoAprire(a, gallo, 'trainee')]).toEqual([true, false, false, false]);
    }
    for (const a of ['/docenti', '/istruttori']) {
      expect([puoAprire(a, tm, 'admin'), puoAprire(a, neri, 'direttore'), puoAprire(a, rinaldi, 'instructor'), puoAprire(a, gallo, 'trainee')]).toEqual([true, true, false, false]);
    }
    // chi dirige un corso non è direttore negli altri: lì resta un istruttore
    const altrove = applica(dati, { tipo: 'corso.salva', corso: corso(dati), direttore_id: 'u-greco' }, ctx('u-tm')).dati;
    expect(puoAprire('/docenti', neri, ruoloNelCorso(altrove, neri, C2))).toBe(false);
    expect(puoAprire('/dati', gallo, 'trainee')).toBe(true);
  });

  it('«Materie e istruttori» sta accanto a «Corsi», «Generality and Purpose» nella parte pratica', () => {
    const tm = voci('u-tm');
    expect(tm.generale.map((v) => v.a)).toEqual(['/corsi', '/materie']);
    expect(tm.teoria.map((v) => v.a)).not.toContain('/materie');
    expect(tm.pratica.at(-1)!.a).toBe('/generalita');
    expect(voci('u-neri').generale).toEqual([]);
    // corso senza parte pratica: niente voci pratiche, ma i Personal Data restano raggiungibili
    const soloTeoria = voci('u-tm', C2);
    expect(soloTeoria.pratica).toEqual([]);
    expect(soloTeoria.corso.map((v) => v.a)).toEqual(['/quadro', '/corso', '/dati']);
    expect(voci('u-marchetti', C2).corso.map((v) => v.a)).toEqual(['/quadro', '/dati']);
  });
});

describe('corso UC-228 Cat. C dell’esempio', () => {
  const uc = programmaTeorico('mtt-uc228-c')!;
  const tutte = lezioniDi(dati, 'c-2026-3');
  const l = tutte.filter((x) => x.tipo === 'lezione');
  const chapter = (x: { materia: string }) => uc.materie.find((m) => m.id === x.materia)!;

  it('dal 9 al 13/11, sospensione, dal 23/11 ogni periodo pieno fino a esaurire le 57 ore; poi MEO, esame, pratiche e fine', () => {
    expect(l.reduce((t, x) => t + x.minuti, 0)).toBe(57 * 60);
    const perGiorno = new Map<string, number>();
    for (const x of l) perGiorno.set(x.data, (perGiorno.get(x.data) ?? 0) + x.minuti / 60);
    expect([...perGiorno]).toEqual([['2026-11-09', 5], ['2026-11-10', 6], ['2026-11-11', 6], ['2026-11-12', 6], ['2026-11-13', 3], ['2026-11-23', 6], ['2026-11-24', 6], ['2026-11-25', 6], ['2026-11-26', 6], ['2026-11-27', 3], ['2026-11-30', 4]]);
    const attivita = (tipo: string) => tutte.filter((x) => x.tipo === tipo).map((x) => `${x.data} ${x.ordine + 1}°`);
    // la prima ora del corso e l'ora dopo l'esame: pratiche amministrative, con il direttore del corso
    expect(attivita('pa')).toEqual(['2026-11-09 1°', '2026-12-01 3°']);
    expect(attivita('meo')).toEqual(['2026-11-30 5°', '2026-11-30 6°']);
    expect(attivita('esame')).toEqual(['2026-12-01 1°', '2026-12-01 2°']);
    expect(tutte.filter((x) => x.tipo === 'pa' || x.tipo === 'meo').every((x) => x.istruttore_id === 'u-neri')).toBe(true);
    // sbarrati: la settimana di sospensione e, finito il corso, il resto della settimana dell'esame
    expect([...new Set(tutte.filter((x) => x.tipo === 'sospensione').map((x) => x.data))]).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
    // ogni periodo di ogni giornata è occupato, senza buchi
    const periodi = new Map<string, Set<number>>();
    for (const x of tutte) periodi.set(x.data, (periodi.get(x.data) ?? new Set()).add(x.ordine));
    for (const [data, ordini] of periodi) expect([...ordini].sort().join(), data).toBe(Array.from({ length: periodiDelGiorno(indiceGiorno(data)) }, (_, i) => i).join());
    expect(corso(dati, 'c-2026-3').durata_settimane).toBe(3);
  });

  it('solo i cinque istruttori indicati, ognuno sui chapter che ha in conferimento', () => {
    const ore = new Map<string, number>();
    for (const x of l) ore.set(x.istruttore_id!, (ore.get(x.istruttore_id!) ?? 0) + x.minuti / 60);
    expect(Object.fromEntries(ore)).toEqual({ 'u-ciav': 10.5, 'u-mast': 10, 'u-cang': 12, 'u-luon': 12, 'u-toto': 12.5 });
    expect(l.filter((x) => !dati.abilitazioni.some((a) => a.user_id === x.istruttore_id && a.mds === 'UC-228' && a.chapter === chapter(x).chapter))).toEqual([]);
    expect(['u-cang', 'u-luon', 'u-ciav', 'u-toto', 'u-mast'].map((id) => nomeUtente(dati, id))).toEqual(['Cang', 'Luon', 'Ciav', 'Toto', 'Mast']);
  });

  it('un modulo a un solo istruttore, tranne il 3 diviso per conferimenti; al massimo 3 ore a testa e 2 istruttori al giorno', () => {
    const chiPerModulo = new Map<number, Set<string>>();
    for (const x of l) chiPerModulo.set(chapter(x).modulo, (chiPerModulo.get(chapter(x).modulo) ?? new Set()).add(x.istruttore_id!));
    expect([...chiPerModulo].filter(([, chi]) => chi.size > 1).map(([m]) => m)).toEqual([3]);
    const giorni = new Map<string, Map<string, number>>();
    for (const x of l) {
      const g = giorni.get(x.data) ?? new Map<string, number>();
      g.set(x.istruttore_id!, (g.get(x.istruttore_id!) ?? 0) + x.minuti);
      giorni.set(x.data, g);
    }
    for (const [data, g] of giorni) {
      expect(g.size, data).toBeLessThanOrEqual(2);
      expect(Math.max(...g.values()), data).toBeLessThanOrEqual(180);
    }
    // il direttore lo salva così com'è: il motore controlla periodi, durate e abilitazioni
    const giorniCorso = [...new Set(tutte.map((x) => x.data))];
    expect(() => applica(dati, { tipo: 'lezioni.sostituisci', corso_id: 'c-2026-3', giorni: giorniCorso, lezioni: tutte }, ctx('u-neri'))).not.toThrow();
  });
});
