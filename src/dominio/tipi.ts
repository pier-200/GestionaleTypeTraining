/** Modello dati condiviso. Date in formato YYYY-MM-DD, istanti ISO. */

export type ID = string;
/** Ruolo dell'account: si conosce già all'accesso. */
export type Ruolo = 'admin' | 'instructor' | 'trainee';
/**
 * Ruolo dentro un singolo corso. Il direttore non è un tipo di account: è un istruttore
 * a cui il Training Manager affida quel corso (uno solo per corso).
 */
export type RuoloCorso = 'direttore' | 'instructor' | 'trainee';
export type RuoloNelCorso = 'admin' | RuoloCorso;
export type TipoEsecuzione = 'AC' | 'SIM' | 'CLA';

export interface Utente {
  id: ID;
  username: string;
  ruolo: Ruolo;
  attivo: boolean;
  /** Grado, nome e cognome di TM e istruttori (i frequentatori usano i Personal Data). */
  grado: string;
  /** Negli account creati prima della divisione in tre campi contiene l'intero nominativo. */
  nome: string;
  cognome: string;
  /** Account istruttore collegato alla voce dell'elenco istruttori pratici. */
  istruttore_id: ID | null;
  deve_cambiare_password: boolean;
  created_at: string;
  updated_at: string;
}

/** Un corso: mezzo (MDS), categoria, parte teorica (MTT) e, per le categorie B, parte pratica (PTT). */
export interface Corso {
  id: ID;
  codice: string;
  nome: string;
  /** Mezzo: CH-47F, UC-228, VC-180A… */
  mds: string;
  /** Categoria della licenza: B1.1, B1.3, B2, C. */
  categoria: string;
  programma_teorico: string | null;
  programma_pratico: string | null;
  data_inizio: string | null;
  /** Data stimata di fine corso: oltre questa il programma settimanale riporta il ritardo. */
  data_fine: string | null;
  /** Data effettiva di chiusura: c'è solo quando il corso è completato, e da lì sostituisce ovunque quella stimata. */
  data_chiusura: string | null;
  /** Durata prevista, in settimane. */
  durata_settimane: number | null;
  maintenance_organization: string;
  location: string;
  /** Aula proposta per ogni lezione, salvo diversa indicazione sul singolo periodo. */
  aula: string;
  /** Gruppo firma del comandante, in calce al programma settimanale. */
  gruppo_firma: string;
  /** Direttore del corso scritto a mano, quando non è uno degli istruttori (altrimenti lo dice l'iscrizione «direttore»). */
  direttore_nome: string;
  /** Istruttori nominati per la fase pratica: vedono il corso e i logbook dei frequentatori. */
  istruttori_pratica: ID[];
  /** Identificativi degli aeromobili disponibili per i task pratici (es. EI906). */
  aeromobili: string[];
  /** Falso quando il corso è completato: resta consultabile, ogni modifica chiede conferma. */
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

/** Chi fa parte di un corso: i frequentatori che gli sono assegnati e l'istruttore che lo dirige. */
export interface Iscrizione {
  id: ID;
  corso_id: ID;
  user_id: ID;
  ruolo: 'direttore' | 'trainee';
  /** Dal giorno indicato il frequentatore è fuori dal corso: i suoi dati restano, fermi a quella data. */
  escluso_il: string | null;
  created_at: string;
}

export interface Anagrafica {
  user_id: ID;
  grado: string;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  citta_nascita: string;
  /** Numero MAML: compare nell'intestazione del Compliance Report. */
  maml: string;
  /** Ente di appartenenza: compare nell'elenco dei frequentatori del programma settimanale. */
  ente: string;
  updated_at: string;
  updated_by: ID | null;
}

/** Practical type training data del frequentatore, per corso. */
export interface DatiTraining {
  corso_id: ID;
  user_id: ID;
  data_inizio: string | null;
  data_fine: string | null;
  maintenance_organization: string;
  location: string;
  updated_at: string;
  updated_by: ID | null;
}

export interface Istruttore {
  id: ID;
  grado: string;
  nome: string;
  cognome: string;
  created_at: string;
  created_by: ID | null;
}

export interface Registrazione {
  id: ID;
  corso_id: ID;
  user_id: ID;
  task_id: number;
  maintenance_location: string;
  data: string;
  tipo_esecuzione: TipoEsecuzione;
  /** Matricola e numero identificativo dell'aeromobile (solo per tipo AC). */
  matricola: string;
  et_minuti: number;
  instructor_id: ID;
  creato_il: string;
  creato_da: ID | null;
  modificato_il: string;
  modificato_da: ID | null;
}

/** Lezione della parte teorica: una fetta di materia in un giorno. */
export interface Lezione {
  id: ID;
  corso_id: ID;
  data: string;
  /** Periodo della giornata (0 = il primo, alle 08:20). */
  ordine: number;
  /** Posizione dentro il periodo: più lezioni brevi possono dividersi la stessa ora (0 = la prima). */
  parte: number;
  minuti: number;
  /** Materia del programma: un chapter previsto dal syllabus, con le sue ore. */
  materia: string;
  istruttore_id: ID | null;
  /** Persona di riferimento senza account (solo pratiche amministrative: RSPP o altri). */
  persona: string;
  /** Lezione di recupero: i frequentatori a cui è destinata (solo a loro scala le assenze). */
  frequentatori: ID[];
  /** Aula del periodo; vuota = aula del corso. */
  aula: string;
  /** Lezione, recupero oppure un'altra attività del periodo (MEO, sospensione, esami, pratica…). */
  tipo: TipoPeriodo;
  /** Il programma diventa visibile ai frequentatori solo dopo la validazione. */
  validata: boolean;
  validata_da: ID | null;
  validata_il: string | null;
  note: string;
  creato_il: string;
  modificato_il: string;
  modificato_da: ID | null;
}

export type StatoPresenza = 'presente' | 'parziale' | 'assente';

/** Cosa si svolge in un periodo del programma settimanale. */
export type TipoPeriodo = 'lezione' | 'recupero' | 'meo' | 'sospensione' | 'esame' | 'esame_pratico' | 'pratica' | 'valutazione' | 'pa';

/** Nell'ordine della tendina «Cosa si svolge». */
export const ETICHETTA_PERIODO: Record<TipoPeriodo, string> = {
  lezione: 'Lezione',
  recupero: 'Lezione di recupero',
  meo: 'Mantenimento efficienza operativa',
  sospensione: 'Sospensione',
  esame: 'Esame teorico',
  esame_pratico: 'Esame pratico',
  pratica: 'Practical training',
  valutazione: 'Valutazione in itinere',
  pa: 'Pratiche amministrative',
};

/** Codice dell'attività, nella griglia della settimana e nella colonna COD. del modulo. */
export const SIGLA_PERIODO: Record<TipoPeriodo, string> = {
  lezione: '',
  recupero: 'REC',
  meo: 'MEO',
  sospensione: '////',
  esame: 'EX',
  esame_pratico: 'EX',
  pratica: 'PT',
  valutazione: 'VI',
  pa: 'PA',
};

/** Persona indicata accanto al periodo: istruttore della lezione, presidente di commissione, riferimento. */
export const ETICHETTA_ISTRUTTORE: Record<TipoPeriodo, string> = {
  lezione: 'Istruttore',
  recupero: 'Istruttore',
  meo: 'Istruttore di riferimento',
  sospensione: '',
  esame: 'Presidente di commissione',
  esame_pratico: 'Presidente di commissione',
  pratica: 'Istruttore',
  valutazione: 'Istruttore',
  pa: 'Persona di riferimento',
};

/** Solo lezioni e recuperi hanno una materia del programma. */
export const conMateria = (tipo: TipoPeriodo) => tipo === 'lezione' || tipo === 'recupero';
/** La sospensione è una cella sbarrata: niente istruttore né altri dati. */
export const conIstruttore = (tipo: TipoPeriodo) => tipo !== 'sospensione';
/** Solo nelle pratiche amministrative il riferimento può essere una persona senza account (es. l'RSPP). */
export const conPersona = (tipo: TipoPeriodo) => tipo === 'pa';
export const RSPP = 'RSPP';

/** Rapportino presenze di una giornata di corso: lo compilano i frequentatori, lo valida chi guida. */
export interface Rapportino {
  id: ID;
  corso_id: ID;
  data: string;
  note: string;
  compilato_da: ID | null;
  compilato_il: string;
  validato_da: ID | null;
  validato_il: string | null;
}

/** Presenza di un frequentatore in una giornata (orario standard salvo diversa indicazione). */
export interface Presenza {
  id: ID;
  corso_id: ID;
  data: string;
  user_id: ID;
  stato: StatoPresenza;
  /** Orario effettivo, solo per la presenza parziale. */
  dalle: string | null;
  alle: string | null;
  motivo: string;
}

/** Certificato AER(EP).P-147 rilasciato al termine del corso. */
export type TipoCertificato = 'teorico' | 'pratico' | 'completo';
export type StatoCertificato = 'bozza' | 'rilasciato' | 'annullato';
export type EsitoProva = '' | 'superato' | 'non superato';

export const ETICHETTA_CERTIFICATO: Record<TipoCertificato, string> = {
  teorico: 'Theoretical Training Certificate',
  pratico: 'Practical Training Certificate',
  completo: 'Type Training Certificate (teorico e pratico)',
};

export const ETICHETTA_STATO_CERTIFICATO: Record<StatoCertificato, string> = {
  bozza: 'Bozza',
  rilasciato: 'Rilasciato',
  annullato: 'Annullato',
};

/**
 * Riga del registro dei certificati: i dati del corso sono copiati qui al momento
 * del rilascio, perché il certificato resta com'era anche se il corso cambia.
 */
export interface Certificato {
  id: ID;
  corso_id: ID;
  user_id: ID;
  /** Progressivo nell'anno, come sul registro. */
  numero: number;
  anno: number;
  tipo: TipoCertificato;
  stato: StatoCertificato;
  mds: string;
  categoria: string;
  /** Documento di riferimento del programma svolto. */
  programma: string;
  data_inizio: string | null;
  data_fine: string | null;
  /** Ore di addestramento teorico riconosciute. */
  ore: number;
  esame_data: string | null;
  esame_esito: EsitoProva;
  pratica_data: string | null;
  pratica_esito: EsitoProva;
  data_rilascio: string | null;
  luogo_rilascio: string;
  /** Maintenance Organisation e numero di approvazione DAAA. */
  organizzazione: string;
  note: string;
  creato_il: string;
  creato_da: ID | null;
  modificato_il: string;
  modificato_da: ID | null;
}

/** Chapter che un istruttore è abilitato a erogare a lezione, per mezzo (MDS): vale per tutte le categorie. */
export interface Abilitazione {
  id: ID;
  user_id: ID;
  mds: string;
  chapter: string;
}

export interface Dati {
  utenti: Utente[];
  corsi: Corso[];
  iscrizioni: Iscrizione[];
  anagrafiche: Anagrafica[];
  training: DatiTraining[];
  istruttori: Istruttore[];
  registrazioni: Registrazione[];
  lezioni: Lezione[];
  abilitazioni: Abilitazione[];
  rapportini: Rapportino[];
  presenze: Presenza[];
  certificati: Certificato[];
}

export const datiVuoti = (): Dati => ({
  utenti: [],
  corsi: [],
  iscrizioni: [],
  anagrafiche: [],
  training: [],
  istruttori: [],
  registrazioni: [],
  lezioni: [],
  abilitazioni: [],
  rapportini: [],
  presenze: [],
  certificati: [],
});

/** Completa i dati salvati da versioni precedenti dell'applicazione. */
export function aggiornaDati(d: Dati): Dati {
  return {
    ...d,
    // «direttore» era un tipo di account: ora è un istruttore con un incarico nel corso (resta nell'iscrizione)
    utenti: d.utenti.map((u) => ({ ...u, grado: u.grado ?? '', cognome: u.cognome ?? '', ruolo: (u.ruolo as string) === 'direttore' ? 'instructor' : u.ruolo })),
    corsi: d.corsi.map((c) => ({
      ...c,
      durata_settimane: c.durata_settimane ?? null,
      data_chiusura: c.data_chiusura ?? null,
      aula: c.aula ?? '',
      gruppo_firma: c.gruppo_firma ?? '',
      direttore_nome: c.direttore_nome ?? '',
      // gli istruttori non si iscrivono più ai corsi: chi lo era resta nominato per la fase pratica
      istruttori_pratica: c.istruttori_pratica ?? d.iscrizioni.filter((i) => i.corso_id === c.id && (i.ruolo as string) === 'instructor').map((i) => i.user_id),
      aeromobili: c.aeromobili ?? [],
    })),
    iscrizioni: d.iscrizioni.filter((i) => (i.ruolo as string) !== 'instructor').map((i) => ({ ...i, escluso_il: i.escluso_il ?? null })),
    anagrafiche: d.anagrafiche.map((a) => ({ ...a, ente: a.ente ?? '' })),
    lezioni: d.lezioni.map((l) => ({ ...l, aula: l.aula ?? '', parte: l.parte ?? 0, persona: l.persona ?? '', frequentatori: l.frequentatori ?? [] })),
    // le abilitazioni erano per programma e materia: ora per mezzo e chapter (quelle vecchie vanno reinserite)
    abilitazioni: d.abilitazioni.filter((a) => a.mds && a.chapter),
  };
}

export const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  admin: 'Training Manager',
  instructor: 'Istruttore',
  trainee: 'Frequentatore',
};

export const ETICHETTA_RUOLO_CORSO: Record<RuoloCorso, string> = {
  direttore: 'Direttore del corso',
  instructor: 'Istruttore',
  trainee: 'Frequentatore',
};
