import {
  IconBook2,
  IconBooks,
  IconCertificate,
  IconCalendarWeek,
  IconChalkboard,
  IconClipboardCheck,
  IconClipboardList,
  IconGauge,
  IconId,
  IconPresentationAnalytics,
  IconUserOff,
  IconLayoutGrid,
  IconReportAnalytics,
  IconSchool,
  IconTable,
  IconUserCircle,
  IconUsersGroup,
  IconUserShield,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { corsiDi, ruoloNelCorso } from '../dominio/motore';
import type { Corso, Dati, Utente } from '../dominio/tipi';
import { usePosizione } from './router';
import { useStato } from './stato';

export interface Voce {
  a: string;
  etichetta: string;
  breve: string;
  icona: Icon;
  /** Pagina riferita a un frequentatore: per lo staff richiede la scelta del frequentatore. */
  frequentatore?: boolean;
  parte?: 'mtt' | 'ptt';
  /** Solo per chi segue il corso (Training Manager, direttore, istruttori). */
  staff?: boolean;
}

const TEORIA: Voce[] = [
  { a: '/settimana', etichetta: 'Programma settimanale', breve: 'Settimana', icona: IconCalendarWeek, parte: 'mtt' },
  { a: '/rapportino', etichetta: 'Rapportino presenze', breve: 'Rapportino', icona: IconClipboardCheck, parte: 'mtt' },
  { a: '/assenze', etichetta: 'Assenze e idoneità', breve: 'Assenze', icona: IconUserOff, parte: 'mtt' },
  { a: '/teoria', etichetta: 'Situazione della teoria', breve: 'Teoria', icona: IconSchool, parte: 'mtt' },
  { a: '/docenti', etichetta: 'Ore degli istruttori', breve: 'Docenti', icona: IconPresentationAnalytics, parte: 'mtt', staff: true },
  { a: '/materie', etichetta: 'Materie e istruttori', breve: 'Materie', icona: IconChalkboard, parte: 'mtt', staff: true },
];

const PRATICA: Voce[] = [
  { a: '/distinta', etichetta: 'Situazione pratica', breve: 'Pratica', icona: IconTable, parte: 'ptt', staff: true },
  { a: '/tavola', etichetta: 'Tavola', breve: 'Tavola', icona: IconLayoutGrid, frequentatore: true, parte: 'ptt' },
  { a: '/logbook', etichetta: 'Logbook', breve: 'Logbook', icona: IconClipboardList, frequentatore: true, parte: 'ptt' },
  { a: '/report', etichetta: 'Compliance Report', breve: 'Report', icona: IconReportAnalytics, frequentatore: true, parte: 'ptt' },
  { a: '/istruttori', etichetta: 'Practical Instructors', breve: 'Istruttori', icona: IconUsersGroup, frequentatore: true, parte: 'ptt' },
  { a: '/dati', etichetta: 'Personal & Training Data', breve: 'Dati', icona: IconId, frequentatore: true, parte: 'ptt' },
];

/** Registri del Training Manager (AER(EP).P-147). */
const REGISTRI: Voce[] = [
  { a: '/registro', etichetta: 'Registro corsi e corsisti', breve: 'Registro', icona: IconBooks },
  { a: '/certificati', etichetta: 'Registro dei certificati', breve: 'Certificati', icona: IconCertificate },
];

export const QUADRO: Voce = { a: '/quadro', etichetta: 'Avanzamento del corso', breve: 'Corso', icona: IconGauge };
export const CORSO: Voce = { a: '/corso', etichetta: 'Corso e iscritti', breve: 'Iscritti', icona: IconTable };
export const CORSI: Voce = { a: '/corsi', etichetta: 'Corsi', breve: 'Corsi', icona: IconSchool };
export const ACCOUNT: Voce = { a: '/account', etichetta: 'Account', breve: 'Account', icona: IconUserShield };
export const GENERALITA: Voce = { a: '/generalita', etichetta: 'Generality and Purpose', breve: 'Generality', icona: IconBook2, parte: 'ptt' };
export const PROFILO: Voce = { a: '/profilo', etichetta: 'Profilo e password', breve: 'Profilo', icona: IconUserCircle };

export interface Menu {
  corso: Voce[];
  teoria: Voce[];
  pratica: Voce[];
  /** Solo Training Manager. */
  registri: Voce[];
  altro: Voce[];
  /** Voci nell'ordine in cui appaiono. */
  ordinate: Voce[];
}

/** Voci di menu per il ruolo nel corso: le parti teorica e pratica compaiono se il corso le prevede. */
export function menuPer(utente: Utente, corso: Corso | undefined, ruolo: string | null): Menu {
  const staff = ruolo === 'admin' || ruolo === 'direttore' || ruolo === 'instructor';
  const mostra = (v: Voce) => (!v.parte || (v.parte === 'mtt' ? corso?.programma_teorico : corso?.programma_pratico)) && (!v.staff || staff);
  const menu = {
    corso: [...(corso ? [QUADRO] : []), ...(utente.ruolo === 'admin' ? [CORSI] : []), ...(corso && staff ? [CORSO] : [])],
    teoria: TEORIA.filter(mostra),
    pratica: PRATICA.filter(mostra),
    registri: utente.ruolo === 'admin' ? REGISTRI : [],
    altro: [...(mostra(GENERALITA) ? [GENERALITA] : []), ...(utente.ruolo === 'admin' ? [ACCOUNT] : []), PROFILO],
  };
  return { ...menu, ordinate: [...menu.corso, ...menu.teoria, ...menu.pratica, ...menu.registri, ...menu.altro] };
}

const CHIAVE_CORSO = 'ptt:corso';
const CHIAVE_FREQ = 'ptt:frequentatore';

const ricorda = (chiave: string, id: string) => {
  try {
    sessionStorage.setItem(chiave, id);
  } catch {
    /* ignorato */
  }
};
const ricordato = (chiave: string) => {
  try {
    return sessionStorage.getItem(chiave);
  } catch {
    return null;
  }
};

export const ricordaCorso = (id: string) => ricorda(CHIAVE_CORSO, id);
export const ricordaFrequentatore = (id: string) => ricorda(CHIAVE_FREQ, id);

/** Corso su cui si sta lavorando: dal parametro `c`, altrimenti l'ultimo scelto o l'unico disponibile. */
export function scegliCorso(dati: Dati, utente: Utente, query: URLSearchParams): Corso | undefined {
  const elenco = corsiDi(dati, utente);
  const id = query.get('c') ?? ricordato(CHIAVE_CORSO);
  return elenco.find((c) => c.id === id) ?? (elenco.length === 1 ? elenco[0] : undefined);
}

export function useCorso(): Corso | undefined {
  const { dati, utente } = useStato();
  const { query } = usePosizione();
  if (!dati || !utente) return undefined;
  return scegliCorso(dati, utente, query);
}

/** Frequentatore a cui si riferiscono le pagine pratiche: sé stesso, oppure quello scelto dallo staff. */
export function scegliFrequentatore(dati: Dati, utente: Utente, corso: Corso | undefined, query: URLSearchParams): Utente | null {
  if (utente.ruolo === 'trainee') return utente;
  const ids = new Set(dati.iscrizioni.filter((i) => i.corso_id === corso?.id && i.ruolo === 'trainee').map((i) => i.user_id));
  const id = query.get('f') ?? ricordato(CHIAVE_FREQ);
  return dati.utenti.find((u) => u.id === id && ids.has(u.id)) ?? null;
}

export function useFrequentatore(): Utente | null {
  const { dati, utente } = useStato();
  const { query } = usePosizione();
  const corso = useCorso();
  if (!dati || !utente) return null;
  return scegliFrequentatore(dati, utente, corso, query);
}

export function useRuoloCorso(): string | null {
  const { dati, utente } = useStato();
  const corso = useCorso();
  if (!dati || !utente) return null;
  return ruoloNelCorso(dati, utente, corso?.id);
}

/** Collegamento a una pagina mantenendo corso e frequentatore. */
export function link(percorso: string, corso: Corso | undefined, f?: string | null, extra = '') {
  const q = [corso ? `c=${corso.id}` : '', f ? `f=${f}` : '', extra].filter(Boolean).join('&');
  return `#${percorso}${q ? `?${q}` : ''}`;
}
