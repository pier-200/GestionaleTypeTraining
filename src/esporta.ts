import { indice, programmaPratico, programmaTeorico, type ProgrammaPratico } from './dominio/programmi';
import type { Report, RigaReport } from './dominio/compliance';
import { oggiISO } from './dominio/motore';
import { statoTeorico } from './dominio/pianificazione';
import { assenzeDi } from './dominio/presenze';
import { ETICHETTA_CERTIFICATO, ETICHETTA_STATO_CERTIFICATO, type Corso, type Dati, type Registrazione, type Utente } from './dominio/tipi';
import { esecuzione, frequentatori, iscritti, istruttoriDi, lezioniDi, nomeIstruttore, nomeUtente, presenzeDi, rapportiniDi, situazione } from './dominio/viste';

/** Esportazioni (PROGETTO_Logbook_PTT.md §5): Excel del singolo frequentatore, Excel complessivo, CSV. */

type Valore = string | number | Date | null;
type Cella = Valore | { v: Valore; b?: boolean; sfondo?: string; pct?: boolean };
interface Foglio {
  nome: string;
  righe: Cella[][];
  larghezze: number[];
}

const GIALLO = '#FFF3A6';
const GRIGIO = '#E4E7EA';
const data = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);
const intestazione = (...titoli: string[]): Cella[] => titoli.map((v) => ({ v, b: true, sfondo: GRIGIO }));
const perc = (p: number | null): Cella => (p == null ? null : { v: p / 100, pct: true });
const esito = (c: boolean | null) => (c == null ? 'n.a.' : c ? 'CONFORME' : 'NON CONFORME');

async function scriviXlsx(fogli: Foglio[], nome: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const cella = (c: Cella) => {
    if (c == null) return null;
    const { v, b, sfondo, pct } = typeof c === 'object' && !(c instanceof Date) ? c : { v: c, b: false, sfondo: undefined, pct: false };
    if (v == null) return sfondo ? { value: '', backgroundColor: sfondo } : null;
    const stile = { ...(b ? { fontWeight: 'bold' as const } : {}), ...(sfondo ? { backgroundColor: sfondo } : {}), wrap: true, alignVertical: 'top' as const };
    if (v instanceof Date) return { value: v, type: Date, format: 'dd/mm/yyyy', ...stile };
    if (typeof v === 'number') return { value: v, type: Number, ...(pct ? { format: '0.0%' } : {}), ...stile };
    return { value: v, type: String, ...stile };
  };
  const sheets = fogli.map((f) => ({ sheet: f.nome.slice(0, 31), data: f.righe.map((r) => r.map(cella)), columns: f.larghezze.map((width) => ({ width })), stickyRowsCount: 1 }));
  const blob = await writeXlsxFile(sheets as never).toBlob();
  scarica(blob, `${nome}.xlsx`);
}

export function scarica(blob: Blob, nomeFile: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const pulisciNome = (s: string) => s.normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');

function righeReport(titolo: string, colonna: string, righe: RigaReport[], requisito: string): Cella[][] {
  return [
    [{ v: titolo, b: true }],
    intestazione(colonna, 'Tasks applicable to the A/C type', 'Tasks effectively performed', 'Percentage (%)', `Esito (${requisito})`),
    ...righe.map((r) => [r.codice, r.previsti, r.eseguiti, perc(r.percentuale), esito(r.conforme)]),
  ];
}

function foglioCompliance(report: Report): Foglio {
  const tot = (etichetta: string, t: Report['totale']): Cella[] => [{ v: etichetta, b: true }, { v: t.previsti, b: true }, { v: t.eseguiti, b: true }, { v: t.percentuale / 100, pct: true, b: true }];
  return {
    nome: 'Compliance Report',
    larghezze: [22, 16, 16, 14, 22],
    righe: [
      ...righeReport('4.1 Percentage by task type', 'Type of task', report.perTipo, '≥ 50%'),
      tot('TOTALE', report.totale),
      [],
      ...righeReport('4.2 Percentage by chapter', 'Chapter', report.perChapter, '≥ 50%'),
      tot('TOTAL task (module AER(EP).P-66)', report.totaleP66),
      tot('TOTAL task', report.totale),
      [],
      ...righeReport('4.3 Percentage by module', 'Module', report.perModulo, '≥ 50%'),
      tot('TOTALE Chapter AER(EP).P-66', report.totaleP66),
      tot('TOTALE', report.totale),
      [],
      [{ v: 'Esito complessivo', b: true }, { v: report.conforme ? 'CONFORME' : 'NON CONFORME', b: true, sfondo: report.conforme ? GIALLO : undefined }],
    ],
  };
}

/** Logbook nel formato dell'Excel originale: tutte le righe del catalogo, una riga per registrazione. */
function foglioLogbook(dati: Dati, programma: ProgrammaPratico, registrazioni: Registrazione[]): Foglio {
  const righe: Cella[][] = [
    intestazione('ID', 'MODULE', 'CH', 'SUBJECT', 'TASK TYPE', 'TASK DESCRIPTION', 'OPERATION PERFORMED', 'MAINTENANCE LOCATION', 'DATA', 'A/C', 'ET (min)', 'INSTRUCTOR', 'Ultima modifica', 'Modificato da'),
  ];
  for (const t of programma.task) {
    const regs = registrazioni.filter((r) => r.task_id === t.id).sort((a, b) => a.data.localeCompare(b.data));
    const base: Cella[] = [t.id, t.modulo, t.chapter, t.subject, t.tipo, t.descrizione, t.riferimenti];
    if (!regs.length) righe.push(base);
    for (const r of regs) {
      const s = GIALLO;
      righe.push([
        ...base.map((v) => ({ v: v as Valore, sfondo: s })),
        { v: r.maintenance_location, sfondo: s },
        { v: data(r.data), sfondo: s },
        { v: esecuzione(r), sfondo: s },
        { v: r.et_minuti, sfondo: s },
        { v: nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id)), sfondo: s },
        { v: new Date(r.modificato_il).toLocaleString('it-IT'), sfondo: s },
        { v: nomeUtente(dati, r.modificato_da), sfondo: s },
      ]);
    }
  }
  return { nome: 'Logbook', righe, larghezze: [6, 8, 8, 24, 9, 48, 30, 22, 11, 18, 8, 26, 17, 22] };
}

export async function esportaFrequentatore(dati: Dati, corso: Corso, utente: Utente) {
  const programma = programmaPratico(corso.programma_pratico);
  if (!programma) throw new Error('Il corso non prevede la parte pratica.');
  const s = situazione(dati, corso, utente);
  const a = dati.anagrafiche.find((x) => x.user_id === utente.id);
  const t = dati.training.find((x) => x.user_id === utente.id && x.corso_id === corso.id) ?? corso;
  const fogli: Foglio[] = [
    {
      nome: 'Personal Data',
      larghezze: [22, 40],
      righe: [intestazione('Trainee Data', ''), ['Rank', a?.grado ?? null], ['Name', a?.nome ?? null], ['Surname', a?.cognome ?? null], ['Date of birth', data(a?.data_nascita)], ['Place of birth', a?.citta_nascita ?? null], ['MAML', a?.maml || null]],
    },
    {
      nome: 'Practical Type Training Data',
      larghezze: [34, 50],
      righe: [
        intestazione('Practical type training data', ''),
        ['Start date', data(t?.data_inizio)],
        ['End date', data(t?.data_fine)],
        ['Maintenance Organisation (Name and DAAA approval nr)', t?.maintenance_organization || null],
        ['Location', t?.location || null],
      ],
    },
    foglioLogbook(dati, programma, s.registrazioni),
    {
      nome: 'Practical Instructors',
      larghezze: [16, 18, 18, 12, 14, 12, 12, 12],
      righe: [
        intestazione('Rank', 'Name', 'Surname', 'Task', 'Registrazioni', 'ET (min)', 'Prima data', 'Ultima data'),
        ...istruttoriDi(dati, s.registrazioni).map((r) => [r.istruttore.grado, r.istruttore.nome, r.istruttore.cognome, r.task, r.registrazioni, r.minuti, data(r.prima), data(r.ultima)]),
      ],
    },
    foglioCompliance(s.report),
  ];
  await scriviXlsx(fogli, `PTR_${programma.aeromobile}_${pulisciNome(s.nome)}_${oggiISO()}`);
}

export async function esportaCorso(dati: Dati, corso: Corso) {
  const programma = programmaPratico(corso.programma_pratico);
  if (!programma) throw new Error('Il corso non prevede la parte pratica.');
  const elenco = frequentatori(dati, corso.id, true).map((u) => situazione(dati, corso, u));
  const tipi = indice(programma).tipiApplicabili.map((t) => t.codice);
  const riepilogo: Foglio = {
    nome: 'Riepilogo',
    larghezze: [18, 16, 18, 16, 8, 10, 10, ...programma.moduli.map(() => 9), ...tipi.map(() => 9), 10, 30, 15],
    righe: [
      intestazione('Grado', 'Nome', 'Cognome', 'Username', 'Attivo', 'Task eseguiti', '% totale', ...programma.moduli.map((m) => `% Mod. ${m.numero}`), ...tipi.map((t) => `% ${t}`), 'Chapter sotto il 50%', 'Elenco chapter sotto il 50%', 'Esito'),
      ...elenco.map((s) => {
        const a = dati.anagrafiche.find((x) => x.user_id === s.utente.id);
        return [
          a?.grado ?? null,
          a?.nome ?? null,
          a?.cognome ?? null,
          s.utente.username,
          s.utente.attivo ? 'Sì' : 'No',
          s.report.totale.eseguiti,
          perc(s.report.totale.percentuale),
          ...s.report.perModulo.map((r) => perc(r.percentuale)),
          ...s.report.perTipo.filter((r) => r.previsti).map((r) => perc(r.percentuale)),
          s.mancanti.chapter.length,
          s.mancanti.chapter.map((c) => c.codice).join(', '),
          { v: s.report.conforme ? 'CONFORME' : 'NON CONFORME', b: true, sfondo: s.report.conforme ? GIALLO : undefined },
        ];
      }),
    ],
  };
  const grezzi: Foglio = {
    nome: 'Registrazioni',
    larghezze: [26, 7, 7, 8, 8, 48, 22, 11, 9, 18, 8, 26, 17, 22],
    righe: [intestazione(...COLONNE_CSV), ...righeCsv(dati, programma, dati.registrazioni.filter((r) => r.corso_id === corso.id)).map((r) => r.map((v, i) => (i === 7 ? data(String(v)) : v)))],
  };
  await scriviXlsx([riepilogo, grezzi], `Riepilogo_${pulisciNome(corso.codice)}_${oggiISO()}`);
}

/** Registro dei corsi e dei corsisti: il quadro d'insieme del Training Manager. */
export async function esportaRegistro(dati: Dati) {
  const corsi: Foglio = {
    nome: 'Corsi',
    larghezze: [16, 40, 12, 10, 12, 12, 24, 12, 12, 12, 12, 10],
    righe: [
      intestazione('Codice', 'Nome', 'MDS', 'Categoria', 'Inizio', 'Fine', 'Maintenance Organisation', 'Sede', 'Corsisti', 'Istruttori', 'Ore teoria svolte', 'Attivo'),
      ...dati.corsi.map((c) => {
        const teorico = programmaTeorico(c.programma_teorico);
        const stato = teorico ? statoTeorico(teorico, lezioniDi(dati, c.id), oggiISO()) : null;
        return [
          c.codice,
          c.nome,
          c.mds,
          c.categoria,
          data(c.data_inizio),
          data(c.data_fine),
          c.maintenance_organization || null,
          c.location || null,
          frequentatori(dati, c.id, true).length,
          iscritti(dati, c.id, 'instructor', true).length + iscritti(dati, c.id, 'direttore', true).length,
          stato ? Math.round(stato.svolti / 60) : null,
          c.attivo ? 'Sì' : 'No',
        ];
      }),
    ],
  };
  const corsisti: Foglio = {
    nome: 'Corsisti',
    larghezze: [16, 18, 18, 12, 20, 16, 16, 12, 12, 14, 12, 18],
    righe: [
      intestazione('Grado', 'Nome', 'Cognome', 'Data di nascita', 'Luogo di nascita', 'MAML', 'Username', 'Corso', 'MDS/Cat.', 'Assenze (h)', '% assenze', 'Esame teorico', '% pratica', 'Certificati'),
      ...dati.corsi.flatMap((c) => {
        const teorico = programmaTeorico(c.programma_teorico);
        const pratico = programmaPratico(c.programma_pratico);
        const rapportini = rapportiniDi(dati, c.id);
        const presenze = presenzeDi(dati, c.id);
        const lezioni = lezioniDi(dati, c.id);
        return frequentatori(dati, c.id, true).map((u) => {
          const a = dati.anagrafiche.find((x) => x.user_id === u.id);
          const assenze = teorico ? assenzeDi(teorico, lezioni, rapportini, presenze, u.id) : null;
          const report = pratico ? situazione(dati, c, u).report : null;
          return [
            a?.grado ?? null,
            a?.nome ?? null,
            a?.cognome ?? null,
            data(a?.data_nascita),
            a?.citta_nascita ?? null,
            a?.maml || null,
            u.username,
            c.codice,
            `${c.mds} ${c.categoria}`,
            assenze ? Math.round((assenze.minuti / 60) * 10) / 10 : null,
            assenze ? perc(assenze.percentuale) : null,
            assenze ? (assenze.idoneo ? 'Idoneo' : 'NON IDONEO') : null,
            report ? perc(report.totale.percentuale) : null,
            dati.certificati.filter((x) => x.user_id === u.id && x.corso_id === c.id).map((x) => `${x.numero}/${x.anno}`).join(', ') || null,
          ];
        });
      }),
    ],
  };
  await scriviXlsx([corsi, corsisti], `Registro_corsi_e_corsisti_${oggiISO()}`);
}

/** Registro dei certificati AER(EP).P-147. */
export async function esportaCertificati(dati: Dati) {
  const righe = [...dati.certificati].sort((a, b) => a.anno - b.anno || a.numero - b.numero);
  const foglio: Foglio = {
    nome: 'Certificati',
    larghezze: [10, 8, 30, 16, 18, 18, 12, 10, 34, 12, 12, 10, 14, 14, 14, 14, 14, 18, 26, 30],
    righe: [
      intestazione(
        'Numero', 'Anno', 'Tipo', 'Grado', 'Nome', 'Cognome', 'MAML', 'Corso', 'Programma di riferimento', 'MDS', 'Categoria', 'Ore',
        'Corso dal', 'Corso al', 'Esame teorico', 'Esito esame', 'Valutazione pratica', 'Esito pratica', 'Rilascio', 'Luogo', 'Maintenance Organisation', 'Stato', 'Note',
      ),
      ...righe.map((c) => {
        const a = dati.anagrafiche.find((x) => x.user_id === c.user_id);
        return [
          c.numero,
          c.anno,
          ETICHETTA_CERTIFICATO[c.tipo],
          a?.grado ?? null,
          a?.nome ?? nomeUtente(dati, c.user_id),
          a?.cognome ?? null,
          a?.maml || null,
          dati.corsi.find((x) => x.id === c.corso_id)?.codice ?? null,
          c.programma || null,
          c.mds,
          c.categoria,
          c.ore || null,
          data(c.data_inizio),
          data(c.data_fine),
          data(c.esame_data),
          c.esame_esito || null,
          data(c.pratica_data),
          c.pratica_esito || null,
          data(c.data_rilascio),
          c.luogo_rilascio || null,
          c.organizzazione || null,
          ETICHETTA_STATO_CERTIFICATO[c.stato],
          c.note || null,
        ];
      }),
    ],
  };
  await scriviXlsx([foglio], `Registro_certificati_P147_${oggiISO()}`);
}

const COLONNE_CSV = ['Frequentatore', 'Task ID', 'Modulo', 'Chapter', 'Task type', 'Descrizione', 'Maintenance location', 'Data', 'Esecuzione', 'Matricola', 'ET (min)', 'Instructor', 'Modificato il', 'Modificato da'];

function righeCsv(dati: Dati, programma: ProgrammaPratico, registrazioni: readonly Registrazione[]): Valore[][] {
  return [...registrazioni]
    .sort((a, b) => nomeUtente(dati, a.user_id).localeCompare(nomeUtente(dati, b.user_id)) || a.data.localeCompare(b.data))
    .map((r) => {
      const t = indice(programma).taskPerId.get(r.task_id)!;
      return [nomeUtente(dati, r.user_id), t.id, t.modulo, t.chapter, t.tipo, t.descrizione, r.maintenance_location, r.data, r.tipo_esecuzione, r.matricola, r.et_minuti, nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id)), r.modificato_il, nomeUtente(dati, r.modificato_da)];
    });
}

/** CSV con separatore ";" e BOM, come lo apre Excel in italiano. */
export function esportaCsv(dati: Dati, corso: Corso, registrazioni: readonly Registrazione[], nome: string) {
  const programma = programmaPratico(corso.programma_pratico);
  if (!programma) throw new Error('Il corso non prevede la parte pratica.');
  const campo = (v: Valore) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const testo = [COLONNE_CSV, ...righeCsv(dati, programma, registrazioni)].map((r) => r.map(campo).join(';')).join('\r\n');
  scarica(new Blob(['﻿', testo], { type: 'text/csv;charset=utf-8' }), `${pulisciNome(nome)}_${oggiISO()}.csv`);
}
