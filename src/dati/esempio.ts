import { generaSettimana, lunediDi, sommaGiorni } from '../dominio/pianificazione';
import { minimoMeta } from '../dominio/compliance';
import { PROGRAMMI_PRATICI, PROGRAMMI_TEORICI, materiaDi, type Task } from '../dominio/programmi';
import type { Abilitazione, Anagrafica, Certificato, Corso, Dati, DatiTraining, Iscrizione, Istruttore, Lezione, Presenza, Rapportino, Registrazione, StatoPresenza, TipoEsecuzione, Utente } from '../dominio/tipi';

/**
 * Situazione esempio SINTETICA per la modalità dimostrativa: persone, matricole e
 * approvazioni sono inventate. Generata in modo deterministico (stesso seme, stessi dati).
 * Due corsi: uno in svolgimento (teoria conclusa, pratica in corso) e uno appena iniziato (solo teoria).
 */

export const PASSWORD_DEMO = 'ptt-demo-2026';

const PRATICO = PROGRAMMI_PRATICI[0];
const TEORICO = PROGRAMMI_TEORICI[0];
const TASK = PRATICO.task;

function generatore(seme: number) {
  let a = seme;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    tra: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    uno: <T,>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)],
    mescola: <T,>(lista: readonly T[]) => {
      const c = [...lista];
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [c[i], c[j]] = [c[j], c[i]];
      }
      return c;
    },
  };
}

const INIZIO = '2026-07-06';
const ISTANTE_BASE = '2026-07-01T08:00:00.000Z';
const CORSO_1 = 'c-2026-1';
const CORSO_2 = 'c-2026-2';

const ISTRUTTORI: Istruttore[] = [
  ['ist-rinaldi', 'Mar. Ca.', 'Paolo', 'Rinaldi'],
  ['ist-colombo', 'Lgt.', 'Andrea', 'Colombo'],
  ['ist-greco', '1° Mar.', 'Stefano', 'Greco'],
  ['ist-marino', 'Serg. Magg. Ca.', 'Davide', 'Marino'],
  ['ist-conti', 'Mar. Ord.', 'Fabio', 'Conti'],
].map(([id, grado, nome, cognome]) => ({ id, grado, nome, cognome, created_at: ISTANTE_BASE, created_by: 'u-tm' }));

const utente = (id: string, username: string, ruolo: Utente['ruolo'], [grado, nome, cognome] = ['', '', ''], istruttore_id: string | null = null): Utente => ({
  id,
  username,
  ruolo,
  grado,
  nome,
  cognome,
  istruttore_id,
  attivo: true,
  deve_cambiare_password: false,
  created_at: ISTANTE_BASE,
  updated_at: ISTANTE_BASE,
});

interface Profilo {
  id: string;
  username: string;
  /** grado, nome, cognome, data e città di nascita, MAML, ente */
  anagrafica: [string, string, string, string, string, string, string] | null;
  /** quanti task eseguire e con quali vincoli */
  obiettivo: { conforme: 'si' | 'quasi' | 'no'; task: number; chapterScoperti?: string[] };
}

const FREQUENTATORI: Profilo[] = [
  { id: 'u-romano', username: 'giulia.romano', anagrafica: ['Serg. Magg.', 'Giulia', 'Romano', '1994-03-18', 'Viterbo', 'MAML-IT-0417', '1° Rgt. AVES'], obiettivo: { conforme: 'si', task: 118 } },
  {
    id: 'u-bruno',
    username: 'alessandro.bruno',
    anagrafica: ['Serg.', 'Alessandro', 'Bruno', '1996-11-02', 'Caserta', 'MAML-IT-0388', '1° Rgt. AVES'],
    obiettivo: { conforme: 'quasi', task: 104, chapterScoperti: ['44', '46', 'AVES 3'] },
  },
  { id: 'u-gallo', username: 'matteo.gallo', anagrafica: ['C.le Magg. Sc.', 'Matteo', 'Gallo', '1998-07-25', 'Rieti', 'MAML-IT-0452', '4° Rgt. AVES'], obiettivo: { conforme: 'no', task: 71 } },
  { id: 'u-costa', username: 'francesca.costa', anagrafica: ['Serg.', 'Francesca', 'Costa', '1997-01-09', 'Bracciano', '', '4° Rgt. AVES'], obiettivo: { conforme: 'no', task: 44 } },
  { id: 'u-ricci', username: 'luca.ricci', anagrafica: ['C.le Magg. Ca.', 'Luca', 'Ricci', '1995-05-30', 'Orvieto', '', '7° Rgt. AVES'], obiettivo: { conforme: 'no', task: 19 } },
  { id: 'u-fontana', username: 'simone.fontana', anagrafica: null, obiettivo: { conforme: 'no', task: 0 } },
];

/** Frequentatori del secondo corso (solo teoria, appena iniziato). */
const NUOVI: Profilo[] = [
  { id: 'u-marchetti', username: 'davide.marchetti', anagrafica: ['Serg.', 'Davide', 'Marchetti', '1999-02-14', 'Terni', '', '1° Rgt. AVES'], obiettivo: { conforme: 'no', task: 0 } },
  { id: 'u-pellegrini', username: 'sara.pellegrini', anagrafica: ['C.le Magg. Sc.', 'Sara', 'Pellegrini', '1998-09-03', 'Perugia', '', '5° Rgt. AVES'], obiettivo: { conforme: 'no', task: 0 } },
  { id: 'u-esposito', username: 'nicola.esposito', anagrafica: ['Serg. Magg.', 'Nicola', 'Esposito', '1993-12-21', 'Napoli', '', '7° Rgt. AVES'], obiettivo: { conforme: 'no', task: 0 } },
];

/** Giorni lavorativi del corso fino a ieri (rispetto al 22/09/2026, data di preparazione dell'esempio). */
function giorniLavorativi(fino: string): string[] {
  const giorni: string[] = [];
  for (let d = new Date(`${INIZIO}T12:00:00Z`); d.toISOString().slice(0, 10) <= fino; d.setUTCDate(d.getUTCDate() + 1)) {
    const g = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    // pausa estiva di Ferragosto
    if (g !== 0 && g !== 6 && !(iso >= '2026-08-10' && iso <= '2026-08-21')) giorni.push(iso);
  }
  return giorni;
}

/** Sceglie i task da eseguire rispettando (o no) i requisiti di conformità. */
function scegliTask(p: Profilo, g: ReturnType<typeof generatore>): Task[] {
  const { conforme, task: quanti, chapterScoperti = [] } = p.obiettivo;
  if (!quanti) return [];
  const scelti = new Set<Task>();
  const disponibili = TASK.filter((t) => !chapterScoperti.includes(t.chapter));
  if (conforme !== 'no') {
    // il 50% di ogni chapter coperto, di ogni modulo e di ogni task type
    const gruppi = (chiave: (t: Task) => string | number) => [...new Set(TASK.map(chiave))].map((k) => TASK.filter((t) => chiave(t) === k));
    for (const gruppo of [...gruppi((t) => t.chapter), ...gruppi((t) => t.modulo), ...gruppi((t) => t.tipo)]) {
      const candidati = g.mescola(gruppo.filter((t) => disponibili.includes(t)));
      for (const t of candidati) {
        if ([...scelti].filter((s) => gruppo.includes(s)).length >= minimoMeta(gruppo.length)) break;
        scelti.add(t);
      }
    }
    for (const t of g.mescola(disponibili)) if (scelti.size < quanti) scelti.add(t);
  } else {
    // avanzamento parziale: si procede per moduli, con qualche salto in avanti
    const pesati = [...disponibili].sort((a, b) => a.modulo + g.r() * 3.2 - (b.modulo + g.r() * 3.2));
    for (const t of pesati) if (scelti.size < quanti && g.r() < 0.78) scelti.add(t);
    for (const t of pesati) if (scelti.size < quanti) scelti.add(t);
  }
  return [...scelti].sort((a, b) => a.modulo - b.modulo || a.id - b.id);
}

const ET: Record<string, [number, number]> = { LOC: [20, 45], SGH: [30, 90], FOT: [40, 120], 'R/I': [60, 180], TS: [45, 150] };
const MATRICOLE = ['MM81781 · EI-901', 'MM81783 · EI-903', 'MM81786 · EI-906', 'MM81790 · EI-910'];

function registrazioni(p: Profilo, g: ReturnType<typeof generatore>): Registrazione[] {
  const task = scegliTask(p, g);
  if (!task.length) return [];
  const giorni = giorniLavorativi('2026-09-21');
  // tutti registrano fino agli ultimi giorni; chi è più indietro registra meno spesso
  const finestra = giorni.slice(0, giorni.length - g.tra(0, 3));
  const elenco: Registrazione[] = [];
  task.forEach((t, i) => {
    const volte = g.r() < 0.12 ? 2 : 1;
    for (let v = 0; v < volte; v++) {
      const indice = Math.min(finestra.length - 1, Math.floor((i / task.length) * finestra.length) + v * g.tra(2, 6));
      const data = finestra[indice];
      const x = g.r();
      const tipo: TipoEsecuzione = x < 0.86 ? 'AC' : x < 0.93 ? 'SIM' : 'CLA';
      const [min, max] = ET[t.tipo];
      const ora = `${data}T${String(g.tra(13, 17)).padStart(2, '0')}:${String(g.tra(0, 59)).padStart(2, '0')}:00.000Z`;
      elenco.push({
        id: `r-${p.id.slice(2)}-${t.id}-${v}`,
        corso_id: CORSO_1,
        user_id: p.id,
        task_id: t.id,
        maintenance_location: tipo === 'AC' ? g.uno(['Viterbo – Hangar 3', 'Viterbo – Hangar 3', 'Viterbo – Linea volo']) : tipo === 'SIM' ? 'Viterbo – Simulatore CH-47F' : 'Viterbo – Aula didattica 2',
        data,
        tipo_esecuzione: tipo,
        matricola: tipo === 'AC' ? g.uno(MATRICOLE) : '',
        et_minuti: Math.round(g.tra(min, max) / 5) * 5,
        instructor_id: g.uno([...ISTRUTTORI, ISTRUTTORI[0], ISTRUTTORI[1]]).id,
        creato_il: ora,
        creato_da: p.id,
        modificato_il: ora,
        modificato_da: p.id,
      });
    }
  });
  // un paio di correzioni del Training Manager
  for (const r of elenco.filter((_, i) => i % 37 === 5)) {
    r.modificato_il = `${r.data}T19:10:00.000Z`;
    r.modificato_da = 'u-tm';
  }
  return elenco;
}

const corso = (id: string, codice: string, nome: string, extra: Partial<Corso>): Corso => ({
  id,
  codice,
  nome,
  mds: 'CH-47F',
  categoria: 'B1.3',
  programma_teorico: TEORICO.id,
  programma_pratico: PRATICO.id,
  data_inizio: INIZIO,
  data_fine: '2026-10-02',
  data_chiusura: null,
  durata_settimane: 13,
  maintenance_organization: '1° Reggimento AVES "Antares" – appr. DAAA n. 00/ESEMPIO',
  location: 'Viterbo',
  aula: 'Aula N.1',
  gruppo_firma: 'Col. Giorgio ESEMPIO',
  direttore_nome: '',
  istruttori_pratica: ['u-rinaldi', 'u-colombo'],
  aeromobili: MATRICOLE,
  attivo: true,
  created_at: ISTANTE_BASE,
  updated_at: ISTANTE_BASE,
  ...extra,
});

/** Abilitazioni dell'esempio: ogni chapter del CH-47F ha uno o due istruttori abilitati. */
const ABILITATI = new Map<string, string[]>();
TEORICO.materie.forEach((m, i) => {
  const chi = [['u-rinaldi', 'u-greco', 'u-neri'][i % 3], ...(i % 3 === 0 ? ['u-colombo'] : [])];
  ABILITATI.set(m.chapter, [...new Set([...(ABILITATI.get(m.chapter) ?? []), ...chi])]);
});

/** Lezioni delle prime settimane, tenute da istruttori abilitati al chapter. */
function lezioniEsempio(corsoId: string, inizio: string, settimane: number, g: ReturnType<typeof generatore>): Lezione[] {
  const lezioni: Lezione[] = [];
  let lunedi = lunediDi(inizio);
  for (let s = 0; s < settimane; s++) {
    for (const p of generaSettimana(TEORICO, lezioni, lunedi, { istruttorePerMateria: (m) => g.uno(ABILITATI.get(m.chapter)!) })) {
      lezioni.push({
        id: `l-${corsoId}-${lezioni.length}`,
        corso_id: corsoId,
        data: p.data,
        ordine: p.ordine,
        parte: p.parte,
        minuti: p.minuti,
        materia: p.materia,
        istruttore_id: p.istruttore_id,
        persona: '',
        frequentatori: [],
        aula: '',
        tipo: 'lezione',
        validata: false,
        validata_da: null,
        validata_il: null,
        note: '',
        creato_il: ISTANTE_BASE,
        modificato_il: ISTANTE_BASE,
        modificato_da: 'u-tm',
      });
    }
    lunedi = sommaGiorni(lunedi, 7);
  }
  return lezioni;
}

/** Assenze inventate: chi è più indietro con la pratica salta qualche giornata. */
const REGOLE_PRESENZA: Record<string, (i: number) => StatoPresenza> = {
  'u-ricci': (i) => (i % 4 === 1 || i % 13 === 8 ? 'assente' : 'presente'),
  'u-costa': (i) => (i % 9 === 3 ? 'assente' : i % 7 === 2 ? 'parziale' : 'presente'),
  'u-gallo': (i) => (i % 11 === 5 ? 'parziale' : 'presente'),
  'u-esposito': (i) => (i % 5 === 2 ? 'parziale' : 'presente'),
};
const MOTIVI = ['Servizio di guardia', 'Visita medica', 'Permesso breve', 'Missione'];

/** Rapportini presenze delle giornate già concluse, con le ultime ancora da validare. */
function rapportiniEsempio(corsoId: string, lezioni: readonly Lezione[], allievi: readonly string[], fino: string, validatiFinoA: string) {
  const rapportini: Rapportino[] = [];
  const presenze: Presenza[] = [];
  const giorni = [...new Set(lezioni.filter((l) => l.corso_id === corsoId && l.data <= fino).map((l) => l.data))].sort();
  giorni.forEach((data, i) => {
    const validato = data <= validatiFinoA;
    rapportini.push({
      id: `rp-${corsoId}-${data}`,
      corso_id: corsoId,
      data,
      note: '',
      compilato_da: allievi[i % allievi.length],
      compilato_il: `${data}T16:40:00.000Z`,
      validato_da: validato ? 'u-neri' : null,
      validato_il: validato ? `${data}T17:15:00.000Z` : null,
    });
    for (const user_id of allievi) {
      const stato = REGOLE_PRESENZA[user_id]?.(i) ?? 'presente';
      presenze.push({
        id: `pr-${corsoId}-${data}-${user_id}`,
        corso_id: corsoId,
        data,
        user_id,
        stato,
        dalle: stato === 'parziale' ? '08:00' : null,
        alle: stato === 'parziale' ? '12:30' : null,
        motivo: stato === 'presente' ? '' : MOTIVI[i % MOTIVI.length],
      });
    }
  });
  return { rapportini, presenze };
}

export function datiEsempio(): Dati {
  const g = generatore(147);
  const tutti = [...FREQUENTATORI, ...NUOVI];
  const anagrafiche: Anagrafica[] = tutti
    .filter((p) => p.anagrafica)
    .map((p) => {
      const [grado, nome, cognome, data_nascita, citta_nascita, maml, ente] = p.anagrafica!;
      return { user_id: p.id, grado, nome, cognome, data_nascita, citta_nascita, maml, ente, updated_at: '2026-07-06T09:00:00.000Z', updated_by: p.id };
    });
  const fontana = utente('u-fontana', 'simone.fontana', 'trainee');
  fontana.created_at = fontana.updated_at = '2026-09-21T10:00:00.000Z';

  const corsi: Corso[] = [
    corso(CORSO_1, 'T1-2026/1', 'T1 Type Training CH-47F Cat. B1.3 – 1° corso 2026', {}),
    corso(CORSO_2, 'T1-2026/2', 'T1 Type Training CH-47F Cat. B1.3 – 2° corso 2026', {
      data_inizio: '2026-09-14',
      data_fine: '2027-03-31',
      durata_settimane: 28,
      programma_pratico: null,
      istruttori_pratica: [],
      created_at: '2026-09-10T08:00:00.000Z',
    }),
  ];

  const utenti: Utente[] = [
    utente('u-tm', 'tm.ferri', 'admin', ['Magg.', 'Luca', 'Ferri']),
    // il direttore è un istruttore come gli altri: l'incarico sta nell'iscrizione ai due corsi
    utente('u-neri', 'marco.neri', 'instructor', ['Cap.', 'Marco', 'Neri']),
    utente('u-rinaldi', 'paolo.rinaldi', 'instructor', ['Mar. Ca.', 'Paolo', 'Rinaldi'], 'ist-rinaldi'),
    utente('u-colombo', 'andrea.colombo', 'instructor', ['Lgt.', 'Andrea', 'Colombo'], 'ist-colombo'),
    utente('u-greco', 'stefano.greco', 'instructor', ['1° Mar.', 'Stefano', 'Greco'], 'ist-greco'),
    ...FREQUENTATORI.filter((p) => p.id !== 'u-fontana').map((p) => utente(p.id, p.username, 'trainee')),
    fontana,
    ...NUOVI.map((p) => utente(p.id, p.username, 'trainee')),
  ];

  // al corso sono assegnati i frequentatori; gli istruttori no: il direttore ha l'incarico, gli altri arrivano con le lezioni o con la fase pratica
  const iscrizione = (corso_id: string, user_id: string, ruolo: Iscrizione['ruolo']): Iscrizione => ({ id: `i-${corso_id}-${user_id}`, corso_id, user_id, ruolo, escluso_il: null, created_at: ISTANTE_BASE });
  const iscrizioni: Iscrizione[] = [
    ...FREQUENTATORI.map((p) => iscrizione(CORSO_1, p.id, 'trainee')),
    iscrizione(CORSO_1, 'u-neri', 'direttore'),
    ...NUOVI.map((p) => iscrizione(CORSO_2, p.id, 'trainee')),
    iscrizione(CORSO_2, 'u-neri', 'direttore'),
  ];

  const training: DatiTraining[] = FREQUENTATORI.map((p) => ({
    corso_id: CORSO_1,
    user_id: p.id,
    data_inizio: INIZIO,
    data_fine: '2026-10-02',
    maintenance_organization: '1° Reggimento AVES "Antares" – appr. DAAA n. 00/ESEMPIO',
    location: 'Viterbo',
    updated_at: ISTANTE_BASE,
    updated_by: 'u-tm',
  }));

  // abilitazioni: per mezzo e chapter, valide per tutti i corsi CH-47F
  const abilitazioni: Abilitazione[] = [...ABILITATI].flatMap(([chapter, chi]) => chi.map((user_id) => ({ id: `${user_id}|CH-47F|${chapter}`, user_id, mds: 'CH-47F', chapter })));

  // primo corso: teoria conclusa e validata, con una lezione di recupero a settembre
  const lezioni1 = lezioniEsempio(CORSO_1, INIZIO, 3, g);
  for (const l of lezioni1) Object.assign(l, { validata: true, validata_da: 'u-neri', validata_il: `${l.data}T07:00:00.000Z` });
  const giorni1 = [...new Set(lezioni1.map((l) => l.data))].sort();
  // qualche periodo non didattico, come capita nella realtà
  const segna = (data: string, ordine: number, tipo: Lezione['tipo']) => {
    const l = lezioni1.find((x) => x.data === data && x.ordine === ordine);
    // MEO ed esame fanno capo al direttore del corso; la sospensione non ha né istruttore né aula
    if (l) Object.assign(l, { tipo, materia: '', note: '' }, tipo === 'sospensione' ? { istruttore_id: null, aula: '' } : { istruttore_id: 'u-neri' });
  };
  segna(giorni1[5], 5, 'meo');
  segna(giorni1[8], 0, 'sospensione');
  segna(giorni1.at(-1)!, 0, 'esame');
  const daRecuperare = lezioni1.find((l) => l.data === giorni1[3])!.materia;
  lezioni1.push({
    id: 'l-recupero-1',
    corso_id: CORSO_1,
    data: '2026-09-17',
    ordine: 0,
    parte: 0,
    minuti: 60,
    materia: daRecuperare,
    istruttore_id: ABILITATI.get(materiaDi(TEORICO, daRecuperare)!.chapter)![0],
    persona: '',
    // il recupero è per chi aveva perso la materia
    frequentatori: ['u-costa', 'u-ricci'],
    aula: 'Aula N.2',
    tipo: 'recupero',
    validata: true,
    validata_da: 'u-neri',
    validata_il: '2026-09-16T07:00:00.000Z',
    note: 'Recupero per le assenze della materia',
    creato_il: '2026-09-15T08:00:00.000Z',
    modificato_il: '2026-09-15T08:00:00.000Z',
    modificato_da: 'u-neri',
  });

  // secondo corso: la prima settimana è validata, la seconda è ancora in preparazione
  const lezioni2 = lezioniEsempio(CORSO_2, '2026-09-14', 2, g);
  for (const l of lezioni2) if (l.data <= '2026-09-18') Object.assign(l, { validata: true, validata_da: 'u-neri', validata_il: '2026-09-13T18:00:00.000Z' });

  // registro dei certificati AER(EP).P-147: due rilasciati e uno ancora da completare
  const certificato = (numero: number, user_id: string, tipo: Certificato['tipo'], stato: Certificato['stato'], extra: Partial<Certificato> = {}): Certificato => ({
    id: `cert-${numero}`,
    corso_id: CORSO_1,
    user_id,
    numero,
    anno: 2026,
    tipo,
    stato,
    mds: 'CH-47F',
    categoria: 'B1.3',
    programma: TEORICO.documento,
    data_inizio: INIZIO,
    data_fine: '2026-10-02',
    ore: 219,
    esame_data: '2026-07-24',
    esame_esito: 'superato',
    pratica_data: null,
    pratica_esito: '',
    data_rilascio: stato === 'rilasciato' ? '2026-09-21' : null,
    luogo_rilascio: stato === 'rilasciato' ? 'Viterbo' : '',
    organizzazione: '1° Reggimento AVES "Antares" – appr. DAAA n. 00/ESEMPIO',
    note: '',
    creato_il: '2026-09-21T09:00:00.000Z',
    creato_da: 'u-tm',
    modificato_il: '2026-09-21T09:00:00.000Z',
    modificato_da: 'u-tm',
    ...extra,
  });
  const certificati: Certificato[] = [
    certificato(1, 'u-romano', 'completo', 'rilasciato', { pratica_data: '2026-09-18', pratica_esito: 'superato' }),
    certificato(2, 'u-bruno', 'teorico', 'rilasciato'),
    certificato(3, 'u-gallo', 'teorico', 'bozza', { esame_esito: '' }),
  ];

  const presenze1 = rapportiniEsempio(CORSO_1, lezioni1, FREQUENTATORI.map((p) => p.id), '2026-09-21', '2026-09-21');
  const presenze2 = rapportiniEsempio(CORSO_2, lezioni2, NUOVI.map((p) => p.id), '2026-09-21', '2026-09-18');

  return {
    utenti,
    corsi,
    iscrizioni,
    anagrafiche,
    training,
    istruttori: ISTRUTTORI,
    registrazioni: FREQUENTATORI.flatMap((p) => registrazioni(p, g)),
    lezioni: [...lezioni1, ...lezioni2],
    abilitazioni,
    rapportini: [...presenze1.rapportini, ...presenze2.rapportini],
    presenze: [...presenze1.presenze, ...presenze2.presenze],
    certificati,
  };
}
