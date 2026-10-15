import type { CampiAbilitazioni } from './motore';
import { MDS, chapterDelMds } from './programmi';
import type { Dati, Utente } from './tipi';

/**
 * Lettura dell'Excel delle abilitazioni (cartella `modelli`, es. «Conferimenti.xlsx») in due forme.
 *
 * A matrice, un foglio per mezzo (il nome del foglio è l'MDS): una riga per chapter («ATA CH.») e una colonna per
 * istruttore («1° Lgt. ROSSI Mario»), con una «X» dove l'istruttore ha il conferimento della materia.
 *
 * A elenco: una tabella con l'istruttore, il mezzo (MDS) e i chapter che può erogare. Le colonne si riconoscono
 * dall'intestazione, in qualunque ordine:
 * - istruttore: «Username», oppure «Istruttore»/«Nominativo», oppure «Cognome» e «Nome» separati;
 * - mezzo: «MDS» (anche «Mezzo» o «Aeromobile»);
 * - chapter: «Chapter» (anche «Ch», «ATA» o «Capitoli»), uno per riga oppure più d'uno separati da virgola;
 *   «tutti» vale per l'intero mezzo.
 */

export interface LetturaAbilitazioni {
  /** Chapter per istruttore e mezzo: sostituiscono quelli che l'istruttore aveva per quel mezzo. */
  righe: CampiAbilitazioni[];
  /** Righe del file che non si sono potute usare, con il motivo. */
  scartate: string[];
  /** Istruttori del file senza un account: si possono creare, poi la lettura si ripete. */
  mancanti: IstruttoreMancante[];
}

export interface IstruttoreMancante {
  /** Come è scritto nel file, es. «1° Lgt. ROSSI Mario». */
  intestazione: string;
  grado: string;
  nome: string;
  cognome: string;
}

/** Username per un nuovo account: «nome.cognome», senza accenti né spazi, diverso da quelli già usati. */
export function usernameDa(nome: string, cognome: string, usati: Iterable<string>): string {
  const base = `${compatto(nome)}.${compatto(cognome)}`.slice(0, 36);
  const occupati = new Set(usati);
  let candidato = base;
  for (let n = 2; occupati.has(candidato); n++) candidato = `${base}${n}`;
  return candidato;
}

/** Gradi scritti in maiuscolo, da non scambiare per cognomi. */
const GRADI_MAIUSCOLI = new Set(['SMA', 'SMC', 'SMB', 'SMG', 'SM', 'CM', 'CMS', 'CMCS']);

/** «1° Lgt. ROSSI Mario» → grado, cognome in maiuscolo, nome; null se non si riconosce il cognome. */
export function scomponiNominativo(testo: string): Omit<IstruttoreMancante, 'intestazione'> | null {
  const parole = testo.trim().split(/\s+/);
  let i = parole.length;
  while (i > 0 && !/^\p{Lu}[\p{Lu}'-]+$/u.test(parole[i - 1])) i--; // nome: dopo l'ultima parola in maiuscolo
  const fineCognome = i;
  while (i > 0 && /^\p{Lu}[\p{Lu}'-]+$/u.test(parole[i - 1]) && !GRADI_MAIUSCOLI.has(parole[i - 1])) i--;
  if (i === fineCognome || fineCognome === parole.length) return null;
  return { grado: parole.slice(0, i).join(' '), cognome: parole.slice(i, fineCognome).join(' '), nome: parole.slice(fineCognome).join(' ') };
}

/** Confronto senza maiuscole, accenti, punteggiatura e spazi doppi. */
const piano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const compatto = (s: string) => piano(s).replace(/ /g, '');

/** Istruttore indicato nel file: per username, oppure per nominativo in qualunque ordine. */
function trovaIstruttore(istruttori: readonly Utente[], testo: string): Utente | undefined {
  const cercato = piano(testo);
  if (!cercato) return undefined;
  const per = (chiave: (u: Utente) => string) => {
    const trovati = istruttori.filter((u) => piano(chiave(u)) === cercato);
    return trovati.length === 1 ? trovati[0] : undefined;
  };
  return (
    per((u) => u.username) ??
    per((u) => `${u.cognome} ${u.nome}`) ??
    per((u) => `${u.nome} ${u.cognome}`) ??
    per((u) => `${u.grado} ${u.cognome} ${u.nome}`) ??
    per((u) => `${u.grado} ${u.nome} ${u.cognome}`) ??
    per((u) => u.cognome)
  );
}

const colonna = (riga: readonly string[], ...nomi: RegExp[]) => riga.findIndex((c) => nomi.some((n) => n.test(piano(c))));
const COLONNA_CHAPTER = /^(chapter|ch|ata|capitol)/;
/** Colonne della matrice che non sono istruttori. */
const DESCRITTIVE = /^(item|n|nr|num|modulo|module|mod|ata|ch|chapter|capitol|subject|materia|titolo|argomento|ore|minuti|min|livello|level)\b/;

/** Chapter scritto nel file (anche «5» o «AVES 1a» su due righe) fra quelli previsti dal syllabus del mezzo. */
const chapterPrevisto = (previsti: readonly string[], scritto: string) => {
  const x = scritto.replace(/\s+/g, ' ').trim();
  return previsti.find((p) => compatto(p) === compatto(x) || compatto(p) === compatto(x.padStart(2, '0')));
};

/** Tutti i fogli del file: quelli a matrice prendono il mezzo dal nome del foglio. */
export function leggiFogli(fogli: readonly { nome: string; righe: string[][] }[], dati: Dati): LetturaAbilitazioni {
  const unite = new Map<string, CampiAbilitazioni>();
  const mancanti = new Map<string, IstruttoreMancante>();
  const scartate: string[] = [];
  for (const f of fogli) {
    const l = leggiAbilitazioni(f.righe, dati, f.nome);
    for (const r of l.righe) {
      const chiave = `${r.user_id}|${r.mds}`;
      unite.set(chiave, { ...r, chapters: [...new Set([...(unite.get(chiave)?.chapters ?? []), ...r.chapters])] });
    }
    for (const m of l.mancanti) mancanti.set(piano(m.intestazione), m);
    scartate.push(...l.scartate.map((x) => (fogli.length > 1 ? `Foglio «${f.nome}», ${x.replace(/^./, (c) => c.toLowerCase())}` : x)));
  }
  return { righe: [...unite.values()], scartate, mancanti: [...mancanti.values()] };
}

/** Matrice chapter × istruttori di un mezzo, con una «X» per ogni conferimento. */
function leggiMatrice(tabella: readonly string[][], dati: Dati, mds: string): LetturaAbilitazioni | null {
  const iTesta = tabella.findIndex((r) => colonna(r, COLONNA_CHAPTER) >= 0);
  if (iTesta < 0) return null;
  const testa = tabella[iTesta];
  const iChapter = colonna(testa, COLONNA_CHAPTER);
  const colonneIstruttori = testa.flatMap((t, j) => (t && !DESCRITTIVE.test(piano(t)) ? [j] : []));
  if (!colonneIstruttori.length) return null;
  const istruttori = dati.utenti.filter((u) => u.ruolo === 'instructor');
  const previsti = chapterDelMds(mds).map((x) => x.chapter);
  const righe: CampiAbilitazioni[] = [];
  const scartate: string[] = [];
  const mancanti: IstruttoreMancante[] = [];
  const conferite = (j: number) =>
    tabella.slice(iTesta + 1).flatMap((r, i) => {
      if (!/^(x|si|sì|✓|✔|1)$/i.test((r[j] ?? '').trim())) return [];
      const trovato = chapterPrevisto(previsti, r[iChapter] ?? '');
      if (!trovato) scartate.push(`Riga ${iTesta + i + 2}: chapter «${r[iChapter] ?? ''}» non previsto dal syllabus del ${mds}`);
      return trovato ? [trovato] : [];
    });
  for (const j of colonneIstruttori) {
    const chapters = [...new Set(conferite(j))];
    if (!chapters.length) continue;
    const utente = trovaIstruttore(istruttori, testa[j]);
    if (utente) {
      righe.push({ user_id: utente.id, mds, chapters });
      continue;
    }
    const parti = scomponiNominativo(testa[j]);
    if (parti) mancanti.push({ intestazione: testa[j], ...parti });
    else scartate.push(`Colonna «${testa[j]}»: nominativo non riconosciuto (serve «Grado COGNOME Nome»)`);
  }
  return { righe, scartate: [...new Set(scartate)], mancanti };
}

export function leggiAbilitazioni(tabella: readonly string[][], dati: Dati, nomeFoglio = ''): LetturaAbilitazioni {
  const iTesta = tabella.findIndex((r) => colonna(r, /^(mds|mezzo|aeromobile)/) >= 0 && colonna(r, COLONNA_CHAPTER) >= 0);
  if (iTesta < 0) {
    const mds = MDS.find((m) => compatto(m.codice) === compatto(nomeFoglio))?.codice;
    const matrice = mds ? leggiMatrice(tabella, dati, mds) : null;
    if (matrice) return matrice;
    return {
      righe: [],
      scartate: [
        nomeFoglio && !mds
          ? `Foglio ignorato: il nome non è un mezzo (${MDS.map((m) => m.codice).join(', ')}) e non c’è la colonna «MDS».`
          : 'Intestazione non riconosciuta: servono le colonne dell’istruttore, «MDS» e «Chapter».',
      ],
      mancanti: [],
    };
  }
  const testa = tabella[iTesta];
  const col = {
    username: colonna(testa, /^(username|utente|account)/),
    nominativo: colonna(testa, /^(istruttore|nominativo|grado cognome|cognome e nome|cognome nome)/),
    cognome: colonna(testa, /^cognome$/),
    nome: colonna(testa, /^nome$/),
    mds: colonna(testa, /^(mds|mezzo|aeromobile)/),
    chapter: colonna(testa, /^(chapter|ch|ata|capitol)/),
  };
  const istruttori = dati.utenti.filter((u) => u.ruolo === 'instructor');
  const raccolte = new Map<string, CampiAbilitazioni>();
  const scartate: string[] = [];
  // nelle tabelle con celle unite istruttore e mezzo compaiono solo sulla prima riga del gruppo
  let ultimo = { chi: '', mds: '' };

  tabella.slice(iTesta + 1).forEach((r, i) => {
    const cella = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const chi = cella(col.username) || cella(col.nominativo) || [cella(col.cognome), cella(col.nome)].filter(Boolean).join(' ') || ultimo.chi;
    const mdsScritto = cella(col.mds) || ultimo.mds;
    ultimo = { chi, mds: mdsScritto };
    const scarta = (motivo: string) => scartate.push(`Riga ${iTesta + i + 2}: ${motivo}`);
    const utente = trovaIstruttore(istruttori, chi);
    if (!utente) return scarta(chi ? `istruttore «${chi}» non trovato fra gli account` : 'manca l’istruttore');
    const mds = MDS.find((m) => compatto(m.codice) === compatto(mdsScritto))?.codice;
    if (!mds) return scarta(`mezzo «${mdsScritto}» non previsto`);
    const previsti = chapterDelMds(mds).map((x) => x.chapter);
    const scritti = cella(col.chapter).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    const chapters = scritti.some((x) => /^(tutti|all|\*)$/i.test(x))
      ? previsti
      : scritti.flatMap((x) => {
          // "5" e "05" sono lo stesso chapter; "aves 2a" vale "AVES 2a"
          const trovato = chapterPrevisto(previsti, x);
          if (!trovato) scarta(`chapter «${x}» non previsto dal syllabus del ${mds}`);
          return trovato ? [trovato] : [];
        });
    const chiave = `${utente.id}|${mds}`;
    const voce = raccolte.get(chiave) ?? { user_id: utente.id, mds, chapters: [] };
    raccolte.set(chiave, { ...voce, chapters: [...new Set([...voce.chapters, ...chapters])] });
  });
  return { righe: [...raccolte.values()].filter((r) => r.chapters.length), scartate, mancanti: [] };
}
