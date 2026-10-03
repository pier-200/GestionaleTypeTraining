import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Drawer, Group, Menu, Select, Stack, Text, Textarea } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconDots, IconEraser, IconFileSpreadsheet, IconLock, IconLockOpen, IconPlus, IconTrash, IconWand } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { esportaSettimana } from '../../esporta';
import { oggiISO, ruoloNelCorso, TIPI_PERIODO, type CampiLezione } from '../../dominio/motore';
import { MINUTI_PERIODO, NOMI_GIORNI, generaSettimana, giorniSettimana, lunediDi, orarioLezione, periodiDelGiorno, sommaGiorni, statoTeorico } from '../../dominio/pianificazione';
import { chapterMateria, materiaDi, oreDaMinuti, programmaTeorico, type Materia } from '../../dominio/programmi';
import { conMateria, ETICHETTA_PERIODO, SIGLA_PERIODO, type Lezione, type TipoPeriodo } from '../../dominio/tipi';
import { docenti, formatoDataBreve, formatoMinuti, lezioniVisibili, nomeUtente, ore } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { useCampoVisibile } from '../componenti/tastiera';
import { useCorso } from '../navigazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';

/** Durate proponibili per un periodo: quarti d'ora fino a due ore. */
const DURATE = [15, 30, 45, 60, 75, 90, 105, 120];

/** Cognome dell'istruttore: nella griglia basta quello. */
const cognome = (nome: string) => nome.split(' ').filter(Boolean).at(-1) ?? nome;

/** Programma settimanale: una griglia di periodi (6 dal lunedì al giovedì, 3 il venerdì) da compilare. */
export function Settimana() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const { query } = usePosizione();
  const [bozza, setBozza] = useState<CampiLezione[] | null>(null);
  const [aperto, setAperto] = useState<{ data: string; ordine: number } | null>(null);
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
  const salvate = lezioni.filter((l) => giorni.includes(l.data));
  const fuori = lezioni.filter((l) => !giorni.includes(l.data));
  const campi = (l: Lezione | CampiLezione): CampiLezione => ({
    id: l.id,
    corso_id: l.corso_id,
    data: l.data,
    ordine: l.ordine,
    minuti: l.minuti,
    materia: l.materia,
    istruttore_id: l.istruttore_id,
    tipo: l.tipo,
    note: l.note,
  });
  const correnti: CampiLezione[] = bozza ?? salvate.map(campi);
  const modificata = bozza != null && JSON.stringify(bozza) !== JSON.stringify(salvate.map(campi));
  const validata = salvate.length > 0 && salvate.every((l) => l.validata);
  const periodiMax = Math.max(...corso.minuti_giorno.map((_, i) => periodiDelGiorno(corso.minuti_giorno, i)), 1);

  /** Lezioni "virtuali" per i calcoli: quelle fuori settimana più la bozza corrente. */
  const perCalcolo = [...fuori, ...correnti.map((l) => ({ ...l, validata: false, validata_da: null, validata_il: null, creato_il: '', modificato_il: '', modificato_da: null }) as Lezione)];
  const stato = statoTeorico(programma, perCalcolo, oggiISO());
  const trova = (data: string, ordine: number) => correnti.find((l) => l.data === data && l.ordine === ordine);

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

  const opzioniMaterie = programma.materie.map((m) => {
    const residuo = stato.materie.find((r) => r.materia.id === m.id)?.residui ?? 0;
    return { value: m.id, label: `M${m.modulo} · ${chapterMateria(m)} · ${m.titolo}${residuo ? ` — restano ${oreDaMinuti(residuo)}` : ''}` };
  });

  const genera = () => {
    const pesi = carico();
    const proposte = generaSettimana(programma, perCalcolo, lunedi, { minutiGiorno: corso.minuti_giorno, istruttorePerMateria: (m: Materia) => scegliIstruttore(m.id, pesi) });
    if (!proposte.length) return;
    for (const p of proposte) if (p.istruttore_id) pesi.set(p.istruttore_id, (pesi.get(p.istruttore_id) ?? 0) + p.minuti);
    setBozza([...correnti, ...proposte.map((p) => ({ id: nuovoUuid(), corso_id: corso.id, data: p.data, ordine: p.ordine, minuti: p.minuti, materia: p.materia, istruttore_id: p.istruttore_id, tipo: 'lezione' as TipoPeriodo, note: '' }))]);
  };

  /** Compila un periodo ancora vuoto con la materia successiva del programma. */
  const aggiungi = (data: string, ordine: number) => {
    const materia = stato.prossima?.id ?? programma.materie[0].id;
    setBozza([...correnti, { id: nuovoUuid(), corso_id: corso.id, data, ordine, minuti: MINUTI_PERIODO, materia, istruttore_id: scegliIstruttore(materia), tipo: 'lezione', note: '' }]);
    setAperto({ data, ordine });
  };

  const modifica = (id: string, nuovi: Partial<CampiLezione>) => setBozza(correnti.map((x) => (x.id === id ? { ...x, ...nuovi } : x)));
  const togli = (id: string) => {
    setBozza(correnti.filter((x) => x.id !== id));
    setAperto(null);
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

  /** Orario del periodo: i periodi mancanti contano come un'ora piena. */
  const orario = (data: string, ordine: number) => orarioLezione(corso, correnti.filter((l) => l.data === data), ordine);

  const inModifica = aperto ? trova(aperto.data, aperto.ordine) : undefined;

  /** Contenuto di un periodo: modulo, chapter, materia e istruttore. */
  const Periodo = ({ data, ordine }: { data: string; ordine: number }) => {
    const l = trova(data, ordine);
    const o = orario(data, ordine);
    if (!l) {
      return guida ? (
        <button type="button" className="periodo vuoto" onClick={() => aggiungi(data, ordine)} aria-label={`Compila il periodo ${ordine + 1} di ${formatoDataBreve(data)}`}>
          <IconPlus size={15} aria-hidden />
        </button>
      ) : (
        <div className="periodo vuoto" aria-label="periodo libero" />
      );
    }
    const materia = conMateria(l.tipo) ? materiaDi(programma, l.materia) : undefined;
    const contenuto = (
      <>
        <div className="periodo-testa">
          {materia ? (
            <span className="codice-materia">
              M{materia.modulo} · {chapterMateria(materia)}
            </span>
          ) : (
            <span className="codice-materia">{SIGLA_PERIODO[l.tipo] || ETICHETTA_PERIODO[l.tipo]}</span>
          )}
          {l.tipo === 'recupero' && <span className="segno-recupero">REC</span>}
          {l.minuti !== MINUTI_PERIODO && <span className="debole durata">{formatoMinuti(l.minuti)}</span>}
        </div>
        <div className="periodo-materia">{materia ? materia.titolo : ETICHETTA_PERIODO[l.tipo]}</div>
        <div className={`periodo-istruttore ${l.istruttore_id ? '' : conMateria(l.tipo) ? 'rosso' : 'debole'}`}>
          {l.istruttore_id ? cognome(nomeUtente(dati, l.istruttore_id)) : conMateria(l.tipo) ? 'da assegnare' : '—'}
        </div>
      </>
    );
    const classi = `periodo ${l.tipo !== 'lezione' ? `t-${l.tipo}` : ''}`;
    return guida ? (
      <button type="button" className={classi} onClick={() => setAperto({ data, ordine })} title={`${o.inizio}–${o.fine} · ${materia?.titolo ?? ETICHETTA_PERIODO[l.tipo]}`}>
        {contenuto}
      </button>
    ) : (
      <div className={classi}>{contenuto}</div>
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
                <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={() => void esportaSettimana(dati, corso, lunedi, correnti)} disabled={!correnti.length}>
                  Esporta in Excel
                </Menu.Item>
                {guida && (
                  <Menu.Item color="rosso" leftSection={<IconEraser size={16} />} onClick={() => setBozza([])} disabled={!correnti.length}>
                    Svuota la settimana
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
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
        {Array.from({ length: periodiMax }, (_, ordine) => (
          <div key={ordine} style={{ display: 'contents' }}>
            <div className="g-ora">
              <span className="cifre">{ordine + 1}°</span>
              <span className="cifre debole">{orario(giorni[0], ordine).inizio}</span>
            </div>
            {giorni.map((data, i) =>
              ordine < periodiDelGiorno(corso.minuti_giorno, i) ? (
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
            {Array.from({ length: periodiDelGiorno(corso.minuti_giorno, i) }, (_, ordine) => (
              <div key={ordine} className="riga-periodo">
                <span className="cifre debole ora">{orario(data, ordine).inizio}</span>
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
                  label="Materia"
                  searchable
                  value={inModifica.materia}
                  onChange={(v) => v && modifica(inModifica.id, { materia: v, istruttore_id: inModifica.istruttore_id ?? scegliIstruttore(v) })}
                  data={opzioniMaterie}
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
            <Select
              label="Durata"
              value={String(inModifica.minuti)}
              onChange={(v) => v && modifica(inModifica.id, { minuti: Number(v) })}
              data={DURATE.map((m) => ({ value: String(m), label: formatoMinuti(m) }))}
              comboboxProps={{ withinPortal: true }}
            />
            <Textarea label="Note" autosize minRows={2} maxLength={300} value={inModifica.note} onChange={(e) => modifica(inModifica.id, { note: e.currentTarget.value })} />
            <Group justify="space-between" mt="xs">
              <Button variant="subtle" color="rosso" leftSection={<IconTrash size={16} />} onClick={() => togli(inModifica.id)}>
                Svuota il periodo
              </Button>
              <Button onClick={() => setAperto(null)}>Fatto</Button>
            </Group>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
