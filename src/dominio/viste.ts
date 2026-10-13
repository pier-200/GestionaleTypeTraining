import { calcolaReport, reportVuoto, requisitiMancanti, type Report } from './compliance';
import { inOrdine, orariLezioni, statoTeorico, type Orario, type StatoTeorico } from './pianificazione';
import { materiaDi, programmaPratico, programmaTeorico, type ProgrammaTeorico } from './programmi';
import { ETICHETTA_PERIODO, conMateria, type Corso, type Dati, type ID, type Istruttore, type Lezione, type Registrazione, type Utente } from './tipi';

/** Viste calcolate sui dati, condivise da interfaccia ed esportazioni. */

export const nomeIstruttore = (i: Pick<Istruttore, 'grado' | 'nome' | 'cognome'> | undefined) => (i ? `${i.grado} ${i.nome} ${i.cognome}` : '—');

/** Grado, nome e cognome: dai Personal Data del frequentatore, altrimenti dall'account. */
const nominativo = (dati: Dati, id: ID | null | undefined) => dati.anagrafiche.find((x) => x.user_id === id) ?? dati.utenti.find((x) => x.id === id);
const unisci = (...parti: string[]) => parti.filter(Boolean).join(' ');

export function nomeUtente(dati: Dati, id: ID | null | undefined): string {
  const p = nominativo(dati, id);
  if (!p) return '—';
  return unisci(p.grado, p.nome, p.cognome) || dati.utenti.find((x) => x.id === id)?.username || '—';
}

/** «Grado COGNOME Nome», come sui moduli ufficiali (gli account non ancora divisi in tre campi restano come sono). */
export function nomeModulo(dati: Dati, id: ID | null | undefined): string {
  const p = nominativo(dati, id);
  return p ? unisci(p.grado, p.cognome.toUpperCase(), p.nome) : '';
}

/** «Grado Cognome»: l'istruttore nella griglia e nel modulo del programma settimanale. */
export function gradoCognome(dati: Dati, id: ID | null | undefined): string {
  const p = nominativo(dati, id);
  return p ? (p.cognome ? unisci(p.grado, p.cognome) : p.nome) : '';
}

/** Cognome e nome per ordinare gli elenchi. */
export function chiaveOrdine(dati: Dati, u: Utente) {
  const p = nominativo(dati, u.id) ?? u;
  return (unisci(p.cognome, p.nome) || u.username).toLowerCase();
}

const inOrdineAlfabetico = (dati: Dati, utenti: Utente[]) => utenti.sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));

/** Giorno da cui il frequentatore è fuori dal corso (null = ne fa parte). */
export const esclusoDal = (dati: Dati, corsoId: ID | null | undefined, userId: ID): string | null =>
  dati.iscrizioni.find((i) => i.corso_id === corsoId && i.user_id === userId && i.ruolo === 'trainee')?.escluso_il ?? null;

export interface QualiFrequentatori {
  /** Anche gli account disattivati. */
  disattivati?: boolean;
  /** Anche chi è stato escluso dal corso (dati storici). */
  esclusi?: boolean;
  /** Chi faceva parte del corso in quel giorno: gli esclusi contano fino al giorno prima dell'esclusione. */
  al?: string;
}

/** Frequentatori assegnati al corso: senza altre indicazioni, solo quelli che ne fanno ancora parte. */
export function frequentatori(dati: Dati, corsoId: ID | null | undefined, quali: QualiFrequentatori = {}): Utente[] {
  const ids = new Set(
    dati.iscrizioni
      .filter((i) => i.corso_id === corsoId && i.ruolo === 'trainee' && (quali.esclusi || !i.escluso_il || (quali.al != null && quali.al < i.escluso_il)))
      .map((i) => i.user_id),
  );
  return inOrdineAlfabetico(dati, dati.utenti.filter((u) => ids.has(u.id) && (quali.disattivati || u.attivo)));
}

/** Istruttori con un account attivo. */
export const istruttoriAttivi = (dati: Dati): Utente[] => inOrdineAlfabetico(dati, dati.utenti.filter((u) => u.ruolo === 'instructor' && u.attivo));

/** Un istruttore tiene la lezione di un chapter solo se è abilitato a quel chapter per quel mezzo. */
export const abilitato = (dati: Dati, userId: ID, mds: string, chapter: string) => dati.abilitazioni.some((a) => a.user_id === userId && a.mds === mds && a.chapter === chapter);
export const abilitatiPer = (dati: Dati, mds: string, chapter: string): Utente[] => istruttoriAttivi(dati).filter((u) => abilitato(dati, u.id, mds, chapter));

/** L'istruttore a cui il Training Manager ha affidato il corso (se il direttore è uno degli istruttori). */
export const direttoreDi = (dati: Dati, corsoId: ID | null | undefined): Utente | undefined =>
  dati.utenti.find((u) => dati.iscrizioni.some((i) => i.corso_id === corsoId && i.ruolo === 'direttore' && i.user_id === u.id));

/** Direttore del corso: l'istruttore incaricato oppure la persona scritta a mano; `modulo` = «Grado COGNOME Nome». */
export function nomeDirettore(dati: Dati, corso: Corso, modulo = false): string {
  const d = direttoreDi(dati, corso.id);
  return d ? (modulo ? nomeModulo(dati, d.id) : nomeUtente(dati, d.id)) : corso.direttore_nome;
}

/** Istruttori nominati per la fase pratica del corso. */
export const istruttoriPratica = (dati: Dati, corso: Corso): Utente[] => inOrdineAlfabetico(dati, dati.utenti.filter((u) => corso.istruttori_pratica.includes(u.id)));

/** Istruttori che seguono il corso: il direttore, quelli della fase pratica e chi vi ha lezioni a calendario. */
export function staffDi(dati: Dati, corso: Corso): Utente[] {
  const ids = new Set([...corso.istruttori_pratica, direttoreDi(dati, corso.id)?.id, ...dati.lezioni.filter((l) => l.corso_id === corso.id).map((l) => l.istruttore_id)]);
  return inOrdineAlfabetico(dati, dati.utenti.filter((u) => u.ruolo === 'instructor' && ids.has(u.id)));
}

/** Fine del corso: la data effettiva di chiusura quando è completato, fino ad allora quella stimata. */
export const fineCorso = (c: Pick<Corso, 'data_fine' | 'data_chiusura' | 'attivo'>) => (c.attivo ? c.data_fine : (c.data_chiusura ?? c.data_fine));
export const formatoFine = (c: Pick<Corso, 'data_fine' | 'data_chiusura' | 'attivo'>) => `${formatoData(fineCorso(c))}${c.attivo && c.data_fine ? ' (stimata)' : ''}`;

export const registrazioniDi = (dati: Dati, corsoId: ID | null | undefined, userId: ID) =>
  dati.registrazioni.filter((r) => r.user_id === userId && r.corso_id === corsoId).sort((a, b) => b.data.localeCompare(a.data) || b.modificato_il.localeCompare(a.modificato_il));

export const lezioniDi = (dati: Dati, corsoId: ID | null | undefined) => inOrdine(dati.lezioni.filter((l) => l.corso_id === corsoId));

/** Cosa si svolge in un periodo: il chapter della lezione con il suo titolo, oppure il nome dell'attività. */
export function contenutoLezione(programma: ProgrammaTeorico | undefined, l: Pick<Lezione, 'tipo' | 'materia'>) {
  const materia = programma && conMateria(l.tipo) ? materiaDi(programma, l.materia) : undefined;
  return { materia, chapter: materia?.chapter ?? null, titolo: materia?.titolo ?? ETICHETTA_PERIODO[l.tipo] };
}

/** Chi è indicato accanto al periodo: «Grado Cognome» dell'istruttore, oppure la persona senza account. */
export const riferimentoLezione = (dati: Dati, l: Pick<Lezione, 'istruttore_id' | 'persona'>) => gradoCognome(dati, l.istruttore_id) || l.persona;

export interface Impegno {
  lezione: Lezione;
  corso: Corso;
  orario: Orario;
}

/** Lezioni dell'istruttore da oggi in poi, in tutti i suoi corsi: solo quelle dei programmi settimanali già validati. */
export function impegniDi(dati: Dati, utenteId: ID, oggi: string): Impegno[] {
  return dati.corsi
    .filter((c) => c.attivo)
    .flatMap((corso) => {
      const lezioni = lezioniDi(dati, corso.id);
      const orari = orariLezioni(lezioni);
      return lezioni.filter((l) => l.istruttore_id === utenteId && l.validata && l.data >= oggi).map((lezione) => ({ lezione, corso, orario: orari.get(lezione.id)! }));
    })
    .sort((a, b) => a.lezione.data.localeCompare(b.lezione.data) || a.orario.inizio.localeCompare(b.orario.inizio));
}

/** Programma visibile: il frequentatore vede solo le settimane già validate. */
export const lezioniVisibili = (dati: Dati, corsoId: ID | null | undefined, ruolo: string | null) =>
  ruolo === 'trainee' ? lezioniDi(dati, corsoId).filter((l) => l.validata) : lezioniDi(dati, corsoId);

export const rapportiniDi = (dati: Dati, corsoId: ID | null | undefined) => dati.rapportini.filter((r) => r.corso_id === corsoId).sort((a, b) => a.data.localeCompare(b.data));

export const presenzeDi = (dati: Dati, corsoId: ID | null | undefined) => dati.presenze.filter((p) => p.corso_id === corsoId);

export interface RigaDocente {
  utente: Utente;
  minuti: number;
  /** Minuti già erogati (lezioni fino a oggi). */
  svolti: number;
  lezioni: number;
  materie: number;
  prima: string;
  ultima: string;
}

/** Ore di lezione teorica erogate da ciascun istruttore del corso. */
export function oreDocenti(dati: Dati, corsoId: ID | null | undefined, lezioni: readonly Lezione[], oggi: string): RigaDocente[] {
  const perId = new Map<ID, Lezione[]>();
  for (const l of lezioni) if (l.istruttore_id) perId.set(l.istruttore_id, [...(perId.get(l.istruttore_id) ?? []), l]);
  const corso = dati.corsi.find((c) => c.id === corsoId);
  const elenco = corso ? staffDi(dati, corso) : [];
  const conosciuti = elenco.filter((u) => perId.has(u.id));
  const altri = [...perId.keys()].filter((id) => !elenco.some((u) => u.id === id)).flatMap((id) => dati.utenti.filter((u) => u.id === id));
  return [...conosciuti, ...altri, ...elenco.filter((u) => !perId.has(u.id))]
    .map((utente) => {
      const sue = perId.get(utente.id) ?? [];
      const date = sue.map((l) => l.data).sort();
      return {
        utente,
        minuti: sue.reduce((s, l) => s + l.minuti, 0),
        svolti: sue.filter((l) => l.data <= oggi).reduce((s, l) => s + l.minuti, 0),
        lezioni: sue.length,
        materie: new Set(sue.map((l) => l.materia)).size,
        prima: date[0] ?? '',
        ultima: date.at(-1) ?? '',
      };
    })
    .sort((a, b) => b.minuti - a.minuti || chiaveOrdine(dati, a.utente).localeCompare(chiaveOrdine(dati, b.utente)));
}

export interface RigaIstruttore {
  istruttore: Istruttore;
  task: number;
  registrazioni: number;
  minuti: number;
  prima: string;
  ultima: string;
}

/** Practical Instructors: vista calcolata dalle registrazioni (non compilata a mano). */
export function istruttoriDi(dati: Dati, registrazioni: readonly Registrazione[]): RigaIstruttore[] {
  const perId = new Map<ID, Registrazione[]>();
  for (const r of registrazioni) perId.set(r.instructor_id, [...(perId.get(r.instructor_id) ?? []), r]);
  return [...perId]
    .flatMap(([id, regs]) => {
      const istruttore = dati.istruttori.find((i) => i.id === id);
      if (!istruttore) return [];
      const date = regs.map((r) => r.data).sort();
      return [{ istruttore, task: new Set(regs.map((r) => r.task_id)).size, registrazioni: regs.length, minuti: regs.reduce((s, r) => s + r.et_minuti, 0), prima: date[0], ultima: date.at(-1)! }];
    })
    .sort((a, b) => b.task - a.task || a.istruttore.cognome.localeCompare(b.istruttore.cognome));
}

export interface Situazione {
  utente: Utente;
  nome: string;
  report: Report;
  mancanti: ReturnType<typeof requisitiMancanti>;
  registrazioni: Registrazione[];
  ultima: Registrazione | undefined;
  /** Giorno dell'esclusione dal corso: la situazione è quella di allora. */
  escluso: string | null;
}

export function situazione(dati: Dati, corso: Corso | undefined, utente: Utente): Situazione {
  const escluso = esclusoDal(dati, corso?.id, utente.id);
  // chi è stato escluso resta con la situazione del giorno in cui è uscito dal corso
  const registrazioni = registrazioniDi(dati, corso?.id, utente.id).filter((r) => !escluso || r.data < escluso);
  const programma = programmaPratico(corso?.programma_pratico);
  const report = programma ? calcolaReport(registrazioni, programma) : reportVuoto();
  const ultima = [...registrazioni].sort((a, b) => b.modificato_il.localeCompare(a.modificato_il))[0];
  return { utente, nome: nomeUtente(dati, utente.id), report, mancanti: requisitiMancanti(report), registrazioni, ultima, escluso };
}

export interface Avanzamento {
  /** Parte teorica: programma, lezioni a calendario e già svolte (assente se il corso non la prevede). */
  teoria?: StatoTeorico;
  /** Parte pratica: situazione di ciascun frequentatore (per il frequentatore solo la propria). */
  pratica?: Situazione[];
}

/** Riscontro di completamento delle due parti del corso, come le vede chi è collegato. */
export function avanzamento(dati: Dati, corso: Corso, utente: Utente, ruolo: string | null, oggi: string): Avanzamento {
  const teorico = programmaTeorico(corso.programma_teorico);
  const allievi = ruolo === 'trainee' ? [utente] : frequentatori(dati, corso.id);
  return {
    teoria: teorico ? statoTeorico(teorico, lezioniVisibili(dati, corso.id, ruolo), oggi) : undefined,
    pratica: programmaPratico(corso.programma_pratico) ? allievi.map((u) => situazione(dati, corso, u)) : undefined,
  };
}

/** Percentuale media di task eseguiti (0 senza frequentatori). */
export const mediaPratica = (s: readonly Situazione[]) => (s.length ? s.reduce((t, x) => t + x.report.totale.percentuale, 0) / s.length : 0);

export const formatoData = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT') : '—');
export const formatoDataBreve = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
export const formatoIstante = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const esecuzione = (r: Pick<Registrazione, 'tipo_esecuzione' | 'matricola'>) => (r.tipo_esecuzione === 'AC' ? r.matricola : r.tipo_esecuzione);

export const formatoMinuti = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}′`.replace(' 00′', '') : `${m}′`);

/** Ore residue/svolte in formato compatto ("12 h", "1,5 h"). */
export const ore = (minuti: number) => `${(minuti / 60).toLocaleString('it-IT', { maximumFractionDigits: 1 })} h`;

