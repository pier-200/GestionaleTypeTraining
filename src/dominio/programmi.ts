/**
 * Programmi di corso, generati dagli Excel ufficiali (scripts/import_catalogo.py e
 * scripts/import_programma_mtt.py). Restano nell'applicazione, non nel database:
 * ogni file in src/dati/programmi viene caricato da solo.
 */

// --- programma pratico (PTR): catalogo dei task del logbook ------------------

export interface Task {
  id: number;
  modulo: number;
  chapter: string;
  subject: string;
  tipo: string;
  descrizione: string;
  riferimenti: string;
}

export interface Chapter {
  codice: string;
  titolo: string;
  modulo: number;
}

export interface ProgrammaPratico {
  id: string;
  tipo: 'pratico';
  nome: string;
  documento: string;
  aeromobile: string;
  motore: string;
  categoria: string;
  taskType: { codice: string; descrizione: string }[];
  moduli: { numero: number; p66: boolean }[];
  chapter: Chapter[];
  task: Task[];
}

// --- programma teorico (MTT): materie da erogare a lezione -------------------

export interface Voce {
  item: number;
  chapter: string;
  subject: string;
  livello: string;
}

export interface Materia {
  id: string;
  modulo: number;
  minuti: number;
  titolo: string;
  voci: Voce[];
  chapters: string[];
}

export interface ProgrammaTeorico {
  id: string;
  tipo: 'teorico';
  nome: string;
  documento: string;
  aeromobile: string;
  categoria: string;
  moduli: { numero: number; titolo: string; minuti: number }[];
  materie: Materia[];
}

const FILE = Object.values(import.meta.glob<ProgrammaPratico | ProgrammaTeorico>('../dati/programmi/*.json', { eager: true, import: 'default' }));
export const PROGRAMMI_PRATICI = FILE.filter((p): p is ProgrammaPratico => p.tipo === 'pratico');
export const PROGRAMMI_TEORICI = FILE.filter((p): p is ProgrammaTeorico => p.tipo === 'teorico');

export const programmaPratico = (id: string | null | undefined) => PROGRAMMI_PRATICI.find((p) => p.id === id);
export const programmaTeorico = (id: string | null | undefined) => PROGRAMMI_TEORICI.find((p) => p.id === id);

// --- MDS e categorie --------------------------------------------------------

export interface Mds {
  codice: string;
  nome: string;
  /** Categorie di licenza previste per quel mezzo. */
  categorie: string[];
}

/** Mezzi (MDS) e categorie per cui si tengono i corsi. */
export const MDS: Mds[] = [
  { codice: 'CH-47F', nome: 'CH-47F', categorie: ['B1.3', 'B2', 'C'] },
  { codice: 'UC-228', nome: 'UC-228', categorie: ['B1.1', 'B2', 'C'] },
  { codice: 'VC-180A', nome: 'VC-180A', categorie: ['B1.1', 'B2', 'C'] },
];

export const mdsDi = (codice: string | null | undefined) => MDS.find((m) => m.codice === codice);

/** Le categorie C prevedono solo la parte teorica; le B anche quella pratica. */
export const soloTeorica = (categoria: string | null | undefined) => (categoria ?? '').trim().toUpperCase().startsWith('C');

/** Programmi disponibili per un mezzo e una categoria (mancano finché non si importa l'Excel). */
export function programmiPer(mds: string | null | undefined, categoria: string | null | undefined) {
  const uguale = (p: { aeromobile: string; categoria: string }) => p.aeromobile === mds && p.categoria === categoria;
  return {
    teorico: PROGRAMMI_TEORICI.find(uguale),
    pratico: soloTeorica(categoria) ? undefined : PROGRAMMI_PRATICI.find(uguale),
  };
}

interface Indice {
  taskPerId: Map<number, Task>;
  chapterPerCodice: Map<string, Chapter>;
  tipiApplicabili: { codice: string; descrizione: string }[];
}

const indici = new Map<string, Indice>();

/** Indici del programma pratico (calcolati una volta sola per programma). */
export function indice(p: ProgrammaPratico): Indice {
  let i = indici.get(p.id);
  if (!i) {
    i = {
      taskPerId: new Map(p.task.map((t) => [t.id, t])),
      chapterPerCodice: new Map(p.chapter.map((c) => [c.codice, c])),
      tipiApplicabili: p.taskType.filter((t) => p.task.some((x) => x.tipo === t.codice)),
    };
    indici.set(p.id, i);
  }
  return i;
}

/** Titolo breve di un modulo: la parte italiana tra parentesi ("HELICOPTERS (Elicottero)" → "Elicottero"). */
export function titoloBreveModulo(titolo: string) {
  const t = /\(([^)]+)\)/.exec(titolo)?.[1] ?? titolo;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export const materiaDi = (p: ProgrammaTeorico, id: string) => p.materie.find((m) => m.id === id);
export const oreDaMinuti = (m: number) => `${Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''} h`;
/** "Ch 63, 63A, 64" per il sottotitolo di una materia. */
export const chapterMateria = (m: Materia) => `Ch ${m.chapters.join(', ')}`;
