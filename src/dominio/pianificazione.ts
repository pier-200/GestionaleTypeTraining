import { voceLezione, type Materia, type ProgrammaTeorico } from './programmi';
import type { Lezione } from './tipi';

/**
 * Parte teorica: programma settimanale e conto a scalare.
 * Le lezioni seguono l'ordine del programma; una materia lunga si spezza su più giorni.
 */

/** Durata massima di una lezione: un'ora, poi la pausa. */
export const MINUTI_PERIODO = 60;

/**
 * Orari dei periodi, uguali per tutti i corsi (modulo «Programma settimanale»):
 * dopo ogni ora 10 minuti di pausa, 20 a metà mattina, pranzo dalle 13 alle 14.
 */
export const ORARI_PERIODI = ['08:20', '09:30', '10:50', '12:00', '14:00', '15:10'] as const;

/** Periodi da lunedì a venerdì: 6 fino al giovedì, i primi 3 il venerdì. */
export const PERIODI_GIORNO = [6, 6, 6, 6, 3];

/** Minuti di lezione di una settimana piena. */
export const MINUTI_SETTIMANA = PERIODI_GIORNO.reduce((s, p) => s + p, 0) * MINUTI_PERIODO;

/** Aule proposte negli elenchi: se ne può sempre scrivere un'altra. */
export const AULE = ['Aula N.1', 'Aula N.2', 'Aula N.3', 'Aula N.4'];

/** Quanti periodi prevede il giorno indicato (0 = lunedì). */
export const periodiDelGiorno = (giorno: number) => PERIODI_GIORNO[giorno] ?? 0;

const giorno = (iso: string) => new Date(`${iso}T00:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);

export function sommaGiorni(iso: string, giorni: number): string {
  const d = giorno(iso);
  d.setUTCDate(d.getUTCDate() + giorni);
  return aIso(d);
}

/** Giorno della settimana: 0 = lunedì … 6 = domenica. */
export const indiceGiorno = (data: string) => (giorno(data).getUTCDay() + 6) % 7;

/** Lunedì della settimana che contiene la data. */
export function lunediDi(iso: string): string {
  const d = giorno(iso);
  return sommaGiorni(iso, -((d.getUTCDay() + 6) % 7));
}

export const giorniSettimana = (lunedi: string) => [0, 1, 2, 3, 4].map((i) => sommaGiorni(lunedi, i));

export const NOMI_GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];

export interface RigaMateria {
  materia: Materia;
  pianificati: number;
  residui: number;
  /** Minuti già svolti (lezioni fino a oggi; 0 se non si indica la data). */
  svolti: number;
}

export interface RigaModulo {
  numero: number;
  titolo: string;
  minuti: number;
  pianificati: number;
  residui: number;
  svolti: number;
}

export interface StatoTeorico {
  materie: RigaMateria[];
  moduli: RigaModulo[];
  totale: { minuti: number; pianificati: number; residui: number };
  /** Prima materia non ancora completamente pianificata. */
  prossima: Materia | undefined;
  /** Minuti di lezione già svolti (data passata) e ancora da svolgere. */
  svolti: number;
}

/** Conto a scalare del programma teorico rispetto alle lezioni già messe a calendario. */
export function statoTeorico(programma: ProgrammaTeorico, lezioni: readonly Lezione[], oggi?: string): StatoTeorico {
  // le lezioni di recupero ripetono materie già a programma: non scalano le ore da svolgere
  const utili = lezioni.filter((l) => l.tipo === 'lezione');
  const perMateria = new Map<string, number>();
  const svoltiPerMateria = new Map<string, number>();
  for (const l of utili) {
    perMateria.set(l.materia, (perMateria.get(l.materia) ?? 0) + l.minuti);
    if (oggi && l.data <= oggi) svoltiPerMateria.set(l.materia, (svoltiPerMateria.get(l.materia) ?? 0) + l.minuti);
  }
  const materie = programma.materie.map((materia) => {
    const pianificati = Math.min(perMateria.get(materia.id) ?? 0, materia.minuti);
    return { materia, pianificati, residui: materia.minuti - pianificati, svolti: Math.min(svoltiPerMateria.get(materia.id) ?? 0, materia.minuti) };
  });
  const moduli = programma.moduli.map((m) => {
    const righe = materie.filter((r) => r.materia.modulo === m.numero);
    const pianificati = righe.reduce((s, r) => s + r.pianificati, 0);
    return { numero: m.numero, titolo: m.titolo, minuti: m.minuti, pianificati, residui: m.minuti - pianificati, svolti: righe.reduce((s, r) => s + r.svolti, 0) };
  });
  const minuti = programma.moduli.reduce((s, m) => s + m.minuti, 0);
  const pianificati = materie.reduce((s, r) => s + r.pianificati, 0);
  return {
    materie,
    moduli,
    totale: { minuti, pianificati, residui: minuti - pianificati },
    prossima: materie.find((r) => r.residui > 0)?.materia,
    svolti: oggi ? utili.filter((l) => l.data <= oggi).reduce((s, l) => s + l.minuti, 0) : 0,
  };
}

export interface Proposta {
  data: string;
  ordine: number;
  minuti: number;
  materia: string;
  chapter: string;
  istruttore_id: ID | null;
}

type ID = string;

/** Chapter con cui proseguire una materia: quello dell'ultima lezione a calendario, altrimenti il primo previsto dal syllabus. */
export function chapterInCorso(materia: Materia, lezioni: readonly Pick<Lezione, 'data' | 'ordine' | 'materia' | 'chapter'>[]): string {
  const ultima = lezioni.filter((l) => l.materia === materia.id && l.chapter).sort((a, b) => a.data.localeCompare(b.data) || a.ordine - b.ordine).at(-1);
  return voceLezione(materia, ultima?.chapter ?? '').chapter;
}

export interface OpzioniSettimana {
  /** Giorni da saltare (festività, esami…). */
  salta?: readonly string[];
  /** Istruttore da proporre per ciascuna materia. */
  istruttorePerMateria?: (materia: Materia) => ID | null;
}

/**
 * Proposta di programma per la settimana che inizia il lunedì indicato: riempie i giorni
 * ancora liberi con le materie residue, nell'ordine del programma.
 */
export function generaSettimana(programma: ProgrammaTeorico, lezioni: readonly Lezione[], lunedi: string, opzioni: OpzioniSettimana = {}): Proposta[] {
  const salta = new Set(opzioni.salta ?? []);
  const residui = new Map(statoTeorico(programma, lezioni).materie.map((r) => [r.materia.id, r.residui]));
  const proposte: Proposta[] = [];

  // la giornata è una griglia di periodi: si riempiono solo quelli ancora vuoti
  giorniSettimana(lunedi).forEach((data, i) => {
    if (salta.has(data)) return;
    for (let ordine = 0; ordine < periodiDelGiorno(i); ordine++) {
      if (lezioni.some((l) => l.data === data && l.ordine === ordine)) continue;
      const materia = programma.materie.find((m) => (residui.get(m.id) ?? 0) > 0);
      if (!materia) return;
      const minuti = Math.min(residui.get(materia.id)!, MINUTI_PERIODO);
      proposte.push({ data, ordine, minuti, materia: materia.id, chapter: chapterInCorso(materia, lezioni), istruttore_id: opzioni.istruttorePerMateria?.(materia) ?? null });
      residui.set(materia.id, residui.get(materia.id)! - minuti);
    }
  });
  return proposte;
}

const inMinuti = (orario: string) => Number(orario.slice(0, 2)) * 60 + Number(orario.slice(3));
const inOrario = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Orario di un periodo: l'inizio è fisso, la fine segue la durata della lezione (un'ora al massimo). */
export function orarioPeriodo(ordine: number, durata = MINUTI_PERIODO) {
  const inizio = ORARI_PERIODI[ordine] ?? ORARI_PERIODI[0];
  return { inizio, fine: inOrario(inMinuti(inizio) + durata) };
}

/** Settimana di corso (1 = quella della data di inizio) e settimane di ritardo oltre la data stimata di fine. */
export function settimanaDiCorso(corso: { data_inizio: string | null; data_fine: string | null }, lunedi: string) {
  const settimane = (da: string) => Math.round((giorno(lunedi).getTime() - giorno(lunediDi(da)).getTime()) / (7 * 86_400_000));
  const numero = corso.data_inizio ? settimane(corso.data_inizio) + 1 : null;
  return { numero: numero != null && numero > 0 ? numero : null, ritardo: corso.data_fine ? Math.max(0, settimane(corso.data_fine)) : 0 };
}
