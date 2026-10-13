import { useState } from 'react';
import { Button, Checkbox, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash, IconUserOff, IconUserPlus } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { oggiISO, ruoloNelCorso } from '../../dominio/motore';
import { programmaPratico, programmaTeorico } from '../../dominio/programmi';
import type { Iscrizione } from '../../dominio/tipi';
import { chiaveOrdine, formatoData, formatoFine, frequentatori, istruttoriPratica, nomeDirettore, nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { CassettoCorso } from './Corsi';
import { FormTraining } from './Dati';
import { link, ricordaFrequentatore, useCorso } from '../navigazione';
import { useStato } from '../stato';

/** Dati del corso, frequentatori assegnati (ed esclusi), istruttori e Practical Type Training Data dell'intero corso. */
export function Corso() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const [nuovo, setNuovo] = useState<string | null>(null);
  const [scelti, setScelti] = useState<string[]>([]);
  const [modifica, setModifica] = useState(false);
  const [esclusione, setEsclusione] = useState<{ iscrizione: Iscrizione; data: string } | null>(null);
  if (!dati || !utente || !corso) return null;
  const mio = ruoloNelCorso(dati, utente, corso.id);
  const guida = mio === 'admin' || mio === 'direttore';
  const iscrizioneDi = (userId: string) => dati.iscrizioni.find((i) => i.corso_id === corso.id && i.user_id === userId && i.ruolo === 'trainee')!;
  // al corso si assegnano i frequentatori: gli istruttori no (direttore e fase pratica stanno nei dati del corso)
  const assegnabili = dati.utenti
    .filter((u) => u.attivo && u.ruolo === 'trainee' && !dati.iscrizioni.some((i) => i.corso_id === corso.id && i.user_id === u.id))
    .sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));
  const allievi = frequentatori(dati, corso.id, { disattivati: true });
  const esclusi = frequentatori(dati, corso.id, { disattivati: true, esclusi: true }).filter((u) => iscrizioneDi(u.id).escluso_il);
  const pratica = istruttoriPratica(dati, corso);
  const direttore = nomeDirettore(dati, corso);

  return (
    <>
      <IntestazionePagina
        titolo={corso.nome}
        sotto={[corso.codice, `${formatoData(corso.data_inizio)} – ${formatoFine(corso)}`, corso.durata_settimane && `${corso.durata_settimane} settimane`, corso.location || 'sede da definire', corso.aula]
          .filter(Boolean)
          .join(' · ')}
        azioni={
          guida ? (
            <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setModifica(true)}>
              Modifica corso
            </Button>
          ) : undefined
        }
      />
      {!corso.attivo && (
        <p className="avviso-escluso" role="note">
          Corso completato il {formatoData(corso.data_chiusura)}: resta consultabile in ogni sua parte, ogni modifica chiede conferma.
        </p>
      )}

      <div className="cartiglio riepilogo-corso">
        <div>
          <span className="etichetta">Parte teorica</span>
          <div className="valore">{programmaTeorico(corso.programma_teorico)?.nome ?? '—'}</div>
        </div>
        <div>
          <span className="etichetta">Parte pratica</span>
          <div className="valore">{programmaPratico(corso.programma_pratico)?.nome ?? '—'}</div>
        </div>
        <div>
          <span className="etichetta">Direttore del corso</span>
          <div className="valore">{direttore || 'da assegnare'}</div>
        </div>
      </div>

      <Sezione titolo={`Frequentatori · ${allievi.length}`}>
        {guida && (
          <Group align="flex-end" gap="sm" mb="md" className="non-stampare">
            <Select
              label="Assegna al corso"
              description="Solo i frequentatori: il direttore e gli istruttori della fase pratica si scelgono in «Modifica corso»."
              placeholder="Scegli un frequentatore"
              searchable
              value={nuovo}
              onChange={setNuovo}
              data={assegnabili.map((u) => ({ value: u.id, label: `${nomeUtente(dati, u.id)} · ${u.username}` }))}
              comboboxProps={{ withinPortal: true }}
              style={{ flex: '1 1 260px' }}
              nothingFoundMessage="Nessun frequentatore da assegnare"
            />
            <Button
              leftSection={<IconPlus size={17} />}
              disabled={!nuovo}
              onClick={async () => {
                if (nuovo && (await esegui({ tipo: 'corso.iscrivi', iscrizione: { id: nuovoUuid(), corso_id: corso.id, user_id: nuovo } }, 'Assegnato al corso'))) setNuovo(null);
              }}
            >
              Assegna
            </Button>
          </Group>
        )}
        {allievi.length === 0 ? (
          <p className="debole" style={{ margin: 0 }}>
            Nessun frequentatore assegnato.
          </p>
        ) : (
          <ul className="elenco-iscritti">
            {allievi.map((u) => (
              <li key={u.id}>
                <span>
                  <strong>{nomeUtente(dati, u.id)}</strong>
                  <span className="debole" style={{ display: 'block', fontSize: 'var(--fs-s)' }}>
                    {u.username}
                    {u.attivo ? '' : ' · account disattivato'}
                  </span>
                </span>
                {guida && (
                  <Group gap={4} wrap="nowrap">
                    <Button size="compact-sm" variant="subtle" color="rosso" leftSection={<IconUserOff size={15} />} onClick={() => setEsclusione({ iscrizione: iscrizioneDi(u.id), data: oggiISO() })}>
                      Escludi
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="subtle"
                      color="rosso"
                      aria-label={`Togli ${u.username} dal corso`}
                      title="Toglie l'assegnazione (solo se non ha ancora registrazioni né presenze)"
                      onClick={() => void esegui({ tipo: 'corso.disiscrivi', id: iscrizioneDi(u.id).id }, 'Tolto dal corso')}
                    >
                      <IconTrash size={16} />
                    </Button>
                  </Group>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sezione>

      {esclusi.length > 0 && (
        <Sezione titolo={`Esclusi dal corso · ${esclusi.length}`}>
          <Text className="debole" size="sm" mb="sm">
            Dal giorno dell’esclusione non compaiono più nel programma né nelle presenze; i loro dati restano consultabili, fermi a quel giorno.
          </Text>
          <ul className="elenco-iscritti">
            {esclusi.map((u) => {
              const i = iscrizioneDi(u.id);
              return (
                <li key={u.id}>
                  <span>
                    <strong>{nomeUtente(dati, u.id)}</strong>
                    <span className="rosso" style={{ display: 'block', fontSize: 'var(--fs-s)' }}>
                      escluso dal {formatoData(i.escluso_il)}
                    </span>
                  </span>
                  <Group gap={4} wrap="nowrap">
                    <Button component="a" size="compact-sm" variant="subtle" href={link(corso.programma_pratico ? '/tavola' : '/dati', corso, u.id)} onClick={() => ricordaFrequentatore(u.id)}>
                      Dati storici
                    </Button>
                    {guida && (
                      <>
                        <Button size="compact-sm" variant="subtle" onClick={() => setEsclusione({ iscrizione: i, data: i.escluso_il ?? oggiISO() })}>
                          Data
                        </Button>
                        <Button size="compact-sm" variant="subtle" leftSection={<IconUserPlus size={15} />} onClick={() => void esegui({ tipo: 'corso.escludi', id: i.id, data: null }, 'Riammesso al corso')}>
                          Riammetti
                        </Button>
                      </>
                    )}
                  </Group>
                </li>
              );
            })}
          </ul>
        </Sezione>
      )}

      {corso.programma_pratico && (
        <Sezione titolo="Fase pratica">
          <div className="griglia-2">
            <div>
              <Text className="etichetta" mb={6}>
                Istruttori della fase pratica · {pratica.length}
              </Text>
              {pratica.length === 0 ? (
                <p className="debole" style={{ margin: 0 }}>
                  Nessuno: si nominano in «Modifica corso».
                </p>
              ) : (
                <ul className="elenco-iscritti">
                  {pratica.map((u) => (
                    <li key={u.id}>
                      <strong>{nomeUtente(dati, u.id)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Text className="etichetta" mb={6}>
                Aeromobili disponibili · {corso.aeromobili.length}
              </Text>
              <p className={corso.aeromobili.length ? 'cifre' : 'debole'} style={{ margin: 0 }}>
                {corso.aeromobili.join(' · ') || 'Nessuno: si inseriscono in «Modifica corso».'}
              </p>
            </div>
          </div>
        </Sezione>
      )}

      {guida && corso.programma_pratico && (
        <Sezione titolo="Practical type training data del corso">
          <div className="griglia-2">
            <div>
              <Text className="etichetta" mb={6}>
                Frequentatori
              </Text>
              <Checkbox
                label="Tutto il corso"
                checked={scelti.length === allievi.length && allievi.length > 0}
                indeterminate={scelti.length > 0 && scelti.length < allievi.length}
                onChange={(e) => setScelti(e.currentTarget.checked ? allievi.map((u) => u.id) : [])}
                mb="sm"
              />
              <Stack gap={8}>
                {allievi.map((u) => (
                  <Checkbox key={u.id} label={nomeUtente(dati, u.id)} checked={scelti.includes(u.id)} onChange={(e) => setScelti(e.currentTarget.checked ? [...scelti, u.id] : scelti.filter((x) => x !== u.id))} />
                ))}
              </Stack>
            </div>
            <div>
              <Text className="etichetta" mb={6}>
                Dati da salvare
              </Text>
              <FormTraining key={scelti.join()} corso={corso} userIds={scelti} sola={false} dopo={() => setScelti([])} />
              <Text size="xs" c="dimmed" mt="sm">
                I campi proposti sono quelli del primo frequentatore selezionato, altrimenti quelli del corso.
              </Text>
            </div>
          </div>
        </Sezione>
      )}

      <CassettoCorso corso={modifica ? corso : null} chiudi={() => setModifica(false)} />

      <Modal opened={esclusione != null} onClose={() => setEsclusione(null)} title={<span className="titolo-sezione">Esclusione dal corso</span>} centered>
        {esclusione && (
          <Stack gap="md">
            <Text>
              <strong>{nomeUtente(dati, esclusione.iscrizione.user_id)}</strong> esce dal corso dal giorno indicato: da allora non compare più nel programma, non rientra nelle presenze e la sua
              parte pratica resta ferma a quel giorno. I dati storici restano consultabili.
            </Text>
            <TextInput type="date" label="Data di esclusione" value={esclusione.data} onChange={(e) => setEsclusione({ ...esclusione, data: e.currentTarget.value })} required />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEsclusione(null)}>
                Annulla
              </Button>
              <Button
                color="rosso"
                disabled={!esclusione.data}
                onClick={async () => {
                  if (await esegui({ tipo: 'corso.escludi', id: esclusione.iscrizione.id, data: esclusione.data }, 'Frequentatore escluso dal corso')) setEsclusione(null);
                }}
              >
                Escludi dal corso
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
