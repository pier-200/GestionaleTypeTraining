import { notifications } from '@mantine/notifications';
import { create } from 'zustand';
import { DemoBackend } from '../backend/demo';
import type { Backend, Sessione } from '../backend/tipi';
import { caricaConfig } from '../config';
import { conferme } from '../dominio/conferme';
import { messaggioErrore } from '../dominio/errori';
import type { Comando } from '../dominio/motore';
import type { Dati, Utente } from '../dominio/tipi';

type Fase = 'avvio' | 'errore' | 'primo_avvio' | 'accesso' | 'pronto';

interface Stato {
  fase: Fase;
  messaggio: string;
  backend: Backend | null;
  utente: Utente | null;
  dati: Dati | null;
  aggiornatoAlle: Date | null;
  /** Task appena registrati: la loro riga riceve il tratto di evidenziatore. */
  appena: number[];
  /** Domanda in attesa di risposta prima di salvare (corso completato, frequentatore escluso). */
  conferma: { messaggio: string; rispondi(si: boolean): void } | null;
  avvia(): Promise<void>;
  entra(s: Sessione): Promise<void>;
  esci(): Promise<void>;
  ricarica(silenzioso?: boolean): Promise<void>;
  esegui(c: Comando, messaggioOk?: string): Promise<boolean>;
  segnaAppena(taskId: number): void;
}

let smettiDiOsservare: (() => void) | null = null;
let avvio: Promise<void> | null = null;

async function creaBackend(): Promise<Backend> {
  // ?demo nell'indirizzo apre sempre la modalità dimostrativa, qualunque sia l'archivio configurato
  if (new URLSearchParams(window.location.search).has('demo')) return new DemoBackend();
  const config = await caricaConfig();
  if (config.tipo === 'github') return new (await import('../backend/github/GitHubBackend')).GitHubBackend(config);
  if (config.tipo === 'supabase') return new (await import('../backend/supabase')).SupabaseBackend(config);
  return new DemoBackend();
}

export const useStato = create<Stato>((set, get) => ({
  fase: 'avvio',
  messaggio: '',
  backend: null,
  utente: null,
  dati: null,
  aggiornatoAlle: null,
  appena: [],
  conferma: null,

  avvia() {
    // una sola volta, anche se React monta due volte in sviluppo
    avvio ??= (async () => {
      try {
        const backend = await creaBackend();
        set({ backend });
        const stato = await backend.avvia();
        if (stato.tipo === 'primo_avvio') return set({ fase: 'primo_avvio', messaggio: stato.messaggio });
        const sessione = await backend.ripristinaSessione();
        if (sessione) await get().entra(sessione);
        else set({ fase: 'accesso' });
      } catch (e) {
        set({ fase: 'errore', messaggio: messaggioErrore(e) });
      }
    })();
    return avvio;
  },

  async entra(s) {
    const backend = get().backend!;
    const dati = await backend.caricaDati();
    set({ utente: s.utente, dati, fase: 'pronto', aggiornatoAlle: new Date() });
    window.scrollTo(0, 0);
    smettiDiOsservare?.();
    smettiDiOsservare = backend.osserva(() => void get().ricarica(true));
  },

  async esci() {
    smettiDiOsservare?.();
    smettiDiOsservare = null;
    await get().backend?.esci();
    set({ utente: null, dati: null, fase: 'accesso' });
    window.location.hash = '#/';
  },

  async ricarica(silenzioso = false) {
    const { backend, utente } = get();
    if (!backend || !utente) return;
    try {
      const dati = await backend.caricaDati(!silenzioso);
      const aggiornato = dati.utenti.find((u) => u.id === utente.id);
      if (!aggiornato?.attivo) return void get().esci();
      set({ dati, utente: aggiornato, aggiornatoAlle: new Date() });
    } catch (e) {
      if (!silenzioso) notifications.show({ color: 'rosso', title: 'Aggiornamento non riuscito', message: messaggioErrore(e) });
    }
  },

  async esegui(c, messaggioOk) {
    const { backend, utente, dati: attuali } = get();
    if (!backend || !utente) return false;
    // corso completato o frequentatore fuori dal corso: la modifica si salva solo dopo una conferma esplicita
    for (const messaggio of attuali ? conferme(attuali, c) : []) {
      const si = await new Promise<boolean>((rispondi) => set({ conferma: { messaggio, rispondi } }));
      set({ conferma: null });
      if (!si) return false;
    }
    try {
      const dati = await backend.esegui(c);
      set({ dati, utente: dati.utenti.find((u) => u.id === utente.id) ?? utente, aggiornatoAlle: new Date() });
      if (messaggioOk) notifications.show({ color: 'inchiostro', message: messaggioOk });
      return true;
    } catch (e) {
      notifications.show({ color: 'rosso', title: 'Operazione non riuscita', message: messaggioErrore(e), autoClose: 8000 });
      return false;
    }
  },

  segnaAppena(taskId) {
    set({ appena: [...get().appena, taskId] });
    setTimeout(() => set({ appena: get().appena.filter((x) => x !== taskId) }), 1200);
  },
}));
