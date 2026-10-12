import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { giorniSettimana, orarioPeriodo, periodiDelGiorno, settimanaDiCorso } from './dominio/pianificazione';
import { materiaDi, programmaTeorico } from './dominio/programmi';
import type { CampiLezione } from './dominio/motore';
import { ETICHETTA_PERIODO, SIGLA_PERIODO, conMateria, type Corso, type Dati } from './dominio/tipi';
import { direttoreDi, formatoDataBreve, frequentatori, gradoCognome, nomeModulo } from './dominio/viste';
import { pulisciNome, scarica } from './esporta';

/**
 * Programma settimanale sul modulo ufficiale: il foglio è quello di public/modelli/programma-settimanale.xlsx
 * (preparato da scripts/modulo_settimanale.py) e si scrivono solo i valori nelle celle, che conservano stile,
 * unioni e impostazione di stampa. Da Excel si stampa in PDF così com'è, su una pagina A4.
 */

type Valore = string | number | null;

const FOGLIO = 'xl/worksheets/sheet1.xml';
const CARTELLA = 'xl/workbook.xml';
const NOME_FOGLIO = 'SETTIMANA';

/** Prima riga di ciascun giorno, da lunedì a venerdì. */
const RIGA_GIORNO = [11, 18, 25, 32, 39];
/** Riga di ciascun periodo dentro la giornata: fra il quarto e il quinto c'è la pausa pranzo. */
const RIGA_PERIODO = [0, 1, 2, 3, 5, 6];
const SIGLA_GIORNO = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
/** Elenco dei frequentatori: due colonne da 8 righe a partire da questa. */
const RIGA_FREQUENTATORI = 47;
const POSTI_FREQUENTATORI = 16;
const BARRATO = '////';

/** Data come la conserva Excel: giorni dal 30/12/1899. */
const seriale = (iso: string | null) => (iso ? Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25569 : null);
const settimane = (n: number | null) => (n ? `${n} settiman${n === 1 ? 'a' : 'e'}` : null);

/** Valore di ogni cella compilabile del modulo, per la settimana che inizia il lunedì indicato. */
export function celleSettimana(dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]): Record<string, Valore> {
  const programma = programmaTeorico(corso.programma_teorico);
  if (!programma) throw new Error('Il corso non prevede la parte teorica.');
  const allievi = frequentatori(dati, corso.id);
  // ponytail: il modulo ha 16 righe fisse; oltre servirebbe un secondo foglio, da aggiungere se mai capita un corso più numeroso
  if (allievi.length > POSTI_FREQUENTATORI) throw new Error(`Il modulo ha ${POSTI_FREQUENTATORI} righe per i frequentatori: il corso ne ha ${allievi.length}.`);
  const { numero, ritardo } = settimanaDiCorso(corso, lunedi);
  const celle: Record<string, Valore> = {
    C6: corso.codice,
    H6: numero,
    C7: seriale(corso.data_inizio),
    H7: seriale(corso.data_fine),
    C8: settimane(corso.durata_settimane),
    H8: settimane(ritardo),
    C43: nomeModulo(dati, direttoreDi(dati, corso.id)?.id),
    F58: corso.gruppo_firma,
  };
  giorniSettimana(lunedi).forEach((data, g) => {
    celle[`A${RIGA_GIORNO[g]}`] = `${SIGLA_GIORNO[g]}\n${formatoDataBreve(data)}`;
    for (let ordine = 0; ordine < periodiDelGiorno(g); ordine++) {
      const riga = RIGA_GIORNO[g] + RIGA_PERIODO[ordine];
      const l = lezioni.find((x) => x.data === data && x.ordine === ordine);
      const materia = l && conMateria(l.tipo) ? materiaDi(programma, l.materia) : undefined;
      const orario = orarioPeriodo(ordine, l?.minuti);
      // il codice è il primo chapter della materia; i periodi non didattici hanno la loro sigla
      const codice = materia ? materia.chapters[0] : l ? (l.tipo === 'sospensione' ? BARRATO : SIGLA_PERIODO[l.tipo]) : null;
      celle[`B${riga}`] = `${orario.inizio}-${orario.fine}`;
      celle[`C${riga}`] = !l ? null : materia ? `${materia.titolo}${l.tipo === 'recupero' ? ' (recupero)' : ''}` : ETICHETTA_PERIODO[l.tipo];
      // numero se Excel lo riscrive uguale ("34"), testo altrimenti ("05", "32A", "AVES 1")
      celle[`G${riga}`] = codice && /^[1-9]\d*$/.test(codice) ? Number(codice) : codice;
      celle[`H${riga}`] = l ? gradoCognome(dati, l.istruttore_id) : null;
      celle[`I${riga}`] = !l ? null : l.tipo === 'sospensione' ? BARRATO : l.aula || corso.aula;
    }
  });
  for (let i = 0; i < POSTI_FREQUENTATORI; i++) {
    const riga = RIGA_FREQUENTATORI + (i % 8);
    const [nome, ente] = i < 8 ? ['B', 'D'] : ['G', 'I'];
    const u = allievi[i];
    celle[`${nome}${riga}`] = u ? nomeModulo(dati, u.id) || u.username : null;
    celle[`${ente}${riga}`] = u ? (dati.anagrafiche.find((a) => a.user_id === u.id)?.ente ?? null) : null;
  }
  return celle;
}

const testoXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Scrive i valori nelle celle del foglio: ogni cella conserva il proprio stile. */
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

/** Il file Excel della settimana, a partire dal modulo vuoto. */
export function creaModuloSettimana(modello: Uint8Array, dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]): Uint8Array {
  const parti = unzipSync(modello);
  const { numero } = settimanaDiCorso(corso, lunedi);
  parti[FOGLIO] = strToU8(compilaFoglio(strFromU8(parti[FOGLIO]), celleSettimana(dati, corso, lunedi, lezioni)));
  // il foglio prende il numero della settimana, come nell'originale ("10 SETTIMANA")
  if (numero) parti[CARTELLA] = strToU8(strFromU8(parti[CARTELLA]).replaceAll(NOME_FOGLIO, `${numero} ${NOME_FOGLIO}`));
  return zipSync(parti);
}

/** Dal pulsante: scarica il programma della settimana sul modulo ufficiale. */
export async function esportaSettimana(dati: Dati, corso: Corso, lunedi: string, lezioni: readonly CampiLezione[]) {
  const risposta = await fetch('./modelli/programma-settimanale.xlsx');
  if (!risposta.ok) throw new Error('Modulo del programma settimanale non trovato.');
  const bytes = creaModuloSettimana(new Uint8Array(await risposta.arrayBuffer()), dati, corso, lunedi, lezioni);
  scarica(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Programma_settimanale_${pulisciNome(corso.codice)}_${lunedi}.xlsx`);
}
