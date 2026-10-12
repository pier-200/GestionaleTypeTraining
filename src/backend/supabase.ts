import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../config';
import { ErroreApp } from '../dominio/errori';
import { RE_USERNAME, applica, errorePassword, oggiISO, type Comando } from '../dominio/motore';
import { datiVuoti, type Dati, type Registrazione, type Utente } from '../dominio/tipi';
import { archivio, type Backend, type DatiPrimoAvvio, type Sessione } from './tipi';

type ConfigSupabase = Extract<Config, { tipo: 'supabase' }>;

const RICORDAMI = 'supabase:ricordami';
const TABELLE = ['profili', 'corsi', 'iscrizioni', 'anagrafiche', 'training_data', 'istruttori', 'registrazioni', 'lezioni', 'abilitazioni', 'rapportini', 'presenze', 'certificati'] as const;

function traduci(e: { message?: string; code?: string } | null | undefined): ErroreApp {
  const m = e?.message ?? 'errore sconosciuto';
  if (/row-level security|permission denied/i.test(m)) return new ErroreApp('PERMESSO_NEGATO', 'Non hai i permessi per questa operazione.');
  if (e?.code === '23505') return new ErroreApp('DUPLICATO', 'Elemento già presente.');
  if (e?.code === 'P0001') return new ErroreApp('VINCOLO', m);
  if (e?.code === '23514') return new ErroreApp('VALIDAZIONE', 'Dati non validi.');
  if (/JWT|session/i.test(m)) return new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
  if (/fetch|network|load failed/i.test(m)) return new ErroreApp('RETE', 'Impossibile contattare Supabase: verificare la connessione o eventuali blocchi della rete.');
  return new ErroreApp('INTERNO', m);
}

function verifica<T>(r: { data: T; error: { message?: string; code?: string } | null }): T {
  if (r.error) throw traduci(r.error);
  return r.data;
}

/**
 * Archivio Supabase (PostgreSQL + Auth + Realtime): i permessi sono applicati dal
 * database (database/schema.sql). Il motore locale anticipa solo i messaggi di errore.
 */
export class SupabaseBackend implements Backend {
  readonly tipo = 'supabase' as const;
  readonly nome: string;
  readonly permessiLatoServer = true;
  private readonly sb: SupabaseClient;
  private readonly locale = archivio('local');
  private utente: Utente | null = null;
  private dati: Dati | null = null;
  private sporche = new Set<string>();

  constructor(private readonly c: ConfigSupabase) {
    this.nome = `Supabase (${new URL(c.url).host})`;
    const locale = this.locale;
    // "resta connesso": la sessione va in localStorage, altrimenti solo nella scheda
    const deposito = () => (locale.leggi(RICORDAMI) === '1' ? window.localStorage : window.sessionStorage);
    this.sb = createClient(c.url, c.chiavePubblica, {
      auth: {
        storageKey: 'ptt:supabase:auth',
        storage: {
          getItem: (k) => window.sessionStorage.getItem(k) ?? window.localStorage.getItem(k),
          setItem: (k, v) => deposito().setItem(k, v),
          removeItem: (k) => {
            window.sessionStorage.removeItem(k);
            window.localStorage.removeItem(k);
          },
        },
      },
    });
  }

  private email = (username: string) => `${username.trim().toLowerCase()}@${this.c.dominioEmail}`;

  async avvia() {
    const stato = verifica(await this.sb.rpc('ptt_stato')) as { admin: boolean };
    return stato.admin
      ? { tipo: 'pronto' as const }
      : { tipo: 'primo_avvio' as const, messaggio: 'Nessun Training Manager configurato: accedere con l’utente creato nel pannello Supabase per diventarlo.' };
  }

  private async entra(username: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: this.email(username), password });
    if (error) {
      if (/invalid|credentials/i.test(error.message)) throw new ErroreApp('AUTENTICAZIONE', 'Username o password non corretti.');
      if (/banned/i.test(error.message)) throw new ErroreApp('AUTENTICAZIONE', 'Account disattivato: rivolgersi al Training Manager.');
      throw traduci(error);
    }
  }

  private async profilo(): Promise<Utente | null> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) return null;
    const p = verifica(await this.sb.from('profili').select('*').eq('id', data.user.id).maybeSingle()) as Utente | null;
    this.utente = p;
    return p;
  }

  async primoAvvio(d: DatiPrimoAvvio): Promise<Sessione> {
    if (!RE_USERNAME.test(d.username.trim().toLowerCase())) throw new ErroreApp('VALIDAZIONE', 'Username non valido');
    if (!d.nome.trim()) throw new ErroreApp('VALIDAZIONE', 'Indicare grado, nome e cognome');
    this.locale.scrivi(RICORDAMI, '0');
    await this.entra(d.username, d.password);
    verifica(await this.sb.rpc('ptt_primo_admin', { p_username: d.username, p_nome: d.nome }));
    return { utente: (await this.profilo())! };
  }

  async ripristinaSessione(): Promise<Sessione | null> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    const utente = await this.profilo();
    if (utente?.attivo) return { utente };
    await this.esci();
    return null;
  }

  async accedi(username: string, password: string, ricordami: boolean): Promise<Sessione> {
    this.locale.scrivi(RICORDAMI, ricordami ? '1' : '0');
    await this.entra(username, password);
    const utente = await this.profilo();
    if (!utente?.attivo) {
      await this.esci();
      throw new ErroreApp('AUTENTICAZIONE', utente ? 'Account disattivato: rivolgersi al Training Manager.' : 'Account non abilitato: rivolgersi al Training Manager.');
    }
    return { utente };
  }

  async esci() {
    await this.sb.auth.signOut();
    this.utente = null;
    this.dati = null;
  }

  async cambiaPassword(attuale: string, nuova: string) {
    if (!this.utente) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    const problema = errorePassword(nuova);
    if (problema) throw new ErroreApp('VALIDAZIONE', problema);
    try {
      await this.entra(this.utente.username, attuale);
    } catch {
      throw new ErroreApp('AUTENTICAZIONE', 'La password attuale non è corretta.');
    }
    const { error } = await this.sb.auth.updateUser({ password: nuova });
    if (error) throw traduci(error);
    verifica(await this.sb.rpc('ptt_password_cambiata'));
  }

  /** Legge tutte le righe visibili (le policy filtrano per ruolo), a blocchi di 1000. */
  private async tutte<T>(tabella: string, ordine: string): Promise<T[]> {
    const righe: T[] = [];
    for (let da = 0; ; da += 1000) {
      const blocco = verifica(await this.sb.from(tabella).select('*').order(ordine).range(da, da + 999)) as T[];
      righe.push(...blocco);
      if (blocco.length < 1000) return righe;
    }
  }

  async caricaDati(completo = false): Promise<Dati> {
    // traffico contenuto (piano gratuito): tutto solo al primo caricamento o col pulsante Aggiorna,
    // poi solo le tabelle segnalate; le registrazioni arrivano già complete dagli eventi in tempo reale
    const tabelle = !this.dati || completo ? [...TABELLE] : [...this.sporche];
    this.sporche.clear();
    const nuovi: Dati = { ...(this.dati ?? datiVuoti()) };
    await Promise.all(
      tabelle.map(async (t) => {
        if (t === 'profili') nuovi.utenti = await this.tutte('profili', 'created_at');
        if (t === 'corsi') nuovi.corsi = await this.tutte('corsi', 'codice');
        if (t === 'iscrizioni') nuovi.iscrizioni = await this.tutte('iscrizioni', 'corso_id');
        if (t === 'anagrafiche') nuovi.anagrafiche = await this.tutte('anagrafiche', 'user_id');
        if (t === 'training_data') nuovi.training = await this.tutte('training_data', 'user_id');
        if (t === 'istruttori') nuovi.istruttori = await this.tutte('istruttori', 'cognome');
        if (t === 'registrazioni') nuovi.registrazioni = await this.tutte('registrazioni', 'data');
        if (t === 'lezioni') nuovi.lezioni = await this.tutte('lezioni', 'data');
        if (t === 'abilitazioni') nuovi.abilitazioni = await this.tutte('abilitazioni', 'user_id');
        if (t === 'rapportini') nuovi.rapportini = await this.tutte('rapportini', 'data');
        if (t === 'presenze') nuovi.presenze = await this.tutte('presenze', 'data');
        if (t === 'certificati') nuovi.certificati = await this.tutte('certificati', 'numero');
      }),
    );
    this.dati = nuovi;
    return nuovi;
  }

  private async funzione(corpo: Record<string, unknown>) {
    const { data, error } = await this.sb.functions.invoke('gestione-utenti', { body: { ...corpo, dominioEmail: this.c.dominioEmail } });
    if (error) {
      let messaggio = error.message;
      try {
        messaggio = ((await (error as { context?: Response }).context?.json()) as { errore?: string })?.errore ?? messaggio;
      } catch {
        /* risposta non JSON */
      }
      throw new ErroreApp('VINCOLO', messaggio);
    }
    return data as { id: string };
  }

  async esegui(comando: Comando): Promise<Dati> {
    if (!this.utente) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    // controllo preventivo con le stesse regole del database, per messaggi immediati e chiari
    applica(this.dati ?? (await this.caricaDati()), comando, { utenteId: this.utente.id, ora: new Date().toISOString(), oggi: oggiISO() });
    switch (comando.tipo) {
      case 'corso.salva': {
        verifica(await this.sb.from('corsi').upsert(comando.corso));
        this.sporche.add('corsi');
        if (comando.direttore_id === undefined) break;
        // un solo direttore per corso: chi lascia l'incarico resta istruttore
        const corso_id = comando.corso.id;
        const uscente = this.sb.from('iscrizioni').update({ ruolo: 'instructor' }).eq('corso_id', corso_id).eq('ruolo', 'direttore');
        verifica(await (comando.direttore_id ? uscente.neq('user_id', comando.direttore_id) : uscente));
        if (comando.direttore_id) verifica(await this.sb.from('iscrizioni').upsert({ corso_id, user_id: comando.direttore_id, ruolo: 'direttore' }, { onConflict: 'corso_id,user_id' }));
        this.sporche.add('iscrizioni');
        break;
      }
      case 'corso.iscrivi':
        verifica(await this.sb.from('iscrizioni').insert(comando.iscrizione));
        this.sporche.add('iscrizioni');
        break;
      case 'corso.disiscrivi':
        verifica(await this.sb.from('iscrizioni').delete().eq('id', comando.id));
        this.sporche.add('iscrizioni').add('lezioni');
        break;
      case 'anagrafica.salva':
        verifica(await this.sb.from('anagrafiche').upsert(comando.anagrafica));
        this.sporche.add('anagrafiche');
        break;
      case 'training.salva':
        verifica(await this.sb.from('training_data').upsert(comando.user_ids.map((user_id) => ({ corso_id: comando.corso_id, user_id, ...comando.training }))));
        this.sporche.add('training_data');
        break;
      case 'istruttore.crea':
        verifica(await this.sb.from('istruttori').insert(comando.istruttore));
        this.sporche.add('istruttori');
        break;
      case 'istruttore.modifica': {
        const { id, ...campi } = comando.istruttore;
        verifica(await this.sb.from('istruttori').update(campi).eq('id', id));
        this.sporche.add('istruttori');
        break;
      }
      case 'registrazione.salva':
        this.applicaRegistrazione(verifica(await this.sb.from('registrazioni').upsert(comando.registrazione).select().single()) as Registrazione);
        break;
      case 'registrazione.elimina':
        verifica(await this.sb.from('registrazioni').delete().eq('id', comando.id));
        this.applicaRegistrazione(null, comando.id);
        break;
      case 'lezioni.sostituisci':
        verifica(await this.sb.from('lezioni').delete().eq('corso_id', comando.corso_id).in('data', comando.giorni));
        if (comando.lezioni.length) verifica(await this.sb.from('lezioni').insert(comando.lezioni));
        this.sporche.add('lezioni');
        break;
      case 'lezione.modifica': {
        const { id, ...campi } = comando.lezione;
        verifica(await this.sb.from('lezioni').update(campi).eq('id', id));
        this.sporche.add('lezioni');
        break;
      }
      case 'settimana.valida':
        verifica(
          await this.sb
            .from('lezioni')
            .update(comando.valida ? { validata: true, validata_da: this.utente.id, validata_il: new Date().toISOString() } : { validata: false, validata_da: null, validata_il: null })
            .eq('corso_id', comando.corso_id)
            .in('data', comando.giorni),
        );
        this.sporche.add('lezioni');
        break;
      case 'rapportino.salva': {
        verifica(await this.sb.from('rapportini').upsert({ corso_id: comando.corso_id, data: comando.data, note: comando.note }, { onConflict: 'corso_id,data' }));
        verifica(await this.sb.from('presenze').delete().eq('corso_id', comando.corso_id).eq('data', comando.data));
        if (comando.presenze.length) {
          verifica(await this.sb.from('presenze').insert(comando.presenze.map((p) => ({ ...p, corso_id: comando.corso_id, data: comando.data }))));
        }
        this.sporche.add('rapportini').add('presenze');
        break;
      }
      case 'certificato.salva':
        verifica(await this.sb.from('certificati').upsert(comando.certificato));
        this.sporche.add('certificati');
        break;
      case 'certificato.elimina':
        verifica(await this.sb.from('certificati').delete().eq('id', comando.id));
        this.sporche.add('certificati');
        break;
      case 'rapportino.valida':
        verifica(
          await this.sb
            .from('rapportini')
            .update(comando.valida ? { validato_il: new Date().toISOString(), validato_da: this.utente.id } : { validato_il: null, validato_da: null })
            .eq('corso_id', comando.corso_id)
            .eq('data', comando.data),
        );
        this.sporche.add('rapportini');
        break;
      case 'abilitazioni.imposta':
        verifica(await this.sb.from('abilitazioni').delete().eq('user_id', comando.user_id).eq('programma', comando.programma));
        if (comando.materie.length) {
          verifica(await this.sb.from('abilitazioni').insert(comando.materie.map((materia) => ({ user_id: comando.user_id, programma: comando.programma, materia }))));
        }
        this.sporche.add('abilitazioni');
        break;
      case 'utente.crea':
        await this.funzione({ azione: 'crea', ...comando.utente, password: comando.password });
        this.sporche.add('profili');
        break;
      case 'utente.modifica':
        await this.funzione({ azione: 'modifica', ...comando.utente, password: comando.password });
        this.sporche.add('profili');
        break;
      case 'utente.passwordCambiata':
        verifica(await this.sb.rpc('ptt_password_cambiata'));
        this.sporche.add('profili');
        break;
    }
    return this.caricaDati();
  }

  /** Applica una registrazione arrivata dal database (salvataggio proprio o evento in tempo reale). */
  private applicaRegistrazione(nuova: Registrazione | null, eliminata?: string) {
    if (!this.dati) return;
    const altre = this.dati.registrazioni.filter((r) => r.id !== (nuova?.id ?? eliminata));
    this.dati = { ...this.dati, registrazioni: nuova ? [...altre, nuova] : altre };
  }

  osserva(avvisa: () => void) {
    let attesa: number | undefined;
    const rimanda = () => {
      window.clearTimeout(attesa);
      attesa = window.setTimeout(avvisa, 400);
    };
    const canale = this.sb.channel('ptt-modifiche');
    for (const table of TABELLE) {
      canale.on('postgres_changes', { event: '*', schema: 'public', table }, (evento) => {
        // le registrazioni arrivano complete nell'evento: niente rilettura dell'intero logbook
        if (table === 'registrazioni') this.applicaRegistrazione(evento.eventType === 'DELETE' ? null : (evento.new as Registrazione), (evento.old as { id?: string }).id);
        else this.sporche.add(table);
        rimanda();
      });
    }
    canale.subscribe();
    return () => {
      window.clearTimeout(attesa);
      void this.sb.removeChannel(canale);
    };
  }
}
