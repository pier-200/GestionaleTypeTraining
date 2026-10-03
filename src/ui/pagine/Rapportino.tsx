import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, SegmentedControl, Text, TextInput, Textarea } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCircleCheckFilled, IconLock, IconLockOpen } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { oggiISO, ruoloNelCorso, type CampiPresenza } from '../../dominio/motore';
import { assenteAllaLezione, orariLezioni, orarioStandard } from '../../dominio/presenze';
import { NOMI_GIORNI, sommaGiorni } from '../../dominio/pianificazione';
import { materiaDi, programmaTeorico } from '../../dominio/programmi';
import { ETICHETTA_PERIODO, conMateria, type ID } from '../../dominio/tipi';
import { formatoData, formatoMinuti, frequentatori, lezioniVisibili, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useCampoVisibile } from '../componenti/tastiera';
import { useCorso } from '../navigazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';

const indiceGiorno = (data: string) => (new Date(`${data}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Rapportino presenze della giornata: lo compila qualsiasi frequentatore, lo valida chi guida il corso. */
export function Rapportino() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const { query } = usePosizione();
  const [bozza, setBozza] = useState<{ giorno: string; valori: Record<ID, CampiPresenza>; note: string } | null>(null);
  const [attesa, setAttesa] = useState(false);
  useCampoVisibile(true);

  const programma = programmaTeorico(corso?.programma_teorico);
  if (!dati || !utente || !corso || !programma) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const guida = ruolo === 'admin' || ruolo === 'direttore';
  const compila = guida || ruolo === 'trainee' || ruolo === 'instructor';

  const giorno = query.get('g') ?? oggiISO();
  const elenco = frequentatori(dati, corso.id);
  const rapportino = dati.rapportini.find((r) => r.corso_id === corso.id && r.data === giorno);
  const validato = rapportino?.validato_il != null;
  const salvate = dati.presenze.filter((p) => p.corso_id === corso.id && p.data === giorno);
  const delGiorno = lezioniVisibili(dati, corso.id, ruolo).filter((l) => l.data === giorno);
  const orari = orariLezioni(corso, delGiorno);
  const [standardDalle, standardAlle] = orarioStandard(giorno);

  const iniziali = (): Record<ID, CampiPresenza> =>
    Object.fromEntries(
      elenco.map((u) => {
        const p = salvate.find((x) => x.user_id === u.id);
        return [u.id, { id: p?.id ?? nuovoUuid(), user_id: u.id, stato: p?.stato ?? 'presente', dalle: p?.dalle ?? standardDalle, alle: p?.alle ?? standardAlle, motivo: p?.motivo ?? '' }];
      }),
    );
  const corrente = bozza?.giorno === giorno ? bozza : { giorno, valori: iniziali(), note: rapportino?.note ?? '' };
  const modificato = bozza?.giorno === giorno;
  const cambia = (userId: ID, campi: Partial<CampiPresenza>) =>
    setBozza({ ...corrente, valori: { ...corrente.valori, [userId]: { ...corrente.valori[userId], ...campi } } });

  const vaiA = (delta: number) => {
    setBozza(null);
    aggiornaQuery({ g: sommaGiorni(giorno, delta) });
  };

  const salva = async () => {
    setAttesa(true);
    const ok = await esegui(
      { tipo: 'rapportino.salva', corso_id: corso.id, data: giorno, note: corrente.note, presenze: Object.values(corrente.valori) },
      'Rapportino salvato',
    );
    setAttesa(false);
    if (ok) setBozza(null);
  };

  const valida = async (valore: boolean) => {
    setAttesa(true);
    await esegui({ tipo: 'rapportino.valida', corso_id: corso.id, data: giorno, valida: valore }, valore ? 'Rapportino validato' : 'Rapportino riaperto');
    setAttesa(false);
  };

  const presenzaDi = (userId: ID) => {
    const v = corrente.valori[userId];
    return v ? { ...v, corso_id: corso.id, data: giorno } : undefined;
  };
  const orarioDi = (id: ID) => orari.get(id) ?? { inizio: '00:00', fine: '00:00' };
  /** Lezioni perse da un frequentatore secondo la compilazione in corso. */
  const perse = (userId: ID) => delGiorno.filter((l) => l.tipo === 'lezione' && assenteAllaLezione(presenzaDi(userId), orarioDi(l.id)));

  const assenti = elenco.filter((u) => corrente.valori[u.id]?.stato !== 'presente').length;
  const futuro = giorno > oggiISO();
  const bloccato = validato && !guida;

  return (
    <>
      <IntestazionePagina
        titolo="Rapportino presenze"
        sotto={`${corso.nome} · ${NOMI_GIORNI[indiceGiorno(giorno)] ?? 'Fine settimana'} ${formatoData(giorno)}`}
        azioni={
          <>
            {guida &&
              (validato ? (
                <Button variant="default" leftSection={<IconLockOpen size={17} />} onClick={() => void valida(false)} loading={attesa}>
                  Riapri
                </Button>
              ) : (
                <Button variant="default" leftSection={<IconLock size={17} />} onClick={() => void valida(true)} disabled={!rapportino} loading={attesa}>
                  Valida
                </Button>
              ))}
            {compila && (
              <Button onClick={() => void salva()} loading={attesa} disabled={bloccato || futuro || !elenco.length}>
                Salva
              </Button>
            )}
          </>
        }
      />

      <div className="settimana-testa">
        <Group gap={6}>
          <ActionIcon variant="default" size="lg" aria-label="Giorno precedente" onClick={() => vaiA(-1)}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <div className="cifre" style={{ fontWeight: 600, minWidth: 130, textAlign: 'center' }}>
            {formatoData(giorno)}
          </div>
          <ActionIcon variant="default" size="lg" aria-label="Giorno successivo" onClick={() => vaiA(1)}>
            <IconChevronRight size={18} />
          </ActionIcon>
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              setBozza(null);
              aggiornaQuery({ g: null });
            }}
          >
            Oggi
          </Button>
        </Group>
        <div className="conto-scalare mtt">
          <span className="etichetta">Orario standard</span>
          <div>
            <b className="cifre">
              {standardDalle}–{standardAlle}
            </b>{' '}
            <span className="debole">
              {assenti === 0 ? 'tutti presenti' : `${assenti} con annotazioni`} · {delGiorno.length} lezioni
            </span>
          </div>
          {validato ? (
            <Badge color="inchiostro" variant="light" leftSection={<IconCircleCheckFilled size={13} />}>
              validato da {nomeUtente(dati, rapportino?.validato_da)}
            </Badge>
          ) : (
            <Badge color="rosso" variant="light">
              {rapportino ? 'da validare' : 'non compilato'}
            </Badge>
          )}
        </div>
      </div>

      <Sezione titolo={`Frequentatori · ${elenco.length}`}>
        {futuro && <Text className="debole">Il rapportino si compila a giornata conclusa: questa data è futura.</Text>}
        {!elenco.length && <Text className="debole">Nessun frequentatore iscritto al corso.</Text>}
        <div className="rapportino">
          {elenco.map((u) => {
            const v = corrente.valori[u.id];
            const mancate = perse(u.id);
            return (
              <article key={u.id} className={`riga-presenza ${v?.stato === 'assente' ? 'assente' : v?.stato === 'parziale' ? 'parziale' : ''}`}>
                <div className="chi">
                  <strong>{nomeUtente(dati, u.id)}</strong>
                  <span className="debole cifre">{u.username}</span>
                </div>
                <SegmentedControl
                  size="xs"
                  value={v?.stato ?? 'presente'}
                  onChange={(s) => cambia(u.id, { stato: s as CampiPresenza['stato'] })}
                  disabled={bloccato || !compila}
                  data={[
                    { label: 'Presente', value: 'presente' },
                    { label: 'Parziale', value: 'parziale' },
                    { label: 'Assente', value: 'assente' },
                  ]}
                  aria-label={`Presenza di ${nomeUtente(dati, u.id)}`}
                />
                {v?.stato === 'parziale' && (
                  <Group gap={6} wrap="nowrap">
                    <TextInput
                      size="xs"
                      type="time"
                      aria-label="Dalle"
                      value={v.dalle ?? ''}
                      onChange={(e) => cambia(u.id, { dalle: e.currentTarget.value })}
                      disabled={bloccato}
                      style={{ width: 110 }}
                    />
                    <TextInput
                      size="xs"
                      type="time"
                      aria-label="Alle"
                      value={v.alle ?? ''}
                      onChange={(e) => cambia(u.id, { alle: e.currentTarget.value })}
                      disabled={bloccato}
                      style={{ width: 110 }}
                    />
                  </Group>
                )}
                {v?.stato !== 'presente' && (
                  <TextInput
                    size="xs"
                    placeholder="Motivo (servizio, visita medica…)"
                    aria-label="Motivo"
                    value={v?.motivo ?? ''}
                    onChange={(e) => cambia(u.id, { motivo: e.currentTarget.value })}
                    disabled={bloccato}
                  />
                )}
                <div className="perse">
                  {mancate.length ? (
                    <span className="rosso cifre">
                      {mancate.length} lezioni perse · {formatoMinuti(mancate.reduce((s, l) => s + l.minuti, 0))}
                    </span>
                  ) : (
                    <span className="debole cifre">nessuna lezione persa</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <Textarea
          mt="md"
          label="Note della giornata"
          autosize
          minRows={2}
          maxLength={300}
          value={corrente.note}
          onChange={(e) => setBozza({ ...corrente, note: e.currentTarget.value })}
          disabled={bloccato || !compila}
        />
        {modificato && (
          <Text className="debole" mt="sm">
            Modifiche non ancora salvate.
          </Text>
        )}
        {bloccato && (
          <Text className="debole" mt="sm">
            Rapportino validato: per correggerlo chiedere la riapertura al direttore del corso.
          </Text>
        )}
      </Sezione>

      <Sezione titolo={`Lezioni del giorno · ${delGiorno.length}`}>
        {!delGiorno.length ? (
          <Text className="debole">Nessuna lezione a programma in questa giornata.</Text>
        ) : (
          <div className="scorre">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Orario</th>
                  <th>Materia</th>
                  <th>Istruttore</th>
                  <th className="num">Durata</th>
                  <th>Assenti</th>
                </tr>
              </thead>
              <tbody>
                {delGiorno.map((l) => {
                  const o = orari.get(l.id);
                  const mancanti = elenco.filter((u) => assenteAllaLezione(presenzaDi(u.id), orarioDi(l.id)));
                  return (
                    <tr key={l.id}>
                      <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                        {o?.inizio}–{o?.fine}
                      </td>
                      <td>
                        <strong>{(conMateria(l.tipo) ? materiaDi(programma, l.materia)?.titolo : ETICHETTA_PERIODO[l.tipo]) ?? l.materia}</strong>
                        {l.tipo !== 'lezione' && (
                          <Badge ml={6} size="xs" color="inchiostro" variant="light">
                            {ETICHETTA_PERIODO[l.tipo].toLowerCase()}
                          </Badge>
                        )}
                      </td>
                      <td>{nomeUtente(dati, l.istruttore_id)}</td>
                      <td className="num">{formatoMinuti(l.minuti)}</td>
                      <td className={mancanti.length ? 'rosso' : 'debole'}>
                        {l.tipo !== 'lezione' ? 'non conta assenze' : mancanti.length ? mancanti.map((u) => nomeUtente(dati, u.id)).join(', ') : 'nessuno'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Sezione>
    </>
  );
}
