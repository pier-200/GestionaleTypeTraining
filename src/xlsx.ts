import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Il minimo che serve per i file .xlsx della cartella `modelli` (uno zip di XML): aprirli, toglierne
 * i dati di chi li ha preparati prima di pubblicarli, leggerne le righe del primo foglio.
 */

/** Le parti di un file .xlsx, per nome. */
export type Parti = Record<string, Uint8Array>;

export const apriXlsx = (bytes: Uint8Array): Parti => unzipSync(bytes);
export const chiudiXlsx = (parti: Parti): Uint8Array => zipSync(parti);

/** Toglie autori, date, percorsi e stampante di chi ha preparato il file: fogli, stili e contenuto restano com'erano. */
export function senzaMetadati(parti: Parti): Parti {
  const pulite: Parti = Object.fromEntries(Object.entries(parti).filter(([nome]) => !nome.startsWith('docProps/') && !nome.includes('printerSettings/')));
  const riscrivi = (nome: string, f: (xml: string) => string) => {
    if (pulite[nome]) pulite[nome] = strToU8(f(strFromU8(pulite[nome])));
  };
  riscrivi('[Content_Types].xml', (x) => x.replace(/<Override PartName="\/docProps\/[^>]*\/>|<Default Extension="bin"[^>]*printerSettings[^>]*\/>/g, ''));
  riscrivi('_rels/.rels', (x) => x.replace(/<Relationship [^>]*Target="docProps\/[^>]*\/>/g, ''));
  // il percorso della cartella da cui il file è stato salvato l'ultima volta
  riscrivi('xl/workbook.xml', (x) => x.replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/g, ''));
  // le impostazioni della stampante usata l'ultima volta: i fogli non vi fanno più riferimento
  for (const nome of Object.keys(pulite)) {
    if (/^xl\/worksheets\/_rels\//.test(nome)) riscrivi(nome, (x) => x.replace(/<Relationship [^>]*printerSettings[^>]*\/>/g, ''));
    else if (/^xl\/worksheets\/[^/]+\.xml$/.test(nome)) riscrivi(nome, (x) => x.replace(/(<pageSetup[^>]*?) r:id="[^"]*"/, '$1'));
  }
  return pulite;
}

const daXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const testoDi = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => daXml(m[1])).join('');

/** Righe non vuote del primo foglio: ogni cella come testo, alla posizione della sua colonna. */
export function righeXlsx(bytes: Uint8Array): string[][] {
  const parti = unzipSync(bytes);
  const leggi = (nome: string) => (parti[nome] ? strFromU8(parti[nome]) : '');
  const condivise = [...leggi('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => testoDi(m[1]));
  const id = leggi('xl/workbook.xml').match(/<sheet [^>]*r:id="([^"]+)"/)?.[1];
  const relazione = [...leggi('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].find((m) => m[0].includes(`Id="${id}"`))?.[0];
  const foglio = leggi(`xl/${(relazione?.match(/Target="([^"]+)"/)?.[1] ?? 'worksheets/sheet1.xml').replace(/^\/?xl\//, '')}`);
  const righe: string[][] = [];
  for (const r of foglio.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)) {
    const riga: string[] = [];
    for (const [, lettere, attributi, dentro] of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const colonna = [...lettere].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1;
      const tipo = attributi.match(/t="(\w+)"/)?.[1];
      const valore = dentro?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
      riga[colonna] = dentro == null ? '' : tipo === 's' ? (condivise[Number(valore)] ?? '') : tipo === 'inlineStr' ? testoDi(dentro) : daXml(valore);
    }
    righe.push(Array.from(riga, (x) => (x ?? '').trim()));
  }
  return righe.filter((r) => r.some(Boolean));
}
