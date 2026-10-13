import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import layout from './dati/layout-compliance.json';
import { calcolaReport, formatoPercentuale, type Report, type RigaReport, type Totale } from './dominio/compliance';
import { programmaPratico } from './dominio/programmi';
import { oggiISO } from './dominio/motore';
import type { Corso, Dati, Utente } from './dominio/tipi';
import { formatoData, registrazioniDi } from './dominio/viste';

/**
 * Compliance Report in PDF identico al modulo ufficiale: le pagine sono quelle del PDF originale
 * (`modelli/Compliance Report.pdf`) e si scrivono solo i valori nelle celle, alle posizioni
 * ricavate da scripts/layout_compliance.py. Carattere Helvetica, metricamente equivalente all'Arial del modulo.
 */

interface Riga {
  chiave: string;
  base: number;
  corpo: number;
  grassetto: boolean;
  eseguiti: number;
  percentuale: number;
}

const normalizza = (codice: string) => codice.replace(/\s+/g, '').toUpperCase();
const NERO = rgb(0, 0, 0);

function valori(r: Report, chiave: string): Pick<RigaReport, 'eseguiti' | 'previsti' | 'percentuale'> | Totale | undefined {
  if (chiave === 'totale') return r.totale;
  if (chiave === 'totaleP66') return r.totaleP66;
  const [tabella, codice] = [chiave.slice(0, chiave.indexOf(':')), chiave.slice(chiave.indexOf(':') + 1)];
  const elenco = tabella === 'tipo' ? r.perTipo : tabella === 'modulo' ? r.perModulo : r.perChapter;
  // 21A e 27 sono barrati nel modulo e non esistono nel catalogo: restano vuoti
  return elenco.find((x) => normalizza(x.codice) === codice);
}

export async function creaCompliancePdf(dati: Dati, corso: Corso, utente: Utente, modello: ArrayBuffer, logo?: ArrayBuffer | null): Promise<Uint8Array> {
  const programma = programmaPratico(corso.programma_pratico);
  if (!programma) throw new Error('Il corso non prevede la parte pratica.');
  const pdf = await PDFDocument.load(modello);
  const normale = await pdf.embedFont(StandardFonts.Helvetica);
  const grassetto = await pdf.embedFont(StandardFonts.HelveticaBold);
  const immagine = logo ? await pdf.embedPng(logo).catch(() => null) : null;
  const ammessi = new Set(normale.getCharacterSet());
  const sicuro = (s: string) => [...s].map((c) => (ammessi.has(c.codePointAt(0)!) ? c : '?')).join('');

  const report = calcolaReport(registrazioniDi(dati, corso.id, utente.id), programma);
  const a = dati.anagrafiche.find((x) => x.user_id === utente.id);
  const t = dati.training.find((x) => x.user_id === utente.id && x.corso_id === corso.id) ?? corso;

  /** Testo centrato (o allineato a sinistra) sulla linea di base, rimpicciolito se non entra in `massimo`. */
  const scrivi = (pagina: PDFPage, testo: string, x: number, base: number, font: PDFFont, corpo: number, centro = true, massimo = Infinity) => {
    const s = sicuro(testo);
    let dimensione = corpo;
    while (dimensione > 6 && font.widthOfTextAtSize(s, dimensione) > massimo) dimensione -= 0.25;
    const w = font.widthOfTextAtSize(s, dimensione);
    pagina.drawText(s, { x: centro ? x - w / 2 : x, y: pagina.getHeight() - base, size: dimensione, font, color: NERO });
  };

  /** Righe di testo spezzate per stare in `larghezza`. */
  const aCapo = (testo: string, font: PDFFont, corpo: number, larghezza: number) => {
    const righe: string[] = [];
    for (const parola of sicuro(testo).split(/\s+/)) {
      const prova = righe.length ? `${righe[righe.length - 1]} ${parola}` : parola;
      if (righe.length && font.widthOfTextAtSize(prova, corpo) <= larghezza) righe[righe.length - 1] = prova;
      else righe.push(parola);
    }
    return righe;
  };

  const pagine = pdf.getPages();
  for (const info of layout.pagine) {
    const pagina = pagine[info.indice];
    const alt = pagina.getHeight();

    if ('intestazione' in info && info.intestazione) {
      const { cella, segnaposto, campi } = info.intestazione as { cella: number[]; segnaposto: number[][]; campi: Record<string, { x: number; base: number; fine: number }> };
      const organizzazione = t?.maintenance_organization?.trim();
      if (organizzazione || immagine) {
        // i segnaposto "Logo" / "Organization and DAAA approval number" lasciano il posto ai valori
        for (const [x0, y0, x1, y1] of segnaposto) pagina.drawRectangle({ x: x0 - 1, y: alt - y1 - 1, width: x1 - x0 + 2, height: y1 - y0 + 2, color: rgb(1, 1, 1) });
        const [sx, alto, dx, basso] = cella;
        const margine = 4;
        let inizio = alto + margine;
        if (immagine) {
          const hMax = (basso - alto) * 0.45;
          const scala = Math.min((dx - sx - 2 * margine) / immagine.width, hMax / immagine.height);
          const w = immagine.width * scala;
          const h = immagine.height * scala;
          pagina.drawImage(immagine, { x: (sx + dx) / 2 - w / 2, y: alt - inizio - h, width: w, height: h });
          inizio += h + 3;
        }
        if (organizzazione) {
          const corpo = 9;
          const righe = aCapo(organizzazione, grassetto, corpo, dx - sx - 2 * margine).slice(0, 5);
          const interlinea = corpo * 1.2;
          const spazio = basso - margine - inizio;
          let base = inizio + (spazio - righe.length * interlinea) / 2 + corpo;
          for (const r of righe) {
            scrivi(pagina, r, (sx + dx) / 2, base, grassetto, corpo);
            base += interlinea;
          }
        }
      }
      const campo = (chiave: string, valore: string | null | undefined) => {
        const c = campi[chiave];
        if (c && valore?.trim()) scrivi(pagina, valore.trim(), c.x + 2, c.base - 1.5, normale, 10, false, c.fine - c.x - 4);
      };
      campo('grade', a?.grado);
      campo('nome', a?.nome);
      campo('cognome', a?.cognome);
      campo('maml', a?.maml);
    }

    for (const r of info.righe as Riga[]) {
      const v = valori(report, r.chiave);
      if (!v) continue;
      const font = r.grassetto ? grassetto : normale;
      scrivi(pagina, String(v.eseguiti), r.eseguiti, r.base, font, r.corpo);
      scrivi(pagina, v.previsti ? formatoPercentuale(v.percentuale) : 'N/A', r.percentuale, r.base, font, r.corpo);
    }

    if ('firma' in info && info.firma) {
      const firma = info.firma as Record<string, { centro: number; base: number; corpo: number }>;
      if (t?.location) scrivi(pagina, t.location, firma.place.centro, firma.place.base, normale, firma.place.corpo);
      scrivi(pagina, formatoData(oggiISO()), firma.date.centro, firma.date.base, normale, firma.date.corpo);
    }
  }
  pdf.setTitle(`Compliance Report – ${[a?.grado, a?.nome, a?.cognome].filter(Boolean).join(' ')}`);
  pdf.setProducer('Gestionale Type Training');
  return pdf.save();
}

/** Dal pulsante: apre il PDF in una nuova scheda (da lì si stampa), o lo scarica se il browser blocca la finestra. */
export async function apriCompliancePdf(dati: Dati, corso: Corso, utente: Utente, finestra: Window | null) {
  const [modello, logo] = await Promise.all([
    fetch('./modelli/Compliance Report.pdf').then((r) => {
      if (!r.ok) throw new Error('Modulo del Compliance Report non trovato.');
      return r.arrayBuffer();
    }),
    // logo facoltativo dell'organizzazione: basta metterlo nella cartella modelli come logo.png
    fetch('./modelli/logo.png')
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('png') ? r.arrayBuffer() : null))
      .catch(() => null),
  ]);
  const bytes = await creaCompliancePdf(dati, corso, utente, modello, logo);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = dati.anagrafiche.find((x) => x.user_id === utente.id);
  if (finestra) {
    finestra.location.href = url;
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = `Compliance_Report_${(a?.cognome ?? utente.username).replace(/[^\w-]+/g, '_')}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
