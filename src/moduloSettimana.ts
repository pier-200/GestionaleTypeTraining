import { strFromU8, strToU8 } from 'fflate';
import { giorniSettimana, inOrdine, orariLezioni, orarioPeriodo, periodiDelGiorno, settimanaDiCorso } from './dominio/pianificazione';
import { programmaTeorico } from './dominio/programmi';
import type { Backend } from './backend/tipi';
import type { CampiLezione } from './dominio/motore';
import { SIGLA_PERIODO, type Corso, type Dati } from './dominio/tipi';
import { contenutoLezione, fineCorso, formatoDataBreve, frequentatori, nomeDirettore, nomeModulo, riferimentoLezione } from './dominio/viste';
import { pulisciNome, scarica } from './esporta';
import { apriXlsx, chiudiXlsx, senzaMetadati, type Parti } from './xlsx';

/**
 * Programma settimanale sul modulo ufficiale: il foglio è quello di `Programma settimanale.xlsx` dei modelli
 * e si scrivono solo i valori nelle celle, che conservano stile, unioni e impostazione di stampa.
 * Quando più lezioni si dividono un periodo la tabella prende una riga in più per ciascuna e il resto
 * del modulo scende. Da Excel si stampa in PDF così com'è, su una pagina A4.
 */

/** Il modulo, nella cartella `modelli` del repository privato dei dati (lo legge solo chi accede). */
export const MODELLO_SETTIMANA = 'Programma settimanale.xlsx';

type Valore = string | number | null;
/** Una riga della tabella delle lezioni. */
export type RigaLezione = [orario: string, addestramento: Valore, codice: Valore, istruttore: Valore, aula: Valore];

const FOGLIO = 'xl/worksheets/sheet1.xml';
const CARTELLA = 'xl/workbook.xml';
const STILI = 'xl/styles.xml';
const STRINGHE = 'xl/sharedStrings.xml';
const NOME_FOGLIO = 'SETTIMANA';

/**
 * Prepara il modulo originale alla compilazione: via i dati di chi lo ha scritto e le convalide rimaste
 * senza elenco, testi dentro le celle (così se ne sostituisce una alla volta), celle a riga singola che
 * rimpiccioliscono un testo lungo invece di tagliarlo.
 */
function preparaModello(originale: Parti): Parti {
  const parti = senzaMetadati(originale);
  const leggi = (nome: string) => (parti[nome] ? strFromU8(parti[nome]) : '');
  const stringhe = [...leggi(STRINGHE).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) => [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
  parti[FOGLIO] = strToU8(
    leggi(FOGLIO)
      .replace(/ t="s"><v>(\d+)<\/v>/g, (_, i: string) => ` t="inlineStr"><is><t xml:space="preserve">${stringhe[Number(i)]}</t></is>`)
      .replace(/<extLst>[\s\S]*?<\/extLst>/g, '')
      // nell'originale l'ottava riga dei frequentatori non ha il numero
      .replace(/<c r="A54" s="(\d+)"\/>/, '<c r="A54" s="$1"><v>8</v></c>'),
  );
  parti[STILI] = strToU8(leggi(STILI).replace(/<alignment (?![^>]*wrapText)/g, '<alignment shrinkToFit="1" '));
  return parti;
}

/** Prima e ultima riga di ciascun giorno nel modulo, da lunedì a venerdì. */
const RIGHE_GIORNO = [
  [11, 17],
  [18, 24],
  [25, 31],
  [32, 38],
  [39, 41],
];
const PRIMA_RIGA_LEZIONI = 11;
const ULTIMA_RIGA_LEZIONI = 41;
const ULTIMA_RIGA = 63;
/** Dopo quattro periodi il modulo ha la riga della pausa pranzo. */
const PERIODI_DEL_MATTINO = 4;
/** Righe che stanno in una pagina alla scala del modulo: oltre, la stampa si riduce per restare in un foglio. */
const RIGHE_IN_PAGINA = 66;
const SIGLA_GIORNO = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
/** Elenco dei frequentatori: due colonne da 8 righe a partire da questa. */
const RIGA_FREQUENTATORI = 47;
const POSTI_FREQUENTATORI = 16;
const BARRATO = '////';

/** Data come la conserva Excel: giorni dal 30/12/1899. */
const seriale = (iso: string | null) => (iso ? Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25569 : null);
const settimane = (n: number | null) => (n ? `${n} settiman${n === 1 ? 'a' : 'e'}` : null);

/** Celle a posizione fissa: intestazione, direttore, frequentatori e gruppo firma. */
export function celleFisse(dati: Dati, corso: Corso, lunedi: string): Record<string, Valore> {
  // chi è stato escluso prima di questa settimana non è più nel programma
  const allievi = frequentatori(dati, corso.id, { al: lunedi });
  // ponytail: il modulo ha 16 righe fisse; oltre servirebbe un secondo foglio, da aggiungere se mai capita un corso più numeroso
  if (allievi.length > POSTI_FREQUENTATORI) throw new Error(`Il modulo ha ${POSTI_FREQUENTATORI} righe per i frequentatori: il corso ne ha ${allievi.length}.`);
  const { numero, ritardo } = settimanaDiCorso(corso, lunedi);
  const celle: Record<string, Valore> = {
    C6: corso.codice,
    H6: numero,
    C7: seriale(corso.data_inizio),
    H7: seriale(fineCorso(corso)),
    C8: settimane(corso.durata_settimane),
    H8: settimane(ritardo),
    C43: nomeDirettore(dati, corso, true),
    F58: corso.gruppo_firma,
  };
  for (let i = 0; i < POSTI_FREQUENTATORI; i++) {
    const riga = RIGA_FREQUENTATORI + (i % 8);
    const [nome, ente] = i < 8 ? ['B', 'D'] : ['G', 'I'];
    const u = allievi[i];
    celle[`${nome}${riga}`] = u ? nomeModulo(dati, u.id) || u.username : null;
    celle[`${ente}${riga}`] = u ? (dati.anagrafiche.find((a) => a.user_id === u.id)?.ente ?? null) : null;
  }
  return celle;
}

/**
 * Righe della tabella, per giorno e per periodo: una per lezione (le lezioni che si dividono un periodo
 * hanno ciascuna la sua, con il proprio orario), una vuota per i periodi liberi.
 */
export function righeSettimana(dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]): RigaLezione[][][] {
  const programma = programmaTeorico(corso.programma_teorico);
  if (!programma) throw new Error('Il corso non prevede la parte teorica.');
  const orari = orariLezioni(lezioni);
  const intervallo = (o: { inizio: string; fine: string }) => `${o.inizio}-${o.fine}`;
  return giorniSettimana(lunedi).map((data, g) =>
    Array.from({ length: periodiDelGiorno(g) }, (_, ordine): RigaLezione[] => {
      const delPeriodo = inOrdine(lezioni.filter((l) => l.data === data && l.ordine === ordine));
      if (!delPeriodo.length) return [[intervallo(orarioPeriodo(ordine)), null, null, null, null]];
      return delPeriodo.map((l) => {
        // chapter della lezione: il suo numero va in COD., il suo titolo in ADDESTRAMENTO; le altre attività hanno il loro codice
        const { chapter, titolo } = contenutoLezione(programma, l);
        const sospesa = l.tipo === 'sospensione';
        const codice = chapter ?? SIGLA_PERIODO[l.tipo];
        return [
          intervallo(orari.get(l.id)!),
          `${titolo}${l.tipo === 'recupero' ? ' (recupero)' : ''}`,
          // numero se Excel lo riscrive uguale ("34"), testo altrimenti ("05", "32A", "AVES 1")
          /^[1-9]\d*$/.test(codice) ? Number(codice) : codice,
          riferimentoLezione(dati, l),
          sospesa ? BARRATO : l.aula || corso.aula,
        ];
      });
    }),
  );
}

const testoXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Scrive i valori nelle celle indicate: ogni cella conserva il proprio stile. */
export function compilaFoglio(foglio: string, celle: Record<string, Valore>): string {
  for (const [cella, v] of Object.entries(celle)) {
    let trovata = false;
    foglio = foglio.replace(new RegExp(`<c r="${cella}"( s="\\d+")?[^>]*?(?:/>|>[\\s\\S]*?</c>)`), (_, stile: string = '') => {
      trovata = true;
      const testa = `<c r="${cella}"${stile}`;
      if (v == null || v === '') return `${testa}/>`;
      return typeof v === 'number' ? `${testa}><v>${v}</v></c>` : `${testa} t="inlineStr"><is><t xml:space="preserve">${testoXml(v)}</t></is></c>`;
    });
    if (!trovata) throw new Error(`Modulo del programma settimanale non riconosciuto: manca la cella ${cella}.`);
  }
  return foglio;
}

/** Il foglio del modulo compilato, e di quante righe si è allungato rispetto all'originale. */
export function foglioSettimana(modello: string, dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]): { foglio: string; righeInPiu: number } {
  const foglio = compilaFoglio(modello, celleFisse(dati, corso, lunedi));
  const rigaDelModulo = (n: number) => {
    const riga = foglio.match(new RegExp(`<row r="${n}"[^>]*>[\\s\\S]*?</row>`))?.[0];
    if (!riga) throw new Error(`Modulo del programma settimanale non riconosciuto: manca la riga ${n}.`);
    return riga;
  };
  /** Copia di una riga del modulo, portata al numero indicato e compilata. */
  const copia = (da: number, a: number, valori: Record<string, Valore>) =>
    compilaFoglio(
      rigaDelModulo(da).replace(`<row r="${da}"`, `<row r="${a}"`).replace(/<c r="([A-Z]+)\d+"/g, `<c r="$1${a}"`),
      Object.fromEntries(Object.entries(valori).map(([colonna, v]) => [`${colonna}${a}`, v])),
    );

  const date = giorniSettimana(lunedi);
  const righe: string[] = [];
  const unioni: string[] = [];
  let n = PRIMA_RIGA_LEZIONI;
  righeSettimana(dati, corso, lunedi, lezioni).forEach((periodi, g) => {
    const [prima, ultima] = RIGHE_GIORNO[g];
    const inizio = n;
    let t = prima; // riga del modulo che corrisponde al periodo
    periodi.forEach((lezioniDelPeriodo, ordine) => {
      if (ordine === PERIODI_DEL_MATTINO) righe.push(copia(t++, n++, {})); // pausa pranzo, com'è nel modulo
      lezioniDelPeriodo.forEach(([orario, addestramento, codice, istruttore, aula], i) => {
        // la riga del modulo porta i bordi del periodo (in testa o in coda alla giornata);
        // le altre lezioni dello stesso periodo prendono quelli di una riga interna
        const suaRiga = t === ultima ? i === lezioniDelPeriodo.length - 1 : i === 0;
        righe.push(copia(suaRiga ? t : prima + 1, n, { A: n === inizio ? `${SIGLA_GIORNO[g]}\n${formatoDataBreve(date[g])}` : null, B: orario, C: addestramento, G: codice, H: istruttore, I: aula }));
        n++;
      });
      t++;
    });
    unioni.push(`A${inizio}:A${n - 1}`);
  });
  for (let r = PRIMA_RIGA_LEZIONI; r < n; r++) unioni.push(`C${r}:F${r}`);
  const righeInPiu = n - 1 - ULTIMA_RIGA_LEZIONI;

  // sotto la tabella tutto scende delle righe aggiunte: righe, celle, unioni
  const giu = (riga: string) => Number(riga) + righeInPiu;
  const testa = foglio.slice(0, foglio.indexOf(`<row r="${PRIMA_RIGA_LEZIONI}"`)).replace(/(<dimension ref="A1:[A-Z]+)(\d+)"/, (_, inizio: string, r: string) => `${inizio}${giu(r)}"`);
  const coda = foglio
    .slice(foglio.indexOf(`<row r="${ULTIMA_RIGA_LEZIONI + 1}"`))
    .replace(/<row r="(\d+)"/g, (_, r: string) => `<row r="${giu(r)}"`)
    .replace(/<c r="([A-Z]+)(\d+)"/g, (_, c: string, r: string) => `<c r="${c}${giu(r)}"`)
    .replace(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/, (_, elenco: string) => {
      const altre = [...elenco.matchAll(/ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].flatMap(([, c1, r1, c2, r2]) =>
        Number(r1) < PRIMA_RIGA_LEZIONI ? [`${c1}${r1}:${c2}${r2}`] : Number(r1) > ULTIMA_RIGA_LEZIONI ? [`${c1}${giu(r1)}:${c2}${giu(r2)}`] : [],
      );
      const tutte = [...altre, ...unioni];
      return `<mergeCells count="${tutte.length}">${tutte.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
    })
    // con molte righe in più la scala si riduce quanto basta a restare in una pagina
    .replace(/(<pageSetup[^>]*? scale=")(\d+)"/, (_, inizio: string, scala: string) => `${inizio}${Math.min(Number(scala), Math.floor((Number(scala) * RIGHE_IN_PAGINA) / (ULTIMA_RIGA + righeInPiu)))}"`);
  return { foglio: testa + righe.join('') + coda, righeInPiu };
}

/** Il file Excel della settimana, a partire dal modulo vuoto. */
export function creaModuloSettimana(modello: Uint8Array, dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]): Uint8Array {
  const parti = preparaModello(apriXlsx(modello));
  const { numero } = settimanaDiCorso(corso, lunedi);
  const { foglio, righeInPiu } = foglioSettimana(strFromU8(parti[FOGLIO]), dati, corso, lunedi, lezioni);
  parti[FOGLIO] = strToU8(foglio);
  // il foglio prende il numero della settimana, come nell'originale ("10 SETTIMANA"), e l'area di stampa segue le righe aggiunte
  const nomeFoglio = numero ? `${numero} ${NOME_FOGLIO}` : NOME_FOGLIO;
  parti[CARTELLA] = strToU8(
    strFromU8(parti[CARTELLA])
      .replace(/(<sheet [^>]*?name=")[^"]*"/, (_, inizio: string) => `${inizio}${nomeFoglio}"`)
      .replace(/(<definedName name="_xlnm\.Print_Area"[^>]*>)[^<]*</, (_, inizio: string) => `${inizio}'${nomeFoglio}'!$A$1:$I$${ULTIMA_RIGA + righeInPiu}<`),
  );
  return chiudiXlsx(parti);
}

/** Dal pulsante: scarica il programma della settimana sul modulo ufficiale. */
export async function esportaSettimana(leggi: Backend['leggiModello'], dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]) {
  const modello = await leggi(MODELLO_SETTIMANA);
  if (!modello) throw new Error(`Modulo del programma settimanale non trovato: manca «${MODELLO_SETTIMANA}» nella cartella modelli.`);
  const bytes = creaModuloSettimana(modello, dati, corso, lunedi, lezioni);
  scarica(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Programma_settimanale_${pulisciNome(corso.codice)}_${lunedi}.xlsx`);
}
