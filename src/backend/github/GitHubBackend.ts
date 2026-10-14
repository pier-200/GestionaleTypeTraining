import type { Config } from '../../config';
import { ErroreApp } from '../../dominio/errori';
import { RE_USERNAME, applica, errorePassword, oggiISO, type Comando, type Esito } from '../../dominio/motore';
import { aggiornaDati, datiVuoti, type Dati, type Utente } from '../../dominio/tipi';
import { archivio, type Backend, type DatiPrimoAvvio, type Sessione } from '../tipi';
import { ApiGitHub, ConflittoRef, type VoceAlberoGit } from './api';
import { bytesDaTesto, nuovoUuid, testoDaBytes } from './crittografia';
import {
  cambiaPasswordPropria,
  creaKeyring,
  impostaCredenziali,
  rimuoviUtente,
  ruotaChiavi,
  sbloccaKeyring,
  validaKeyring,
  type ChiaviSessione,
  type Keyring,
} from './keyring';

type ConfigGitHub = Extract<Config, { tipo: 'github' }>;

const SESSIONE = 'github:sessione';
const FILE_KEYRING = 'keyring.json';
/** Cartella dei format ufficiali nel repository dei dati: privata come i dati, la legge solo chi accede. */
const MODELLI = 'modelli/';
const FORMATO = 1;

/**
 * Solo token «fine-grained», limitati ai due repository dell'archivio: un token classico o quello della GitHub CLI
 * aprirebbe tutti i repository dell'account a chi riuscisse a decifrare il portachiavi, che è pubblico.
 */
function controllaToken(token: string, c: ConfigGitHub) {
  if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(token)) {
    throw new ErroreApp('VALIDAZIONE', `Serve un token «fine-grained» (inizia con github_pat_) con accesso ai soli repository ${c.repoDati} e ${c.repoAccessi}, «Contents: Read and write».`);
  }
}
const README = `# Dati del Gestionale Type Training

Repository **privato** gestito dall'applicazione: non modificare i file a mano.
Ogni salvataggio crea un commit, quindi qualsiasi versione precedente è recuperabile dalla cronologia.

- \`db/utenti.json\`, \`db/corsi.json\`, \`db/iscrizioni.json\`, \`db/anagrafiche.json\`, \`db/training.json\`, \`db/istruttori.json\`, \`db/abilitazioni.json\`
- \`db/registrazioni/<id frequentatore>.json\`: logbook di ciascun frequentatore
- \`db/lezioni/<id corso>.json\`: programma della parte teorica
- \`db/presenze/<id corso>.json\`: rapportini presenze e assenze della parte teorica
- \`db/certificati.json\`: registro dei certificati AER(EP).P-147
- \`modelli/\`: format ufficiali (programma settimanale, Compliance Report, programmi, abilitazioni degli istruttori);
  si aggiornano con \`npm run modelli\` dal progetto oppure da GitHub (Add file → Upload files)
`;

/** Un file per collezione; registrazioni e lezioni divise per frequentatore e per corso (salvataggi più leggeri). */
function inFile(d: Dati): Map<string, string> {
  const testo = (elementi: unknown[]) => `${JSON.stringify({ formato: FORMATO, elementi }, null, 1)}
`;
  const file = new Map<string, string>([
    ['db/utenti.json', testo(d.utenti)],
    ['db/corsi.json', testo(d.corsi)],
    ['db/iscrizioni.json', testo(d.iscrizioni)],
    ['db/anagrafiche.json', testo(d.anagrafiche)],
    ['db/training.json', testo(d.training)],
    ['db/istruttori.json', testo(d.istruttori)],
    ['db/abilitazioni.json', testo(d.abilitazioni)],
    ['db/rapportini.json', testo(d.rapportini)],
    ['db/certificati.json', testo(d.certificati)],
  ]);
  const raggruppa = <T,>(elementi: T[], chiave: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of elementi) m.set(chiave(x), [...(m.get(chiave(x)) ?? []), x]);
    return m;
  };
  const perUtente = raggruppa(d.registrazioni, (r) => r.user_id);
  for (const u of d.utenti) if (u.ruolo === 'trainee') file.set(`db/registrazioni/${u.id}.json`, testo(perUtente.get(u.id) ?? []));
  const perCorso = raggruppa(d.lezioni, (l) => l.corso_id);
  for (const c of d.corsi) file.set(`db/lezioni/${c.id}.json`, testo(perCorso.get(c.id) ?? []));
  const presenzePerCorso = raggruppa(d.presenze, (p) => p.corso_id);
  for (const c of d.corsi) file.set(`db/presenze/${c.id}.json`, testo(presenzePerCorso.get(c.id) ?? []));
  return file;
}

function daFile(file: Map<string, string>): Dati {
  const elenco = <T,>(testo: string | undefined): T[] => {
    if (!testo) return [];
    const j = JSON.parse(testo) as { formato?: number; elementi?: T[] };
    if ((j.formato ?? 1) > FORMATO) throw new ErroreApp('CONFIGURAZIONE', 'Dati salvati da una versione più recente dell’applicazione: ricaricare la pagina.');
    return j.elementi ?? [];
  };
  const raccogli = <T,>(prefisso: string) => [...file].filter(([p]) => p.startsWith(prefisso)).flatMap(([, t]) => elenco<T>(t));
  return aggiornaDati({
    utenti: elenco(file.get('db/utenti.json')),
    corsi: elenco(file.get('db/corsi.json')),
    iscrizioni: elenco(file.get('db/iscrizioni.json')),
    anagrafiche: elenco(file.get('db/anagrafiche.json')),
    training: elenco(file.get('db/training.json')),
    istruttori: elenco(file.get('db/istruttori.json')),
    abilitazioni: elenco(file.get('db/abilitazioni.json')),
    rapportini: elenco(file.get('db/rapportini.json')),
    certificati: elenco(file.get('db/certificati.json')),
    registrazioni: raccogli('db/registrazioni/'),
    lezioni: raccogli('db/lezioni/'),
    presenze: raccogli('db/presenze/'),
  });
}

/**
 * Archivio su repository GitHub privato (come Gestionale PdS): usa solo domini GitHub.
 * Limite dichiarato: i permessi sono applicati dall'app, non da un server.
 */
export class GitHubBackend implements Backend {
  readonly tipo = 'github' as const;
  readonly nome: string;
  private readonly locale = archivio('local');
  private readonly scheda = archivio('session');
  private api: ApiGitHub | null = null;
  private chiavi: ChiaviSessione | null = null;
  private utenteId: string | null = null;
  private testa: { commit: string; albero: string } | null = null;
  /** Contenuto dei file all'ultimo caricamento, per scrivere solo quelli cambiati. */
  private file = new Map<string, string>();
  private dati: Dati | null = null;
  /** File della cartella `modelli` all'ultimo caricamento (percorso → sha) e contenuti già letti (sha → byte). */
  private modelli = new Map<string, string>();
  private contenutiModelli = new Map<string, Uint8Array>();
  private coda: Promise<unknown> = Promise.resolve();

  constructor(private readonly c: ConfigGitHub) {
    this.nome = `Repository GitHub privato (${c.owner}/${c.repoDati})`;
  }

  // --- portachiavi ---------------------------------------------------------

  private async keyringPubblico(): Promise<Keyring | null> {
    const pubblica = new ApiGitHub(null);
    const [api, raw] = await Promise.allSettled([
      pubblica.leggiContenuto(this.c.owner, this.c.repoAccessi, FILE_KEYRING, this.c.branch).then((x) => (x ? JSON.parse(testoDaBytes(x.bytes)) : null)),
      fetch(`https://raw.githubusercontent.com/${this.c.owner}/${this.c.repoAccessi}/${this.c.branch}/${FILE_KEYRING}?t=${Date.now()}`, { cache: 'no-store' }).then((r) =>
        r.status === 404 ? null : r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
    ]);
    const validi = [api, raw].flatMap((e) => (e.status === 'fulfilled' && e.value ? [validaKeyring(e.value)] : []));
    if (validi.length) return validi.sort((a, b) => b.revisione - a.revisione)[0];
    if ([api, raw].some((e) => e.status === 'fulfilled')) return null;
    throw new ErroreApp('RETE', 'Impossibile leggere gli accessi da GitHub: verificare la connessione.');
  }

  private async aggiornaKeyring(trasforma: (k: Keyring) => Promise<Keyring | null>, messaggio: string, api = this.richiediApi()) {
    for (let i = 0; i < 4; i++) {
      const x = await api.leggiContenuto(this.c.owner, this.c.repoAccessi, FILE_KEYRING, this.c.branch);
      if (!x) throw new ErroreApp('CONFIGURAZIONE', 'Portachiavi degli accessi non trovato.');
      const nuovo = await trasforma(validaKeyring(JSON.parse(testoDaBytes(x.bytes))));
      if (!nuovo) return;
      try {
        await api.scriviContenuto(this.c.owner, this.c.repoAccessi, FILE_KEYRING, bytesDaTesto(`${JSON.stringify(nuovo, null, 2)}\n`), messaggio, x.sha, this.c.branch);
        return;
      } catch (e) {
        if (!(e instanceof ConflittoRef)) throw e;
      }
    }
    throw new ErroreApp('CONFLITTO', 'Portachiavi modificato contemporaneamente da un altro utente: riprovare.');
  }

  // --- sessione ------------------------------------------------------------

  private richiediApi() {
    if (!this.api) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    return this.api;
  }

  private apri(utente: Utente, chiavi: ChiaviSessione, ricordami: boolean) {
    this.chiavi = chiavi;
    this.utenteId = utente.id;
    this.api = new ApiGitHub(chiavi.token);
    (ricordami ? this.locale : this.scheda).scrivi(SESSIONE, JSON.stringify({ utenteId: utente.id, chiavi }));
  }

  async avvia() {
    return (await this.keyringPubblico())
      ? { tipo: 'pronto' as const }
      : { tipo: 'primo_avvio' as const, messaggio: `Portachiavi non ancora presente in ${this.c.owner}/${this.c.repoAccessi}: inserire il token GitHub e creare il Training Manager.` };
  }

  async primoAvvio(d: DatiPrimoAvvio): Promise<Sessione> {
    const username = d.username.trim().toLowerCase();
    const problema = !RE_USERNAME.test(username) ? 'Username non valido' : (errorePassword(d.password) ?? (d.nome.trim() ? null : 'Indicare grado, nome e cognome'));
    if (problema) throw new ErroreApp('VALIDAZIONE', problema);
    const token = d.token?.trim();
    if (!token) throw new ErroreApp('VALIDAZIONE', 'Indicare il token di accesso GitHub.');
    controllaToken(token, this.c);
    const api = new ApiGitHub(token);
    const dati = await api.leggiRepository(this.c.owner, this.c.repoDati);
    if (!dati) throw new ErroreApp('CONFIGURAZIONE', `Repository ${this.c.owner}/${this.c.repoDati} non trovato o non accessibile con il token.`);
    if (!dati.private) throw new ErroreApp('CONFIGURAZIONE', `Il repository dei dati ${this.c.owner}/${this.c.repoDati} deve essere privato.`);
    const accessi = await api.leggiRepository(this.c.owner, this.c.repoAccessi);
    if (!accessi || accessi.private) throw new ErroreApp('CONFIGURAZIONE', `Il repository ${this.c.owner}/${this.c.repoAccessi} deve esistere ed essere pubblico (contiene solo il portachiavi cifrato).`);
    if (await api.leggiContenuto(this.c.owner, this.c.repoAccessi, FILE_KEYRING, this.c.branch)) {
      throw new ErroreApp('CONFIGURAZIONE', 'Portachiavi già presente: accedere con le credenziali esistenti.');
    }
    this.api = api;
    if (!(await api.leggiRef(this.c.owner, this.c.repoDati, this.c.branch))) {
      await api.scriviContenuto(this.c.owner, this.c.repoDati, 'README.md', bytesDaTesto(README), 'Inizializzazione', undefined, this.c.branch);
    }
    const attuali = await this.caricaDati();
    let admin = attuali.utenti.find((u) => u.username === username);
    if (attuali.utenti.length && (!admin || admin.ruolo !== 'admin')) {
      throw new ErroreApp('CONFIGURAZIONE', 'Il repository contiene già utenti: indicare lo username di un Training Manager esistente.');
    }
    if (!admin) {
      const ora = new Date().toISOString();
      admin = { id: nuovoUuid(), username, ruolo: 'admin', grado: '', nome: d.nome.trim(), cognome: '', istruttore_id: null, attivo: true, deve_cambiare_password: false, created_at: ora, updated_at: ora };
      await this.salva({ ...datiVuoti(), utenti: [admin] }, `${username}: configurazione iniziale`);
    }
    const { keyring, chiavi } = await creaKeyring(token, username, d.password);
    await api.scriviContenuto(this.c.owner, this.c.repoAccessi, FILE_KEYRING, bytesDaTesto(`${JSON.stringify(keyring, null, 2)}\n`), 'Configurazione iniziale del portachiavi', undefined, this.c.branch);
    this.apri(admin, chiavi, false);
    return { utente: admin };
  }

  async ripristinaSessione(): Promise<Sessione | null> {
    const grezza = this.scheda.leggi(SESSIONE) ?? this.locale.leggi(SESSIONE);
    if (!grezza) return null;
    try {
      const s = JSON.parse(grezza) as { utenteId: string; chiavi: ChiaviSessione };
      this.chiavi = s.chiavi;
      this.utenteId = s.utenteId;
      this.api = new ApiGitHub(s.chiavi.token);
      const utente = (await this.caricaDati()).utenti.find((u) => u.id === s.utenteId);
      if (utente?.attivo) return { utente };
    } catch (e) {
      if (e instanceof ErroreApp && e.codice === 'RETE') throw e;
    }
    await this.esci();
    return null;
  }

  async accedi(username: string, password: string, ricordami: boolean): Promise<Sessione> {
    const u = username.trim().toLowerCase();
    const keyring = await this.keyringPubblico();
    if (!keyring) throw new ErroreApp('CONFIGURAZIONE', 'Configurazione iniziale non completata.');
    const chiavi = await sbloccaKeyring(keyring, u, password);
    this.api = new ApiGitHub(chiavi.token);
    try {
      const utente = (await this.caricaDati()).utenti.find((x) => x.username === u);
      if (!utente?.attivo) throw new ErroreApp('AUTENTICAZIONE', 'Account disattivato: rivolgersi al Training Manager.');
      this.apri(utente, chiavi, ricordami);
      return { utente };
    } catch (e) {
      this.api = null;
      if (e instanceof ErroreApp && e.codice === 'AUTENTICAZIONE' && /token/i.test(e.message)) {
        // come nel Gestionale PdS: il Training Manager rinnova il token dalla pagina di accesso, per tutti
        throw chiavi.ka
          ? new ErroreApp('TOKEN_SCADUTO', 'Il token di accesso a GitHub è scaduto o è stato revocato. Come Training Manager puoi inserire qui un nuovo token: l’accesso torna per tutti gli utenti.')
          : new ErroreApp('AUTENTICAZIONE', 'Il token di accesso a GitHub è scaduto o è stato revocato: il Training Manager deve rinnovarlo accedendo all’applicazione.');
      }
      throw e;
    }
  }

  /**
   * Rinnovo del token scaduto dalla pagina di accesso: le credenziali del Training Manager sbloccano
   * le chiavi amministrative anche quando il token precedente non funziona più.
   */
  async rinnovaTokenEAccedi(username: string, password: string, nuovoToken: string, ricordami: boolean): Promise<Sessione> {
    const keyring = await this.keyringPubblico();
    if (!keyring) throw new ErroreApp('CONFIGURAZIONE', 'Configurazione iniziale non completata.');
    await this.sostituisciToken(await sbloccaKeyring(keyring, username.trim().toLowerCase(), password), nuovoToken);
    return this.accedi(username, password, ricordami);
  }

  /** Sostituisce il token GitHub e rigenera le chiavi di accesso di tutti gli utenti (solo Training Manager). */
  async ruotaToken(nuovoToken: string): Promise<void> {
    if (!this.chiavi || !this.utenteId) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    const nuove = await this.sostituisciToken(this.chiavi, nuovoToken);
    const ricordata = this.locale.leggi(SESSIONE) != null;
    this.chiavi = nuove;
    this.api = new ApiGitHub(nuove.token);
    (ricordata ? this.locale : this.scheda).scrivi(SESSIONE, JSON.stringify({ utenteId: this.utenteId, chiavi: nuove }));
  }

  /**
   * Prova il nuovo token (lettura e scrittura del repository dei dati, scrittura del portachiavi) e lo cifra
   * con chiavi nuove per tutti: chi conservasse le chiavi vecchie non lo può decifrare. Le password non cambiano.
   */
  private async sostituisciToken(chiavi: ChiaviSessione, nuovoToken: string): Promise<ChiaviSessione> {
    if (!chiavi.ka) throw new ErroreApp('PERMESSO_NEGATO', 'Solo il Training Manager può sostituire il token.');
    const token = nuovoToken.trim();
    controllaToken(token, this.c);
    const api = new ApiGitHub(token);
    const ammessi = `il token deve avere accesso ai soli repository ${this.c.repoDati} e ${this.c.repoAccessi}, con «Contents: Read and write»`;
    try {
      if (!(await api.leggiRef(this.c.owner, this.c.repoDati, this.c.branch))) throw new ErroreApp('CONFIGURAZIONE', '');
      await api.creaBlob(this.c.owner, this.c.repoDati, bytesDaTesto('verifica del token'));
    } catch (e) {
      if (e instanceof ErroreApp && e.codice === 'RETE') throw e;
      throw new ErroreApp('CONFIGURAZIONE', `Il nuovo token non legge o non scrive ${this.c.owner}/${this.c.repoDati}: ${ammessi}.`);
    }
    const esito: { chiavi?: ChiaviSessione } = {};
    await this.aggiornaKeyring(
      async (k) => {
        const r = await ruotaChiavi(k, chiavi, token);
        esito.chiavi = r.chiavi;
        return r.keyring;
      },
      `${chiavi.username}: sostituzione del token e rigenerazione delle chiavi`,
      api,
    );
    if (!esito.chiavi) throw new ErroreApp('CONFIGURAZIONE', `Portachiavi non aggiornato: ${ammessi}.`);
    return esito.chiavi;
  }

  async esci() {
    this.api = null;
    this.chiavi = null;
    this.utenteId = null;
    this.dati = null;
    this.testa = null;
    this.file = new Map();
    this.modelli = new Map();
    this.contenutiModelli.clear();
    this.locale.rimuovi(SESSIONE);
    this.scheda.rimuovi(SESSIONE);
  }

  async cambiaPassword(attuale: string, nuova: string) {
    const chiavi = this.chiavi;
    if (!chiavi) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
    const problema = errorePassword(nuova);
    if (problema) throw new ErroreApp('VALIDAZIONE', problema);
    const keyring = await this.keyringPubblico();
    try {
      await sbloccaKeyring(keyring!, chiavi.username, attuale);
    } catch {
      throw new ErroreApp('AUTENTICAZIONE', 'La password attuale non è corretta.');
    }
    await this.aggiornaKeyring((k) => cambiaPasswordPropria(k, chiavi, nuova), `${chiavi.username}: cambio password`);
    await this.esegui({ tipo: 'utente.passwordCambiata' });
  }

  // --- dati ----------------------------------------------------------------

  async caricaDati(): Promise<Dati> {
    const api = this.richiediApi();
    const commit = await api.leggiRef(this.c.owner, this.c.repoDati, this.c.branch);
    if (!commit) throw new ErroreApp('CONFIGURAZIONE', `Il repository ${this.c.owner}/${this.c.repoDati} è vuoto o non accessibile.`);
    if (this.dati && this.testa?.commit === commit) return this.dati;
    const { albero } = await api.leggiCommit(this.c.owner, this.c.repoDati, commit);
    const tutti = (await api.leggiAlbero(this.c.owner, this.c.repoDati, albero)).filter((e) => e.type === 'blob');
    const elementi = tutti.filter((e) => e.path.startsWith('db/'));
    const file = new Map(await Promise.all(elementi.map(async (e) => [e.path, testoDaBytes(await api.leggiBlob(this.c.owner, this.c.repoDati, e.sha))] as const)));
    // dei modelli si tiene solo l'elenco: il contenuto si scarica quando serve
    this.modelli = new Map(tutti.filter((e) => e.path.startsWith(MODELLI)).map((e) => [e.path.slice(MODELLI.length), e.sha]));
    this.file = file;
    this.testa = { commit, albero };
    this.dati = daFile(file);
    return this.dati;
  }

  /** Scrive in un unico commit i soli file cambiati; lancia ConflittoRef se nel frattempo altri hanno salvato. */
  private async salva(dati: Dati, messaggio: string) {
    const api = this.richiediApi();
    const voci: VoceAlberoGit[] = [];
    const nuovi = inFile(dati);
    for (const [path, testo] of nuovi) if (this.file.get(path) !== testo) voci.push({ path, mode: '100644', type: 'blob', content: testo });
    if (!voci.length) return;
    const albero = await api.creaAlbero(this.c.owner, this.c.repoDati, this.testa!.albero, voci);
    const commit = await api.creaCommit(this.c.owner, this.c.repoDati, messaggio, albero, [this.testa!.commit]);
    await api.aggiornaRef(this.c.owner, this.c.repoDati, this.c.branch, commit);
    this.testa = { commit, albero };
    this.file = new Map([...this.file, ...nuovi]);
    this.dati = dati;
  }

  async esegui(comando: Comando): Promise<Dati> {
    // i comandi dello stesso browser vanno in coda; in caso di salvataggi altrui si ricarica e si riapplica
    const lavoro = this.coda.then(async () => {
      if (!this.utenteId || !this.chiavi) throw new ErroreApp('AUTENTICAZIONE', 'Sessione scaduta: accedere di nuovo.');
      for (let i = 0; i < 5; i++) {
        const esito: Esito = applica(await this.caricaDati(), comando, { utenteId: this.utenteId, ora: new Date().toISOString(), oggi: oggiISO() });
        try {
          await this.salva(esito.dati, `${this.chiavi.username}: ${comando.tipo}`);
        } catch (e) {
          if (e instanceof ConflittoRef) continue;
          throw e;
        }
        for (const eff of esito.effetti) {
          const chiavi = this.chiavi;
          if (eff.tipo === 'credenziali.imposta') {
            await this.aggiornaKeyring((k) => impostaCredenziali(k, chiavi, eff.username, eff.password, eff.admin), `${chiavi.username}: credenziali di ${eff.username}`);
          } else {
            await this.aggiornaKeyring((k) => rimuoviUtente(k, eff.username), `${chiavi.username}: revoca di ${eff.username}`);
          }
        }
        return esito.dati;
      }
      throw new ErroreApp('CONFLITTO', 'Molti salvataggi contemporanei: riprovare.');
    });
    this.coda = lavoro.catch(() => undefined);
    return lavoro;
  }

  async elencoModelli(): Promise<string[]> {
    await this.caricaDati();
    return [...this.modelli.keys()].sort();
  }

  async leggiModello(nome: string): Promise<Uint8Array | null> {
    await this.caricaDati();
    const sha = this.modelli.get(nome);
    if (!sha) return null;
    const letto = this.contenutiModelli.get(sha) ?? (await this.richiediApi().leggiBlob(this.c.owner, this.c.repoDati, sha));
    this.contenutiModelli.set(sha, letto);
    return letto;
  }

  osserva(avvisa: () => void) {
    // ponytail: polling del ramo ogni 30 s (GitHub non offre notifiche al browser)
    const controlla = async () => {
      if (!this.api || document.hidden) return;
      try {
        const commit = await this.api.leggiRef(this.c.owner, this.c.repoDati, this.c.branch);
        if (commit && commit !== this.testa?.commit) avvisa();
      } catch {
        /* rete assente: si riprova al giro successivo */
      }
    };
    const timer = window.setInterval(controlla, 30_000);
    window.addEventListener('focus', controlla);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', controlla);
    };
  }
}
