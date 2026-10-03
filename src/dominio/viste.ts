import { calcolaReport, reportVuoto, requisitiMancanti, type Report } from './compliance';
import { statoTeorico, type StatoTeorico } from './pianificazione';
import { programmaPratico, programmaTeorico } from './programmi';
import type { Corso, Dati, ID, Istruttore, Lezione, Registrazione, RuoloCorso, Utente } from './tipi';

/** Viste calcolate sui dati, condivise da interfaccia ed esportazioni. */

export const nomeIstruttore = (i: Pick<Istruttore, 'grado' | 'nome' | 'cognome'> | undefined) => (i ? `${i.grado} ${i.nome} ${i.cognome}` : '—');

export function nomeUtente(dati: Dati, id: ID | null | undefined): string {
  if (!id) return '—';
  const a = dati.anagrafiche.find((x) => x.user_id === id);
  if (a) return `${a.grado} ${a.nome} ${a.cognome}`;
  const u = dati.utenti.find((x) => x.id === id);
  return u ? u.nome || u.username : '—';
}

/** Cognome e nome per ordinare gli elenchi. */
export function chiaveOrdine(dati: Dati, u: Utente) {
  const a = dati.anagrafiche.find((x) => x.user_id === u.id);
  return (a ? `${a.cognome} ${a.nome}` : u.nome || u.username).toLowerCase();
}

/** Account iscritti al corso con il ruolo indicato. */
export function iscritti(dati: Dati, corsoId: ID | null | undefined, ruolo: RuoloCorso, ancheDisattivati = false): Utente[] {
  const ids = new Set(dati.iscrizioni.filter((i) => i.corso_id === corsoId && i.ruolo === ruolo).map((i) => i.user_id));
  return dati.utenti.filter((u) => ids.has(u.id) && (ancheDisattivati || u.attivo)).sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));
}

export const frequentatori = (dati: Dati, corsoId: ID | null | undefined, ancheDisattivati = false) => iscritti(dati, corsoId, 'trainee', ancheDisattivati);

/** Chi può erogare lezioni nel corso: istruttori e direttore. */
export const docenti = (dati: Dati, corsoId: ID | null | undefined) => [...iscritti(dati, corsoId, 'instructor'), ...iscritti(dati, corsoId, 'direttore')];

export const registrazioniDi = (dati: Dati, corsoId: ID | null | undefined, userId: ID) =>
  dati.registrazioni.filter((r) => r.user_id === userId && r.corso_id === corsoId).sort((a, b) => b.data.localeCompare(a.data) || b.modificato_il.localeCompare(a.modificato_il));

export const lezioniDi = (dati: Dati, corsoId: ID | null | undefined) =>
  dati.lezioni.filter((l) => l.corso_id === corsoId).sort((a, b) => a.data.localeCompare(b.data) || a.ordine - b.ordine);

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
  const elenco = docenti(dati, corsoId);
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
}

export function situazione(dati: Dati, corso: Corso | undefined, utente: Utente): Situazione {
  const registrazioni = registrazioniDi(dati, corso?.id, utente.id);
  const programma = programmaPratico(corso?.programma_pratico);
  const report = programma ? calcolaReport(registrazioni, programma) : reportVuoto();
  const ultima = [...registrazioni].sort((a, b) => b.modificato_il.localeCompare(a.modificato_il))[0];
  return { utente, nome: nomeUtente(dati, utente.id), report, mancanti: requisitiMancanti(report), registrazioni, ultima };
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

export const lezioniGiorno = (lezioni: readonly Lezione[], data: string) => lezioni.filter((l) => l.data === data).sort((a, b) => a.ordine - b.ordine);
