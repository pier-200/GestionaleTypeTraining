import { useMemo, useState } from 'react';
import { ActionIcon, Autocomplete, Badge, Button, Drawer, Group, Menu, SegmentedControl, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronLeft, IconChevronRight, IconDots, IconEraser, IconFileSpreadsheet, IconLock, IconLockOpen, IconPlus, IconTrash, IconWand } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { messaggioErrore } from '../../dominio/errori';
import { oggiISO, ruoloNelCorso, TIPI_PERIODO, type CampiLezione } from '../../dominio/motore';
import { AULE, MINUTI_PERIODO, NOMI_GIORNI, ORARI_PERIODI, chapterInCorso, generaSettimana, giorniSettimana, inOrdine, lunediDi, orariLezioni, periodiDelGiorno, settimanaDiCorso, sommaGiorni, statoTeorico } from '../../dominio/pianificazione';
import { chapterPrevisti, materiaDi, oreDaMinuti, programmaTeorico, voceLezione, type Materia } from '../../dominio/programmi';
import { conMateria, ETICHETTA_PERIODO, SIGLA_PERIODO, type Lezione, type TipoPeriodo } from '../../dominio/tipi';
import { contenutoLezione, docenti, formatoDataBreve, formatoMinuti, lezioniVisibili, nomeUtente, ore } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { useCampoVisibile } from '../componenti/tastiera';
import { useCorso } from '../navigazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';

/** Durate proponibili per una lezione: quarti d'ora fino all'ora piena, poi c'è la pausa. */
const DURATE = [15, 30, 45, MINUTI_PERIODO];

/**
 * Programma settimanale: una griglia di periodi a orari fissi (6 dal lunedì al giovedì, 3 il venerdì) da compilare.
 * Un periodo è un'ora: la riempie una lezione sola oppure più lezioni brevi, una dopo l'altra.
 */
export function Settimana() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const { query } = usePosizione();
  const [inBozza, setInBozza] = useState<{ lunedi: string; lezioni: CampiLezione[] } | null>(null);
  /** Lezione aperta nel pannello di modifica. */
  const [aperto, setAperto] = useState<string | null>(null);
  const [attesa, setAttesa] = useState(false);
  useCampoVisibile(true);

  const programma = programmaTeorico(corso?.programma_teorico);
  const ruolo = dati && utente && corso ? ruoloNelCorso(dati, utente, corso.id) : null;
  const lezioni = useMemo(() => (dati && corso ? lezioniVisibili(dati, corso.id, ruolo) : []), [dati, corso, ruolo]);
  if (!dati || !utente || !corso) return null;
  if (!programma) {
    return (
      <>
        <IntestazionePagina titolo="Programma settimanale" sotto={corso.nome} />
        <Text className="debole">Il programma teorico di {corso.mds} categoria {corso.categoria} non è ancora stato caricato.</Text>
      </>
    );
  }
  const guida = ruolo === 'admin' || ruolo === 'direttore';

  const lunedi = lunediDi(query.get('w') ?? corso.data_inizio ?? oggiISO());
  const giorni = giorniSettimana(lunedi);
  // la bozza vale per la settimana in cui è nata: arrivando su un'altra si riparte da quella salvata
  const bozza = inBozza?.lunedi === lunedi ? inBozza.lezioni : null;
  const setBozza = (nuova: CampiLezione[] | null) => setInBozza(nuova && { lunedi, lezioni: nuova });
  const salvate = lezioni.filter((l) => giorni.includes(l.data));
  const fuori = lezioni.filter((l) => !giorni.includes(l.data));
  const campi = (l: Lezione | CampiLezione): CampiLezione => ({
    id: l.id,
    corso_id: l.corso_id,
    data: l.data,
    ordine: l.ordine,
    parte: l.parte,
    minuti: l.minuti,
    materia: l.materia,
    chapter: l.chapter,
    istruttore_id: l.istruttore_id,
    aula: l.aula,
    tipo: l.tipo,
    note: l.note,
  });
  const correnti: CampiLezione[] = bozza ?? salvate.map(campi);
  const modificata = bozza != null && JSON.stringify(bozza) !== JSON.stringify(salvate.map(campi));
  const validata = salvate.length > 0 && salvate.every((l) => l.validata);
  const settimana = settimanaDiCorso(corso, lunedi).numero;
  /** Cognome dell'istruttore: nella griglia basta quello (gli account non ancora divisi in tre campi danno l'ultima parola). */
  const cognome = (id: string) => dati.utenti.find((u) => u.id === id)?.cognome || nomeUtente(dati, id).split(' ').at(-1);
  const aule = [...new Set([...AULE, corso.aula, ...lezioni.map((l) => l.aula)].filter(Boolean))];

  /** Lezioni "virtuali" per i calcoli: quelle fuori settimana più la bozza corrente. */
  const perCalcolo = [...fuori, ...correnti.map((l) => ({ ...l, validata: false, validata_da: null, validata_il: null, creato_il: '', modificato_il: '', modificato_da: null }) as Lezione)];
  const stato = statoTeorico(programma, perCalcolo, oggiISO());
  const orari = orariLezioni(correnti);
  /** Lezioni che si dividono il periodo, nell'ordine in cui si svolgono, e minuti ancora liberi. */
  const delPeriodo = (data: string, ordine: number) => inOrdine(correnti.filter((l) => l.data === data && l.ordine === ordine));
  const liberi = (data: string, ordine: number) => MINUTI_PERIODO - delPeriodo(data, ordine).reduce((s, l) => s + l.minuti, 0);

  const possibili = docenti(dati, corso.id);
  /** Istruttori proponibili: quelli abilitati alla materia (più quello già assegnato, se diverso). */
  const abilitati = (materia: string, corrente?: string | null) => {
    const ok = possibili.filter((u) => dati.abilitazioni.some((a) => a.user_id === u.id && a.programma === programma.id && a.materia === materia));
    const elenco = ok.length ? ok : possibili;
    const assegnato = corrente ? possibili.find((u) => u.id === corrente) : undefined;
    return assegnato && !elenco.includes(assegnato) ? [...elenco, assegnato] : elenco;
  };
  const carico = () => {
    const m = new Map<string, number>();
    for (const l of perCalcolo) if (l.istruttore_id) m.set(l.istruttore_id, (m.get(l.istruttore_id) ?? 0) + l.minuti);
    return m;
  };
  /** A parità di abilitazione tocca a chi ha meno ore assegnate. */
  const scegliIstruttore = (materia: string, pesi = carico()) => {
    const elenco = abilitati(materia);
    return elenco.length ? [...elenco].sort((a, b) => (pesi.get(a.id) ?? 0) - (pesi.get(b.id) ?? 0))[0].id : null;
  };

  /** Chapter del syllabus, raggruppati per materia: le ore del programma sono date al gruppo, non al singolo chapter. */
  const opzioniChapter = programma.materie.map((m) => {
    const residuo = stato.materie.find((r) => r.materia.id === m.id)?.residui ?? 0;
    const previsti = chapterPrevisti(m);
    return {
      group: `M${m.modulo} · Ch ${previsti.map((v) => v.chapter).join(', ')} — ${residuo ? `restano ${oreDaMinuti(residuo)}` : 'ore tutte a calendario'}`,
      items: previsti.map((v) => ({ value: `${m.id}|${v.chapter}`, label: `${v.chapter} · ${v.subject}` })),
    };
  });

  const genera = () => {
    const pesi = carico();
    const proposte = generaSettimana(programma, perCalcolo, lunedi, { istruttorePerMateria: (m: Materia) => scegliIstruttore(m.id, pesi) });
    if (!proposte.length) return;
    for (const p of proposte) if (p.istruttore_id) pesi.set(p.istruttore_id, (pesi.get(p.istruttore_id) ?? 0) + p.minuti);
    setBozza([...correnti, ...proposte.map((p) => ({ id: nuovoUuid(), corso_id: corso.id, data: p.data, ordine: p.ordine, parte: p.parte, minuti: p.minuti, materia: p.materia, chapter: p.chapter, istruttore_id: p.istruttore_id, aula: '', tipo: 'lezione' as TipoPeriodo, note: '' }))]);
  };

  /** Mette nel tempo ancora libero del periodo la materia successiva del programma, proseguendo il chapter in corso. */
  const aggiungi = (data: string, ordine: number) => {
    const minuti = liberi(data, ordine);
    if (minuti < DURATE[0]) return;
    const materia = stato.prossima ?? programma.materie[0];
    const id = nuovoUuid();
    const parte = (delPeriodo(data, ordine).at(-1)?.parte ?? -1) + 1;
    setBozza([...correnti, { id, corso_id: corso.id, data, ordine, parte, minuti, materia: materia.id, chapter: chapterInCorso(materia, perCalcolo), istruttore_id: scegliIstruttore(materia.id), aula: '', tipo: 'lezione', note: '' }]);
    setAperto(id);
  };

  const modifica = (id: string, nuovi: Partial<CampiLezione>) => setBozza(correnti.map((x) => (x.id === id ? { ...x, ...nuovi } : x)));
  /** Toglie la lezione: se nel periodo ne restano altre si passa alla prima. */
  const togli = (l: CampiLezione) => {
    setBozza(correnti.filter((x) => x.id !== l.id));
    setAperto(delPeriodo(l.data, l.ordine).find((x) => x.id !== l.id)?.id ?? null);
  };

  const salva = async () => {
    setAttesa(true);
    const ok = await esegui({ tipo: 'lezioni.sostituisci', corso_id: corso.id, giorni, lezioni: correnti.map(campi) }, 'Programma della settimana salvato');
    setAttesa(false);
    if (ok) setBozza(null);
  };

  const valida = async (valore: boolean) => {
    setAttesa(true);
    await esegui({ tipo: 'settimana.valida', corso_id: corso.id, giorni, valida: valore }, valore ? 'Settimana validata e visibile ai frequentatori' : 'Validazione ritirata');
    setAttesa(false);
  };

  const vaiA = (delta: number) => {
    setBozza(null);
    aggiornaQuery({ w: sommaGiorni(lunedi, delta * 7) });
  };

  /** Il programma sul modulo ufficiale, da stampare in PDF da Excel. */
  const esporta = async () => {
    try {
      const { esportaSettimana } = await import('../../moduloSettimana');
      await esportaSettimana(dati, corso, lunedi, correnti);
    } catch (e) {
      notifications.show({ color: 'rosso', title: 'Excel non creato', message: messaggioErrore(e) });
    }
  };

  const inModifica = correnti.find((l) => l.id === aperto);
  const materiaInModifica = inModifica && conMateria(inModifica.tipo) ? materiaDi(programma, inModifica.materia) : undefined;
  const compagne = inModifica ? delPeriodo(inModifica.data, inModifica.ordine) : [];
  const liberiInModifica = inModifica ? liberi(inModifica.data, inModifica.ordine) : 0;

  /** Contenuto di un periodo: per ogni lezione modulo, chapter, titolo e istruttore; se sono più d'una, una riga ciascuna con il suo orario. */
  const Periodo = ({ data, ordine }: { data: string; ordine: number }) => {
    const parti = delPeriodo(data, ordine);
    if (!parti.length) {
      return guida ? (
        <button type="button" className="periodo vuoto" onClick={() => aggiungi(data, ordine)} aria-label={`Compila il periodo ${ordine + 1} di ${formatoDataBreve(data)}`}>
          <IconPlus size={15} aria-hidden />
        </button>
      ) : (
        <div className="periodo vuoto" aria-label="periodo libero" />
      );
    }
    const diviso = parti.length > 1;
    return (
      <div className={`periodo-parti ${diviso ? 'diviso' : ''}`}>
        {parti.map((l) => {
          const o = orari.get(l.id)!;
          const { materia, chapter, titolo } = contenutoLezione(programma, l);
          const codice = materia ? `${diviso ? '' : `M${materia.modulo} · `}Ch ${chapter}` : SIGLA_PERIODO[l.tipo] || ETICHETTA_PERIODO[l.tipo];
          const istruttore = (
            <span className={`periodo-istruttore ${l.istruttore_id ? '' : conMateria(l.tipo) ? 'rosso' : 'debole'}`}>
              {l.istruttore_id ? cognome(l.istruttore_id) : conMateria(l.tipo) ? 'da assegnare' : '—'}
            </span>
          );
          const contenuto = diviso ? (
            <>
              <span className="cifre debole">{o.inizio}</span>
              <span className="codice-materia">{codice}</span>
              <span className="periodo-materia">{titolo}</span>
              {istruttore}
            </>
          ) : (
            <>
              <span className="periodo-testa">
                <span className="codice-materia">{codice}</span>
                {l.tipo === 'recupero' && <span className="segno-recupero">REC</span>}
                {l.minuti !== MINUTI_PERIODO && <span className="debole durata">{formatoMinuti(l.minuti)}</span>}
              </span>
              <span className="periodo-materia">{titolo}</span>
              {istruttore}
            </>
          );
          // chi è collegato riconosce a colpo d'occhio le proprie lezioni
          const classi = ['periodo', diviso && 'parte', l.tipo !== 'lezione' && `t-${l.tipo}`, l.istruttore_id === utente.id && 'mia'].filter(Boolean).join(' ');
          return guida ? (
            <button key={l.id} type="button" className={classi} onClick={() => setAperto(l.id)} title={`${o.inizio}–${o.fine} · ${titolo} · ${l.aula || corso.aula}`}>
              {contenuto}
            </button>
          ) : (
            <div key={l.id} className={classi} title={`${o.inizio}–${o.fine} · ${titolo} · ${l.aula || corso.aula}`}>
              {contenuto}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <IntestazionePagina
        titolo="Programma settimanale"
        sotto={`${corso.codice} · ${corso.mds} ${corso.categoria}`}
        azioni={
          <>
            {guida && (
              <>
                <Button variant="default" size="sm" leftSection={<IconWand size={16} />} onClick={genera} disabled={stato.totale.residui === 0}>
                  Genera
                </Button>
                <Button size="sm" onClick={() => void salva()} loading={attesa} disabled={!modificata}>
                  Salva
                </Button>
              </>
            )}
            {/* il modulo riporta i nominativi del corso: lo scarica solo chi lo segue, non i frequentatori */}
            {ruolo !== 'trainee' && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="default" size="lg" aria-label="Altre azioni">
                    <IconDots size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {guida &&
                    (validata ? (
                      <Menu.Item leftSection={<IconLockOpen size={16} />} onClick={() => void valida(false)}>
                        Ritira la validazione
                      </Menu.Item>
                    ) : (
                      <Menu.Item leftSection={<IconLock size={16} />} onClick={() => void valida(true)} disabled={!salvate.length || modificata}>
                        Valida la settimana
                      </Menu.Item>
                    ))}
                  <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={() => void esporta()} disabled={!correnti.length}>
                    Programma settimanale in Excel
                  </Menu.Item>
                  {guida && (
                    <Menu.Item color="rosso" leftSection={<IconEraser size={16} />} onClick={() => setBozza([])} disabled={!correnti.length}>
                      Svuota la settimana
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </>
        }
      />

      <div className="settimana-testa">
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="default" size="md" aria-label="Settimana precedente" onClick={() => vaiA(-1)}>
            <IconChevronLeft size={17} />
          </ActionIcon>
          <div className="cifre" style={{ fontWeight: 600, minWidth: 108, textAlign: 'center' }}>
            {formatoDataBreve(giorni[0])}–{formatoDataBreve(giorni[4])}
          </div>
          <ActionIcon variant="default" size="md" aria-label="Settimana successiva" onClick={() => vaiA(1)}>
            <IconChevronRight size={17} />
          </ActionIcon>
          <Button variant="subtle" size="compact-sm" onClick={() => { setBozza(null); aggiornaQuery({ w: null }); }}>
            Oggi
          </Button>
          {settimana && <span className="etichetta">{settimana}ª settimana</span>}
          {salvate.length > 0 && (
            <Badge size="sm" color={validata ? 'inchiostro' : 'rosso'} variant="light">
              {validata ? 'validata' : 'da validare'}
            </Badge>
          )}
        </Group>
        <div className="conto-scalare mtt">
          <span className="etichetta">Restano</span>
          <b className="cifre">{ore(stato.totale.residui)}</b>
          <span className="debole">di {ore(stato.totale.minuti)}</span>
        </div>
      </div>

      {/* PC: griglia periodi × giorni */}
      <div className="griglia-settimana solo-schermo-largo" style={{ gridTemplateColumns: `62px repeat(5, minmax(0, 1fr))` }}>
        <div className="g-angolo" />
        {giorni.map((data, i) => (
          <div key={data} className="g-giorno">
            {NOMI_GIORNI[i]} <span className="cifre debole">{formatoDataBreve(data)}</span>
          </div>
        ))}
        {ORARI_PERIODI.map((inizio, ordine) => (
          <div key={ordine} style={{ display: 'contents' }}>
            <div className="g-ora">
              <span className="cifre">{ordine + 1}°</span>
              <span className="cifre debole">{inizio}</span>
            </div>
            {giorni.map((data, i) =>
              ordine < periodiDelGiorno(i) ? (
                <div key={data} className="g-cella">
                  <Periodo data={data} ordine={ordine} />
                </div>
              ) : (
                <div key={data} className="g-cella chiusa" />
              ),
            )}
          </div>
        ))}
      </div>

      {/* Cellulare: per ogni giorno solo materia e istruttore */}
      <div className="settimana-mobile solo-schermo-stretto">
        {giorni.map((data, i) => (
          <section key={data} className="giorno-mobile">
            <header>
              {NOMI_GIORNI[i]} <span className="cifre debole">{formatoDataBreve(data)}</span>
            </header>
            {ORARI_PERIODI.slice(0, periodiDelGiorno(i)).map((inizio, ordine) => (
              <div key={ordine} className="riga-periodo">
                <span className="cifre debole ora">{inizio}</span>
                <Periodo data={data} ordine={ordine} />
              </div>
            ))}
          </section>
        ))}
      </div>

      {modificata && (
        <Text className="debole" mt="sm" size="sm">
          Modifiche non salvate. Dopo il salvataggio la settimana va validata perché i frequentatori la vedano.
        </Text>
      )}
      {!guida && (
        <Text className="debole" mt="sm" size="sm">
          Il programma è preparato dal Training Manager o dal direttore del corso.
        </Text>
      )}

      <Drawer
        opened={Boolean(inModifica)}
        onClose={() => setAperto(null)}
        position="right"
        title={inModifica ? `${NOMI_GIORNI[giorni.indexOf(inModifica.data)]} ${formatoDataBreve(inModifica.data)} · ${inModifica.ordine + 1}° periodo` : ''}
      >
        {inModifica && (
          <Stack gap="sm">
            {compagne.length > 1 && (
              <SegmentedControl
                fullWidth
                aria-label="Lezioni del periodo"
                value={inModifica.id}
                onChange={setAperto}
                data={compagne.map((l) => ({ value: l.id, label: `${orari.get(l.id)!.inizio} · ${formatoMinuti(l.minuti)}` }))}
              />
            )}
            <Select
              label="Cosa si svolge"
              value={inModifica.tipo}
              onChange={(v) => v && modifica(inModifica.id, { tipo: v as TipoPeriodo })}
              data={TIPI_PERIODO.map((t) => ({ value: t, label: ETICHETTA_PERIODO[t] }))}
              comboboxProps={{ withinPortal: true }}
            />
            {conMateria(inModifica.tipo) && (
              <>
                <Select
                  label="Chapter"
                  description="Solo i chapter previsti dal syllabus: numero e titolo vanno sul programma settimanale."
                  searchable
                  allowDeselect={false}
                  value={materiaInModifica ? `${materiaInModifica.id}|${voceLezione(materiaInModifica, inModifica.chapter).chapter}` : null}
                  onChange={(v) => {
                    if (!v) return;
                    const [materia, chapter] = v.split('|');
                    modifica(inModifica.id, { materia, chapter, istruttore_id: inModifica.istruttore_id ?? scegliIstruttore(materia) });
                  }}
                  data={opzioniChapter}
                  comboboxProps={{ withinPortal: true }}
                />
                <Select
                  label="Istruttore"
                  placeholder="da assegnare"
                  clearable
                  value={inModifica.istruttore_id}
                  onChange={(v) => modifica(inModifica.id, { istruttore_id: v })}
                  data={abilitati(inModifica.materia, inModifica.istruttore_id).map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
                  comboboxProps={{ withinPortal: true }}
                />
              </>
            )}
            {inModifica.tipo !== 'sospensione' && (
              <Autocomplete
                label="Aula"
                description="Vuota = aula del corso."
                placeholder={corso.aula || 'aula del corso'}
                value={inModifica.aula}
                onChange={(aula) => modifica(inModifica.id, { aula })}
                data={aule}
                maxLength={40}
                comboboxProps={{ withinPortal: true }}
              />
            )}
            <Select
              label="Durata"
              description={`Dalle ${orari.get(inModifica.id)!.inizio} alle ${orari.get(inModifica.id)!.fine}. Il periodo è di un’ora: accorciando la lezione resta posto per un’altra.`}
              value={String(inModifica.minuti)}
              onChange={(v) => v && modifica(inModifica.id, { minuti: Number(v) })}
              data={DURATE.filter((m) => m <= inModifica.minuti + liberiInModifica).map((m) => ({ value: String(m), label: formatoMinuti(m) }))}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            <Textarea label="Note" autosize minRows={2} maxLength={300} value={inModifica.note} onChange={(e) => modifica(inModifica.id, { note: e.currentTarget.value })} />
            <Button variant="default" leftSection={<IconPlus size={16} />} disabled={liberiInModifica < DURATE[0]} onClick={() => aggiungi(inModifica.data, inModifica.ordine)}>
              {liberiInModifica < DURATE[0] ? 'Altra lezione nel periodo: prima accorcia questa' : `Altra lezione nel periodo · ${formatoMinuti(liberiInModifica)} liberi`}
            </Button>
            <Group justify="space-between" mt="xs">
              <Button variant="subtle" color="rosso" leftSection={<IconTrash size={16} />} onClick={() => togli(inModifica)}>
                Togli la lezione
              </Button>
              <Button onClick={() => setAperto(null)}>Fatto</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
