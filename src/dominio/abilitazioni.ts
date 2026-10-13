import type { CampiAbilitazioni } from './motore';
import { MDS, chapterDelMds } from './programmi';
import type { Dati, Utente } from './tipi';

/**
 * Lettura dell'Excel delle abilitazioni (cartella `modelli`): una tabella con l'istruttore, il mezzo (MDS)
 * e i chapter che può erogare. Le colonne si riconoscono dall'intestazione, in qualunque ordine:
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

export function leggiAbilitazioni(tabella: readonly string[][], dati: Dati): LetturaAbilitazioni {
  const colonna = (riga: readonly string[], ...nomi: RegExp[]) => riga.findIndex((c) => nomi.some((n) => n.test(piano(c))));
  const iTesta = tabella.findIndex((r) => colonna(r, /^(mds|mezzo|aeromobile)/) >= 0 && colonna(r, /^(chapter|ch|ata|capitol)/) >= 0);
  if (iTesta < 0) return { righe: [], scartate: ['Intestazione non riconosciuta: servono le colonne dell’istruttore, «MDS» e «Chapter».'] };
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
          const trovato = previsti.find((p) => compatto(p) === compatto(x) || compatto(p) === compatto(x.padStart(2, '0')));
          if (!trovato) scarta(`chapter «${x}» non previsto dal syllabus del ${mds}`);
          return trovato ? [trovato] : [];
        });
    const chiave = `${utente.id}|${mds}`;
    const voce = raccolte.get(chiave) ?? { user_id: utente.id, mds, chapters: [] };
    raccolte.set(chiave, { ...voce, chapters: [...new Set([...voce.chapters, ...chapters])] });
  });
  return { righe: [...raccolte.values()].filter((r) => r.chapters.length), scartate };
}
