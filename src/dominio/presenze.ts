import { indiceGiorno, inOrdine, orariLezioni, type Orario } from './pianificazione';
import { materiaDi, type Materia, type ProgrammaTeorico } from './programmi';
import type { ID, Lezione, Presenza, Rapportino } from './tipi';

/**
 * Rapportino presenze e conteggio delle assenze della parte teorica.
 * Chi perde anche solo qualche minuto di una lezione risulta assente a quella lezione;
 * una lezione di recupero della stessa materia sana l'assenza e non ne produce di nuove.
 */

/** Orario standard di presenza: 08:00-16:30 dal lunedì al giovedì, 08:00-12:00 il venerdì. */
export const ORARIO_STANDARD: readonly (readonly [string, string])[] = [
  ['08:00', '16:30'],
  ['08:00', '16:30'],
  ['08:00', '16:30'],
  ['08:00', '16:30'],
  ['08:00', '12:00'],
];

/** Quota di assenze che rende «Non idoneo» all'esame teorico (sul totale delle ore del corso). */
export const SOGLIA_ASSENZE = 0.1;

export { indiceGiorno };

export const orarioStandard = (data: string) => ORARIO_STANDARD[indiceGiorno(data)] ?? ORARIO_STANDARD[0];

export { orariLezioni, type Orario };

/** Presenza del frequentatore in quel giorno: senza rapportino non c'è rilevazione. */
const presenzaDi = (presenze: readonly Presenza[], data: string, userId: ID) => presenze.find((p) => p.data === data && p.user_id === userId);

/** Vero se il frequentatore ha perso anche solo un minuto della lezione. */
export function assenteAllaLezione(presenza: Presenza | undefined, orario: Orario): boolean {
  if (!presenza || presenza.stato === 'presente') return false;
  if (presenza.stato === 'assente') return true;
  const dalle = presenza.dalle ?? '00:00';
  const alle = presenza.alle ?? '23:59';
  return dalle > orario.inizio || alle < orario.fine;
}

export interface AssenzaLezione {
  lezione: Lezione;
  materia: Materia | undefined;
  orario: Orario;
  motivo: string;
  /** Rapportino della giornata già validato dal direttore o dal Training Manager. */
  validata: boolean;
  recuperata: boolean;
}

export interface RigaAssenzeMateria {
  materia: Materia;
  minuti: number;
  recuperati: number;
  residui: number;
}

export interface SituazioneAssenze {
  user_id: ID;
  assenze: AssenzaLezione[];
  materie: RigaAssenzeMateria[];
  /** Minuti di assenza che restano dopo i recuperi. */
  minuti: number;
  lordi: number;
  recuperati: number;
  /** Minuti complessivi del programma teorico. */
  totale: number;
  percentuale: number;
  idoneo: boolean;
  /** Assenze che pesano ma vengono da rapportini non ancora validati. */
  daValidare: number;
}

/** Situazione delle assenze di un frequentatore: per lezione, per materia e idoneità all'esame. */
export function assenzeDi(
  programma: ProgrammaTeorico,
  lezioni: readonly Lezione[],
  rapportini: readonly Rapportino[],
  presenze: readonly Presenza[],
  userId: ID,
): SituazioneAssenze {
  const orari = orariLezioni(lezioni);
  const rilevate = new Map(rapportini.map((r) => [r.data, r]));
  const mie = presenze.filter((p) => p.user_id === userId);
  const assenze: AssenzaLezione[] = [];
  const recuperi = new Map<string, number>();

  for (const l of inOrdine(lezioni)) {
    const rapportino = rilevate.get(l.data);
    if (!rapportino) continue; // giornata non rilevata: nessuna assenza da conteggiare
    const orario = orari.get(l.id)!;
    const presenza = presenzaDi(mie, l.data, userId);
    const assente = assenteAllaLezione(presenza, orario);
    if (l.tipo === 'recupero') {
      // il recupero vale solo per chi c'era; chi manca non prende un'assenza in più
      if (!assente) recuperi.set(l.materia, (recuperi.get(l.materia) ?? 0) + l.minuti);
      continue;
    }
    // MEO, sospensioni ed esami occupano un periodo ma non sono programma: non generano assenze
    if (l.tipo !== 'lezione') continue;
    if (assente) {
      assenze.push({
        lezione: l,
        materia: materiaDi(programma, l.materia),
        orario,
        motivo: presenza?.motivo ?? '',
        validata: rapportino.validato_il != null,
        recuperata: false,
      });
    }
  }

  // i recuperi sanano le assenze della stessa materia, dalla più vecchia
  const materie = new Map<string, RigaAssenzeMateria>();
  for (const a of assenze) {
    const materia = a.materia;
    if (!materia) continue;
    const riga = materie.get(materia.id) ?? { materia, minuti: 0, recuperati: 0, residui: 0 };
    riga.minuti += a.lezione.minuti;
    materie.set(materia.id, riga);
  }
  for (const riga of materie.values()) {
    let credito = Math.min(recuperi.get(riga.materia.id) ?? 0, riga.minuti);
    riga.recuperati = credito;
    riga.residui = riga.minuti - credito;
    for (const a of assenze) {
      if (a.materia?.id !== riga.materia.id || credito < a.lezione.minuti) continue;
      a.recuperata = true;
      credito -= a.lezione.minuti;
    }
  }

  const righe = [...materie.values()].sort((a, b) => b.residui - a.residui || a.materia.id.localeCompare(b.materia.id));
  const lordi = righe.reduce((s, r) => s + r.minuti, 0);
  const recuperati = righe.reduce((s, r) => s + r.recuperati, 0);
  const minuti = righe.reduce((s, r) => s + r.residui, 0);
  const totale = programma.moduli.reduce((s, m) => s + m.minuti, 0);
  return {
    user_id: userId,
    assenze,
    materie: righe,
    minuti,
    lordi,
    recuperati,
    totale,
    percentuale: totale ? (minuti / totale) * 100 : 0,
    idoneo: !totale || minuti / totale < SOGLIA_ASSENZE,
    daValidare: assenze.filter((a) => !a.validata && !a.recuperata).reduce((s, a) => s + a.lezione.minuti, 0),
  };
}

/** Minuti di assenza oltre i quali si è «Non idonei» (10% del programma). */
export const limiteAssenze = (programma: ProgrammaTeorico) => Math.ceil(programma.moduli.reduce((s, m) => s + m.minuti, 0) * SOGLIA_ASSENZE);
