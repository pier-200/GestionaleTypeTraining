import type { Comando } from '../dominio/motore';
import type { Dati, Utente } from '../dominio/tipi';

export interface Sessione {
  utente: Utente;
}

export type StatoAvvio = { tipo: 'pronto' } | { tipo: 'primo_avvio'; messaggio: string };

export interface DatiPrimoAvvio {
  username: string;
  nome: string;
  password: string;
  /** Solo archivio GitHub: token di accesso ai repository. */
  token?: string;
}

/** Interfaccia comune agli archivi: l'interfaccia utente non conosce i dettagli di persistenza. */
export interface Backend {
  readonly tipo: 'demo' | 'github';
  readonly nome: string;

  avvia(): Promise<StatoAvvio>;
  primoAvvio(d: DatiPrimoAvvio): Promise<Sessione>;
  ripristinaSessione(): Promise<Sessione | null>;
  accedi(username: string, password: string, ricordami: boolean): Promise<Sessione>;
  esci(): Promise<void>;
  cambiaPassword(attuale: string, nuova: string): Promise<void>;
  /** Dati visibili all'utente; completo = rilegge tutto (pulsante Aggiorna). */
  caricaDati(completo?: boolean): Promise<Dati>;
  /** Esegue il comando e restituisce i dati aggiornati. */
  esegui(comando: Comando): Promise<Dati>;
  /** Richiama `avvisa` quando altri utenti modificano i dati; restituisce la funzione per smettere. */
  osserva(avvisa: () => void): () => void;
  /** File della cartella `modelli` (moduli ufficiali, programmi, abilitazioni), con il percorso relativo. */
  elencoModelli(): Promise<string[]>;
  /** Contenuto di un file della cartella `modelli`; null se non c'è. */
  leggiModello(nome: string): Promise<Uint8Array | null>;
}

/** Chiavi di archiviazione nel browser: tutte con prefisso, perché le pagine github.io dello stesso account condividono l'origine. */
export const PREFISSO = 'ptt:';

export function archivio(tipo: 'local' | 'session') {
  const riserva = new Map<string, string>();
  const s = () => {
    try {
      return tipo === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    leggi(k: string): string | null {
      try {
        return s()?.getItem(PREFISSO + k) ?? riserva.get(k) ?? null;
      } catch {
        return riserva.get(k) ?? null;
      }
    },
    scrivi(k: string, v: string) {
      try {
        const st = s();
        if (st) st.setItem(PREFISSO + k, v);
        else riserva.set(k, v);
      } catch {
        riserva.set(k, v);
      }
    },
    rimuovi(k: string) {
      try {
        s()?.removeItem(PREFISSO + k);
      } catch {
        /* ignorato */
      }
      riserva.delete(k);
    },
  };
}
