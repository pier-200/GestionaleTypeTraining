import { ErroreApp } from './errori';
import { chapterDelMds, materiaDi, mdsDi, indice, programmaPratico, programmaTeorico, programmiPer } from './programmi';
import { MINUTI_PERIODO, inOrdine, indiceGiorno, periodiDelGiorno } from './pianificazione';
import { conIstruttore, conMateria, conPersona, type Abilitazione, type Anagrafica, type Certificato, type Corso, type Dati, type DatiTraining, type EsitoProva, type ID, type Iscrizione, type Istruttore, type Lezione, type Presenza, type Rapportino, type Registrazione, type RuoloNelCorso, type StatoCertificato, type StatoPresenza, type TipoCertificato, type TipoEsecuzione, type TipoPeriodo, type Utente } from './tipi';

/**
 * Comandi di modifica dei dati, con permessi e validazioni. Il motore è eseguito
 * nel browser dagli archivi demo e GitHub; con Supabase le stesse regole sono
 * ripetute dal database (database/schema.sql) e il motore serve per i messaggi immediati.
 */

export type CampiRegistrazione = Pick<
  Registrazione,
  'id' | 'corso_id' | 'user_id' | 'task_id' | 'maintenance_location' | 'data' | 'tipo_esecuzione' | 'matricola' | 'et_minuti' | 'instructor_id'
>;
export type CampiAnagrafica = Omit<Anagrafica, 'updated_at' | 'updated_by'>;
export type CampiTraining = Omit<DatiTraining, 'corso_id' | 'user_id' | 'updated_at' | 'updated_by'>;
export type CampiIstruttore = Pick<Istruttore, 'id' | 'grado' | 'nome' | 'cognome'>;
export type CampiUtente = Pick<Utente, 'id' | 'username' | 'ruolo' | 'grado' | 'nome' | 'cognome' | 'istruttore_id'>;
/** I programmi non si scelgono a mano: seguono mezzo e categoria. */
export type CampiCorso = Pick<
  Corso,
  | 'id'
  | 'codice'
  | 'nome'
  | 'mds'
  | 'categoria'
  | 'data_inizio'
  | 'data_fine'
  | 'data_chiusura'
  | 'durata_settimane'
  | 'maintenance_organization'
  | 'location'
  | 'aula'
  | 'gruppo_firma'
  | 'direttore_nome'
  | 'aeromobili'
  | 'attivo'
>;
export type CampiLezione = Pick<Lezione, 'id' | 'corso_id' | 'data' | 'ordine' | 'parte' | 'minuti' | 'materia' | 'istruttore_id' | 'persona' | 'frequentatori' | 'aula' | 'tipo' | 'note'>;
/** Chapter di un mezzo a cui un istruttore è abilitato. */
export interface CampiAbilitazioni {
  user_id: ID;
  mds: string;
  chapters: string[];
}
export type CampiPresenza = Pick<Presenza, 'id' | 'user_id' | 'stato' | 'dalle' | 'alle' | 'motivo'>;
export type CampiCertificato = Omit<Certificato, 'creato_il' | 'creato_da' | 'modificato_il' | 'modificato_da'>;

export type Comando =
  /**
   * direttore_id: l'istruttore a cui affidare il corso (null = nessuno, o una persona fuori elenco in corso.direttore_nome);
   * istruttori_pratica: gli istruttori nominati per la fase pratica. Se mancano, restano com'erano.
   */
  | { tipo: 'corso.salva'; corso: CampiCorso; direttore_id?: ID | null; istruttori_pratica?: ID[] }
  /** Assegna un frequentatore al corso. */
  | { tipo: 'corso.iscrivi'; iscrizione: Pick<Iscrizione, 'id' | 'corso_id' | 'user_id'> }
  | { tipo: 'corso.disiscrivi'; id: ID }
  /** Esclude il frequentatore dal corso a partire dal giorno indicato (null = lo riammette). */
  | { tipo: 'corso.escludi'; id: ID; data: string | null }
  | { tipo: 'anagrafica.salva'; anagrafica: CampiAnagrafica }
  | { tipo: 'training.salva'; corso_id: ID; user_ids: ID[]; training: CampiTraining }
  | { tipo: 'istruttore.crea'; istruttore: CampiIstruttore }
  | { tipo: 'istruttore.modifica'; istruttore: CampiIstruttore }
  | { tipo: 'registrazione.salva'; registrazione: CampiRegistrazione }
  | { tipo: 'registrazione.elimina'; id: ID }
  | { tipo: 'lezioni.sostituisci'; corso_id: ID; giorni: string[]; lezioni: CampiLezione[] }
  | { tipo: 'lezione.modifica'; lezione: Pick<CampiLezione, 'id' | 'istruttore_id' | 'note'> }
  | { tipo: 'settimana.valida'; corso_id: ID; giorni: string[]; valida: boolean }
  | { tipo: 'rapportino.salva'; corso_id: ID; data: string; note: string; presenze: CampiPresenza[] }
  | { tipo: 'rapportino.valida'; corso_id: ID; data: string; valida: boolean }
  | { tipo: 'certificato.salva'; certificato: CampiCertificato }
  | { tipo: 'certificato.elimina'; id: ID }
  /** Sostituisce i chapter a cui l'istruttore è abilitato per quel mezzo. */
  | ({ tipo: 'abilitazioni.imposta' } & CampiAbilitazioni)
  /** Come sopra per più istruttori e mezzi insieme (importazione dall'Excel delle abilitazioni). */
  | { tipo: 'abilitazioni.importa'; righe: CampiAbilitazioni[] }
  | { tipo: 'utente.crea'; utente: CampiUtente; password: string }
  | { tipo: 'utente.modifica'; utente: Pick<Utente, 'id' | 'grado' | 'nome' | 'cognome' | 'attivo' | 'istruttore_id'>; password?: string }
  | { tipo: 'utente.passwordCambiata' };

/** Operazioni sulle credenziali che l'archivio deve eseguire dopo il salvataggio dei dati. */
export type Effetto =
  | { tipo: 'credenziali.imposta'; username: string; password: string; admin: boolean }
  | { tipo: 'credenziali.rimuovi'; username: string };

export interface Contesto {
  utenteId: ID;
  ora: string;
  oggi: string;
}

export interface Esito {
  dati: Dati;
  effetti: Effetto[];
}

export const RE_USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
export const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
export const TIPI_ESECUZIONE: TipoEsecuzione[] = ['AC', 'SIM', 'CLA'];
export const TIPI_PERIODO: TipoPeriodo[] = ['lezione', 'recupero', 'meo', 'sospensione', 'esame', 'esame_pratico', 'pratica', 'valutazione', 'pa'];
export const TIPI_CERTIFICATO: TipoCertificato[] = ['teorico', 'pratico', 'completo'];
export const STATI_CERTIFICATO: StatoCertificato[] = ['bozza', 'rilasciato', 'annullato'];
export const ESITI_PROVA: EsitoProva[] = ['', 'superato', 'non superato'];

/** Primo numero libero del registro dei certificati per quell'anno. */
export const prossimoNumero = (dati: Dati, anno: number) =>
  dati.certificati.filter((c) => c.anno === anno).reduce((max, c) => Math.max(max, c.numero), 0) + 1;

export const oggiISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Lunghezza minima volutamente bassa (richiesta dell'utente: credenziali di avvio semplici).
 * Con l'archivio GitHub la password protegge il token nel portachiavi: per i dati veri usarne una lunga.
 */
export const PASSWORD_MINIMA = 4;

export function errorePassword(p: string): string | null {
  if (p.length < PASSWORD_MINIMA) return `La password deve contenere almeno ${PASSWORD_MINIMA} caratteri`;
  if (p.length > 128) return 'La password è troppo lunga';
  return null;
}

const dataValida = (s: string) => RE_DATA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Ruolo dell'utente nel corso indicato ('admin' se Training Manager): il direttore si riconosce solo qui. */
export function ruoloNelCorso(dati: Dati, utente: Utente, corsoId: ID | null | undefined): RuoloNelCorso | null {
  if (utente.ruolo === 'admin') return 'admin';
  const i = dati.iscrizioni.find((x) => x.corso_id === corsoId && x.user_id === utente.id);
  if (i) return i.ruolo;
  // gli istruttori non si iscrivono: seguono i corsi in cui sono nominati per la pratica o hanno lezioni
  if (utente.ruolo !== 'instructor') return null;
  const corso = dati.corsi.find((c) => c.id === corsoId);
  return corso && (corso.istruttori_pratica.includes(utente.id) || dati.lezioni.some((l) => l.corso_id === corso.id && l.istruttore_id === utente.id)) ? 'instructor' : null;
}

/** Corsi visibili all'utente. */
export function corsiDi(dati: Dati, utente: Utente): Corso[] {
  return dati.corsi.filter((c) => ruoloNelCorso(dati, utente, c.id) != null).sort((a, b) => Number(b.attivo) - Number(a.attivo) || b.codice.localeCompare(a.codice));
}

class Controlli {
  readonly errori: Record<string, string> = {};

  testo(campo: string, etichetta: string, valore: string | null | undefined, max: number, obbligatorio = true): string {
    const t = (valore ?? '').trim();
    if (!t && obbligatorio) this.errori[campo] = `${etichetta}: campo obbligatorio`;
    else if (t.length > max) this.errori[campo] = `${etichetta}: massimo ${max} caratteri`;
    return t;
  }

  data(campo: string, etichetta: string, valore: string | null | undefined, obbligatoria: boolean, massima?: string): string | null {
    const v = (valore ?? '').trim();
    if (!v) {
      if (obbligatoria) this.errori[campo] = `${etichetta}: campo obbligatorio`;
      return null;
    }
    if (!dataValida(v)) this.errori[campo] = `${etichetta}: data non valida`;
    else if (massima && v > massima) this.errori[campo] = `${etichetta}: la data non può essere futura`;
    return v;
  }

  verifica() {
    const valori = Object.values(this.errori);
    if (valori.length) throw new ErroreApp('VALIDAZIONE', valori.length === 1 ? valori[0] : `Dati non validi: ${valori.join('; ')}`, this.errori);
  }
}

/** Normalizza e valida i campi di una registrazione (usato anche dal form). */
export function validaRegistrazione(r: CampiRegistrazione, oggi: string, istruttori: readonly Istruttore[], programma: string | null | undefined): CampiRegistrazione {
  const c = new Controlli();
  const p = programmaPratico(programma);
  if (!p) c.errori.corso_id = 'Il corso non prevede la parte pratica';
  else if (!indice(p).taskPerId.has(r.task_id)) c.errori.task_id = 'Task non presente nel programma del corso';
  const maintenance_location = c.testo('maintenance_location', 'Maintenance location', r.maintenance_location, 100);
  const data = c.data('data', 'Data', r.data, true, oggi) ?? '';
  if (!TIPI_ESECUZIONE.includes(r.tipo_esecuzione)) c.errori.tipo_esecuzione = 'Indicare aeromobile, SIM o CLA';
  const matricola = r.tipo_esecuzione === 'AC' ? c.testo('matricola', 'Matricola aeromobile', r.matricola, 60) : '';
  const et = Number(r.et_minuti);
  if (!Number.isInteger(et) || et <= 0) c.errori.et_minuti = 'ET: indicare i minuti (numero intero maggiore di zero)';
  else if (et > 1440) c.errori.et_minuti = 'ET: massimo 1440 minuti';
  if (!r.instructor_id) c.errori.instructor_id = 'Instructor: campo obbligatorio';
  else if (!istruttori.some((i) => i.id === r.instructor_id)) c.errori.instructor_id = 'Instructor non presente in elenco';
  c.verifica();
  return { ...r, maintenance_location, data, matricola, et_minuti: et };
}

function permesso(ok: boolean, messaggio = 'Non hai i permessi per questa operazione.') {
  if (!ok) throw new ErroreApp('PERMESSO_NEGATO', messaggio);
}

const sostituisci = <T,>(lista: T[], trova: (x: T) => boolean, nuovo: T) => {
  const i = lista.findIndex(trova);
  return i < 0 ? [...lista, nuovo] : lista.map((x, j) => (j === i ? nuovo : x));
};

const chiaveIstruttore = (i: Pick<Istruttore, 'grado' | 'nome' | 'cognome'>) =>
  [i.grado, i.nome, i.cognome].map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');

export function applica(dati: Dati, comando: Comando, ctx: Contesto): Esito {
  const io = dati.utenti.find((u) => u.id === ctx.utenteId);
  if (!io || !io.attivo) throw new ErroreApp('AUTENTICAZIONE', 'Utente non abilitato: accedere di nuovo.');
  const admin = io.ruolo === 'admin';
  const traccia = { updated_at: ctx.ora, updated_by: io.id };
  const corso = (id: ID) => {
    const c = dati.corsi.find((x) => x.id === id);
    if (!c) throw new ErroreApp('NON_TROVATO', 'Corso non trovato.');
    return c;
  };
  /** Chi guida il corso: Training Manager o l'istruttore che ne è direttore. */
  const guida = (corsoId: ID) => admin || ruoloNelCorso(dati, io, corsoId) === 'direttore';
  /** Direttore di almeno un corso: cura anche l'elenco degli istruttori pratici. */
  const dirige = admin || dati.iscrizioni.some((i) => i.user_id === io.id && i.ruolo === 'direttore');
  const iscrizione = (corsoId: ID, userId: ID) => dati.iscrizioni.find((i) => i.corso_id === corsoId && i.user_id === userId && i.ruolo === 'trainee');
  /** Frequentatore assegnato al corso (anche se poi escluso: i suoi dati restano). */
  const frequenta = (corsoId: ID, userId: ID) => iscrizione(corsoId, userId) != null;
  /** Frequentatore che fa parte del corso nel giorno indicato. */
  const frequentaIl = (corsoId: ID, userId: ID, giorno: string) => {
    const i = iscrizione(corsoId, userId);
    return i != null && (!i.escluso_il || giorno < i.escluso_il);
  };
  const istruttore = (id: ID) => dati.utenti.some((u) => u.id === id && u.ruolo === 'instructor');

  switch (comando.tipo) {
    case 'corso.salva': {
      const c = comando.corso;
      const esistente = dati.corsi.find((x) => x.id === c.id);
      permesso(esistente ? guida(c.id) : admin, esistente ? 'Solo il Training Manager o il direttore modificano il corso.' : 'Solo il Training Manager crea i corsi.');
      const v = new Controlli();
      const codice = v.testo('codice', 'Codice', c.codice, 30);
      if (codice && dati.corsi.some((x) => x.id !== c.id && x.codice.toLowerCase() === codice.toLowerCase())) v.errori.codice = `Il codice "${codice}" è già usato da un altro corso`;
      const nome = v.testo('nome', 'Nome', c.nome, 120);
      const data_inizio = v.data('data_inizio', 'Data di inizio', c.data_inizio, false);
      const data_fine = v.data('data_fine', 'Data di fine', c.data_fine, false);
      if (data_inizio && data_fine && data_fine < data_inizio) v.errori.data_fine = 'La data di fine precede la data di inizio';
      const mezzo = mdsDi(c.mds);
      if (!mezzo) v.errori.mds = 'Indicare il mezzo (MDS)';
      else if (!mezzo.categorie.includes(c.categoria)) v.errori.categoria = `Il ${mezzo.codice} non prevede la categoria "${c.categoria}"`;
      // i programmi seguono mezzo e categoria (le categorie C hanno solo la parte teorica)
      const attesi = programmiPer(c.mds, c.categoria);
      const durata_settimane = c.durata_settimane == null ? null : Number(c.durata_settimane);
      if (durata_settimane != null && (!Number.isInteger(durata_settimane) || durata_settimane < 1 || durata_settimane > 104)) v.errori.durata_settimane = 'Durata: settimane intere, da 1 a 104';
      // il direttore è un istruttore con un incarico in più su questo corso, oppure una persona fuori elenco: lo assegna il Training Manager
      const attuale = dati.iscrizioni.find((i) => i.corso_id === c.id && i.ruolo === 'direttore');
      const direttore_id = comando.direttore_id === undefined ? (attuale?.user_id ?? null) : comando.direttore_id;
      const direttore_nome = direttore_id ? '' : v.testo('direttore_nome', 'Direttore del corso', c.direttore_nome, 80, false);
      const cambiaDirettore = direttore_id !== (attuale?.user_id ?? null);
      if (cambiaDirettore || direttore_nome !== (esistente?.direttore_nome ?? '')) {
        permesso(admin, 'Solo il Training Manager assegna il direttore del corso.');
        if (direttore_id && !dati.utenti.some((u) => u.id === direttore_id && u.ruolo === 'instructor' && u.attivo)) v.errori.direttore_id = 'Il direttore del corso va scelto tra gli istruttori, oppure scritto a mano';
      }
      const istruttori_pratica = [...new Set(comando.istruttori_pratica ?? esistente?.istruttori_pratica ?? [])];
      if (istruttori_pratica.some((id) => !istruttore(id))) v.errori.istruttori_pratica = 'Per la fase pratica si nominano solo istruttori';
      const aeromobili = [...new Set((c.aeromobili ?? []).map((a) => a.trim()).filter(Boolean))];
      if (aeromobili.length > 40 || aeromobili.some((a) => a.length > 30)) v.errori.aeromobili = 'Aeromobili: al massimo 40 identificativi di 30 caratteri';
      // la data di fine è stimata finché il corso è aperto; alla chiusura si indica quella effettiva
      const data_chiusura = c.attivo ? null : v.data('data_chiusura', 'Data effettiva di chiusura', c.data_chiusura, true, ctx.oggi);
      if (data_inizio && data_chiusura && data_chiusura < data_inizio) v.errori.data_chiusura = 'La chiusura precede la data di inizio';
      const nuovo: Corso = {
        ...(esistente ?? { id: c.id, created_at: ctx.ora }),
        id: c.id,
        codice,
        nome,
        mds: c.mds,
        categoria: c.categoria,
        programma_teorico: attesi.teorico?.id ?? null,
        programma_pratico: attesi.pratico?.id ?? null,
        data_inizio,
        data_fine,
        data_chiusura,
        durata_settimane,
        maintenance_organization: v.testo('maintenance_organization', 'Maintenance Organisation', c.maintenance_organization, 200, false),
        location: v.testo('location', 'Location', c.location, 100, false),
        aula: v.testo('aula', 'Aula', c.aula, 40, false),
        gruppo_firma: v.testo('gruppo_firma', 'Gruppo firma del comandante', c.gruppo_firma, 120, false),
        direttore_nome,
        istruttori_pratica,
        aeromobili,
        attivo: c.attivo,
        created_at: esistente?.created_at ?? ctx.ora,
        updated_at: ctx.ora,
      };
      v.verifica();
      let iscrizioni = dati.iscrizioni;
      if (cambiaDirettore) {
        // l'incarico sta nell'iscrizione «direttore»: ce n'è una sola per corso
        iscrizioni = iscrizioni.filter((i) => i !== attuale);
        if (direttore_id) iscrizioni = [...iscrizioni, { id: `${c.id}|${direttore_id}`, corso_id: c.id, user_id: direttore_id, ruolo: 'direttore', escluso_il: null, created_at: ctx.ora }];
      }
      return { dati: { ...dati, corsi: sostituisci(dati.corsi, (x) => x.id === c.id, nuovo), iscrizioni }, effetti: [] };
    }

    case 'corso.iscrivi': {
      const i = comando.iscrizione;
      permesso(guida(i.corso_id), 'Solo il Training Manager o il direttore iscrivono al corso.');
      corso(i.corso_id);
      const utente = dati.utenti.find((u) => u.id === i.user_id);
      if (!utente) throw new ErroreApp('NON_TROVATO', 'Account non trovato.');
      // al corso si assegnano i frequentatori: direttore e istruttori della pratica si scelgono nei dati del corso
      if (utente.ruolo !== 'trainee') throw new ErroreApp('VINCOLO', 'Al corso si assegnano solo i frequentatori: il direttore e gli istruttori della fase pratica si scelgono nei dati del corso.');
      if (dati.iscrizioni.some((x) => x.corso_id === i.corso_id && x.user_id === i.user_id)) throw new ErroreApp('DUPLICATO', 'Frequentatore già assegnato a questo corso.');
      return { dati: { ...dati, iscrizioni: [...dati.iscrizioni, { id: i.id, corso_id: i.corso_id, user_id: i.user_id, ruolo: 'trainee', escluso_il: null, created_at: ctx.ora }] }, effetti: [] };
    }

    case 'corso.escludi': {
      const i = dati.iscrizioni.find((x) => x.id === comando.id && x.ruolo === 'trainee');
      if (!i) throw new ErroreApp('NON_TROVATO', 'Frequentatore non assegnato al corso.');
      permesso(guida(i.corso_id), 'Solo il Training Manager o il direttore escludono un frequentatore dal corso.');
      const v = new Controlli();
      const escluso_il = v.data('data', 'Data di esclusione', comando.data, false);
      const inizio = corso(i.corso_id).data_inizio;
      if (escluso_il && inizio && escluso_il < inizio) v.errori.data = 'L’esclusione precede l’inizio del corso';
      v.verifica();
      return { dati: { ...dati, iscrizioni: dati.iscrizioni.map((x) => (x === i ? { ...x, escluso_il } : x)) }, effetti: [] };
    }

    case 'corso.disiscrivi': {
      const i = dati.iscrizioni.find((x) => x.id === comando.id);
      if (!i) throw new ErroreApp('NON_TROVATO', 'Iscrizione non trovata.');
      permesso(guida(i.corso_id), 'Solo il Training Manager o il direttore gestiscono le iscrizioni.');
      if (i.ruolo !== 'trainee') throw new ErroreApp('VINCOLO', 'Il direttore si cambia nei dati del corso.');
      if (dati.registrazioni.some((r) => r.corso_id === i.corso_id && r.user_id === i.user_id) || dati.presenze.some((p) => p.corso_id === i.corso_id && p.user_id === i.user_id)) {
        throw new ErroreApp('VINCOLO', 'Il frequentatore ha già registrazioni o presenze in questo corso: per toglierlo va escluso, così i suoi dati restano.');
      }
      return { dati: { ...dati, iscrizioni: dati.iscrizioni.filter((x) => x.id !== comando.id) }, effetti: [] };
    }

    case 'anagrafica.salva': {
      const a = comando.anagrafica;
      // i Personal Data li vedono tutti, li modificano solo il Training Manager e il direttore del corso del frequentatore
      permesso(admin || dati.iscrizioni.some((i) => i.user_id === a.user_id && i.ruolo === 'trainee' && guida(i.corso_id)), 'Solo il Training Manager o il direttore del corso modificano i Personal Data.');
      if (!dati.utenti.some((u) => u.id === a.user_id && u.ruolo === 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non trovato.');
      const c = new Controlli();
      const nuova: Anagrafica = {
        user_id: a.user_id,
        grado: c.testo('grado', 'Grado', a.grado, 60),
        nome: c.testo('nome', 'Nome', a.nome, 80),
        cognome: c.testo('cognome', 'Cognome', a.cognome, 80),
        data_nascita: c.data('data_nascita', 'Data di nascita', a.data_nascita, true, ctx.oggi),
        citta_nascita: c.testo('citta_nascita', 'Città di nascita', a.citta_nascita, 80),
        maml: c.testo('maml', 'MAML', a.maml, 40, false),
        ente: c.testo('ente', 'Ente', a.ente, 60, false),
        ...traccia,
      };
      c.verifica();
      return { dati: { ...dati, anagrafiche: sostituisci(dati.anagrafiche, (x) => x.user_id === a.user_id, nuova) }, effetti: [] };
    }

    case 'training.salva': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore inseriscono i Practical Type Training Data.');
      corso(comando.corso_id);
      const t = comando.training;
      const c = new Controlli();
      const data_inizio = c.data('data_inizio', 'Data di inizio', t.data_inizio, false);
      const data_fine = c.data('data_fine', 'Data di fine', t.data_fine, false);
      if (data_inizio && data_fine && data_fine < data_inizio) c.errori.data_fine = 'La data di fine precede la data di inizio';
      const campi = {
        data_inizio,
        data_fine,
        maintenance_organization: c.testo('maintenance_organization', 'Maintenance Organisation', t.maintenance_organization, 200, false),
        location: c.testo('location', 'Location', t.location, 100, false),
      };
      if (!comando.user_ids.length) c.errori.user_ids = 'Selezionare almeno un frequentatore';
      c.verifica();
      let training = dati.training;
      for (const user_id of comando.user_ids) {
        if (!frequenta(comando.corso_id, user_id)) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
        training = sostituisci(training, (x) => x.user_id === user_id && x.corso_id === comando.corso_id, { corso_id: comando.corso_id, user_id, ...campi, ...traccia });
      }
      return { dati: { ...dati, training }, effetti: [] };
    }

    case 'istruttore.crea':
    case 'istruttore.modifica': {
      const i = comando.istruttore;
      const esistente = dati.istruttori.find((x) => x.id === i.id);
      if (comando.tipo === 'istruttore.crea') {
        permesso(dirige || io.ruolo === 'trainee');
        if (esistente) throw new ErroreApp('DUPLICATO', 'Istruttore già presente.');
      } else {
        permesso(dirige, 'Solo il Training Manager o un direttore modificano l’elenco istruttori.');
        if (!esistente) throw new ErroreApp('NON_TROVATO', 'Istruttore non trovato.');
      }
      const c = new Controlli();
      const campi = {
        grado: c.testo('grado', 'Grado', i.grado, 60),
        nome: c.testo('nome', 'Nome', i.nome, 80),
        cognome: c.testo('cognome', 'Cognome', i.cognome, 80),
      };
      c.verifica();
      const doppio = dati.istruttori.find((x) => x.id !== i.id && chiaveIstruttore(x) === chiaveIstruttore(campi));
      if (doppio) throw new ErroreApp('DUPLICATO', `${campi.grado} ${campi.nome} ${campi.cognome} è già nell'elenco istruttori.`);
      const nuovo: Istruttore = esistente ? { ...esistente, ...campi } : { id: i.id, ...campi, created_at: ctx.ora, created_by: io.id };
      return { dati: { ...dati, istruttori: sostituisci(dati.istruttori, (x) => x.id === i.id, nuovo) }, effetti: [] };
    }

    case 'registrazione.salva': {
      const c = corso(comando.registrazione.corso_id);
      const r = validaRegistrazione(comando.registrazione, ctx.oggi, dati.istruttori, c.programma_pratico);
      const esistente = dati.registrazioni.find((x) => x.id === r.id);
      permesso(admin || (io.ruolo === 'trainee' && r.user_id === io.id && (!esistente || esistente.user_id === io.id)));
      if (!frequenta(r.corso_id, r.user_id)) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
      // chi è stato escluso non registra più: la sua situazione resta quella del giorno dell'esclusione
      if (!admin && iscrizione(r.corso_id, r.user_id)?.escluso_il) throw new ErroreApp('PERMESSO_NEGATO', 'Sei fuori dal corso: il logbook non si può più modificare.');
      if (esistente && esistente.corso_id !== r.corso_id) throw new ErroreApp('VINCOLO', 'La registrazione non si può spostare su un altro corso.');
      // l'aeromobile si sceglie fra quelli del corso (una registrazione già salvata conserva il suo)
      if (r.tipo_esecuzione === 'AC' && c.aeromobili.length && !c.aeromobili.includes(r.matricola) && esistente?.matricola !== r.matricola) {
        throw new ErroreApp('VALIDAZIONE', 'Aeromobile non presente fra quelli del corso.', { matricola: 'Scegliere uno degli aeromobili del corso' });
      }
      const nuova: Registrazione = {
        ...r,
        creato_il: esistente?.creato_il ?? ctx.ora,
        creato_da: esistente?.creato_da ?? io.id,
        modificato_il: ctx.ora,
        modificato_da: io.id,
      };
      return { dati: { ...dati, registrazioni: sostituisci(dati.registrazioni, (x) => x.id === r.id, nuova) }, effetti: [] };
    }

    case 'registrazione.elimina': {
      const esistente = dati.registrazioni.find((x) => x.id === comando.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Registrazione già eliminata.');
      permesso(admin || (io.ruolo === 'trainee' && esistente.user_id === io.id && !iscrizione(esistente.corso_id, io.id)?.escluso_il));
      return { dati: { ...dati, registrazioni: dati.registrazioni.filter((x) => x.id !== comando.id) }, effetti: [] };
    }

    case 'lezioni.sostituisci': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore preparano il programma settimanale.');
      const c = corso(comando.corso_id);
      const p = programmaTeorico(c.programma_teorico);
      if (!p) throw new ErroreApp('VINCOLO', 'Il corso non prevede la parte teorica.');
      const v = new Controlli();
      const giorni = new Set(comando.giorni.filter((g) => dataValida(g)));
      if (giorni.size !== comando.giorni.length) v.errori.giorni = 'Giorni non validi';
      for (const l of comando.lezioni) {
        if (!giorni.has(l.data)) v.errori.lezioni = 'Una lezione cade fuori dai giorni indicati';
        if (!TIPI_PERIODO.includes(l.tipo)) v.errori.tipo = 'Tipo di periodo non valido';
        const materia = conMateria(l.tipo) ? materiaDi(p, l.materia) : undefined;
        // a lezione vanno solo i chapter previsti dal syllabus del corso
        if (conMateria(l.tipo) && !materia) v.errori.materia = 'Chapter non previsto dal syllabus del corso';
        if (l.ordine < 0 || l.ordine >= periodiDelGiorno(indiceGiorno(l.data))) v.errori.ordine = 'Periodo fuori dalla giornata';
        // una lezione dura al massimo un'ora (poi c'è la pausa) e si compone a quarti d'ora
        if (!Number.isInteger(l.minuti) || l.minuti < 15 || l.minuti > MINUTI_PERIODO || l.minuti % 15 !== 0) v.errori.minuti = `Durata della lezione non valida: quarti d’ora da 15 a ${MINUTI_PERIODO} minuti`;
        // più lezioni brevi possono dividersi un periodo, senza superare l'ora
        const nelPeriodo = comando.lezioni.filter((x) => x.data === l.data && x.ordine === l.ordine).reduce((s, x) => s + x.minuti, 0);
        if (nelPeriodo > MINUTI_PERIODO) v.errori.periodo = `Le lezioni di un periodo non possono superare ${MINUTI_PERIODO} minuti in tutto`;
        if ((l.aula ?? '').trim().length > 40) v.errori.aula = 'Aula: massimo 40 caratteri';
        if (l.istruttore_id && conIstruttore(l.tipo)) {
          if (!istruttore(l.istruttore_id)) v.errori.istruttore = 'Istruttore non trovato';
          // la lezione di un chapter la tiene solo chi è abilitato a quel chapter per il mezzo del corso
          else if (materia && !dati.abilitazioni.some((a) => a.user_id === l.istruttore_id && a.mds === c.mds && a.chapter === materia.chapter)) {
            v.errori.istruttore = `Istruttore non abilitato al chapter ${materia.chapter} del ${c.mds}`;
          }
        }
        if ((l.persona ?? '').trim().length > 80) v.errori.persona = 'Persona di riferimento: massimo 80 caratteri';
        // la lezione di recupero è per i frequentatori scelti: solo a loro scala le assenze
        if (l.tipo === 'recupero') {
          if (!(l.frequentatori ?? []).length) v.errori.frequentatori = 'Lezione di recupero: scegliere i frequentatori a cui è destinata';
          else if (l.frequentatori.some((id) => !frequentaIl(comando.corso_id, id, l.data))) v.errori.frequentatori = 'Lezione di recupero: un frequentatore scelto non fa parte del corso';
        }
      }
      v.verifica();
      const restanti = dati.lezioni.filter((l) => l.corso_id !== comando.corso_id || !giorni.has(l.data));
      // dopo ogni modifica la settimana torna da validare: i frequentatori vedono solo i programmi validati
      // dentro ogni periodo le lezioni si numerano di seguito, nell'ordine indicato
      const ordinate = inOrdine(comando.lezioni.map((l) => ({ ...l, parte: Number(l.parte) || 0 })));
      const nuove: Lezione[] = ordinate.map((l, i) => ({
        ...l,
        parte: ordinate.slice(0, i).filter((x) => x.data === l.data && x.ordine === l.ordine).length,
        materia: conMateria(l.tipo) ? l.materia : '',
        // la sospensione è una cella sbarrata: niente istruttore, aula o note
        istruttore_id: conIstruttore(l.tipo) ? l.istruttore_id : null,
        persona: conPersona(l.tipo) && !l.istruttore_id ? (l.persona ?? '').trim() : '',
        frequentatori: l.tipo === 'recupero' ? [...new Set(l.frequentatori)] : [],
        aula: conIstruttore(l.tipo) ? (l.aula ?? '').trim() : '',
        validata: false,
        validata_da: null,
        validata_il: null,
        note: conIstruttore(l.tipo) ? (l.note ?? '').slice(0, 300) : '',
        creato_il: dati.lezioni.find((x) => x.id === l.id)?.creato_il ?? ctx.ora,
        modificato_il: ctx.ora,
        modificato_da: io.id,
      }));
      return { dati: { ...dati, lezioni: [...restanti, ...nuove] }, effetti: [] };
    }

    case 'settimana.valida': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore validano il programma.');
      corso(comando.corso_id);
      const giorni = new Set(comando.giorni);
      const coinvolte = dati.lezioni.filter((l) => l.corso_id === comando.corso_id && giorni.has(l.data));
      if (!coinvolte.length) throw new ErroreApp('VINCOLO', 'Nessuna lezione da validare in questi giorni.');
      const validate = comando.valida ? { validata: true, validata_da: io.id, validata_il: ctx.ora } : { validata: false, validata_da: null, validata_il: null };
      return { dati: { ...dati, lezioni: dati.lezioni.map((l) => (coinvolte.includes(l) ? { ...l, ...validate } : l)) }, effetti: [] };
    }

    case 'rapportino.salva': {
      const c = corso(comando.corso_id);
      const mio = ruoloNelCorso(dati, io, comando.corso_id);
      // il rapportino lo compila chiunque frequenti il corso, per tutti i frequentatori
      permesso(admin || mio === 'direttore' || mio === 'trainee' || mio === 'instructor', 'Solo chi partecipa al corso compila il rapportino.');
      if (!c.programma_teorico) throw new ErroreApp('VINCOLO', 'Il corso non prevede la parte teorica.');
      const esistente = dati.rapportini.find((r) => r.corso_id === comando.corso_id && r.data === comando.data);
      if (esistente?.validato_il && !guida(comando.corso_id)) {
        throw new ErroreApp('VINCOLO', 'Rapportino già validato: chiederne la riapertura al direttore del corso.');
      }
      const v = new Controlli();
      const data = v.data('data', 'Data', comando.data, true, ctx.oggi) ?? '';
      const note = v.testo('note', 'Note', comando.note, 300, false);
      const orario = (campo: string, valore: string | null | undefined) => {
        const t = (valore ?? '').trim();
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) v.errori[campo] = 'Orario non valido (es. 08:30)';
        return t;
      };
      const presenze: Presenza[] = comando.presenze.map((p) => {
        // chi è stato escluso non rientra più nelle presenze dal giorno dell'esclusione
        if (!frequentaIl(comando.corso_id, p.user_id, comando.data)) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso in quel giorno.');
        const stato: StatoPresenza = p.stato === 'assente' || p.stato === 'parziale' ? p.stato : 'presente';
        const parziale = stato === 'parziale';
        const dalle = parziale ? orario(`dalle_${p.user_id}`, p.dalle) : null;
        const alle = parziale ? orario(`alle_${p.user_id}`, p.alle) : null;
        if (parziale && dalle && alle && alle <= dalle) v.errori[`alle_${p.user_id}`] = 'L’orario di uscita precede quello di ingresso';
        return {
          id: p.id,
          corso_id: comando.corso_id,
          data: comando.data,
          user_id: p.user_id,
          stato,
          dalle,
          alle,
          motivo: stato === 'presente' ? '' : v.testo(`motivo_${p.user_id}`, 'Motivo', p.motivo, 200, false),
        };
      });
      if (new Set(presenze.map((p) => p.user_id)).size !== presenze.length) v.errori.presenze = 'Frequentatore indicato due volte';
      v.verifica();
      const rapportino: Rapportino = {
        ...(esistente ?? { id: `${comando.corso_id}|${data}`, corso_id: comando.corso_id, data, validato_da: null, validato_il: null }),
        note,
        compilato_da: io.id,
        compilato_il: ctx.ora,
      };
      const altre = dati.presenze.filter((p) => p.corso_id !== comando.corso_id || p.data !== data);
      return {
        dati: { ...dati, rapportini: sostituisci(dati.rapportini, (r) => r.id === rapportino.id, rapportino), presenze: [...altre, ...presenze] },
        effetti: [],
      };
    }

    case 'rapportino.valida': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore validano il rapportino.');
      const esistente = dati.rapportini.find((r) => r.corso_id === comando.corso_id && r.data === comando.data);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Rapportino non ancora compilato.');
      const nuovo: Rapportino = comando.valida
        ? { ...esistente, validato_da: io.id, validato_il: ctx.ora }
        : { ...esistente, validato_da: null, validato_il: null };
      return { dati: { ...dati, rapportini: sostituisci(dati.rapportini, (r) => r.id === nuovo.id, nuovo) }, effetti: [] };
    }

    case 'lezione.modifica': {
      const esistente = dati.lezioni.find((x) => x.id === comando.lezione.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Lezione non trovata.');
      permesso(guida(esistente.corso_id), 'Solo il Training Manager o il direttore modificano le lezioni.');
      const istruttore_id = comando.lezione.istruttore_id;
      if (istruttore_id && !istruttore(istruttore_id)) throw new ErroreApp('VALIDAZIONE', 'Istruttore non trovato.');
      const nuova: Lezione = { ...esistente, istruttore_id, note: (comando.lezione.note ?? '').slice(0, 300), modificato_il: ctx.ora, modificato_da: io.id };
      return { dati: { ...dati, lezioni: sostituisci(dati.lezioni, (x) => x.id === nuova.id, nuova) }, effetti: [] };
    }

    case 'abilitazioni.imposta':
    case 'abilitazioni.importa': {
      // i chapter valgono per il mezzo, in tutte le categorie: li assegna solo il Training Manager
      permesso(admin, 'Solo il Training Manager assegna i chapter agli istruttori.');
      let abilitazioni = dati.abilitazioni;
      for (const r of comando.tipo === 'abilitazioni.importa' ? comando.righe : [comando]) {
        if (!mdsDi(r.mds)) throw new ErroreApp('NON_TROVATO', `Mezzo non previsto: ${r.mds}.`);
        if (!istruttore(r.user_id)) throw new ErroreApp('NON_TROVATO', 'Istruttore non trovato.');
        const previsti = new Set(chapterDelMds(r.mds).map((x) => x.chapter));
        const nuove: Abilitazione[] = [...new Set(r.chapters)].filter((ch) => previsti.has(ch)).map((chapter) => ({ id: `${r.user_id}|${r.mds}|${chapter}`, user_id: r.user_id, mds: r.mds, chapter }));
        abilitazioni = [...abilitazioni.filter((a) => a.user_id !== r.user_id || a.mds !== r.mds), ...nuove];
      }
      return { dati: { ...dati, abilitazioni }, effetti: [] };
    }

    case 'certificato.salva': {
      permesso(admin, 'Solo il Training Manager tiene il registro dei certificati.');
      const c = comando.certificato;
      const esistente = dati.certificati.find((x) => x.id === c.id);
      corso(c.corso_id);
      if (!frequenta(c.corso_id, c.user_id)) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
      const v = new Controlli();
      if (!TIPI_CERTIFICATO.includes(c.tipo)) v.errori.tipo = 'Tipo di certificato non valido';
      if (!STATI_CERTIFICATO.includes(c.stato)) v.errori.stato = 'Stato non valido';
      if (!ESITI_PROVA.includes(c.esame_esito)) v.errori.esame_esito = 'Esito dell’esame non valido';
      if (!ESITI_PROVA.includes(c.pratica_esito)) v.errori.pratica_esito = 'Esito della valutazione pratica non valido';
      const anno = Math.trunc(Number(c.anno));
      if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) v.errori.anno = 'Anno non valido';
      const numero = Math.trunc(Number(c.numero)) || prossimoNumero(dati, anno);
      if (numero < 1 || numero > 9999) v.errori.numero = 'Numero non valido';
      else if (dati.certificati.some((x) => x.id !== c.id && x.anno === anno && x.numero === numero)) v.errori.numero = `Il numero ${numero}/${anno} è già nel registro`;
      const data_inizio = v.data('data_inizio', 'Data di inizio', c.data_inizio, false);
      const data_fine = v.data('data_fine', 'Data di fine', c.data_fine, false);
      if (data_inizio && data_fine && data_fine < data_inizio) v.errori.data_fine = 'La data di fine precede la data di inizio';
      const data_rilascio = v.data('data_rilascio', 'Data di rilascio', c.data_rilascio, c.stato === 'rilasciato', ctx.oggi);
      const ore = Number(c.ore);
      if (!Number.isFinite(ore) || ore < 0 || ore > 2000) v.errori.ore = 'Ore non valide';
      const nuovo: Certificato = {
        ...c,
        numero,
        anno,
        mds: v.testo('mds', 'MDS', c.mds, 30, false),
        categoria: v.testo('categoria', 'Categoria', c.categoria, 10, false),
        programma: v.testo('programma', 'Programma', c.programma, 300, false),
        data_inizio,
        data_fine,
        ore: Math.round(ore),
        esame_data: v.data('esame_data', 'Data dell’esame teorico', c.esame_data, false, ctx.oggi),
        pratica_data: v.data('pratica_data', 'Data della valutazione pratica', c.pratica_data, false, ctx.oggi),
        data_rilascio,
        luogo_rilascio: v.testo('luogo_rilascio', 'Luogo di rilascio', c.luogo_rilascio, 100, c.stato === 'rilasciato'),
        organizzazione: v.testo('organizzazione', 'Maintenance Organisation', c.organizzazione, 200, false),
        note: v.testo('note', 'Note', c.note, 300, false),
        creato_il: esistente?.creato_il ?? ctx.ora,
        creato_da: esistente?.creato_da ?? io.id,
        modificato_il: ctx.ora,
        modificato_da: io.id,
      };
      v.verifica();
      return { dati: { ...dati, certificati: sostituisci(dati.certificati, (x) => x.id === c.id, nuovo) }, effetti: [] };
    }

    case 'certificato.elimina': {
      permesso(admin, 'Solo il Training Manager tiene il registro dei certificati.');
      const esistente = dati.certificati.find((x) => x.id === comando.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Certificato non trovato.');
      if (esistente.stato === 'rilasciato') throw new ErroreApp('VINCOLO', 'Un certificato rilasciato non si cancella: annullarlo.');
      return { dati: { ...dati, certificati: dati.certificati.filter((x) => x.id !== comando.id) }, effetti: [] };
    }

    case 'utente.crea': {
      permesso(admin, 'Solo il Training Manager crea gli account.');
      const u = comando.utente;
      const c = new Controlli();
      const username = u.username.trim().toLowerCase();
      if (!RE_USERNAME.test(username)) c.errori.username = 'Username: 3-40 caratteri tra lettere minuscole, cifre, punto e trattini';
      else if (dati.utenti.some((x) => x.username === username)) c.errori.username = `Lo username "${username}" è già in uso`;
      const staff = u.ruolo !== 'trainee';
      const grado = c.testo('grado', 'Grado', u.grado, 60, staff);
      const nome = c.testo('nome', 'Nome', u.nome, 100, staff);
      const cognome = c.testo('cognome', 'Cognome', u.cognome, 80, staff);
      const problema = errorePassword(comando.password);
      if (problema) c.errori.password = problema;
      if (!['admin', 'instructor', 'trainee'].includes(u.ruolo)) c.errori.ruolo = 'Ruolo non valido';
      if (u.istruttore_id && !dati.istruttori.some((i) => i.id === u.istruttore_id)) c.errori.istruttore_id = 'Istruttore non trovato';
      c.verifica();
      const nuovo: Utente = {
        id: u.id,
        username,
        ruolo: u.ruolo,
        grado,
        nome,
        cognome,
        istruttore_id: u.ruolo === 'instructor' ? u.istruttore_id : null,
        attivo: true,
        deve_cambiare_password: true,
        created_at: ctx.ora,
        updated_at: ctx.ora,
      };
      return {
        dati: { ...dati, utenti: [...dati.utenti, nuovo] },
        effetti: [{ tipo: 'credenziali.imposta', username, password: comando.password, admin: u.ruolo === 'admin' }],
      };
    }

    case 'utente.modifica': {
      permesso(admin, 'Solo il Training Manager modifica gli account.');
      const u = comando.utente;
      const esistente = dati.utenti.find((x) => x.id === u.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Account non trovato.');
      if (esistente.id === io.id && !u.attivo) throw new ErroreApp('VINCOLO', 'Non puoi disattivare il tuo stesso account.');
      const c = new Controlli();
      const staff = esistente.ruolo !== 'trainee';
      const grado = c.testo('grado', 'Grado', u.grado, 60, staff);
      const nome = c.testo('nome', 'Nome', u.nome, 100, staff);
      const cognome = c.testo('cognome', 'Cognome', u.cognome, 80, staff);
      if (comando.password != null) {
        const problema = errorePassword(comando.password);
        if (problema) c.errori.password = problema;
      } else if (u.attivo && !esistente.attivo) {
        c.errori.password = 'Per riattivare l’account indicare una nuova password provvisoria';
      }
      if (u.istruttore_id && !dati.istruttori.some((i) => i.id === u.istruttore_id)) c.errori.istruttore_id = 'Istruttore non trovato';
      c.verifica();
      const nuovo: Utente = {
        ...esistente,
        grado,
        nome,
        cognome,
        attivo: u.attivo,
        istruttore_id: esistente.ruolo === 'instructor' ? u.istruttore_id : null,
        deve_cambiare_password: comando.password != null ? true : esistente.deve_cambiare_password,
        updated_at: ctx.ora,
      };
      const effetti: Effetto[] = !u.attivo
        ? [{ tipo: 'credenziali.rimuovi', username: esistente.username }]
        : comando.password != null
          ? [{ tipo: 'credenziali.imposta', username: esistente.username, password: comando.password, admin: esistente.ruolo === 'admin' }]
          : [];
      return { dati: { ...dati, utenti: dati.utenti.map((x) => (x.id === u.id ? nuovo : x)) }, effetti };
    }

    case 'utente.passwordCambiata':
      return {
        dati: { ...dati, utenti: dati.utenti.map((x) => (x.id === io.id ? { ...x, deve_cambiare_password: false, updated_at: ctx.ora } : x)) },
        effetti: [],
      };
  }
}
