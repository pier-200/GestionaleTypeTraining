import { type Materia, type ProgrammaTeorico } from './programmi';
import type { Corso, Lezione } from './tipi';

/**
 * Parte teorica: programma settimanale e conto a scalare.
 * Le lezioni seguono l'ordine del programma; una materia lunga si spezza su più giorni.
 */

/** Minuti di lezione da lunedì a venerdì: 6 ore fino al giovedì, 3 il venerdì. */
export const MINUTI_GIORNO = [360, 360, 360, 360, 180];

/** Durata di un periodo: la giornata ha 6 periodi dal lunedì al giovedì e 3 il venerdì. */
export const MINUTI_PERIODO = 60;

/** Quanti periodi prevede il giorno indicato (0 = lunedì). */
export const periodiDelGiorno = (minutiGiorno: readonly number[], giorno: number) => Math.round((minutiGiorno[giorno] ?? 0) / MINUTI_PERIODO);

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
  istruttore_id: ID | null;
}

type ID = string;

export interface OpzioniSettimana {
  minutiGiorno?: number[];
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
  const capienza = opzioni.minutiGiorno ?? MINUTI_GIORNO;
  const salta = new Set(opzioni.salta ?? []);
  const residui = new Map(statoTeorico(programma, lezioni).materie.map((r) => [r.materia.id, r.residui]));
  const proposte: Proposta[] = [];

  // la giornata è una griglia di periodi: si riempiono solo quelli ancora vuoti
  giorniSettimana(lunedi).forEach((data, i) => {
    if (salta.has(data)) return;
    for (let ordine = 0; ordine < periodiDelGiorno(capienza, i); ordine++) {
      if (lezioni.some((l) => l.data === data && l.ordine === ordine)) continue;
      const materia = programma.materie.find((m) => (residui.get(m.id) ?? 0) > 0);
      if (!materia) return;
      const minuti = Math.min(residui.get(materia.id)!, MINUTI_PERIODO);
      proposte.push({ data, ordine, minuti, materia: materia.id, istruttore_id: opzioni.istruttorePerMateria?.(materia) ?? null });
      residui.set(materia.id, residui.get(materia.id)! - minuti);
    }
  });
  return proposte;
}

/**
 * Orario di un periodo, dall'ora di inizio del corso e dalla durata dei periodi che lo precedono.
 * I periodi ancora vuoti valgono un'ora: la griglia della giornata resta allineata.
 */
export function orarioLezione(corso: Pick<Corso, 'ora_inizio'>, delGiorno: readonly { ordine: number; minuti: number }[], ordine: number) {
  const [h, m] = (corso.ora_inizio || '08:30').split(':').map(Number);
  let prima = 0;
  for (let i = 0; i < ordine; i++) prima += delGiorno.find((l) => l.ordine === i)?.minuti ?? MINUTI_PERIODO;
  const inizio = h * 60 + m + prima;
  const corrente = delGiorno.find((l) => l.ordine === ordine);
  const fine = inizio + (corrente?.minuti ?? MINUTI_PERIODO);
  const fmt = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return { inizio: fmt(inizio), fine: fmt(fine) };
}
