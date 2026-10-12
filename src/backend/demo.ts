import { PASSWORD_DEMO, datiEsempio } from '../dati/esempio';
import { ErroreApp } from '../dominio/errori';
import { applica, errorePassword, oggiISO, type Comando } from '../dominio/motore';
import { aggiornaDati, datiVuoti, type Dati } from '../dominio/tipi';
import { PREFISSO, archivio, type Backend, type Sessione } from './tipi';

const DATI = 'demo:dati';
const PASSWORD = 'demo:password';
const SESSIONE = 'demo:sessione';
const VERSIONE = 'demo:versione';
/** Da aumentare quando la situazione esempio cambia forma: i dati vecchi nel browser vengono rigenerati. */
const FORMATO = '2026-10-13-lezioni-nel-periodo';

/**
 * Archivio dimostrativo: i dati restano nel browser di chi apre l'app (localStorage),
 * partendo dalla situazione esempio. Utile per provare l'app, non per il lavoro condiviso.
 */
export class DemoBackend implements Backend {
  readonly tipo = 'demo' as const;
  readonly nome = 'Dimostrativo (dati nel browser)';
  readonly permessiLatoServer = false;
  private readonly locale = archivio('local');
  private readonly scheda = archivio('session');

  private leggi(): Dati {
    const testo = this.locale.leggi(DATI);
    // dopo un aggiornamento dell'app i dati di prova salvati nel browser possono essere incompleti
    if (testo && this.locale.leggi(VERSIONE) === FORMATO) {
      try {
        return aggiornaDati({ ...datiVuoti(), ...(JSON.parse(testo) as Partial<Dati>) });
      } catch {
        /* dati corrotti: si riparte dall'esempio */
      }
    }
    return this.ripristinaEsempio();
  }

  private passwords(): Record<string, string> {
    try {
      return JSON.parse(this.locale.leggi(PASSWORD) ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }
  }

  /** Dati attuali del browser (anche prima dell'accesso, per i profili rapidi). */
  datiCorrenti(): Dati {
    return this.leggi();
  }

  /** Riporta i dati alla situazione esempio iniziale. */
  ripristinaEsempio(): Dati {
    const dati = datiEsempio();
    this.locale.scrivi(DATI, JSON.stringify(dati));
    this.locale.scrivi(VERSIONE, FORMATO);
    this.locale.scrivi(PASSWORD, JSON.stringify(Object.fromEntries(dati.utenti.map((u) => [u.username, PASSWORD_DEMO]))));
    return dati;
  }

  async avvia() {
    return { tipo: 'pronto' as const };
  }

  async primoAvvio(): Promise<Sessione> {
    throw new ErroreApp('CONFIGURAZIONE', 'La modalità dimostrativa non richiede configurazione.');
  }

  private sessione(id: string | null): Sessione | null {
    const utente = id ? this.leggi().utenti.find((u) => u.id === id) : undefined;
    return utente?.attivo ? { utente } : null;
  }

  async ripristinaSessione() {
    return this.sessione(this.scheda.leggi(SESSIONE) ?? this.locale.leggi(SESSIONE));
  }

  async accedi(username: string, password: string, ricordami: boolean): Promise<Sessione> {
    const u = username.trim().toLowerCase();
    const utente = this.leggi().utenti.find((x) => x.username === u);
    if (!utente || this.passwords()[u] !== password) throw new ErroreApp('AUTENTICAZIONE', 'Username o password non corretti.');
    if (!utente.attivo) throw new ErroreApp('AUTENTICAZIONE', 'Account disattivato: rivolgersi al Training Manager.');
    (ricordami ? this.locale : this.scheda).scrivi(SESSIONE, utente.id);
    return { utente };
  }

  /** Accesso rapido ai profili della situazione esempio. */
  async accediCome(username: string) {
    return this.accedi(username, this.passwords()[username] ?? '', false);
  }

  async esci() {
    this.locale.rimuovi(SESSIONE);
    this.scheda.rimuovi(SESSIONE);
  }

  private utenteCorrente() {
    const id = this.scheda.leggi(SESSIONE) ?? this.locale.leggi(SESSIONE);
    if (!id) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    return id;
  }

  async cambiaPassword(attuale: string, nuova: string) {
    const utente = this.leggi().utenti.find((u) => u.id === this.utenteCorrente())!;
    const pw = this.passwords();
    if (pw[utente.username] !== attuale) throw new ErroreApp('AUTENTICAZIONE', 'La password attuale non è corretta.');
    const problema = errorePassword(nuova);
    if (problema) throw new ErroreApp('VALIDAZIONE', problema);
    this.locale.scrivi(PASSWORD, JSON.stringify({ ...pw, [utente.username]: nuova }));
    await this.esegui({ tipo: 'utente.passwordCambiata' });
  }

  async caricaDati() {
    return this.leggi();
  }

  async esegui(comando: Comando): Promise<Dati> {
    const esito = applica(this.leggi(), comando, { utenteId: this.utenteCorrente(), ora: new Date().toISOString(), oggi: oggiISO() });
    const pw = this.passwords();
    for (const e of esito.effetti) {
      if (e.tipo === 'credenziali.imposta') pw[e.username] = e.password;
      else delete pw[e.username];
    }
    this.locale.scrivi(PASSWORD, JSON.stringify(pw));
    this.locale.scrivi(DATI, JSON.stringify(esito.dati));
    return esito.dati;
  }

  osserva(avvisa: () => void) {
    // un salvataggio in un'altra scheda dello stesso browser aggiorna questa
    const f = (e: StorageEvent) => e.key === PREFISSO + DATI && avvisa();
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }
}
