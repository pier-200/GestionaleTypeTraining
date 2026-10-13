import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import layout from '../src/dati/layout-compliance.json';
import { creaCompliancePdf } from '../src/stampaReport';

it('il Compliance Report in PDF usa le pagine del modulo ufficiale e compila ogni riga applicabile', async () => {
  const modello = readFileSync(resolve(__dirname, '../modelli/Compliance Report.pdf'));
  const d = datiEsempio();
  const corso = d.corsi.find((c) => c.programma_pratico)!;
  const bytes = await creaCompliancePdf(d, corso, d.utenti.find((u) => u.id === 'u-romano')!, modello.buffer.slice(modello.byteOffset, modello.byteOffset + modello.byteLength));
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(4);
  // 7 righe 4.1, 33+39 righe 4.2 (21A e 27 barrate restano vuote), 10 righe 4.3
  expect(layout.pagine.map((p) => p.righe.length)).toEqual([7, 33, 39, 10]);
  if (process.env.PTT_SALVA_PDF) writeFileSync(process.env.PTT_SALVA_PDF, bytes);
});
